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
  const query = String(searchParams.get("query") || "").trim();
  const job = String(searchParams.get("job") || "").trim();
  const status = String(searchParams.get("status") || "").trim();
  const page = clampInt(searchParams.get("page"), 1, 1, 5000);
  const pageSize = clampInt(searchParams.get("pageSize"), 10, 1, 50);

  const result = await fetchCronRuns({ query, job, status, page, pageSize });
  return NextResponse.json(result);
}
