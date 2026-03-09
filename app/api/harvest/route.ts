import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Types } from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Financial } from "@/models/Financial";
import { Batch } from "@/models/Batch";

const CHANNELS = ["POK", "restaurant", "market", "direct", "hotel", "other"] as const;

type HarvestPayload = {
  batchId: string;
  fishSold?: number;
  weightKg: number;
  pricePerKg: number;
  buyer?: string;
  channel?: string;
  date?: string;
  markBatchHarvested?: boolean;
};

function parseDate(value: unknown) {
  if (!value) return new Date();
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function validatePayload(body: any): { ok: true; value: HarvestPayload } | { ok: false; error: string } {
  const batchId = String(body?.batchId || "").trim();
  if (!Types.ObjectId.isValid(batchId)) return { ok: false, error: "Valid batch is required" };

  const fishSold = Math.trunc(Number(body?.fishSold || 0));
  const weightKg = Number(body?.weightKg || 0);
  const pricePerKg = Number(body?.pricePerKg || 0);
  const channel = String(body?.channel || "POK");
  const date = parseDate(body?.date);

  if (!Number.isFinite(fishSold) || fishSold < 0) return { ok: false, error: "Fish sold cannot be negative" };
  if (!Number.isFinite(weightKg) || weightKg <= 0) return { ok: false, error: "Weight (kg) must be greater than 0" };
  if (!Number.isFinite(pricePerKg) || pricePerKg < 0) return { ok: false, error: "Price/kg cannot be negative" };
  if (!CHANNELS.includes(channel as any)) return { ok: false, error: "Invalid sales channel" };
  if (!date) return { ok: false, error: "Invalid harvest date" };

  return {
    ok: true,
    value: {
      batchId,
      fishSold,
      weightKg,
      pricePerKg,
      buyer: String(body?.buyer || "").trim(),
      channel,
      date: date.toISOString(),
      markBatchHarvested: Boolean(body?.markBatchHarvested),
    },
  };
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  const { searchParams } = new URL(req.url);
  const batchId = searchParams.get("batchId");

  await connectDB();

  const [fin, batches] = await Promise.all([
    Financial.findOne({ userId }).lean<any>(),
    Batch.find({
      userId,
      $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
    })
      .select("name status harvestDate harvestedWeightKg harvestPricePerKg")
      .lean<any[]>(),
  ]);

  const batchMap = new Map<string, any>(batches.map((b) => [String(b._id), b]));
  let rows = (fin?.revenue || [])
    .filter((r: any) => !batchId || String(r.batchId || "") === batchId)
    .map((r: any) => {
      const b = batchMap.get(String(r.batchId || ""));
      const weightKg = Number(r.weightKg || 0);
      const amount = Number(r.totalAmount || 0);
      return {
        _id: String(r._id),
        batchId: r.batchId ? String(r.batchId) : "",
        batchName: b?.name || "Unknown Batch",
        fishSold: Number(r.fishSold || 0),
        weightKg,
        pricePerKg: Number(r.pricePerKg || 0),
        totalAmount: amount,
        buyer: String(r.buyer || ""),
        channel: String(r.channel || "other"),
        date: r.date,
        avgPricePerFish: Number(r.fishSold || 0) > 0 ? amount / Number(r.fishSold || 1) : 0,
      };
    })
    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totals = rows.reduce(
    (acc: any, row: any) => {
      acc.fishSold += row.fishSold || 0;
      acc.weightKg += row.weightKg || 0;
      acc.revenue += row.totalAmount || 0;
      return acc;
    },
    { fishSold: 0, weightKg: 0, revenue: 0 }
  );

  return NextResponse.json({ rows, totals, batches });
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

  let fin = await Financial.findOne({ userId });
  if (!fin) fin = await Financial.create({ userId, expenses: [], revenue: [] });

  const totalAmount = payload.weightKg * payload.pricePerKg;
  fin.revenue.push({
    batchId: payload.batchId,
    fishSold: payload.fishSold || 0,
    weightKg: payload.weightKg,
    pricePerKg: payload.pricePerKg,
    totalAmount,
    buyer: payload.buyer || "",
    channel: payload.channel || "other",
    date: payload.date ? new Date(payload.date) : new Date(),
  });
  fin.updatedAt = new Date();
  await fin.save();

  if (payload.markBatchHarvested) {
    batch.status = "harvested";
    batch.harvestDate = payload.date ? new Date(payload.date) : new Date();
    batch.harvestedWeightKg = payload.weightKg;
    batch.harvestPricePerKg = payload.pricePerKg;
    await batch.save();
  }

  const created = fin.revenue[fin.revenue.length - 1];
  return NextResponse.json(created, { status: 201 });
}

