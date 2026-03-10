import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { recordAuditEvent } from "@/lib/audit";
import { computeBillingReconcile } from "@/lib/billing-reconcile";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role === "staff") {
    return NextResponse.json({ error: "Only account owners can reconcile billing." }, { status: 403 });
  }

  let dryRun = false;
  try {
    const body = await req.json();
    dryRun = Boolean(body?.dryRun);
  } catch {
    // allow empty body
  }

  await connectDB();
  const user = await User.findById((session.user as any).id);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const now = new Date();
  const { actions, patch } = computeBillingReconcile(user, now);

  const hasChanges = actions.length > 0;
  if (hasChanges && !dryRun) {
    await User.findByIdAndUpdate(user._id, { $set: patch });
    await recordAuditEvent({
      sessionUser: session.user,
      action: "billing_reconcile",
      resource: "billing",
      resourceId: user._id.toString(),
      summary: `Applied ${actions.length} billing reconciliation change${actions.length > 1 ? "s" : ""}`,
      meta: { actions },
    }).catch(() => {});
  }

  const refreshed = hasChanges && !dryRun ? await User.findById(user._id).lean<any>() : null;
  return NextResponse.json({
    dryRun,
    changed: hasChanges && !dryRun,
    actions,
    before: {
      plan: user.plan,
      billingStatus: user.billingStatus,
      billingExpiresAt: user.billingExpiresAt || null,
      cancelAtPeriodEnd: Boolean(user.cancelAtPeriodEnd),
      scheduledPlan: user.scheduledPlan || "",
      canceledAt: user.canceledAt || null,
    },
    after: refreshed
      ? {
          plan: refreshed.plan,
          billingStatus: refreshed.billingStatus,
          billingExpiresAt: refreshed.billingExpiresAt || null,
          cancelAtPeriodEnd: Boolean(refreshed.cancelAtPeriodEnd),
          scheduledPlan: refreshed.scheduledPlan || "",
          canceledAt: refreshed.canceledAt || null,
        }
      : null,
  });
}
