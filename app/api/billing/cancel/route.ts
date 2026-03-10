import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { recordAuditEvent } from "@/lib/audit";

const PAYSTACK_DISABLE_ENDPOINT = "https://api.paystack.co/subscription/disable";

type CancelMode = "cancel" | "downgrade";

function isNonFatalDisableMessage(message: string) {
  const m = message.toLowerCase();
  return (
    m.includes("already inactive") ||
    m.includes("not found") ||
    m.includes("subscription with code not found") ||
    m.includes("does not exist")
  );
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role === "staff") {
    return NextResponse.json({ error: "Only account owners can manage billing." }, { status: 403 });
  }

  let mode: CancelMode = "cancel";
  try {
    const body = await req.json();
    if (body?.mode === "downgrade") mode = "downgrade";
  } catch {
    // default mode
  }

  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return NextResponse.json({ error: "PAYSTACK_SECRET_KEY is not configured" }, { status: 500 });

  await connectDB();
  const user = await User.findById((session.user as any).id);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (user.plan === "free") {
    return NextResponse.json({ error: "You are already on the Free plan" }, { status: 400 });
  }

  if (mode === "cancel" && user.cancelAtPeriodEnd) {
    return NextResponse.json({
      ok: true,
      mode,
      billingStatus: user.billingStatus,
      plan: user.plan,
      cancelAtPeriodEnd: true,
      providerSkipped: true,
    });
  }

  const hasSubscriptionDetails = Boolean(user.paystackSubscriptionCode && user.paystackEmailToken);
  if (!hasSubscriptionDetails && mode === "cancel") {
    return NextResponse.json(
      { error: "Subscription details are missing. Please contact support to cancel billing safely." },
      { status: 400 }
    );
  }

  let providerResult: any = null;
  let providerWarning = "";
  if (hasSubscriptionDetails) {
    try {
      const disableRes = await fetch(PAYSTACK_DISABLE_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: user.paystackSubscriptionCode,
          token: user.paystackEmailToken,
        }),
      });
      providerResult = await disableRes.json();
      if (!disableRes.ok || !providerResult?.status) {
        const msg = String(providerResult?.message || "Unable to cancel subscription at provider right now");
        if (isNonFatalDisableMessage(msg)) {
          providerWarning = msg;
        } else {
          return NextResponse.json({ error: msg }, { status: 502 });
        }
      }
    } catch {
      return NextResponse.json({ error: "Unable to reach payment provider. Please retry shortly." }, { status: 502 });
    }
  } else {
    providerWarning = "Subscription details missing at provider; local downgrade applied.";
  }

  const now = new Date();
  if (mode === "downgrade") {
    user.plan = "free";
    user.billingStatus = "canceled";
    user.cancelAtPeriodEnd = false;
    user.cancellationRequestedAt = now;
    user.canceledAt = now;
    user.scheduledPlan = "";
    user.billingExpiresAt = now;
    user.paystackSubscriptionCode = "";
    user.paystackEmailToken = "";
  } else {
    user.cancelAtPeriodEnd = true;
    user.cancellationRequestedAt = now;
    user.scheduledPlan = "free";
    user.paystackSubscriptionCode = "";
    user.paystackEmailToken = "";
  }

  await user.save();

  await recordAuditEvent({
    sessionUser: session.user,
    action: mode === "downgrade" ? "billing_downgrade_now" : "billing_cancel_autorenew",
    resource: "billing",
    resourceId: user._id.toString(),
    summary:
      mode === "downgrade"
        ? "Downgraded plan to Free immediately"
        : "Canceled auto-renew for current subscription",
    meta: { mode, resultingPlan: user.plan, cancelAtPeriodEnd: user.cancelAtPeriodEnd },
  }).catch(() => {});

  return NextResponse.json({
    ok: true,
    mode,
    billingStatus: user.billingStatus,
    plan: user.plan,
    cancelAtPeriodEnd: user.cancelAtPeriodEnd,
    providerWarning,
  });
}
