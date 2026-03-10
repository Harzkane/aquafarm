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
import { runAtomic } from "@/lib/transactions";
import { validateLogPayload } from "@/lib/validators/logs";

function dayRange(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

async function applyMortalityDelta(
  batchId: string,
  userId: string,
  deltaMortality: number,
  txSession: any = null
) {
  if (!deltaMortality) return;
  const batch = await Batch.findOne({
    _id: batchId,
    userId,
    $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
  }).session(txSession || null);
  if (!batch) return;
  const updatedCount = Math.max(0, (batch.currentCount || 0) - deltaMortality);
  batch.currentCount = updatedCount;
  await batch.save({ session: txSession || undefined });
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
  const { log, auditAction } = await runAtomic(async (txSession) => {
    const existing = await DailyLog.findOne({
      userId,
      batchId: payload.batchId,
      date: { $gte: start, $lte: end },
      $or: slotMatcher,
    }).session(txSession || null);

    let logDoc;
    let action: "create" | "update" = "create";
    if (existing) {
      const previousMortality = Number(existing.mortality || 0);
      const nextMortality = Number(payload.mortality || 0);
      const deltaMortality = nextMortality - previousMortality;
      Object.assign(existing, payload);
      existing.date = logDate;
      await existing.save({ session: txSession || undefined });
      await applyMortalityDelta(payload.batchId, userId, deltaMortality, txSession);
      logDoc = existing;
      action = "update";
    } else {
      const created = await DailyLog.create([{ ...payload, userId, date: logDate }], {
        session: txSession || undefined,
      });
      logDoc = created[0];
      await applyMortalityDelta(payload.batchId, userId, Number(payload.mortality || 0), txSession);
    }

    return { log: logDoc, auditAction: action };
  });

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
