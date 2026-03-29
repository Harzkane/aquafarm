import { AlertCandidate, AlertRule, buildMeta } from "./types";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export const operationsRules: AlertRule[] = [
  (ctx) => {
    const alerts: AlertCandidate[] = [];
    const todayStart = startOfDay(ctx.now);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(todayStart.getDate() + 1);
    const hasLogToday = ctx.logs30d.some((log) => {
      const dt = new Date(log.date);
      return dt >= todayStart && dt < tomorrowStart;
    });

    if (ctx.batches.length > 0 && !hasLogToday) {
      alerts.push({
        key: "ops:no-daily-log",
        source: "dashboard",
        severity: "warning" as const,
        title: "No daily log for today",
        message: "No feed or water log has been recorded yet for active batches today.",
        href: "/feeding",
        meta: buildMeta(undefined, {
          entityType: "farm",
          incidentKey: "incident:daily-logging",
          windowDays: 1,
        }),
      });
    }

    if (ctx.recentCronFailures > 0 && ctx.owner.plan === "commercial") {
      alerts.push({
        key: "ops:cron-failures-24h",
        source: "ops",
        severity: ctx.recentCronFailures >= 3 ? "critical" : "warning",
        title: "Cron failures in last 24h",
        message: `${ctx.recentCronFailures} cron run${ctx.recentCronFailures > 1 ? "s have" : " has"} failed in the past 24 hours.`,
        href: "/settings/ops",
        meta: buildMeta(undefined, {
          entityType: "platform",
          incidentKey: "incident:platform-ops",
          actualValue: ctx.recentCronFailures,
          windowDays: 1,
        }),
      });
    }

    return alerts;
  },
];
