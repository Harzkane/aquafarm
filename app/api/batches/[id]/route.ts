import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Batch } from "@/models/Batch";
import { DailyLog } from "@/models/DailyLog";
import { Financial } from "@/models/Financial";
import { Types } from "mongoose";
import { User } from "@/models/User";
import { getPlanConfig } from "@/lib/plans";
import { recordAuditEvent } from "@/lib/audit";

type UpdateBody = {
  name?: string;
  stockingDate?: string;
  initialCount?: number;
  juvenileCost?: number;
  targetWeight?: number;
  notes?: string;
  status?: "active" | "harvested" | "partial";
  harvestDate?: string | null;
  harvestedWeightKg?: number;
  harvestPricePerKg?: number;
  harvestNotes?: string;
};

function validateUpdate(body: UpdateBody) {
  const update: Record<string, any> = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return { ok: false as const, error: "Batch name is required" };
    update.name = name;
  }

  if (body.stockingDate !== undefined) {
    const d = new Date(body.stockingDate);
    if (Number.isNaN(d.getTime())) return { ok: false as const, error: "Stocking date is invalid" };
    update.stockingDate = d;
  }

  if (body.initialCount !== undefined) {
    const n = Number(body.initialCount);
    if (!Number.isFinite(n) || n <= 0) {
      return { ok: false as const, error: "Initial fish count must be greater than 0" };
    }
    update.initialCount = Math.round(n);
  }

  if (body.juvenileCost !== undefined) {
    const c = Number(body.juvenileCost);
    if (!Number.isFinite(c) || c < 0) return { ok: false as const, error: "Juvenile cost cannot be negative" };
    update.juvenileCost = c;
  }

  if (body.targetWeight !== undefined) {
    const w = Number(body.targetWeight);
    if (!Number.isFinite(w) || w <= 0) return { ok: false as const, error: "Target weight must be greater than 0" };
    update.targetWeight = w;
  }

  if (body.notes !== undefined) update.notes = String(body.notes).trim();

  if (body.status !== undefined) {
    if (!["active", "harvested", "partial"].includes(body.status)) {
      return { ok: false as const, error: "Invalid status" };
    }
    update.status = body.status;
  }

  if (body.harvestDate !== undefined) {
    if (body.harvestDate === null || body.harvestDate === "") {
      update.harvestDate = null;
    } else {
      const d = new Date(body.harvestDate);
      if (Number.isNaN(d.getTime())) return { ok: false as const, error: "Harvest date is invalid" };
      update.harvestDate = d;
    }
  }

  if (body.harvestedWeightKg !== undefined) {
    const w = Number(body.harvestedWeightKg);
    if (!Number.isFinite(w) || w < 0) return { ok: false as const, error: "Harvested weight cannot be negative" };
    update.harvestedWeightKg = w;
  }

  if (body.harvestPricePerKg !== undefined) {
    const p = Number(body.harvestPricePerKg);
    if (!Number.isFinite(p) || p < 0) return { ok: false as const, error: "Harvest price cannot be negative" };
    update.harvestPricePerKg = p;
  }

  if (body.harvestNotes !== undefined) update.harvestNotes = String(body.harvestNotes).trim();

  return { ok: true as const, value: update };
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as UpdateBody;
  const validated = validateUpdate(body);
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });
  if (!Types.ObjectId.isValid(params.id)) {
    return NextResponse.json({ error: "Invalid batch id" }, { status: 400 });
  }

  await connectDB();
  const userId = (session.user as any).id;
  const existing = await Batch.findOne({
    _id: params.id,
    userId,
    $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
  });
  if (!existing) return NextResponse.json({ error: "Batch not found" }, { status: 404 });

  const update = validated.value;
  if (typeof update.initialCount === "number") {
    const hasAdjustedFishCount = Number(existing.currentCount || 0) !== Number(existing.initialCount || 0);
    const [hasLogs, hasRevenue] = await Promise.all([
      DailyLog.exists({ userId, batchId: existing._id }),
      Financial.exists({ userId, "revenue.batchId": existing._id }),
    ]);

    if (hasAdjustedFishCount || hasLogs || hasRevenue) {
      return NextResponse.json(
        {
          error:
            "Initial fish count can only be edited before logs, mortality, or harvest activity exist for this batch. Use Reopen Batch to repair current fish totals instead.",
        },
        { status: 409 },
      );
    }
  }

  // Keep currentCount in sync if initial count is being edited before any mortality/growth adjustments.
  if (
    typeof update.initialCount === "number" &&
    existing.currentCount === existing.initialCount
  ) {
    update.currentCount = update.initialCount;
  }

  if (update.status === "active") {
    const user = await User.findById(userId).select("plan").lean<any>();
    const plan = getPlanConfig(user?.plan);
    if (plan.maxActiveBatches !== null) {
      const activeCount = await Batch.countDocuments({
        userId,
        status: "active",
        _id: { $ne: existing._id },
        $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
      });
      if (activeCount >= plan.maxActiveBatches) {
        return NextResponse.json(
          {
            error: `Your ${plan.label} plan allows up to ${plan.maxActiveBatches} active batch${plan.maxActiveBatches > 1 ? "es" : ""}. Upgrade to add more.`,
            code: "PLAN_LIMIT_ACTIVE_BATCHES",
            limit: plan.maxActiveBatches,
          },
          { status: 403 }
        );
      }
    }

    // Reopen clears harvested metadata to avoid stale values.
    update.harvestDate = null;
    update.harvestedWeightKg = null;
    update.harvestPricePerKg = null;
    update.harvestNotes = "";
  }

  const updated = await Batch.findOneAndUpdate(
    {
      _id: params.id,
      userId,
      $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
    },
    { $set: update },
    { new: true }
  );

  if (updated) {
    await recordAuditEvent({
      sessionUser: session.user,
      action: "update",
      resource: "batch",
      resourceId: updated._id.toString(),
      summary: `Updated batch ${updated.name}`,
      meta: { fields: Object.keys(update) },
    }).catch(() => {});
  }

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!Types.ObjectId.isValid(params.id)) {
    return NextResponse.json({ error: "Invalid batch id" }, { status: 400 });
  }

  await connectDB();
  const userId = (session.user as any).id;
  const existing = await Batch.findOne({
    _id: params.id,
    userId,
    $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
  });

  if (!existing) return NextResponse.json({ error: "Batch not found" }, { status: 404 });

  const hasLiveFish =
    Math.max(0, Math.trunc(Number(existing.currentCount || 0))) > 0 ||
    (Array.isArray(existing.tankAllocations) && existing.tankAllocations.some((allocation: any) => Number(allocation?.fishCount || 0) > 0));

  const [hasLogs, hasFinancialLinks] = await Promise.all([
    DailyLog.exists({ userId, batchId: existing._id }),
    Financial.exists({
      userId,
      $or: [{ "revenue.batchId": existing._id }, { "expenses.batchId": existing._id }],
    }),
  ]);

  if (hasLiveFish || hasLogs || hasFinancialLinks) {
    return NextResponse.json(
      {
        error:
          "Batches with live fish or recorded feed, mortality, expense, or harvest activity cannot be deleted. Harvest or reopen the batch instead so your reports stay consistent.",
      },
      { status: 409 },
    );
  }

  const deleted = await Batch.findOneAndUpdate(
    {
      _id: params.id,
      userId,
      $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
    },
    { $set: { deletedAt: new Date() } },
    { new: true }
  );

  await recordAuditEvent({
    sessionUser: session.user,
    action: "delete",
    resource: "batch",
    resourceId: deleted._id.toString(),
    summary: `Deleted batch ${deleted.name}`,
  }).catch(() => {});
  return NextResponse.json({ success: true });
}
