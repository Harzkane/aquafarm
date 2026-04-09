import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { AlertNotification } from "@/models/AlertNotification";
import { AlertIncident } from "@/models/AlertIncident";
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

  const statusRows = await AlertNotification.aggregate([
    { $match: { userId: ownerUserId, active: true } },
    {
      $project: {
        normalizedStatus: {
          $cond: [
            { $in: ["$status", ["new", "acknowledged", "in_progress", "muted"]] },
            "$status",
            "new",
          ],
        },
      },
    },
    { $group: { _id: "$normalizedStatus", count: { $sum: 1 } } },
  ]);
  const statusCounts = { new: 0, acknowledged: 0, in_progress: 0, muted: 0 };
  for (const row of statusRows) {
    const key = String(row._id || "");
    const count = Number(row.count || 0);
    if (key === "new" || key === "acknowledged" || key === "in_progress" || key === "muted") {
      (statusCounts as any)[key] = count;
    }
  }

  const sourceRows = await AlertNotification.aggregate([
    { $match: { userId: ownerUserId, active: true } },
    { $group: { _id: "$source", count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
  ]);

  let incidents: any[] = [];
  if (counts.total > 0) {
    incidents = await AlertIncident.find({
      userId: ownerUserId,
      active: true,
    })
      .sort({ severityRank: -1, updatedAt: -1 })
      .limit(8)
      .select("title summary severity status source href entityType alertCount assignedToUserId assignedToName nextStepNote followUpDueAt verificationStatus verificationNote verifiedAt updatedAt")
      .lean<any[]>();
  } else {
    const now = new Date();
    await AlertIncident.updateMany(
      { userId: ownerUserId, active: true },
      { $set: { active: false, status: "resolved", updatedAt: now, resolvedAt: now } }
    );
  }

  const ageRows = await AlertNotification.find({
    userId: ownerUserId,
    active: true,
  })
    .select("createdAt acknowledgedAt status")
    .lean<any[]>();
  const analytics = {
    avgOpenAgeHours: ageRows.length
      ? Number((ageRows.reduce((sum, row) => sum + (Date.now() - new Date(row.createdAt).getTime()), 0) / ageRows.length / (1000 * 60 * 60)).toFixed(1))
      : 0,
    avgTimeToAcknowledgeHours: ageRows.filter((row) => row.acknowledgedAt).length
      ? Number((
          ageRows
            .filter((row) => row.acknowledgedAt)
            .reduce((sum, row) => sum + (new Date(row.acknowledgedAt).getTime() - new Date(row.createdAt).getTime()), 0) /
          ageRows.filter((row) => row.acknowledgedAt).length /
          (1000 * 60 * 60)
        ).toFixed(1))
      : 0,
  };

  return NextResponse.json({
    alerts,
    counts,
    statusCounts,
    sourceCounts: sourceRows.map((row) => ({ source: String(row._id || ""), count: Number(row.count || 0) })),
    incidents,
    analytics,
    refreshed: refreshStats,
  });
}
