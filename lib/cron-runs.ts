import { connectDB } from "@/lib/db";
import { CronRun } from "@/models/CronRun";

type FetchCronRunsInput = {
  query?: string;
  job?: string;
  status?: string;
  page: number;
  pageSize: number;
};

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function fetchCronRuns(input: FetchCronRunsInput) {
  const query: Record<string, unknown> = {};
  const textQuery = String(input.query || "").trim();
  const job = String(input.job || "").trim();
  const status = String(input.status || "").trim();
  if (job) query.job = job;
  if (status === "success" || status === "failed") query.status = status;
  if (textQuery) {
    const regex = new RegExp(escapeRegex(textQuery), "i");
    query.$or = [
      { job: regex },
      { error: regex },
      ...(textQuery === "success" || textQuery === "failed" ? [{ status: textQuery }] : []),
    ];
  }

  await connectDB();
  const pageSize = Math.max(1, Math.min(50, Math.trunc(Number(input.pageSize) || 10)));
  const page = Math.max(1, Math.trunc(Number(input.page) || 1));
  const skip = (page - 1) * pageSize;

  const [runs, totalRuns, totalsAgg, summary] = await Promise.all([
    CronRun.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(pageSize)
      .select("job status dryRun durationMs metrics error createdAt")
      .lean<any[]>(),
    CronRun.countDocuments(query),
    CronRun.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          failedRuns: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
          dryRuns: { $sum: { $cond: ["$dryRun", 1, 0] } },
          avgDurationMs: { $avg: "$durationMs" },
        },
      },
    ]),
    CronRun.aggregate([
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
      { $limit: 50 },
    ]),
  ]);

  const totals = totalsAgg[0] || null;

  return {
    runs,
    totals: {
      totalRuns: Number(totalRuns || 0),
      failedRuns: Number(totals?.failedRuns || 0),
      dryRuns: Number(totals?.dryRuns || 0),
      avgDurationMs: Math.round(Number(totals?.avgDurationMs || 0)),
    },
    pagination: {
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(Number(totalRuns || 0) / pageSize)),
      totalRuns: Number(totalRuns || 0),
    },
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
