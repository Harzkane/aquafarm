import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { getPlanConfig } from "@/lib/plans";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const user = await User.findById((session.user as any).id)
    .select(
      "plan role billingStatus trialEndsAt billingExpiresAt cancelAtPeriodEnd cancellationRequestedAt canceledAt scheduledPlan successOnboardingStatus successOnboardingCompletedAt successOnboardingNotes successCheckInLastAt successCheckInNextAt successCheckInHistory"
    )
    .lean<any>();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const plan = getPlanConfig(user.plan);
  let staffUsers = 0;
  if (plan.maxStaffUsers !== null && user.role !== "staff") {
    staffUsers = await User.countDocuments({
      role: "staff",
      farmOwnerId: user._id,
    });
  }

  return NextResponse.json({
    plan: plan.key,
    planLabel: plan.label,
    role: user.role === "staff" ? "staff" : "owner",
    canManageStaff: plan.key === "commercial" && user.role !== "staff",
    limits: {
      maxActiveBatches: plan.maxActiveBatches,
      maxTanks: plan.maxTanks,
      maxStaffUsers: plan.maxStaffUsers,
      reportHistoryDays: plan.reportHistoryDays,
    },
    usage: {
      staffUsers,
    },
    billingStatus: user.billingStatus || "inactive",
    trialEndsAt: user.trialEndsAt || null,
    billingExpiresAt: user.billingExpiresAt || null,
    cancelAtPeriodEnd: Boolean(user.cancelAtPeriodEnd),
    cancellationRequestedAt: user.cancellationRequestedAt || null,
    canceledAt: user.canceledAt || null,
    scheduledPlan: user.scheduledPlan || "",
    successProgram: {
      onboardingStatus: user.successOnboardingStatus || "not_started",
      onboardingCompletedAt: user.successOnboardingCompletedAt || null,
      onboardingNotes: user.successOnboardingNotes || "",
      checkInLastAt: user.successCheckInLastAt || null,
      checkInNextAt: user.successCheckInNextAt || null,
      checkInHistory: (user.successCheckInHistory || []).map((item: any) => ({
        date: item.date,
        notes: item.notes || "",
        actorName: item.actorName || "",
      })),
    },
  });
}
