import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { AuditLog } from "@/models/AuditLog";
import { User } from "@/models/User";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function resourceToQueryValue(resource: string) {
  if (resource === "billing") return "billing";
  if (resource === "staff") return "staff_user";
  if (resource === "batches") return "batch";
  if (resource === "tanks") return "tank";
  if (resource === "logs") return "daily_log";
  if (resource === "water_quality") return "water_quality";
  return "";
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerUserId = (session.user as any).id;
  const actorUserId = (session.user as any).memberUserId || ownerUserId;

  await connectDB();
  const actor = await User.findById(actorUserId).select("role");
  const owner = await User.findById(ownerUserId).select("plan");
  if (!owner) return NextResponse.json({ error: "User not found" }, { status: 404 });
  const role = actor?.role === "staff" ? "staff" : "owner";
  if (role !== "owner" || owner.plan !== "commercial") {
    return NextResponse.json(
      { error: "Operational audit visibility is available for Commercial owners only.", code: "PLAN_FEATURE_LOCKED" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const queryText = String(searchParams.get("query") || "").trim();
  const resourceFilter = String(searchParams.get("resource") || "all").trim();
  const page = Math.max(1, Math.trunc(Number(searchParams.get("page") || 1)));
  const pageSizeRaw = Math.trunc(Number(searchParams.get("pageSize") || 10));
  const pageSize = Math.max(1, Math.min(50, Number.isFinite(pageSizeRaw) ? pageSizeRaw : 10));
  const query: Record<string, unknown> = { ownerUserId };

  const resource = resourceToQueryValue(resourceFilter);
  if (resource) query.resource = resource;
  if (queryText) {
    const regex = new RegExp(escapeRegex(queryText), "i");
    query.$or = [
      { actorName: regex },
      { actorEmail: regex },
      { action: regex },
      { resource: regex },
      { summary: regex },
    ];
  }

  const skip = (page - 1) * pageSize;
  const [logs, totalLogs] = await Promise.all([
    AuditLog.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean<any[]>(),
    AuditLog.countDocuments(query),
  ]);

  return NextResponse.json({
    logs,
    totals: { totalLogs: Number(totalLogs || 0) },
    pagination: {
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(Number(totalLogs || 0) / pageSize)),
      totalLogs: Number(totalLogs || 0),
    },
  });
}
