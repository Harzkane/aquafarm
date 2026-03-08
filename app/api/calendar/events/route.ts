import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Types } from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Batch } from "@/models/Batch";
import { CalendarEvent } from "@/models/CalendarEvent";

function normalizeText(v: unknown, maxLen: number) {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, maxLen);
}

function parseCompletedAt(v: unknown) {
  if (!v) return new Date();
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const { searchParams } = new URL(req.url);
  const batchId = searchParams.get("batchId");

  await connectDB();
  const query: any = { userId };
  if (batchId) {
    if (!Types.ObjectId.isValid(batchId)) {
      return NextResponse.json({ error: "Invalid batch id" }, { status: 400 });
    }
    query.batchId = batchId;
  }
  const events = await CalendarEvent.find(query).sort({ completedAt: -1, createdAt: -1 }).populate("batchId", "name");
  return NextResponse.json(events);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }

  const batchId = normalizeText(body?.batchId, 80);
  const kind = normalizeText(body?.kind, 20);
  const milestoneWeek = Math.trunc(Number(body?.milestoneWeek));
  const completedAt = parseCompletedAt(body?.completedAt);
  const notes = normalizeText(body?.notes, 500);

  if (!Types.ObjectId.isValid(batchId)) return NextResponse.json({ error: "Valid batch is required" }, { status: 400 });
  if (!["sort", "harvest"].includes(kind)) return NextResponse.json({ error: "Invalid calendar event kind" }, { status: 400 });
  if (!Number.isFinite(milestoneWeek) || milestoneWeek <= 0) return NextResponse.json({ error: "Milestone week is invalid" }, { status: 400 });
  if (!completedAt) return NextResponse.json({ error: "Completed date is invalid" }, { status: 400 });

  await connectDB();

  const batch = await Batch.findOne({
    _id: batchId,
    userId,
    $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
  }).select("_id status");
  if (!batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });

  const event = await CalendarEvent.findOneAndUpdate(
    { userId, batchId, kind, milestoneWeek },
    { $set: { completedAt, notes } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).populate("batchId", "name");

  return NextResponse.json(event, { status: 201 });
}
