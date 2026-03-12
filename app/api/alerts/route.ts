import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { AlertNotification } from "@/models/AlertNotification";
import { collectAlertCandidates, syncAlertsForUser } from "@/lib/alerts";
import { clampInt } from "@/lib/cron-utils";

function parseBool(value: string | null) {
  return value === "1";
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const ownerUserId = (session.user as any).id;
  const { searchParams } = new URL(req.url);
  const limit = clampInt(searchParams.get("limit"), 20, 1, 100);
  const includeCounts = parseBool(searchParams.get("counts"));
  const refresh = parseBool(searchParams.get("refresh"));

  let refreshStats: Record<string, number> | null = null;
  if (refresh) {
    const candidates = await collectAlertCandidates(ownerUserId);
    refreshStats = await syncAlertsForUser(ownerUserId, candidates);
  }

  const alerts = await AlertNotification.find({
    userId: ownerUserId,
    active: true,
  })
    .sort({ severityRank: -1, updatedAt: -1 })
    .limit(limit)
    .lean<any[]>();

  if (!includeCounts) {
    return NextResponse.json({ alerts, refreshed: refreshStats });
  }

  const countsRows = await AlertNotification.aggregate([
    { $match: { userId: ownerUserId, active: true } },
    { $group: { _id: "$severity", count: { $sum: 1 } } },
  ]);
  const counts = { total: 0, info: 0, warning: 0, critical: 0 };
  for (const row of countsRows) {
    const key = String(row._id || "") as "info" | "warning" | "critical";
    const count = Number(row.count || 0);
    if (key === "info" || key === "warning" || key === "critical") {
      counts[key] = count;
      counts.total += count;
    }
  }

  return NextResponse.json({ alerts, counts, refreshed: refreshStats });
}
