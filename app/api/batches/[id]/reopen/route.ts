import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Types } from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Batch } from "@/models/Batch";
import { Tank } from "@/models/Tank";
import { runAtomic } from "@/lib/transactions";
import { recordAuditEvent } from "@/lib/audit";
import { syncTankOccupancy } from "@/lib/tank-allocations";

function toPositiveInt(value: unknown) {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid batch id" }, { status: 400 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }

  const restoreCount = toPositiveInt(body?.restoreCount);
  const tankId = String(body?.tankId || "").trim();

  if (!restoreCount) {
    return NextResponse.json({ error: "Restore fish count must be greater than 0" }, { status: 400 });
  }
  if (tankId && !Types.ObjectId.isValid(tankId)) {
    return NextResponse.json({ error: "Valid tank is required" }, { status: 400 });
  }

  await connectDB();
  const userId = (session.user as any).id;

  const result = await runAtomic(async (txSession) => {
    const batch = await Batch.findOne({
      _id: id,
      userId,
      $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
    }).session(txSession || null);

    if (!batch) return { error: "Batch not found", status: 404 as const };
    if (restoreCount > Number(batch.initialCount || 0)) {
      return {
        error: `Restore fish count cannot exceed the original stocked count of ${Number(batch.initialCount || 0).toLocaleString()}`,
        status: 400 as const,
      };
    }

    let restoredTankName = "";
    if (tankId) {
      const tank = await Tank.findOne({ _id: tankId, userId }).session(txSession || null);
      if (!tank) return { error: "Tank not found", status: 404 as const };

      const conflictingBatch = await Batch.findOne({
        _id: { $ne: batch._id },
        userId,
        status: { $in: ["active", "partial"] },
        $and: [
          { "tankAllocations.tankId": String(tank._id) },
          { $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }] },
        ],
      })
        .select("name")
        .session(txSession || null);

      if (conflictingBatch) {
        return {
          error: `${tank.name} is already allocated to active batch ${conflictingBatch.name}. Clear or move those fish first.`,
          status: 409 as const,
        };
      }

      const currentFish = Math.max(0, Math.trunc(Number(tank.currentFish || 0)));
      const targetFishCapacity = Math.max(0, Math.trunc(Number(tank.targetFishCapacity || 0)));

      if (targetFishCapacity > 0 && restoreCount > targetFishCapacity) {
        return {
          error: `${tank.name} fish capacity is ${targetFishCapacity}. Reduce the restore count or update tank capacity.`,
          status: 409 as const,
        };
      }
      if (currentFish > 0 && currentFish !== restoreCount) {
        return {
          error: `${tank.name} currently shows ${currentFish.toLocaleString()} fish. Match the restore count to that tank count or clear the tank first.`,
          status: 409 as const,
        };
      }

      if (currentFish === 0) tank.currentFish = restoreCount;
      syncTankOccupancy(tank, String(batch._id));
      await tank.save({ session: txSession || undefined });

      batch.tankAllocations = [
        {
          tankId: String(tank._id),
          tankName: tank.name,
          fishCount: restoreCount,
          phase: "recovered",
        },
      ];
      restoredTankName = tank.name;
    } else {
      batch.tankAllocations = [];
    }

    batch.status = "active";
    batch.currentCount = restoreCount;
    batch.harvestDate = null;
    batch.harvestedWeightKg = null;
    batch.harvestPricePerKg = null;
    batch.harvestNotes = "";
    await batch.save({ session: txSession || undefined });

    return {
      batchId: String(batch._id),
      batchName: batch.name,
      restoredTankName,
      restoreCount,
    };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await recordAuditEvent({
    sessionUser: session.user,
    action: "update",
    resource: "batch",
    resourceId: result.batchId,
    summary: `Reopened batch ${result.batchName}`,
    meta: {
      restoreCount: result.restoreCount,
      tankName: result.restoredTankName || null,
    },
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
