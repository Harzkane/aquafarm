import { connectDB } from "@/lib/db";
import { CronRun } from "@/models/CronRun";

type FetchCronRunsInput = {
  job?: string;
  status?: string;
  limit: number;
};

export async function fetchCronRuns(input: FetchCronRunsInput) {
  const query: Record<string, unknown> = {};
  const job = String(input.job || "").trim();
  const status = String(input.status || "").trim();
  if (job) query.job = job;
  if (status === "success" || status === "failed") query.status = status;

  await connectDB();
  const runs = await CronRun.find(query)
    .sort({ createdAt: -1, _id: -1 })
    .limit(input.limit)
    .select("job status dryRun durationMs metrics error createdAt")
    .lean<any[]>();

  const summary = await CronRun.aggregate([
    { $match: query },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: "$job",
        totalRuns: { $sum: 1 },
        failedRuns: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
        latestStatus: { $first: "$status" },
        latestRunAt: { $first: "$createdAt" },
        avgDurationMs: { $avg: "$durationMs" },
      },
    },
    { $sort: { latestRunAt: -1 } },
  ]);

  return {
    runs,
    summary: summary.map((row: any) => ({
      job: row._id,
      totalRuns: Number(row.totalRuns || 0),
      failedRuns: Number(row.failedRuns || 0),
      latestStatus: row.latestStatus || "success",
      latestRunAt: row.latestRunAt || null,
      avgDurationMs: Math.round(Number(row.avgDurationMs || 0)),
    })),
  };
}

export async function fetchCronHealth(hours = 24) {
  const windowHours = Math.max(1, Math.min(168, Math.trunc(Number(hours) || 24)));
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  await connectDB();

  const [totals] = await CronRun.aggregate([
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id: null,
        totalRuns: { $sum: 1 },
        failedRuns: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
      },
    },
  ]);

  const [lastFailure] = await CronRun.find({ status: "failed", createdAt: { $gte: since } })
    .sort({ createdAt: -1 })
    .limit(1)
    .select("job error createdAt")
    .lean<any[]>();

  return {
    windowHours,
    since,
    totalRuns: Number(totals?.totalRuns || 0),
    failedRuns: Number(totals?.failedRuns || 0),
    hasFailures: Number(totals?.failedRuns || 0) > 0,
    lastFailure: lastFailure
      ? {
          job: String(lastFailure.job || ""),
          error: String(lastFailure.error || ""),
          createdAt: lastFailure.createdAt || null,
        }
      : null,
  };
}
