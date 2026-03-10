import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { AuditLog } from "@/models/AuditLog";
import { User } from "@/models/User";

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
  const requestedLimit = Number(searchParams.get("limit") || 100);
  const limit = Math.max(1, Math.min(500, Number.isFinite(requestedLimit) ? Math.trunc(requestedLimit) : 100));

  const logs = await AuditLog.find({ ownerUserId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean<any[]>();

  return NextResponse.json({ logs });
}
