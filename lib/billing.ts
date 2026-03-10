import { BillingEvent } from "@/models/BillingEvent";
import { User } from "@/models/User";
import { normalizePlan, PlanKey } from "@/lib/plans";

type ApplyPaymentInput = {
  reference: string;
  userId?: string;
  customerCode?: string;
  targetPlan?: unknown;
  paidAt?: Date;
  source: "webhook" | "verify";
};

export async function markBillingEventProcessed(eventKey: string, eventType: string, reference?: string) {
  const existing = await BillingEvent.findOne({ eventKey }).lean();
  if (existing) return false;
  await BillingEvent.create({ eventKey, eventType, reference });
  return true;
}

export async function hasProcessedBillingEvent(eventKey: string) {
  const existing = await BillingEvent.findOne({ eventKey }).lean();
  return Boolean(existing);
}

export async function applySuccessfulPayment(input: ApplyPaymentInput) {
  const plan: PlanKey = normalizePlan(input.targetPlan || "pro");
  if (plan === "free") return null;
  const paidAt = input.paidAt || new Date();
  const existingUser = input.userId
    ? await User.findById(input.userId).select("plan successOnboardingStatus successCheckInHistory")
    : input.customerCode
      ? await User.findOne({ paystackCustomerCode: input.customerCode }).select("plan successOnboardingStatus successCheckInHistory")
      : null;

  const setFields: any = {
    plan,
    billingStatus: "active",
    planActivatedAt: paidAt,
    billingExpiresAt: null,
    cancelAtPeriodEnd: false,
    cancellationRequestedAt: null,
    canceledAt: null,
    scheduledPlan: "",
  };
  if (plan === "commercial") {
    const shouldInitializeProgram = !existingUser || existingUser.plan !== "commercial";
    if (shouldInitializeProgram) {
      setFields.successOnboardingStatus = "in_progress";
      setFields.successOnboardingCompletedAt = null;
      setFields.successOnboardingNotes = "";
      setFields.successCheckInLastAt = null;
      setFields.successCheckInHistory = [];
      setFields.successCheckInNextAt = new Date(paidAt.getTime() + 30 * 24 * 60 * 60 * 1000);
    } else if (!existingUser.successCheckInHistory?.length) {
      setFields.successCheckInNextAt = new Date(paidAt.getTime() + 30 * 24 * 60 * 60 * 1000);
    }
  }
  if (input.customerCode) setFields.paystackCustomerCode = input.customerCode;

  if (input.userId) {
    return User.findByIdAndUpdate(input.userId, { $set: setFields }, { new: true });
  }
  if (input.customerCode) {
    return User.findOneAndUpdate({ paystackCustomerCode: input.customerCode }, { $set: setFields }, { new: true });
  }
  return null;
}
