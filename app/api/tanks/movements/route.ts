import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Tank } from "@/models/Tank";
import { Batch } from "@/models/Batch";
import { TankMovement } from "@/models/TankMovement";
import { runAtomic } from "@/lib/transactions";
import { validateMove } from "@/lib/validators/tank-movements";
import {
  getTankAllocationCount,
  syncTankOccupancy,
  upsertTankAllocation,
  normalizeTankAllocations,
} from "@/lib/tank-allocations";

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

  const result = await runAtomic(async (txSession) => {
    const [batch, fromTank, toTank] = await Promise.all([
      Batch.findOne({
        _id: payload.batchId,
        userId,
        status: { $in: ["active", "partial"] },
        $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
      }).session(txSession || null),
      Tank.findOne({ _id: payload.fromTankId, userId }).session(txSession || null),
      Tank.findOne({ _id: payload.toTankId, userId }).session(txSession || null),
    ]);

    if (!batch) return { error: "Batch not found or not active", status: 404 as const };
    if (!fromTank) return { error: "Source tank not found", status: 404 as const };
    if (!toTank) return { error: "Destination tank not found", status: 404 as const };

    const conflictingBatch = await Batch.findOne({
      _id: { $ne: batch._id },
      userId,
      status: { $in: ["active", "partial"] },
      $and: [
        { "tankAllocations.tankId": String(toTank._id) },
        { $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }] },
      ],
    })
      .select("name")
      .session(txSession || null);

    const fromAllocated = getTankAllocationCount(batch.tankAllocations, String(fromTank._id));
    if (fromAllocated < payload.count) {
      return {
        error: `${batch.name} has only ${fromAllocated.toLocaleString()} fish allocated in ${fromTank.name}.`,
        status: 409 as const,
      };
    }

    const fromCurrent = Number(fromTank.currentFish || 0);
    if (fromCurrent < payload.count) {
      return {
        error: `Cannot move ${payload.count}. ${fromTank.name} has only ${fromCurrent}.`,
        status: 409 as const,
      };
    }

    fromTank.currentFish = fromCurrent - payload.count;
    const toCurrent = Number(toTank.currentFish || 0);
    if (conflictingBatch) {
      return {
        error: `${toTank.name} is already allocated to active batch ${conflictingBatch.name}. Move or clear those fish first.`,
        status: 409 as const,
      };
    }
    if (toCurrent > 0 && toTank.currentBatch && String(toTank.currentBatch) !== String(batch._id)) {
      return {
        error: `${toTank.name} already contains fish from another batch. Move or clear those fish first.`,
        status: 409 as const,
      };
    }
    const nextToCount = toCurrent + payload.count;
    const toTarget = Number(toTank.targetFishCapacity || 0);
    if (toTarget > 0 && nextToCount > toTarget) {
      return {
        error: `${toTank.name} fish capacity is ${toTarget}. Reduce move count or update fish capacity.`,
        status: 409 as const,
      };
    }

    toTank.currentFish = nextToCount;
    syncTankOccupancy(fromTank, String(batch._id));
    syncTankOccupancy(toTank, String(batch._id));

    const allocations = normalizeTankAllocations(batch.tankAllocations);
    const fromIx = allocations.findIndex((a: any) => a?.tankId === String(fromTank._id));
    if (fromIx >= 0) {
      allocations[fromIx].fishCount = Math.max(0, Number(allocations[fromIx].fishCount || 0) - payload.count);
      if (allocations[fromIx].fishCount === 0) allocations.splice(fromIx, 1);
    }

    batch.tankAllocations = upsertTankAllocation(
      allocations,
      String(toTank._id),
      toTank.name,
      payload.count,
      "sorting",
    );

    const movementDocs = await TankMovement.create(
      [
        {
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
        },
      ],
      { session: txSession || undefined }
    );

    await Promise.all([
      fromTank.save({ session: txSession || undefined }),
      toTank.save({ session: txSession || undefined }),
      batch.save({ session: txSession || undefined }),
    ]);

    return { movement: movementDocs[0] };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.movement, { status: 201 });
}
