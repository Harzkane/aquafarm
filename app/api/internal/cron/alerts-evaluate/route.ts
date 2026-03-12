import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { logCronRun } from "@/lib/cron-log";
import { clampInt, isCronAuthorized, parseDryRunFlag } from "@/lib/cron-utils";
import { collectAlertCandidates, syncAlertsForUser } from "@/lib/alerts";

function isAuthorized(req: NextRequest) {
  return isCronAuthorized(process.env.CRON_SECRET, req.headers.get("authorization"));
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const dryRun = parseDryRunFlag(searchParams.get("dryRun"));
  const limit = clampInt(searchParams.get("limit"), 50, 1, 200);
  const startedAt = Date.now();

  try {
    await connectDB();
    const owners = await User.find({ role: "owner", isActive: { $ne: false } })
      .select("_id")
      .sort({ _id: 1 })
      .limit(limit)
      .lean<any[]>();

    let evaluated = 0;
    let activeAlerts = 0;
    let resolvedAlerts = 0;
    let touchedRecords = 0;
    const sample: Array<{ userId: string; active: number; resolved: number }> = [];

    for (const owner of owners) {
      const ownerId = String(owner._id);
      const candidates = await collectAlertCandidates(ownerId);
      evaluated += 1;
      if (!dryRun) {
        const sync = await syncAlertsForUser(ownerId, candidates);
        activeAlerts += sync.active;
        resolvedAlerts += sync.resolved;
        touchedRecords += sync.touched;
        if (sample.length < 20) {
          sample.push({ userId: ownerId, active: sync.active, resolved: sync.resolved });
        }
      } else {
        activeAlerts += candidates.length;
        if (sample.length < 20) {
          sample.push({ userId: ownerId, active: candidates.length, resolved: 0 });
        }
      }
    }

    const response = {
      ok: true,
      dryRun,
      evaluated,
      activeAlerts,
      resolvedAlerts,
      touchedRecords,
      hasMore: owners.length === limit,
      sample,
    };

    await logCronRun({
      job: "alerts-evaluate",
      status: "success",
      dryRun,
      durationMs: Date.now() - startedAt,
      metrics: {
        limit,
        evaluated: response.evaluated,
        activeAlerts: response.activeAlerts,
        resolvedAlerts: response.resolvedAlerts,
        touchedRecords: response.touchedRecords,
      },
    });

    return NextResponse.json(response);
  } catch (error: any) {
    await logCronRun({
      job: "alerts-evaluate",
      status: "failed",
      dryRun,
      durationMs: Date.now() - startedAt,
      metrics: { limit },
      error: String(error?.message || error || "Unknown error"),
    });
    return NextResponse.json({ error: "Alert evaluation cron failed" }, { status: 500 });
  }
}
