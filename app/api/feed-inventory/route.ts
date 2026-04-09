import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { FeedInventory } from "@/models/FeedInventory";
import { DailyLog } from "@/models/DailyLog";
import { getFeedIdentity, getFeedProductBalances, summarizeFeedInventory } from "@/lib/feed-inventory";
import { syncFeedPurchaseExpense } from "@/lib/financial-sync";

type PurchasePayload = {
  date?: string;
  brand: string;
  pelletSizeMm?: number | null;
  bagSizeKg: number;
  bags: number;
  unitPrice: number;
  supplier?: string;
  notes?: string;
};

function validatePayload(body: any): { ok: true; value: PurchasePayload } | { ok: false; error: string } {
  const date = body?.date ? new Date(body.date) : new Date();
  if (Number.isNaN(date.getTime())) return { ok: false, error: "Invalid purchase date" };

  const identity = getFeedIdentity({
    brand: String(body?.brand || "").trim(),
    pelletSizeMm: body?.pelletSizeMm,
    feedType: String(body?.brand || "").trim(),
  });
  const bagSizeKg = Number(body?.bagSizeKg || 0);
  const bags = Number(body?.bags || 0);
  const unitPrice = Number(body?.unitPrice || 0);

  if (!identity.brand) return { ok: false, error: "Feed brand/type is required" };
  if (!Number.isFinite(bagSizeKg) || bagSizeKg <= 0) return { ok: false, error: "Bag size must be greater than 0" };
  if (!Number.isFinite(bags) || bags <= 0) return { ok: false, error: "Number of bags must be greater than 0" };
  if (!Number.isFinite(unitPrice) || unitPrice < 0) return { ok: false, error: "Unit price cannot be negative" };

  return {
    ok: true,
    value: {
      date: date.toISOString(),
      brand: identity.brand,
      pelletSizeMm: identity.pelletSizeMm,
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
    DailyLog.find({ userId }).select("feedGiven date feedType feedBrand feedSizeMm").lean<any[]>(),
  ]);

  const purchases = (inventory?.purchases || []).slice().sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const summary = summarizeFeedInventory(
    {
      openingStockKg: inventory?.openingStockKg,
      openingStockBrand: inventory?.openingStockBrand,
      openingStockSizeMm: inventory?.openingStockSizeMm,
      purchases,
    },
    logs
  );

  return NextResponse.json({
    openingStockKg: summary.openingStockKg,
    openingStockBrand: inventory?.openingStockBrand || "",
    openingStockSizeMm: inventory?.openingStockSizeMm ?? null,
    openingStockDate: inventory?.openingStockDate ?? null,
    openingStockTotalCost: Number(inventory?.openingStockTotalCost || 0),
    openingStockSupplier: inventory?.openingStockSupplier || "",
    purchases,
    products: summary.products,
    lowStockProducts: summary.lowStockProducts,
    totals: {
      stockedKg: summary.stockedKg,
      purchasedKg: summary.purchasedKg,
      purchasedCost: summary.purchasedCost,
      consumedKg: summary.consumedKg,
      remainingKg: summary.remainingKg,
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
    pelletSizeMm: payload.pelletSizeMm ?? null,
    bagSizeKg: payload.bagSizeKg,
    bags: payload.bags,
    totalKg,
    unitPrice: payload.unitPrice,
    totalCost,
    supplier: payload.supplier || "",
    notes: payload.notes || "",
  });
  inventory.updatedAt = new Date();
  try {
    await inventory.save();
    const savedPurchase = inventory.purchases[inventory.purchases.length - 1];
    await syncFeedPurchaseExpense({
      userId,
      purchaseId: String(savedPurchase._id),
      date: new Date(savedPurchase.date),
      totalCost: Number(savedPurchase.totalCost || 0),
      brand: String(savedPurchase.brand || ""),
      pelletSizeMm: savedPurchase.pelletSizeMm ?? null,
      bagSizeKg: Number(savedPurchase.bagSizeKg || 0),
      bags: Number(savedPurchase.bags || 0),
      supplier: String(savedPurchase.supplier || ""),
    });
  } catch (error) {
    const rollbackEntry = inventory.purchases[inventory.purchases.length - 1];
    if (rollbackEntry) rollbackEntry.deleteOne();
    inventory.updatedAt = new Date();
    await inventory.save();
    throw error;
  }

  return NextResponse.json(inventory, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const openingStockKg = Number(body?.openingStockKg);
  const openingStockTotalCost = Number(body?.openingStockTotalCost || 0);
  const openingStockDate = body?.openingStockDate ? new Date(body.openingStockDate) : null;
  const identity = getFeedIdentity({
    brand: String(body?.openingStockBrand || "").trim(),
    pelletSizeMm: body?.openingStockSizeMm,
  });
  if (!Number.isFinite(openingStockKg) || openingStockKg < 0) {
    return NextResponse.json({ error: "Opening stock must be a non-negative number" }, { status: 400 });
  }
  if (!Number.isFinite(openingStockTotalCost) || openingStockTotalCost < 0) {
    return NextResponse.json({ error: "Opening stock value cannot be negative" }, { status: 400 });
  }
  if (openingStockDate && Number.isNaN(openingStockDate.getTime())) {
    return NextResponse.json({ error: "Opening stock date is invalid" }, { status: 400 });
  }
  const openingStockSupplier = String(body?.openingStockSupplier || "").trim();

  const userId = (session.user as any).id;
  await connectDB();
  const [inventory, logs] = await Promise.all([
    FeedInventory.findOne({ userId }),
    DailyLog.find({ userId }).select("feedGiven date feedType feedBrand feedSizeMm").lean<any[]>(),
  ]);

  const hypotheticalInventory = {
    openingStockKg,
    openingStockBrand: identity.brand,
    openingStockSizeMm: identity.pelletSizeMm,
    purchases: inventory?.purchases || [],
  };
  const invalidBalance = getFeedProductBalances(hypotheticalInventory, logs).find((product) => product.remainingKg < 0);
  if (invalidBalance) {
    return NextResponse.json(
      {
        error: `${invalidBalance.label} already has ${invalidBalance.consumedKg.toFixed(2)}kg consumed. Increase stocked quantity or correct feed logs before reducing opening stock.`,
      },
      { status: 409 },
    );
  }

  const nextInventory = await FeedInventory.findOneAndUpdate(
    { userId },
    {
      $set: {
        openingStockKg,
        openingStockBrand: identity.brand,
        openingStockSizeMm: identity.pelletSizeMm,
        openingStockDate,
        openingStockTotalCost,
        openingStockSupplier,
        updatedAt: new Date(),
      },
    },
    { upsert: true, new: true }
  );
  return NextResponse.json(nextInventory);
}
