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
