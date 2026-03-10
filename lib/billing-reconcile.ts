export type BillingUserShape = {
  plan?: "free" | "pro" | "commercial" | string;
  billingStatus?: "inactive" | "trialing" | "active" | "past_due" | "canceled" | string;
  billingExpiresAt?: Date | string | null;
  cancelAtPeriodEnd?: boolean;
  scheduledPlan?: "" | "free" | "pro" | "commercial" | string;
  canceledAt?: Date | string | null;
};

export type ReconcileAction = {
  key: string;
  reason: string;
  value: unknown;
};

export type BillingReconcileResult = {
  actions: ReconcileAction[];
  patch: Record<string, unknown>;
};

export function computeBillingReconcile(user: BillingUserShape, now = new Date()): BillingReconcileResult {
  const actions: ReconcileAction[] = [];
  const patch: Record<string, unknown> = {};

  const mark = (key: string, value: unknown, reason: string) => {
    actions.push({ key, value, reason });
    patch[key] = value;
  };

  const expiresAt = user.billingExpiresAt ? new Date(user.billingExpiresAt) : null;
  const hasExpired = Boolean(expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= now.getTime());

  if (user.cancelAtPeriodEnd && user.scheduledPlan !== "free") {
    mark("scheduledPlan", "free", "Scheduled downgrade should be set when cancel-at-period-end is active.");
  }

  if (!user.cancelAtPeriodEnd && user.scheduledPlan === "free") {
    mark("scheduledPlan", "", "Clearing stale scheduled downgrade because cancel-at-period-end is not active.");
  }

  if (user.cancelAtPeriodEnd && hasExpired) {
    mark("plan", "free", "Subscription reached period end while cancel-at-period-end is active.");
    mark("billingStatus", "canceled", "Billing should be canceled after period end.");
    mark("cancelAtPeriodEnd", false, "Cancel-at-period-end has been fulfilled.");
    mark("canceledAt", now, "Set cancellation timestamp at reconciliation time.");
    mark("scheduledPlan", "", "Scheduled downgrade fulfilled.");
  }

  if (user.plan !== "free" && hasExpired && (user.billingStatus === "inactive" || user.billingStatus === "canceled")) {
    mark("plan", "free", "Paid plan cannot remain active after expiration with inactive/canceled billing.");
    if (user.billingStatus !== "canceled") {
      mark("billingStatus", "canceled", "Expired paid account moved to canceled billing status.");
    }
    if (!user.canceledAt) {
      mark("canceledAt", now, "Set cancellation timestamp for expired paid account.");
    }
  }

  if (user.plan === "free" && user.billingStatus === "active" && !user.cancelAtPeriodEnd) {
    mark("billingStatus", "inactive", "Free plan should not remain active without a renewal schedule.");
  }

  if (user.billingStatus === "canceled" && !user.canceledAt) {
    mark("canceledAt", now, "Canceled billing status should include cancellation timestamp.");
  }

  return { actions, patch };
}

