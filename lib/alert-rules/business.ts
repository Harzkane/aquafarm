import { summarizeFeedInventory } from "@/lib/feed-inventory";
import { AlertCandidate, AlertRule, buildMeta, toFiniteNumber } from "./types";

export const businessRules: AlertRule[] = [
  (ctx) => {
    const alerts: AlertCandidate[] = [];
    const feedSummary = summarizeFeedInventory(ctx.feedInventory, ctx.feedLogs);
    const mostUrgentFeed = feedSummary.lowStockProducts[0];
    if (mostUrgentFeed) {
      alerts.push({
        key: `feed:stock-low:${mostUrgentFeed.key}`,
        source: "feed-inventory",
        severity: mostUrgentFeed.lowStockSeverity === "critical" ? "critical" : "warning",
        title: `${mostUrgentFeed.label} running low`,
        message:
          mostUrgentFeed.estimatedDaysLeft != null
            ? `${mostUrgentFeed.remainingKg.toFixed(2)}kg left, about ${mostUrgentFeed.estimatedDaysLeft.toFixed(1)} feeding days remaining.`
            : `${mostUrgentFeed.remainingKg.toFixed(2)}kg left. Recent usage is not enough to forecast days left.`,
        href: "/feed-inventory",
        meta: buildMeta(undefined, {
          entityType: "feed",
          incidentKey: `incident:feed:${mostUrgentFeed.key}`,
          feedKey: mostUrgentFeed.key,
          remainingFeedKg: mostUrgentFeed.remainingKg,
          estimatedDaysLeft: mostUrgentFeed.estimatedDaysLeft,
        }),
      });
    }

    if (ctx.owner.billingStatus === "past_due") {
      alerts.push({
        key: "billing:past-due",
        source: "billing",
        severity: "critical",
        title: "Billing is past due",
        message: "Payment is overdue. Update billing now to avoid interruption.",
        href: "/settings/billing",
        meta: buildMeta(undefined, { entityType: "billing", incidentKey: "incident:billing-status" }),
      });
    }

    if (ctx.owner.cancelAtPeriodEnd) {
      alerts.push({
        key: "billing:cancel-at-period-end",
        source: "billing",
        severity: "warning",
        title: "Plan downgrade scheduled",
        message: "Auto-renew is disabled and your plan is scheduled to downgrade at period end.",
        href: "/settings/billing",
        meta: buildMeta(undefined, { entityType: "billing", incidentKey: "incident:billing-status" }),
      });
    }

    if (ctx.owner.billingExpiresAt && ctx.owner.plan !== "free") {
      const expiresAt = new Date(ctx.owner.billingExpiresAt).getTime();
      const daysToExpiry = Math.ceil((expiresAt - ctx.now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysToExpiry <= 3) {
        alerts.push({
          key: "billing:expiring-soon",
          source: "billing",
          severity: daysToExpiry <= 0 ? "critical" : "warning",
          title: daysToExpiry <= 0 ? "Billing period expired" : "Billing period ending soon",
          message:
            daysToExpiry <= 0
              ? "Your billing period has expired. Confirm plan status immediately."
              : `Your billing period ends in ${daysToExpiry} day${daysToExpiry > 1 ? "s" : ""}.`,
          href: "/settings/billing",
          meta: buildMeta(undefined, {
            entityType: "billing",
            incidentKey: "incident:billing-status",
            daysToExpiry,
          }),
        });
      }
    }

    if (ctx.owner.role !== "staff" && ctx.plan.maxStaffUsers && ctx.plan.maxStaffUsers > 0) {
      if (ctx.staffUsers >= ctx.plan.maxStaffUsers) {
        alerts.push({
          key: "staff:seat-limit-reached",
          source: "staff",
          severity: "critical",
          title: "Staff seat limit reached",
          message: `${ctx.staffUsers}/${ctx.plan.maxStaffUsers} staff seats are in use.`,
          href: "/settings/staff",
          meta: buildMeta(undefined, {
            entityType: "staff",
            incidentKey: "incident:staff-capacity",
            actualValue: ctx.staffUsers,
            maxStaffUsers: ctx.plan.maxStaffUsers,
          }),
        });
      } else if (ctx.staffUsers >= Math.ceil(ctx.plan.maxStaffUsers * 0.8)) {
        alerts.push({
          key: "staff:seat-limit-near",
          source: "staff",
          severity: "warning",
          title: "Staff seat usage is high",
          message: `${ctx.staffUsers}/${ctx.plan.maxStaffUsers} staff seats are used.`,
          href: "/settings/staff",
          meta: buildMeta(undefined, {
            entityType: "staff",
            incidentKey: "incident:staff-capacity",
            actualValue: ctx.staffUsers,
            maxStaffUsers: ctx.plan.maxStaffUsers,
          }),
        });
      }
    }

    const last30Expenses = (ctx.financial?.expenses || [])
      .filter((item: any) => new Date(item.date).getTime() >= ctx.now.getTime() - 30 * 24 * 60 * 60 * 1000)
      .reduce((sum: number, item: any) => sum + toFiniteNumber(item.amount), 0);
    const last30Revenue = (ctx.financial?.revenue || [])
      .filter((item: any) => new Date(item.date).getTime() >= ctx.now.getTime() - 30 * 24 * 60 * 60 * 1000)
      .reduce((sum: number, item: any) => sum + toFiniteNumber(item.totalAmount), 0);
    const net30 = last30Revenue - last30Expenses;
    if (last30Revenue > 0 && net30 < 0) {
      alerts.push({
        key: "financials:negative-net-30d",
        source: "financials",
        severity: "warning",
        title: "30-day net is negative",
        message: "Revenue is below expenses in the last 30 days.",
        href: "/financials",
        meta: buildMeta(undefined, {
          entityType: "financials",
          incidentKey: "incident:financials",
          windowDays: 30,
          net30,
        }),
      });
    }

    return alerts;
  },
];
