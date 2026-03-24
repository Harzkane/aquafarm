import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Types } from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Tank } from "@/models/Tank";
import { Batch } from "@/models/Batch";
import { recordAuditEvent } from "@/lib/audit";

const TANK_TYPES = new Set(["tarpaulin", "half-cut", "concrete", "fiberglass"]);
const STATUSES = new Set(["active", "empty", "cleaning", "quarantine"]);

function normalizeOptionalText(value: unknown, maxLen: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return undefined;
  return value.trim().slice(0, maxLen);
}

type PatchValue = {
  name?: string;
  type?: string;
  status?: string;
  capacity?: number;
  dimensions?: string;
  notes?: string;
  currentFish?: number;
  targetFishCapacity?: number;
};

function validatePatch(body: any): { ok: true; value: PatchValue } | { ok: false; error: string } {
  const update: PatchValue = {};

  if (body?.name !== undefined) {
    const name = normalizeOptionalText(body.name, 120);
    if (!name) return { ok: false, error: "Tank name cannot be empty" };
    update.name = name;
  }

  if (body?.type !== undefined) {
    const type = normalizeOptionalText(body.type, 30);
    if (!type || !TANK_TYPES.has(type)) return { ok: false, error: "Invalid tank type" };
    update.type = type;
  }

  if (body?.status !== undefined) {
    const status = normalizeOptionalText(body.status, 30);
    if (!status || !STATUSES.has(status)) return { ok: false, error: "Invalid tank status" };
    update.status = status;
  }

  if (body?.capacity !== undefined) {
    const capacity = Number(body.capacity);
    if (!Number.isFinite(capacity) || capacity <= 0) {
      return { ok: false, error: "Capacity must be a positive number" };
    }
    update.capacity = Math.trunc(capacity);
  }

  if (body?.currentFish !== undefined) {
    const fish = Number(body.currentFish);
    const currentFish = Math.trunc(fish);
    if (!Number.isFinite(fish) || currentFish < 0) {
      return { ok: false, error: "Current fish must be 0 or more" };
    }
    update.currentFish = currentFish;
  }

  if (body?.targetFishCapacity !== undefined) {
    const n = Number(body.targetFishCapacity);
    const targetFishCapacity = Math.trunc(n);
    if (!Number.isFinite(n) || targetFishCapacity < 0) {
      return { ok: false, error: "Fish capacity cannot be negative" };
    }
    update.targetFishCapacity = targetFishCapacity;
  }

  const dimensions = normalizeOptionalText(body?.dimensions, 120);
  if (dimensions !== undefined) update.dimensions = dimensions;

  const notes = normalizeOptionalText(body?.notes, 2000);
  if (notes !== undefined) update.notes = notes;

  if (
    update.targetFishCapacity !== undefined &&
    update.currentFish !== undefined &&
    update.targetFishCapacity > 0 &&
    update.currentFish > update.targetFishCapacity
  ) {
    return { ok: false, error: "Current fish cannot exceed fish capacity" };
  }

  return { ok: true, value: update };
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid tank ID" }, { status: 400 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }

  const validated = validatePatch(body);
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });

  try {
    await connectDB();
    const userId = (session.user as any).id;
    const tank = await Tank.findOne({ _id: id, userId });
    if (!tank) return NextResponse.json({ error: "Tank not found" }, { status: 404 });

    const nextCurrentFish =
      validated.value.currentFish !== undefined ? validated.value.currentFish : Number(tank.currentFish || 0);
    const nextTargetFish =
      validated.value.targetFishCapacity !== undefined ? validated.value.targetFishCapacity : Number(tank.targetFishCapacity || 0);
    if (nextTargetFish > 0 && nextCurrentFish > nextTargetFish) {
      return NextResponse.json({ error: "Current fish cannot exceed fish capacity" }, { status: 400 });
    }

    if (
      validated.value.currentFish !== undefined &&
      validated.value.currentFish !== Number(tank.currentFish || 0)
    ) {
      const linkedBatch = await Batch.findOne({
        userId,
        status: { $in: ["active", "partial"] },
        $and: [
          { $or: [{ "tankAllocations.tankId": id }, { "tankAllocations.tankName": tank.name }] },
          { $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }] },
        ],
      }).select("_id name");

      if (linkedBatch) {
        return NextResponse.json(
          {
            error: `Tank fish count is managed by batch allocation for ${linkedBatch.name}. Use Allocate Batch Fish, Move Fish, mortality, or harvest flows instead.`,
          },
          { status: 409 }
        );
      }

      if (validated.value.currentFish > 0) {
        return NextResponse.json(
          {
            error: "Tank fish count must be added through Allocate Batch Fish or Move Fish so batch allocations stay accurate.",
          },
          { status: 409 }
        );
      }
    }

    Object.assign(tank, validated.value);
    if (validated.value.capacity !== undefined) {
      tank.workingVolume = Math.round(validated.value.capacity * 0.78);
    }
    if (validated.value.currentFish !== undefined && validated.value.currentFish <= 0 && tank.currentBatch) {
      tank.currentBatch = undefined;
      if (tank.status === "active") tank.status = "empty";
    }

    await tank.save();
    await recordAuditEvent({
      sessionUser: session.user,
      action: "update",
      resource: "tank",
      resourceId: tank._id.toString(),
      summary: `Updated tank ${tank.name}`,
      meta: { fields: Object.keys(validated.value) },
    }).catch(() => {});
    return NextResponse.json(tank);
  } catch {
    return NextResponse.json({ error: "Failed to update tank" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid tank ID" }, { status: 400 });
  }

  try {
    await connectDB();
    const userId = (session.user as any).id;
    const tank = await Tank.findOne({ _id: id, userId });
    if (!tank) return NextResponse.json({ error: "Tank not found" }, { status: 404 });

    const linkedBatch = await Batch.findOne({
      userId,
      status: { $in: ["active", "partial"] },
      $and: [
        { $or: [{ "tankAllocations.tankId": id }, { "tankAllocations.tankName": tank.name }] },
        { $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }] },
      ],
    }).select("_id name");

    if (linkedBatch) {
      return NextResponse.json(
        { error: `Tank is linked to active batch ${linkedBatch.name}. Reassign fish before deleting.` },
        { status: 409 }
      );
    }

    if (Number(tank.currentFish || 0) > 0) {
      return NextResponse.json(
        { error: "Tank has fish tracked. Set fish count to 0 before deleting." },
        { status: 409 }
      );
    }

    await tank.deleteOne();
    await recordAuditEvent({
      sessionUser: session.user,
      action: "delete",
      resource: "tank",
      resourceId: tank._id.toString(),
      summary: `Deleted tank ${tank.name}`,
    }).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete tank" }, { status: 500 });
  }
}
