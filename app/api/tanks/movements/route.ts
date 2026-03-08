import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Types } from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Tank } from "@/models/Tank";
import { Batch } from "@/models/Batch";
import { TankMovement } from "@/models/TankMovement";

type MovePayload = {
  batchId: string;
  fromTankId: string;
  toTankId: string;
  count: number;
  date: Date;
  reason: string;
  notes: string;
};

function normalizeText(v: unknown, maxLen: number) {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, maxLen);
}

function validateMove(body: any): { ok: true; value: MovePayload } | { ok: false; error: string } {
  const batchId = normalizeText(body?.batchId, 80);
  const fromTankId = normalizeText(body?.fromTankId, 80);
  const toTankId = normalizeText(body?.toTankId, 80);
  const countRaw = Number(body?.count);
  const count = Math.trunc(countRaw);
  const date = body?.date ? new Date(body.date) : new Date();
  const reason = normalizeText(body?.reason, 80) || "sorting";
  const notes = normalizeText(body?.notes, 500);

  if (!Types.ObjectId.isValid(batchId)) return { ok: false, error: "Valid batch is required" };
  if (!Types.ObjectId.isValid(fromTankId)) return { ok: false, error: "Valid source tank is required" };
  if (!Types.ObjectId.isValid(toTankId)) return { ok: false, error: "Valid destination tank is required" };
  if (fromTankId === toTankId) return { ok: false, error: "Source and destination tank must be different" };
  if (!Number.isFinite(countRaw) || count <= 0) return { ok: false, error: "Move count must be greater than 0" };
  if (Number.isNaN(date.getTime())) return { ok: false, error: "Invalid move date" };

  return { ok: true, value: { batchId, fromTankId, toTankId, count, date, reason, notes } };
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const { searchParams } = new URL(req.url);
  const limit = Math.max(1, Math.min(200, Number(searchParams.get("limit") || 50)));

  await connectDB();
  const moves = await TankMovement.find({ userId })
    .sort({ date: -1, createdAt: -1 })
    .limit(limit)
    .populate("batchId", "name");

  return NextResponse.json(moves);
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

  const validated = validateMove(body);
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });
  const payload = validated.value;

  await connectDB();

  const [batch, fromTank, toTank] = await Promise.all([
    Batch.findOne({
      _id: payload.batchId,
      userId,
      status: { $in: ["active", "partial"] },
      $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
    }),
    Tank.findOne({ _id: payload.fromTankId, userId }),
    Tank.findOne({ _id: payload.toTankId, userId }),
  ]);

  if (!batch) return NextResponse.json({ error: "Batch not found or not active" }, { status: 404 });
  if (!fromTank) return NextResponse.json({ error: "Source tank not found" }, { status: 404 });
  if (!toTank) return NextResponse.json({ error: "Destination tank not found" }, { status: 404 });

  const fromCurrent = Number(fromTank.currentFish || 0);
  if (fromCurrent < payload.count) {
    return NextResponse.json(
      { error: `Cannot move ${payload.count}. ${fromTank.name} has only ${fromCurrent}.` },
      { status: 409 }
    );
  }

  fromTank.currentFish = fromCurrent - payload.count;
  const toCurrent = Number(toTank.currentFish || 0);
  const nextToCount = toCurrent + payload.count;
  const toTarget = Number(toTank.targetFishCapacity || 0);
  if (toTarget > 0 && nextToCount > toTarget) {
    return NextResponse.json(
      { error: `${toTank.name} fish capacity is ${toTarget}. Reduce move count or update fish capacity.` },
      { status: 409 }
    );
  }

  toTank.currentFish = nextToCount;
  if (fromTank.currentFish <= 0 && fromTank.status === "active") fromTank.status = "empty";
  if (toTank.currentFish > 0 && toTank.status === "empty") toTank.status = "active";

  const allocations = Array.isArray(batch.tankAllocations) ? [...batch.tankAllocations] : [];
  const fromIx = allocations.findIndex((a: any) => a?.tankId === String(fromTank._id));
  if (fromIx >= 0) {
    allocations[fromIx].fishCount = Math.max(0, Number(allocations[fromIx].fishCount || 0) - payload.count);
    if (allocations[fromIx].fishCount === 0) allocations.splice(fromIx, 1);
  }

  const toIx = allocations.findIndex((a: any) => a?.tankId === String(toTank._id));
  if (toIx >= 0) {
    allocations[toIx].fishCount = Number(allocations[toIx].fishCount || 0) + payload.count;
    allocations[toIx].tankName = toTank.name;
  } else {
    allocations.push({
      tankId: String(toTank._id),
      tankName: toTank.name,
      fishCount: payload.count,
      phase: "sorting",
    });
  }
  batch.tankAllocations = allocations;

  const movement = await TankMovement.create({
    userId,
    batchId: payload.batchId,
    fromTankId: String(fromTank._id),
    toTankId: String(toTank._id),
    fromTankName: fromTank.name,
    toTankName: toTank.name,
    count: payload.count,
    date: payload.date,
    reason: payload.reason,
    notes: payload.notes,
  });

  await Promise.all([fromTank.save(), toTank.save(), batch.save()]);

  return NextResponse.json(movement, { status: 201 });
}
