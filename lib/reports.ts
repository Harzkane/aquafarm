type Bucket = {
  key: string;
  label: string;
  start: Date;
  end: Date;
  revenue: number;
  expense: number;
  mortality: number;
  feed: number;
};

export type HarvestReadiness = {
  readinessScore: number;
  readinessStatus: "growing" | "approaching" | "ready";
  latestAvgWeight: number | null;
  latestFishCount: number | null;
  latestGrowthDate: string | null;
  targetWeight: number | null;
  weightProgressPct: number | null;
  daysToTargetHarvest: number | null;
  cycleProgressPct: number;
};

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function getReportRangeStart(range: string) {
  const now = Date.now();
  if (range === "30d") return new Date(now - 30 * 24 * 60 * 60 * 1000);
  if (range === "90d") return new Date(now - 90 * 24 * 60 * 60 * 1000);
  return null;
}

export function buildReportBuckets(
  range: string,
  now: Date,
  logs: any[],
  expenses: any[],
  revenue: any[],
): { granularity: "daily" | "weekly" | "monthly"; buckets: Bucket[] } {
  if (range === "30d") {
    const buckets: Bucket[] = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      const start = startOfDay(date);
      const end = endOfDay(date);
      buckets.push({
        key: start.toISOString().slice(0, 10),
        label: start.toLocaleDateString("en-NG", { day: "numeric", month: "short" }),
        start,
        end,
        revenue: 0,
        expense: 0,
        mortality: 0,
        feed: 0,
      });
    }
    return { granularity: "daily", buckets };
  }

  if (range === "90d") {
    const buckets: Bucket[] = [];
    const windowStart = startOfDay(new Date(now.getTime() - 89 * 24 * 60 * 60 * 1000));
    for (let i = 0; i < 13; i++) {
      const start = startOfDay(new Date(windowStart.getTime() + i * 7 * 24 * 60 * 60 * 1000));
      const end = endOfDay(new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000));
      buckets.push({
        key: `${start.toISOString().slice(0, 10)}_wk`,
        label: start.toLocaleDateString("en-NG", { day: "numeric", month: "short" }),
        start,
        end,
        revenue: 0,
        expense: 0,
        mortality: 0,
        feed: 0,
      });
    }
    return { granularity: "weekly", buckets };
  }

  const candidateDates: Date[] = [];
  for (const l of logs) {
    const d = new Date(l.date);
    if (!Number.isNaN(d.getTime())) candidateDates.push(d);
  }
  for (const e of expenses) {
    const d = new Date(e.date);
    if (!Number.isNaN(d.getTime())) candidateDates.push(d);
  }
  for (const r of revenue) {
    const d = new Date(r.date);
    if (!Number.isNaN(d.getTime())) candidateDates.push(d);
  }
  const earliest = candidateDates.length
    ? new Date(Math.min(...candidateDates.map((d) => d.getTime())))
    : new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const monthCursor = startOfMonth(earliest);
  const monthEnd = startOfMonth(now);
  const buckets: Bucket[] = [];
  while (monthCursor <= monthEnd) {
    const start = startOfMonth(monthCursor);
    const end = endOfMonth(monthCursor);
    buckets.push({
      key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
      label: start.toLocaleDateString("en-NG", { month: "short", year: "2-digit" }),
      start,
      end,
      revenue: 0,
      expense: 0,
      mortality: 0,
      feed: 0,
    });
    monthCursor.setMonth(monthCursor.getMonth() + 1, 1);
  }
  return { granularity: "monthly", buckets };
}

export function analyzeHarvestReadiness(batch: any, logs: any[], weeksSinceStocking: number): HarvestReadiness {
  const growthLogs = logs
    .filter((log: any) => Number.isFinite(Number(log.avgWeight)) || Number.isFinite(Number(log.fishCount)))
    .slice()
    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const latestGrowthLog = growthLogs[0] || null;
  const latestAvgWeight = Number.isFinite(Number(latestGrowthLog?.avgWeight)) ? Number(latestGrowthLog.avgWeight) : null;
  const latestFishCount = Number.isFinite(Number(latestGrowthLog?.fishCount)) ? Number(latestGrowthLog.fishCount) : null;
  const targetWeight = Number(batch.targetWeight || 0);
  const survivalRate = Number(batch.initialCount || 0) > 0 ? (Number(batch.currentCount || 0) / Number(batch.initialCount || 1)) * 100 : 0;
  const cycleProgressPct = Math.min((weeksSinceStocking / 18) * 100, 100);
  const weightProgressPct = latestAvgWeight != null && targetWeight > 0
    ? Math.min((latestAvgWeight / targetWeight) * 100, 130)
    : null;
  const targetHarvestDate = batch.targetHarvestDate ? new Date(batch.targetHarvestDate) : null;
  const daysToTargetHarvest = targetHarvestDate && !Number.isNaN(targetHarvestDate.getTime())
    ? Math.ceil((targetHarvestDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    : null;
  const recentWaterRiskLogs = logs.filter((log: any) => {
    const ph = Number(log.ph);
    const ammonia = Number(log.ammonia);
    const dissolvedO2 = Number(log.dissolvedO2);
    return (
      (Number.isFinite(ph) && (ph < 6.5 || ph > 8)) ||
      (Number.isFinite(ammonia) && ammonia >= 0.5) ||
      (Number.isFinite(dissolvedO2) && dissolvedO2 < 5)
    );
  }).length;

  let score = 0;
  if (weightProgressPct != null) score += Math.min(weightProgressPct * 0.62, 62);
  else score += Math.min(cycleProgressPct * 0.24, 18);

  if (weeksSinceStocking >= 18) score += 14;
  else if (weeksSinceStocking >= 15) score += 10;
  else if (weeksSinceStocking >= 12) score += 6;

  if (daysToTargetHarvest != null) {
    if (daysToTargetHarvest <= 7) score += 12;
    else if (daysToTargetHarvest <= 21) score += 8;
    else if (daysToTargetHarvest <= 35) score += 4;
  }

  if (survivalRate >= 85) score += 8;
  else if (survivalRate >= 70) score += 4;

  if (recentWaterRiskLogs === 0) score += 4;
  else if (recentWaterRiskLogs >= 3) score -= 6;

  const readinessScore = Math.max(0, Math.min(Math.round(score), 100));
  const readinessStatus = readinessScore >= 80 ? "ready" : readinessScore >= 60 ? "approaching" : "growing";

  return {
    readinessScore,
    readinessStatus,
    latestAvgWeight,
    latestFishCount,
    latestGrowthDate: latestGrowthLog?.date ? new Date(latestGrowthLog.date).toISOString() : null,
    targetWeight: targetWeight > 0 ? targetWeight : null,
    weightProgressPct,
    daysToTargetHarvest,
    cycleProgressPct,
  };
}
