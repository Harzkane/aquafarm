import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { logCronRun } from "@/lib/cron-log";
import { clampInt, isCronAuthorized, parseDryRunFlag } from "@/lib/cron-utils";
import { dispatchCriticalAlerts } from "@/lib/alert-dispatch";

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
    const result = await dispatchCriticalAlerts(limit, dryRun);
    const response = {
      ok: true,
      dryRun,
      ...result,
    };

    await logCronRun({
      job: "alerts-dispatch",
      status: "success",
      dryRun,
      durationMs: Date.now() - startedAt,
      metrics: {
        limit,
        checked: response.checked,
        sent: response.sent,
        failed: response.failed,
        skipped: response.skipped,
        cooldownSkipped: response.cooldownSkipped,
        channelDisabled: response.channelDisabled,
      },
    });

    return NextResponse.json(response);
  } catch (error: any) {
    await logCronRun({
      job: "alerts-dispatch",
      status: "failed",
      dryRun,
      durationMs: Date.now() - startedAt,
      metrics: { limit },
      error: String(error?.message || error || "Unknown error"),
    });
    return NextResponse.json({ error: "Alert dispatch cron failed" }, { status: 500 });
  }
}
