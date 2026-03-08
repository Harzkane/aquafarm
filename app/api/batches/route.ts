import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Batch } from "@/models/Batch";

function validateBatchPayload(body: any) {
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const stockingDate = new Date(body?.stockingDate);
  const initialCount = Number(body?.initialCount);
  const juvenileCost = body?.juvenileCost === undefined ? 0 : Number(body.juvenileCost);
  const targetWeight = body?.targetWeight === undefined ? 1000 : Number(body.targetWeight);
  const notes = typeof body?.notes === "string" ? body.notes.trim() : "";

  if (!name) return { ok: false as const, error: "Batch name is required" };
  if (!Number.isFinite(initialCount) || initialCount <= 0) {
    return { ok: false as const, error: "Initial fish count must be greater than 0" };
  }
  if (Number.isNaN(stockingDate.getTime())) {
    return { ok: false as const, error: "Stocking date is invalid" };
  }
  if (!Number.isFinite(juvenileCost) || juvenileCost < 0) {
    return { ok: false as const, error: "Juvenile cost cannot be negative" };
  }
  if (!Number.isFinite(targetWeight) || targetWeight <= 0) {
    return { ok: false as const, error: "Target weight must be greater than 0" };
  }

  return {
    ok: true as const,
    value: {
      name,
      stockingDate,
      initialCount: Math.round(initialCount),
      juvenileCost,
      targetWeight,
      notes,
    },
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const batches = await Batch.find({
    userId: (session.user as any).id,
    $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
  }).sort({ createdAt: -1 });
  return NextResponse.json(batches);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const validated = validateBatchPayload(body);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  await connectDB();
  const batch = await Batch.create({
    ...validated.value,
    userId: (session.user as any).id,
    currentCount: validated.value.initialCount,
    deletedAt: null,
  });
  return NextResponse.json(batch, { status: 201 });
}
