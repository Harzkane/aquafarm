import { Types } from "mongoose";
import { Tank } from "@/models/Tank";

type TankAllocationLike = {
  tankId?: string;
  tankName?: string;
  fishCount?: number;
  phase?: string;
};

function toTankId(value: unknown) {
  const id = String(value || "").trim();
  return Types.ObjectId.isValid(id) ? id : "";
}

export function normalizeTankAllocations(input: unknown): TankAllocationLike[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => ({
      tankId: toTankId((item as TankAllocationLike)?.tankId),
      tankName: String((item as TankAllocationLike)?.tankName || "").trim(),
      fishCount: Math.max(0, Math.trunc(Number((item as TankAllocationLike)?.fishCount || 0))),
      phase: String((item as TankAllocationLike)?.phase || "").trim(),
    }))
    .filter((item) => item.tankId || item.tankName || Number(item.fishCount || 0) > 0);
}

export function getAllocatedFishCount(input: unknown) {
  return normalizeTankAllocations(input).reduce((sum, item) => sum + Number(item.fishCount || 0), 0);
}

export function getTankAllocationCount(input: unknown, tankId: string) {
  return normalizeTankAllocations(input)
    .filter((item) => item.tankId === tankId)
    .reduce((sum, item) => sum + Number(item.fishCount || 0), 0);
}

export function upsertTankAllocation(
  input: unknown,
  tankId: string,
  tankName: string,
  count: number,
  phase: string,
) {
  const allocations = normalizeTankAllocations(input);
  const existing = allocations.find((item) => item.tankId === tankId);
  if (existing) {
    existing.fishCount = Number(existing.fishCount || 0) + count;
    existing.tankName = tankName;
    existing.phase = existing.phase || phase;
  } else {
    allocations.push({ tankId, tankName, fishCount: count, phase });
  }
  return allocations.filter((item) => Number(item.fishCount || 0) > 0);
}

export function syncTankOccupancy(tank: any, batchId?: string) {
  const currentFish = Math.max(0, Math.trunc(Number(tank.currentFish || 0)));
  tank.currentFish = currentFish;

  if (currentFish <= 0) {
    if (tank.status === "active") tank.status = "empty";
    tank.currentBatch = undefined;
    return;
  }

  if (tank.status === "empty") tank.status = "active";
  if (batchId && !tank.currentBatch) {
    tank.currentBatch = new Types.ObjectId(batchId);
  }
}

export async function removeFishFromBatchAllocations(params: {
  batch: any;
  userId: string;
  count: number;
  txSession?: any;
  preferredTankId?: string;
}) {
  const { batch, userId, txSession, preferredTankId } = params;
  let remaining = Math.max(0, Math.trunc(Number(params.count || 0)));
  if (!batch || remaining <= 0) return 0;

  const allocations = normalizeTankAllocations(batch.tankAllocations);
  if (allocations.length === 0) {
    batch.tankAllocations = [];
    return 0;
  }

  const ordered = allocations
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      if (preferredTankId) {
        const aPreferred = a.item.tankId === preferredTankId ? 1 : 0;
        const bPreferred = b.item.tankId === preferredTankId ? 1 : 0;
        if (aPreferred !== bPreferred) return bPreferred - aPreferred;
      }
      return Number(b.item.fishCount || 0) - Number(a.item.fishCount || 0);
    });

  const removedByTank = new Map<string, number>();

  for (const entry of ordered) {
    if (remaining <= 0) break;
    const available = Number(entry.item.fishCount || 0);
    if (available <= 0) continue;

    const removed = Math.min(available, remaining);
    entry.item.fishCount = available - removed;
    remaining -= removed;

    if (entry.item.tankId) {
      removedByTank.set(entry.item.tankId, Number(removedByTank.get(entry.item.tankId) || 0) + removed);
    }
  }

  const nextAllocations = allocations.filter((item) => Number(item.fishCount || 0) > 0);
  batch.tankAllocations = nextAllocations;

  const tankIds = Array.from(removedByTank.keys());
  if (tankIds.length === 0) {
    return Math.max(0, Math.trunc(Number(params.count || 0))) - remaining;
  }

  const tanks = await Tank.find({ userId, _id: { $in: tankIds } }).session(txSession || null);
  await Promise.all(
    tanks.map(async (tank) => {
      const removed = Number(removedByTank.get(String(tank._id)) || 0);
      if (removed <= 0) return;
      tank.currentFish = Math.max(0, Number(tank.currentFish || 0) - removed);
      syncTankOccupancy(tank, String(batch._id || ""));
      await tank.save({ session: txSession || undefined });
    }),
  );

  return Math.max(0, Math.trunc(Number(params.count || 0))) - remaining;
}
