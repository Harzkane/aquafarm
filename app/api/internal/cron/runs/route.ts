import { NextRequest, NextResponse } from "next/server";
import { clampInt, isCronAuthorized } from "@/lib/cron-utils";
import { fetchCronRuns } from "@/lib/cron-runs";

function isAuthorized(req: NextRequest) {
  return isCronAuthorized(process.env.CRON_SECRET, req.headers.get("authorization"));
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const job = String(searchParams.get("job") || "").trim();
  const status = String(searchParams.get("status") || "").trim();
  const limit = clampInt(searchParams.get("limit"), 50, 1, 200);

  const result = await fetchCronRuns({ job, status, limit });
  return NextResponse.json(result);
}
