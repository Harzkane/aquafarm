import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Types } from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { DailyLog } from "@/models/DailyLog";
import { Batch } from "@/models/Batch";
import { User } from "@/models/User";
import { getPlanConfig } from "@/lib/plans";
import { recordAuditEvent } from "@/lib/audit";

type WaterPayload = {
  batchId: string;
  date?: string;
  feedSession?: "morning" | "evening";
  tankName?: string;
  ph?: number | null;
  ammonia?: number | null;
  temperature?: number | null;
  dissolvedO2?: number | null;
  waterChanged?: boolean;
  waterChangePct?: number;
  observations?: string;
};

function optionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function validatePayload(body: any): { ok: true; value: WaterPayload } | { ok: false; error: string } {
  const batchId = typeof body?.batchId === "string" ? body.batchId.trim() : "";
  if (!Types.ObjectId.isValid(batchId)) return { ok: false, error: "Valid batch is required" };

  const date = body?.date ? new Date(body.date) : new Date();
  if (Number.isNaN(date.getTime())) return { ok: false, error: "Invalid reading date" };

  const feedSession = body?.feedSession === "evening" ? "evening" : "morning";
  const ph = optionalNumber(body?.ph);
  const ammonia = optionalNumber(body?.ammonia);
  const temperature = optionalNumber(body?.temperature);
  const dissolvedO2 = optionalNumber(body?.dissolvedO2);
  const waterChanged = Boolean(body?.waterChanged);
  const waterChangePct = Math.trunc(optionalNumber(body?.waterChangePct) ?? 0);

  if (ph !== undefined && (ph < 0 || ph > 14)) return { ok: false, error: "pH must be between 0 and 14" };
  if (ammonia !== undefined && ammonia < 0) return { ok: false, error: "Ammonia cannot be negative" };
  if (temperature !== undefined && (temperature < -10 || temperature > 60)) return { ok: false, error: "Temperature is out of range" };
  if (dissolvedO2 !== undefined && dissolvedO2 < 0) return { ok: false, error: "Dissolved oxygen cannot be negative" };
  if (waterChangePct < 0 || waterChangePct > 100) return { ok: false, error: "Water change % must be between 0 and 100" };
  if (waterChanged && waterChangePct <= 0) return { ok: false, error: "Enter water change % when water was changed" };
  if (ph === undefined && ammonia === undefined && temperature === undefined && dissolvedO2 === undefined) {
    return { ok: false, error: "Enter at least one water metric (pH, ammonia, temperature, DO)" };
  }

  return {
    ok: true,
    value: {
      batchId,
      date: date.toISOString(),
      feedSession,
      tankName: String(body?.tankName || "").trim(),
      ph,
      ammonia,
      temperature,
      dissolvedO2,
      waterChanged,
      waterChangePct: waterChanged ? waterChangePct : 0,
      observations: String(body?.observations || "").trim(),
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

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  const { searchParams } = new URL(req.url);
  const requestedLimit = Number(searchParams.get("limit") || 100);
  const batchId = searchParams.get("batchId");

  await connectDB();
  const user = await User.findById(userId).select("plan").lean<any>();
  const plan = getPlanConfig(user?.plan);
  const maxLimit = plan.reportHistoryDays ? 300 : 5000;
  const fallbackLimit = plan.reportHistoryDays ? 100 : 1000;
  const limit = Math.max(
    1,
    Math.min(maxLimit, Number.isFinite(requestedLimit) ? Math.trunc(requestedLimit) : fallbackLimit)
  );

  const query: Record<string, any> = {
    userId,
    $or: [
      { ph: { $ne: null } },
      { ammonia: { $ne: null } },
      { temperature: { $ne: null } },
      { dissolvedO2: { $ne: null } },
    ],
  };
  if (batchId && Types.ObjectId.isValid(batchId)) query.batchId = batchId;
  if (plan.reportHistoryDays) {
    query.date = { $gte: new Date(Date.now() - plan.reportHistoryDays * 24 * 60 * 60 * 1000) };
  }

  const logs = await DailyLog.find(query)
    .sort({ date: -1, createdAt: -1 })
    .limit(limit)
    .populate("batchId", "name");

  return NextResponse.json(logs);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const validated = validatePayload(body);
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
  if (String(batch.status || "") === "harvested") {
    return NextResponse.json({ error: "Water quality cannot be recorded for a harvested batch" }, { status: 409 });
  }

  const date = new Date(payload.date || new Date().toISOString());
  const { start, end } = dayRange(date);
  const normalizedTankName = String(payload.tankName || "").trim();
  const slotMatcher =
    payload.feedSession === "evening"
      ? [{ feedSession: "evening" }]
      : [{ feedSession: "morning" }, { feedSession: { $exists: false } }, { feedSession: null }];

  const existing = await DailyLog.findOne({
    userId,
    batchId: payload.batchId,
    date: { $gte: start, $lte: end },
    tankName: normalizedTankName,
    $or: slotMatcher,
  });

  let log;
  let auditAction: "create" | "update" = "create";
  if (existing) {
    existing.feedSession = payload.feedSession;
    existing.tankName = normalizedTankName;
    existing.ph = payload.ph ?? null;
    existing.ammonia = payload.ammonia ?? null;
    existing.temperature = payload.temperature ?? null;
    existing.dissolvedO2 = payload.dissolvedO2 ?? null;
    existing.waterChanged = payload.waterChanged ?? false;
    existing.waterChangePct = payload.waterChangePct ?? 0;
    existing.observations = payload.observations || existing.observations || "";
    existing.date = date;
    await existing.save();
    log = existing;
    auditAction = "update";
  } else {
    log = await DailyLog.create({
      userId,
      batchId: payload.batchId,
      date,
      feedSession: payload.feedSession,
      tankName: normalizedTankName,
      ph: payload.ph,
      ammonia: payload.ammonia,
      temperature: payload.temperature,
      dissolvedO2: payload.dissolvedO2,
      waterChanged: payload.waterChanged ?? false,
      waterChangePct: payload.waterChangePct ?? 0,
      observations: payload.observations || "",
      feedGiven: 0,
      mortality: 0,
    });
  }

  await recordAuditEvent({
    sessionUser: session.user,
    action: auditAction,
    resource: "water_quality",
    resourceId: log._id.toString(),
    summary: `${auditAction === "create" ? "Recorded" : "Updated"} water quality for ${batch.name}`,
    meta: {
      batchId: batch._id.toString(),
      batchName: batch.name,
      feedSession: payload.feedSession || "morning",
      tankName: normalizedTankName,
      ph: payload.ph ?? null,
      ammonia: payload.ammonia ?? null,
      temperature: payload.temperature ?? null,
      dissolvedO2: payload.dissolvedO2 ?? null,
      waterChanged: Boolean(payload.waterChanged),
      waterChangePct: Number(payload.waterChangePct || 0),
      date: date.toISOString(),
    },
  }).catch(() => {});

  return NextResponse.json(log, { status: 201 });
}
