import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { clampInt } from "@/lib/cron-utils";
import { fetchCronHealth } from "@/lib/cron-runs";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const ownerUserId = (session.user as any).id;
  const actorUserId = (session.user as any).memberUserId || ownerUserId;
  const actor = await User.findById(actorUserId).select("role");
  const owner = await User.findById(ownerUserId).select("plan");
  if (!owner) return NextResponse.json({ error: "User not found" }, { status: 404 });
  const role = actor?.role === "staff" ? "staff" : "owner";
  if (role !== "owner" || owner.plan !== "commercial") {
    return NextResponse.json(
      { error: "Ops visibility is available for Commercial account owners only.", code: "PLAN_FEATURE_LOCKED" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const hours = clampInt(searchParams.get("hours"), 24, 1, 168);
  const result = await fetchCronHealth(hours);
  return NextResponse.json(result);
}

