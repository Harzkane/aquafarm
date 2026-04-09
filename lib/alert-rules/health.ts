import { AlertCandidate, AlertRule, buildMeta, toFiniteNumber } from "./types";

export const healthRules: AlertRule[] = [
  (ctx) => {
    const alerts: AlertCandidate[] = [];
    const totalFish = ctx.batches.reduce((sum, b) => sum + toFiniteNumber(b.currentCount), 0);
    const mortality3d = ctx.logs3d.reduce((sum, log) => sum + toFiniteNumber(log.mortality), 0);

    if (totalFish > 0 && mortality3d / totalFish >= 0.01) {
      alerts.push({
        key: "health:mortality-spike-3d",
        source: "mortality",
        severity: mortality3d / totalFish >= 0.02 ? "critical" : "warning",
        title: "Mortality spike detected",
        message: `${mortality3d} deaths logged in the last 3 days (${((mortality3d / totalFish) * 100).toFixed(2)}% of current stock).`,
        href: "/mortality",
        meta: buildMeta(undefined, {
          entityType: "farm",
          incidentKey: "incident:farm-health",
          windowDays: 3,
          actualValue: mortality3d,
          thresholdPct: mortality3d / totalFish >= 0.02 ? 2 : 1,
          totalFish,
        }),
      });
    }

    const waterRisk3d = ctx.logs3d.filter((log) => {
      const ph = Number(log.ph);
      const ammonia = Number(log.ammonia);
      const dissolvedO2 = Number(log.dissolvedO2);
      return (
        (Number.isFinite(ph) && (ph < 6.5 || ph > 8)) ||
        (Number.isFinite(ammonia) && ammonia >= 0.5) ||
        (Number.isFinite(dissolvedO2) && dissolvedO2 < 5)
      );
    }).length;

    if (waterRisk3d > 0) {
      alerts.push({
        key: "health:water-risk-3d",
        source: "water-quality",
        severity: waterRisk3d >= 3 ? "critical" : "warning",
        title: "Water quality out of range",
        message: `${waterRisk3d} recent log${waterRisk3d > 1 ? "s show" : " shows"} pH, ammonia, or dissolved oxygen risk in the last 3 days.`,
        href: "/water-quality",
        meta: buildMeta(undefined, {
          entityType: "farm",
          incidentKey: "incident:farm-health",
          windowDays: 3,
          actualValue: waterRisk3d,
        }),
      });
    }

    if (alerts.length >= 2) {
      alerts.push({
        key: "health:multi-signal-farm",
        source: "dashboard",
        severity: "critical",
        title: "Multiple health signals need attention",
        message: "Mortality and water quality warnings are active together. Review farm health immediately.",
        href: "/alerts",
        meta: buildMeta(undefined, {
          entityType: "farm",
          incidentKey: "incident:farm-health",
          correlated: true,
          signalCount: alerts.length,
        }),
      });
    }

    return alerts;
  },
];
