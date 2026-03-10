import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { DailyLog } from "@/models/DailyLog";
import { Batch } from "@/models/Batch";
import { User } from "@/models/User";
import { getPlanConfig } from "@/lib/plans";
import { Types } from "mongoose";
import { recordAuditEvent } from "@/lib/audit";

type LogPayload = {
  batchId: string;
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

function validateLogPayload(body: any): { ok: true; value: LogPayload } | { ok: false; error: string } {
  const batchId = typeof body?.batchId === "string" ? body.batchId.trim() : "";
  if (!batchId || !Types.ObjectId.isValid(batchId)) return { ok: false, error: "Valid batch is required" };

  const feedGiven = normalizeOptionalNumber(body?.feedGiven) ?? 0;
  const feedSession = body?.feedSession === "evening" ? "evening" : "morning";
  const mortality = Math.trunc(normalizeOptionalNumber(body?.mortality) ?? 0);
  const ph = normalizeOptionalNumber(body?.ph);
  const ammonia = normalizeOptionalNumber(body?.ammonia);
  const temperature = normalizeOptionalNumber(body?.temperature);
  const waterChangePct = Math.trunc(normalizeOptionalNumber(body?.waterChangePct) ?? 0);
  const fishCount = normalizeOptionalNumber(body?.fishCount);
  const avgWeight = normalizeOptionalNumber(body?.avgWeight);
  const dissolvedO2 = normalizeOptionalNumber(body?.dissolvedO2);
  const waterChanged = Boolean(body?.waterChanged);
  const date = body?.date ? new Date(body.date) : new Date();

  if (Number.isNaN(date.getTime())) return { ok: false, error: "Invalid log date" };
  if (feedGiven < 0) return { ok: false, error: "Feed given cannot be negative" };
  if (mortality < 0) return { ok: false, error: "Mortality cannot be negative" };
  if (ph !== undefined && (ph < 0 || ph > 14)) return { ok: false, error: "pH must be between 0 and 14" };
  if (ammonia !== undefined && ammonia < 0) return { ok: false, error: "Ammonia cannot be negative" };
  if (temperature !== undefined && (temperature < -10 || temperature > 60)) return { ok: false, error: "Temperature is out of valid range" };
  if (waterChangePct < 0 || waterChangePct > 100) return { ok: false, error: "Water change % must be between 0 and 100" };
  if (waterChanged && waterChangePct <= 0) return { ok: false, error: "Enter water change % when water was changed" };

  return {
    ok: true,
    value: {
      batchId,
      date: date.toISOString(),
      feedSession,
      tankId: typeof body?.tankId === "string" ? body.tankId.trim() : "",
      tankName: typeof body?.tankName === "string" ? body.tankName.trim() : "",
      feedGiven,
      feedType: typeof body?.feedType === "string" ? body.feedType.trim() : "",
      mortality,
      mortalityCause: typeof body?.mortalityCause === "string" ? body.mortalityCause.trim() : "",
      fishCount,
      avgWeight,
      ph,
      ammonia,
      temperature,
      dissolvedO2,
      waterChanged,
      waterChangePct: waterChanged ? waterChangePct : 0,
      observations: typeof body?.observations === "string" ? body.observations.trim() : "",
    },
  };
}

function dayRange(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

async function applyMortalityDelta(batchId: string, userId: string, deltaMortality: number) {
  if (!deltaMortality) return;
  const batch = await Batch.findOne({
    _id: batchId,
    userId,
    $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
  });
  if (!batch) return;
  const updatedCount = Math.max(0, (batch.currentCount || 0) - deltaMortality);
  batch.currentCount = updatedCount;
  await batch.save();
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const batchId = searchParams.get("batchId");
  const requestedLimit = Number(searchParams.get("limit") || 100);
  await connectDB();
  const userId = (session.user as any).id;
  const user = await User.findById(userId).select("plan").lean<any>();
  const plan = getPlanConfig(user?.plan);
  const maxLimit = plan.reportHistoryDays ? 300 : 5000;
  const fallbackLimit = plan.reportHistoryDays ? 100 : 1000;
  const limit = Math.max(
    1,
    Math.min(maxLimit, Number.isFinite(requestedLimit) ? Math.trunc(requestedLimit) : fallbackLimit)
  );

  const query: any = { userId };
  if (batchId && Types.ObjectId.isValid(batchId)) query.batchId = batchId;
  if (plan.reportHistoryDays) {
    const historyStart = new Date(Date.now() - plan.reportHistoryDays * 24 * 60 * 60 * 1000);
    query.date = { $gte: historyStart };
  }

  const logs = await DailyLog.find(query).sort({ date: -1 }).limit(limit).populate("batchId", "name");
  return NextResponse.json(logs);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const validated = validateLogPayload(body);
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });

  await connectDB();
  const userId = (session.user as any).id;
  const payload = validated.value;

  const batch = await Batch.findOne({
    _id: payload.batchId,
    userId,
    $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
  });
  if (!batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });

  const logDate = new Date(payload.date || new Date().toISOString());
  const { start, end } = dayRange(logDate);
  const feedSession = payload.feedSession || "morning";
  const slotMatcher =
    feedSession === "morning"
      ? [{ feedSession: "morning" }, { feedSession: { $exists: false } }, { feedSession: null }]
      : [{ feedSession: "evening" }];
  const existing = await DailyLog.findOne({
    userId,
    batchId: payload.batchId,
    date: { $gte: start, $lte: end },
    $or: slotMatcher,
  });

  let log;
  let auditAction: "create" | "update" = "create";
  if (existing) {
    const previousMortality = Number(existing.mortality || 0);
    const nextMortality = Number(payload.mortality || 0);
    const deltaMortality = nextMortality - previousMortality;
    Object.assign(existing, payload);
    existing.date = logDate;
    await existing.save();
    await applyMortalityDelta(payload.batchId, userId, deltaMortality);
    log = existing;
    auditAction = "update";
  } else {
    log = await DailyLog.create({ ...payload, userId, date: logDate });
    await applyMortalityDelta(payload.batchId, userId, Number(payload.mortality || 0));
  }

  await recordAuditEvent({
    sessionUser: session.user,
    action: auditAction,
    resource: "daily_log",
    resourceId: log._id.toString(),
    summary: `${auditAction === "create" ? "Created" : "Updated"} daily log for ${batch.name}`,
    meta: {
      batchId: batch._id.toString(),
      batchName: batch.name,
      feedSession: payload.feedSession || "morning",
      feedGiven: Number(payload.feedGiven || 0),
      mortality: Number(payload.mortality || 0),
      date: logDate.toISOString(),
    },
  }).catch(() => {});

  return NextResponse.json(log, { status: 201 });
}
