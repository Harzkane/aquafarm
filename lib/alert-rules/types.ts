export type AlertSeverity = "info" | "warning" | "critical";

export type AlertCandidate = {
  key: string;
  source: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  href: string;
  meta?: Record<string, unknown>;
};

export type AlertRuleContext = {
  now: Date;
  owner: any;
  plan: any;
  batches: any[];
  financial: any;
  calendarEvents: any[];
  logs30d: any[];
  logs3d: any[];
  feedLogs: any[];
  feedInventory: any;
  recentCronFailures: number;
  staffUsers: number;
};

export type AlertRule = (ctx: AlertRuleContext) => AlertCandidate[];

export function buildMeta(
  base: Record<string, unknown> | undefined,
  extra: Record<string, unknown>
) {
  return { ...(base || {}), ...extra };
}

export function toFiniteNumber(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function severityRank(severity: AlertSeverity) {
  if (severity === "critical") return 3;
  if (severity === "warning") return 2;
  return 1;
}

