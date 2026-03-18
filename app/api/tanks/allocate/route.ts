import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Types } from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Batch } from "@/models/Batch";
import { Tank } from "@/models/Tank";
import { runAtomic } from "@/lib/transactions";
import { recordAuditEvent } from "@/lib/audit";

function toPositiveInt(value: unknown) {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }

  const batchId = String(body?.batchId || "").trim();
  const tankId = String(body?.tankId || "").trim();
  const count = toPositiveInt(body?.count);

  if (!Types.ObjectId.isValid(batchId)) {
    return NextResponse.json({ error: "Valid batch is required" }, { status: 400 });
  }
  if (!Types.ObjectId.isValid(tankId)) {
    return NextResponse.json({ error: "Valid tank is required" }, { status: 400 });
  }
  if (!count) {
    return NextResponse.json({ error: "Count must be greater than 0" }, { status: 400 });
  }

  await connectDB();
  const userId = (session.user as any).id;

  const result = await runAtomic(async (txSession) => {
    const [batch, tank] = await Promise.all([
      Batch.findOne({
        _id: batchId,
        userId,
        status: { $in: ["active", "partial"] },
        $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
      }).session(txSession || null),
      Tank.findOne({ _id: tankId, userId }).session(txSession || null),
    ]);

    if (!batch) return { error: "Active batch not found", status: 404 as const };
    if (!tank) return { error: "Tank not found", status: 404 as const };

    const allocations = Array.isArray(batch.tankAllocations) ? [...batch.tankAllocations] : [];
    const allocatedFish = allocations.reduce((sum: number, item: any) => sum + Number(item?.fishCount || 0), 0);
    const unassignedFish = Math.max(0, Number(batch.currentCount || 0) - allocatedFish);
    if (count > unassignedFish) {
      return { error: `Only ${unassignedFish.toLocaleString()} unassigned fish remain for ${batch.name}.`, status: 409 as const };
    }

    const currentFish = Number(tank.currentFish || 0);
    const targetFishCapacity = Number(tank.targetFishCapacity || 0);
    if (targetFishCapacity > 0 && currentFish + count > targetFishCapacity) {
      return {
        error: `${tank.name} fish capacity is ${targetFishCapacity}. Reduce allocation count or update fish capacity.`,
        status: 409 as const,
      };
    }

    tank.currentFish = currentFish + count;
    if (tank.currentFish > 0 && tank.status === "empty") tank.status = "active";
    if (!tank.currentBatch) tank.currentBatch = batch._id;

    const existingAllocation = allocations.find((item: any) => item?.tankId === String(tank._id));
    if (existingAllocation) {
      existingAllocation.fishCount = Number(existingAllocation.fishCount || 0) + count;
      existingAllocation.tankName = tank.name;
      existingAllocation.phase = existingAllocation.phase || "stocked";
    } else {
      allocations.push({
        tankId: String(tank._id),
        tankName: tank.name,
        fishCount: count,
        phase: "stocked",
      });
    }
    batch.tankAllocations = allocations;

    await Promise.all([
      tank.save({ session: txSession || undefined }),
      batch.save({ session: txSession || undefined }),
    ]);

    return {
      batchId: String(batch._id),
      batchName: batch.name,
      tankId: String(tank._id),
      tankName: tank.name,
      count,
    };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await recordAuditEvent({
    sessionUser: session.user,
    action: "update",
    resource: "tank",
    resourceId: result.tankId,
    summary: `Allocated ${result.count} fish from ${result.batchName} to ${result.tankName}`,
    meta: {
      batchId: result.batchId,
      batchName: result.batchName,
      tankId: result.tankId,
      tankName: result.tankName,
      count: result.count,
    },
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
