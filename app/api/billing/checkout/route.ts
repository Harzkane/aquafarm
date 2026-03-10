import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { normalizePlan } from "@/lib/plans";
import { recordAuditEvent } from "@/lib/audit";

const PAYSTACK_ENDPOINT = "https://api.paystack.co/transaction/initialize";

type CheckoutPayload = {
  plan?: "pro" | "commercial";
  returnTo?: "plans" | "billing";
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role === "staff") {
    return NextResponse.json({ error: "Only account owners can manage billing." }, { status: 403 });
  }

  let body: CheckoutPayload = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const targetPlan = normalizePlan(body.plan || "pro");
  const returnTo = body.returnTo === "billing" ? "billing" : "plans";
  if (targetPlan === "free") {
    return NextResponse.json({ error: "Checkout not required for free plan" }, { status: 400 });
  }

  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    return NextResponse.json({ error: "PAYSTACK_SECRET_KEY is not configured" }, { status: 500 });
  }

  const proAmount = Number(process.env.PAYSTACK_PRO_AMOUNT_KOBO || 500000); // ₦5,000
  const commercialAmount = Number(process.env.PAYSTACK_COMMERCIAL_AMOUNT_KOBO || 1500000); // ₦15,000
  const amount = targetPlan === "commercial" ? commercialAmount : proAmount;
  const appUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  await connectDB();
  const user = await User.findById((session.user as any).id);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const callbackPath = returnTo === "billing" ? "/settings/billing" : "/plans";
  const callbackUrl = `${appUrl}${callbackPath}?checkout=success&plan=${targetPlan}`;
  const payload = {
    email: user.email,
    amount,
    currency: "NGN",
    callback_url: callbackUrl,
    metadata: {
      userId: user._id.toString(),
      targetPlan,
    },
  };

  const response = await fetch(PAYSTACK_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const result = await response.json();

  if (!response.ok || !result?.status || !result?.data?.authorization_url) {
    return NextResponse.json(
      { error: result?.message || "Failed to initialize checkout with Paystack" },
      { status: 502 }
    );
  }

  await recordAuditEvent({
    sessionUser: session.user,
    action: "billing_checkout_initialized",
    resource: "billing",
    resourceId: user._id.toString(),
    summary: `Initialized ${targetPlan} checkout`,
    meta: { targetPlan, returnTo },
  }).catch(() => {});

  return NextResponse.json({
    authorizationUrl: result.data.authorization_url as string,
    reference: result.data.reference as string,
    targetPlan,
  });
}
