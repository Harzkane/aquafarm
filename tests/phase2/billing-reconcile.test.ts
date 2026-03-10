import test from "node:test";
import assert from "node:assert/strict";
import { computeBillingReconcile } from "../../lib/billing-reconcile";

test("reconcile schedules free downgrade when cancelAtPeriodEnd is true", () => {
  const now = new Date("2026-03-10T10:00:00.000Z");
  const { actions, patch } = computeBillingReconcile(
    {
      plan: "pro",
      billingStatus: "active",
      cancelAtPeriodEnd: true,
      scheduledPlan: "",
      billingExpiresAt: new Date("2026-03-12T00:00:00.000Z"),
    },
    now
  );

  assert.ok(actions.length > 0);
  assert.equal(patch.scheduledPlan, "free");
});

test("reconcile downgrades expired cancel-at-period-end accounts", () => {
  const now = new Date("2026-03-10T10:00:00.000Z");
  const { patch } = computeBillingReconcile(
    {
      plan: "commercial",
      billingStatus: "active",
      cancelAtPeriodEnd: true,
      scheduledPlan: "free",
      billingExpiresAt: new Date("2026-03-01T00:00:00.000Z"),
    },
    now
  );

  assert.equal(patch.plan, "free");
  assert.equal(patch.billingStatus, "canceled");
  assert.equal(patch.cancelAtPeriodEnd, false);
  assert.equal(patch.scheduledPlan, "");
  assert.ok(patch.canceledAt instanceof Date);
});

test("reconcile fixes free plan with invalid active status", () => {
  const { patch } = computeBillingReconcile({
    plan: "free",
    billingStatus: "active",
    cancelAtPeriodEnd: false,
  });
  assert.equal(patch.billingStatus, "inactive");
});

