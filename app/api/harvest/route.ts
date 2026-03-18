import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Financial } from "@/models/Financial";
import { Batch } from "@/models/Batch";
import { Tank } from "@/models/Tank";
import { runAtomic } from "@/lib/transactions";
import { validateHarvestPayload } from "@/lib/validators/harvest";
import { normalizeTankAllocations, syncTankOccupancy } from "@/lib/tank-allocations";

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
  const validated = validateHarvestPayload(body);
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });

  await connectDB();
  const userId = (session.user as any).id;
  const payload = validated.value;

  const result = await runAtomic(async (txSession) => {
    const batch = await Batch.findOne({
      _id: payload.batchId,
      userId,
      $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
    }).session(txSession || null);
    if (!batch) return { error: "Batch not found", status: 404 as const };

    let fin = await Financial.findOne({ userId }).session(txSession || null);
    if (!fin) {
      const created = await Financial.create([{ userId, expenses: [], revenue: [] }], {
        session: txSession || undefined,
      });
      fin = created[0];
    }

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
    await fin.save({ session: txSession || undefined });

    if (payload.markBatchHarvested) {
      const allocations = normalizeTankAllocations(batch.tankAllocations);
      const tankIds = allocations.map((item) => item.tankId).filter(Boolean);
      if (tankIds.length > 0) {
        const tanks = await Tank.find({ userId, _id: { $in: tankIds } }).session(txSession || null);
        await Promise.all(
          tanks.map(async (tank) => {
            const allocated = allocations
              .filter((item) => item.tankId === String(tank._id))
              .reduce((sum, item) => sum + Number(item.fishCount || 0), 0);
            tank.currentFish = Math.max(0, Number(tank.currentFish || 0) - allocated);
            syncTankOccupancy(tank, String(batch._id));
            await tank.save({ session: txSession || undefined });
          }),
        );
      }

      batch.status = "harvested";
      batch.harvestDate = payload.date ? new Date(payload.date) : new Date();
      batch.harvestedWeightKg = payload.weightKg;
      batch.harvestPricePerKg = payload.pricePerKg;
      batch.currentCount = 0;
      batch.tankAllocations = [];
      await batch.save({ session: txSession || undefined });
    }

    return { created: fin.revenue[fin.revenue.length - 1] };
  });

  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const created = result.created;
  return NextResponse.json(created, { status: 201 });
}
