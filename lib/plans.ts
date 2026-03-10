export type PlanKey = "free" | "pro" | "commercial";

export type PlanConfig = {
  key: PlanKey;
  label: string;
  maxActiveBatches: number | null;
  maxTanks: number | null;
  maxStaffUsers: number | null;
  reportHistoryDays: number | null;
};

export const PLAN_CONFIG: Record<PlanKey, PlanConfig> = {
  free: {
    key: "free",
    label: "Free",
    maxActiveBatches: 1,
    maxTanks: 4,
    maxStaffUsers: null,
    reportHistoryDays: 30,
  },
  pro: {
    key: "pro",
    label: "Pro Founder",
    maxActiveBatches: 5,
    maxTanks: null,
    maxStaffUsers: null,
    reportHistoryDays: null,
  },
  commercial: {
    key: "commercial",
    label: "Pro+ Commercial",
    maxActiveBatches: null,
    maxTanks: null,
    maxStaffUsers: 5,
    reportHistoryDays: null,
  },
};

export function normalizePlan(plan: unknown): PlanKey {
  if (plan === "pro" || plan === "commercial") return plan;
  return "free";
}

export function getPlanConfig(plan: unknown): PlanConfig {
  const key = normalizePlan(plan);
  return PLAN_CONFIG[key];
}
