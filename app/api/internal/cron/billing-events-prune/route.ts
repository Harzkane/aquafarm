import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { BillingEvent } from "@/models/BillingEvent";
import { logCronRun } from "@/lib/cron-log";
import { clampInt, isCronAuthorized, parseDryRunFlag } from "@/lib/cron-utils";

function isAuthorized(req: NextRequest) {
  return isCronAuthorized(process.env.CRON_SECRET, req.headers.get("authorization"));
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const dryRun = parseDryRunFlag(searchParams.get("dryRun"));
  const keepDays = clampInt(searchParams.get("keepDays"), 180, 30, 730);
  const batchSize = clampInt(searchParams.get("batchSize"), 500, 50, 1000);
  const startedAt = Date.now();

  try {
    const cutoff = new Date(Date.now() - keepDays * 24 * 60 * 60 * 1000);
    await connectDB();

    const candidates = await BillingEvent.find({ createdAt: { $lt: cutoff } })
      .sort({ createdAt: 1 })
      .limit(batchSize)
      .select("_id createdAt")
      .lean<any[]>();

    if (candidates.length === 0) {
      const response = {
        ok: true,
        dryRun,
        keepDays,
        batchSize,
        deleted: 0,
        oldestCandidate: null,
        cutoff,
      };
      await logCronRun({
        job: "billing-events-prune",
        status: "success",
        dryRun,
        durationMs: Date.now() - startedAt,
        metrics: { keepDays, batchSize, candidateCount: 0, deleted: 0 },
      });
      return NextResponse.json(response);
    }

    let deleted = 0;
    if (!dryRun) {
      const ids = candidates.map((row) => row._id);
      const result = await BillingEvent.deleteMany({ _id: { $in: ids } });
      deleted = Number(result.deletedCount || 0);
    }

    const response = {
      ok: true,
      dryRun,
      keepDays,
      batchSize,
      deleted,
      candidateCount: candidates.length,
      oldestCandidate: candidates[0]?.createdAt || null,
      newestCandidate: candidates[candidates.length - 1]?.createdAt || null,
      cutoff,
      hasMore: candidates.length === batchSize,
    };
    await logCronRun({
      job: "billing-events-prune",
      status: "success",
      dryRun,
      durationMs: Date.now() - startedAt,
      metrics: {
        keepDays,
        batchSize,
        candidateCount: response.candidateCount,
        deleted: response.deleted,
        hasMore: response.hasMore,
      },
    });
    return NextResponse.json(response);
  } catch (error: any) {
    await logCronRun({
      job: "billing-events-prune",
      status: "failed",
      dryRun,
      durationMs: Date.now() - startedAt,
      metrics: { keepDays, batchSize },
      error: String(error?.message || error || "Unknown error"),
    });
    return NextResponse.json({ error: "Billing events prune cron failed" }, { status: 500 });
  }
}
