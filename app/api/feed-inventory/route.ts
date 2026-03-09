import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { FeedInventory } from "@/models/FeedInventory";
import { DailyLog } from "@/models/DailyLog";

type PurchasePayload = {
  date?: string;
  brand: string;
  bagSizeKg: number;
  bags: number;
  unitPrice: number;
  supplier?: string;
  notes?: string;
};

function validatePayload(body: any): { ok: true; value: PurchasePayload } | { ok: false; error: string } {
  const date = body?.date ? new Date(body.date) : new Date();
  if (Number.isNaN(date.getTime())) return { ok: false, error: "Invalid purchase date" };

  const brand = String(body?.brand || "").trim();
  const bagSizeKg = Number(body?.bagSizeKg || 0);
  const bags = Number(body?.bags || 0);
  const unitPrice = Number(body?.unitPrice || 0);

  if (!brand) return { ok: false, error: "Feed brand/type is required" };
  if (!Number.isFinite(bagSizeKg) || bagSizeKg <= 0) return { ok: false, error: "Bag size must be greater than 0" };
  if (!Number.isFinite(bags) || bags <= 0) return { ok: false, error: "Number of bags must be greater than 0" };
  if (!Number.isFinite(unitPrice) || unitPrice < 0) return { ok: false, error: "Unit price cannot be negative" };

  return {
    ok: true,
    value: {
      date: date.toISOString(),
      brand,
      bagSizeKg,
      bags,
      unitPrice,
      supplier: String(body?.supplier || "").trim(),
      notes: String(body?.notes || "").trim(),
    },
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  await connectDB();

  const [inventory, logs] = await Promise.all([
    FeedInventory.findOne({ userId }).lean<any>(),
    DailyLog.find({ userId }).select("feedGiven date").lean<any[]>(),
  ]);

  const purchases = (inventory?.purchases || []).slice().sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const openingStockKg = Number(inventory?.openingStockKg || 0);
  const purchasedKg = purchases.reduce((s: number, p: any) => s + Number(p.totalKg || 0), 0);
  const purchasedCost = purchases.reduce((s: number, p: any) => s + Number(p.totalCost || 0), 0);
  const consumedKg = logs.reduce((s: number, l: any) => s + Number(l.feedGiven || 0), 0);
  const remainingKg = Math.max(0, openingStockKg + purchasedKg - consumedKg);

  const last14 = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const logs14 = logs.filter((l: any) => new Date(l.date).getTime() >= last14.getTime());
  const consumed14 = logs14.reduce((s: number, l: any) => s + Number(l.feedGiven || 0), 0);
  const feedingDays14 = new Set(
    logs14
      .filter((l: any) => Number(l.feedGiven || 0) > 0)
      .map((l: any) => new Date(l.date).toISOString().slice(0, 10))
  ).size;
  const avgDailyUse = feedingDays14 > 0 ? consumed14 / feedingDays14 : 0;
  const estimatedDaysLeft = avgDailyUse > 0 ? remainingKg / avgDailyUse : null;

  return NextResponse.json({
    openingStockKg,
    purchases,
    totals: {
      purchasedKg,
      purchasedCost,
      consumedKg,
      remainingKg,
      avgDailyUse,
      estimatedDaysLeft,
      feedingDays14,
    },
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const validated = validatePayload(body);
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });

  const userId = (session.user as any).id;
  const payload = validated.value;
  await connectDB();

  let inventory = await FeedInventory.findOne({ userId });
  if (!inventory) inventory = await FeedInventory.create({ userId, openingStockKg: 0, purchases: [] });

  const totalKg = payload.bagSizeKg * payload.bags;
  const totalCost = payload.unitPrice * payload.bags;

  inventory.purchases.push({
    date: payload.date ? new Date(payload.date) : new Date(),
    brand: payload.brand,
    bagSizeKg: payload.bagSizeKg,
    bags: payload.bags,
    totalKg,
    unitPrice: payload.unitPrice,
    totalCost,
    supplier: payload.supplier || "",
    notes: payload.notes || "",
  });
  inventory.updatedAt = new Date();
  await inventory.save();

  return NextResponse.json(inventory, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const openingStockKg = Number(body?.openingStockKg);
  if (!Number.isFinite(openingStockKg) || openingStockKg < 0) {
    return NextResponse.json({ error: "Opening stock must be a non-negative number" }, { status: 400 });
  }

  const userId = (session.user as any).id;
  await connectDB();
  const inventory = await FeedInventory.findOneAndUpdate(
    { userId },
    { $set: { openingStockKg, updatedAt: new Date() } },
    { upsert: true, new: true }
  );
  return NextResponse.json(inventory);
}
