import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { DailyLog } from "@/models/DailyLog";
import { Batch } from "@/models/Batch";
import { Types } from "mongoose";

type LogPatchBody = {
  batchId?: string;
  date?: string;
  feedSession?: "morning" | "evening";
  tankId?: string;
  tankName?: string;
  feedGiven?: number;
  feedType?: string;
  mortality?: number;
  mortalityCause?: string;
  fishCount?: number;
  avgWeight?: number;
  ph?: number | null;
  ammonia?: number | null;
  temperature?: number | null;
  dissolvedO2?: number | null;
  waterChanged?: boolean;
  waterChangePct?: number;
  observations?: string;
};

function normalizeOptionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function validatePatchBody(body: LogPatchBody): { ok: true; value: Record<string, any> } | { ok: false; error: string } {
  const update: Record<string, any> = {};

  if (body.batchId !== undefined) {
    if (!Types.ObjectId.isValid(body.batchId)) return { ok: false, error: "Invalid batch id" };
    update.batchId = body.batchId;
  }
  if (body.date !== undefined) {
    const d = new Date(body.date);
    if (Number.isNaN(d.getTime())) return { ok: false, error: "Invalid log date" };
    update.date = d;
  }
  if (body.feedSession !== undefined) {
    if (body.feedSession !== "morning" && body.feedSession !== "evening") {
      return { ok: false, error: "Feed session must be morning or evening" };
    }
    update.feedSession = body.feedSession;
  }
  if (body.tankId !== undefined) update.tankId = String(body.tankId || "").trim();
  if (body.tankName !== undefined) update.tankName = String(body.tankName || "").trim();
  if (body.feedType !== undefined) update.feedType = String(body.feedType || "").trim();
  if (body.mortalityCause !== undefined) update.mortalityCause = String(body.mortalityCause || "").trim();
  if (body.observations !== undefined) update.observations = String(body.observations || "").trim();

  if (body.feedGiven !== undefined) {
    const n = Number(body.feedGiven);
    if (!Number.isFinite(n) || n < 0) return { ok: false, error: "Feed given cannot be negative" };
    update.feedGiven = n;
  }
  if (body.mortality !== undefined) {
    const n = Math.trunc(Number(body.mortality));
    if (!Number.isFinite(n) || n < 0) return { ok: false, error: "Mortality cannot be negative" };
    update.mortality = n;
  }
  if (body.ph !== undefined) {
    const ph = normalizeOptionalNumber(body.ph);
    if (ph !== undefined && (ph < 0 || ph > 14)) return { ok: false, error: "pH must be between 0 and 14" };
    update.ph = ph ?? null;
  }
  if (body.ammonia !== undefined) {
    const ammonia = normalizeOptionalNumber(body.ammonia);
    if (ammonia !== undefined && ammonia < 0) return { ok: false, error: "Ammonia cannot be negative" };
    update.ammonia = ammonia ?? null;
  }
  if (body.temperature !== undefined) {
    const temperature = normalizeOptionalNumber(body.temperature);
    if (temperature !== undefined && (temperature < -10 || temperature > 60)) {
      return { ok: false, error: "Temperature is out of valid range" };
    }
    update.temperature = temperature ?? null;
  }
  if (body.dissolvedO2 !== undefined) {
    const d = normalizeOptionalNumber(body.dissolvedO2);
    if (d !== undefined && d < 0) return { ok: false, error: "Dissolved oxygen cannot be negative" };
    update.dissolvedO2 = d ?? null;
  }
  if (body.fishCount !== undefined) {
    const n = normalizeOptionalNumber(body.fishCount);
    if (n !== undefined && n < 0) return { ok: false, error: "Fish count cannot be negative" };
    update.fishCount = n;
  }
  if (body.avgWeight !== undefined) {
    const n = normalizeOptionalNumber(body.avgWeight);
    if (n !== undefined && n < 0) return { ok: false, error: "Average weight cannot be negative" };
    update.avgWeight = n;
  }
  if (body.waterChanged !== undefined) update.waterChanged = Boolean(body.waterChanged);
  if (body.waterChangePct !== undefined) {
    const n = Math.trunc(Number(body.waterChangePct));
    if (!Number.isFinite(n) || n < 0 || n > 100) return { ok: false, error: "Water change % must be between 0 and 100" };
    update.waterChangePct = n;
  }
  if (update.waterChanged === true && (update.waterChangePct === undefined || update.waterChangePct <= 0)) {
    return { ok: false, error: "Enter water change % when water was changed" };
  }
  if (update.waterChanged === false) update.waterChangePct = 0;

  return { ok: true, value: update };
}

async function applyMortalityDelta(batchId: string, userId: string, deltaMortality: number) {
  if (!deltaMortality) return;
  const batch = await Batch.findOne({
    _id: batchId,
    userId,
    $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
  });
  if (!batch) return;
  batch.currentCount = Math.max(0, (batch.currentCount || 0) - deltaMortality);
  await batch.save();
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!Types.ObjectId.isValid(params.id)) return NextResponse.json({ error: "Invalid log id" }, { status: 400 });

  const body = (await req.json()) as LogPatchBody;
  const validated = validatePatchBody(body);
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });

  await connectDB();
  const userId = (session.user as any).id;
  const existing = await DailyLog.findOne({ _id: params.id, userId });
  if (!existing) return NextResponse.json({ error: "Log not found" }, { status: 404 });

  const update = validated.value;
  const oldBatchId = String(existing.batchId);
  const newBatchId = update.batchId ? String(update.batchId) : oldBatchId;
  const oldMortality = Number(existing.mortality || 0);
  const newMortality = update.mortality !== undefined ? Number(update.mortality || 0) : oldMortality;

  if (newBatchId !== oldBatchId) {
    const targetBatch = await Batch.findOne({
      _id: newBatchId,
      userId,
      $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
    });
    if (!targetBatch) return NextResponse.json({ error: "Target batch not found" }, { status: 404 });
  }

  Object.assign(existing, update);
  await existing.save();

  if (newBatchId === oldBatchId) {
    await applyMortalityDelta(oldBatchId, userId, newMortality - oldMortality);
  } else {
    await applyMortalityDelta(oldBatchId, userId, -oldMortality);
    await applyMortalityDelta(newBatchId, userId, newMortality);
  }

  return NextResponse.json(existing);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!Types.ObjectId.isValid(params.id)) return NextResponse.json({ error: "Invalid log id" }, { status: 400 });

  await connectDB();
  const userId = (session.user as any).id;
  const existing = await DailyLog.findOne({ _id: params.id, userId });
  if (!existing) return NextResponse.json({ error: "Log not found" }, { status: 404 });

  const batchId = String(existing.batchId);
  const mortality = Number(existing.mortality || 0);
  await existing.deleteOne();
  await applyMortalityDelta(batchId, userId, -mortality);

  return NextResponse.json({ success: true });
}
