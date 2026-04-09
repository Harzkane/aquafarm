import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Types } from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { FeedInventory } from "@/models/FeedInventory";
import { DailyLog } from "@/models/DailyLog";
import { getFeedIdentity, getFeedProductBalances } from "@/lib/feed-inventory";
import { removeFeedPurchaseExpense, syncFeedPurchaseExpense } from "@/lib/financial-sync";

function validateBody(body: any) {
  const date = body?.date ? new Date(body.date) : new Date();
  if (Number.isNaN(date.getTime())) return { ok: false as const, error: "Invalid purchase date" };

  const identity = getFeedIdentity({
    brand: String(body?.brand || "").trim(),
    pelletSizeMm: body?.pelletSizeMm,
    feedType: String(body?.brand || "").trim(),
  });
  const bagSizeKg = Number(body?.bagSizeKg || 0);
  const bags = Number(body?.bags || 0);
  const unitPrice = Number(body?.unitPrice || 0);
  if (!identity.brand) return { ok: false as const, error: "Feed brand/type is required" };
  if (!Number.isFinite(bagSizeKg) || bagSizeKg <= 0) return { ok: false as const, error: "Bag size must be greater than 0" };
  if (!Number.isFinite(bags) || bags <= 0) return { ok: false as const, error: "Bags must be greater than 0" };
  if (!Number.isFinite(unitPrice) || unitPrice < 0) return { ok: false as const, error: "Unit price cannot be negative" };

  return {
    ok: true as const,
    value: {
      date,
      brand: identity.brand,
      pelletSizeMm: identity.pelletSizeMm,
      bagSizeKg,
      bags,
      totalKg: bagSizeKg * bags,
      unitPrice,
      totalCost: unitPrice * bags,
      supplier: String(body?.supplier || "").trim(),
      notes: String(body?.notes || "").trim(),
    },
  };
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!Types.ObjectId.isValid(params.id)) return NextResponse.json({ error: "Invalid entry id" }, { status: 400 });

  const body = await req.json();
  const validated = validateBody(body);
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });

  await connectDB();
  const userId = (session.user as any).id;
  const [inv, logs] = await Promise.all([
    FeedInventory.findOne({ userId }),
    DailyLog.find({ userId }).select("feedGiven date feedType feedBrand feedSizeMm").lean<any[]>(),
  ]);
  if (!inv) return NextResponse.json({ error: "Feed inventory not found" }, { status: 404 });

  const entry = inv.purchases.id(params.id);
  if (!entry) return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
  const previousValue = entry.toObject ? entry.toObject() : { ...entry };
  const hypotheticalPurchases = inv.purchases.map((purchase: any) => {
    if (String(purchase._id) !== params.id) return purchase.toObject ? purchase.toObject() : purchase;
    return {
      ...(purchase.toObject ? purchase.toObject() : purchase),
      ...validated.value,
    };
  });
  const invalidBalance = getFeedProductBalances(
    {
      openingStockKg: inv.openingStockKg,
      openingStockBrand: inv.openingStockBrand,
      openingStockSizeMm: inv.openingStockSizeMm,
      purchases: hypotheticalPurchases,
    },
    logs,
  ).find((product) => product.remainingKg < 0);
  if (invalidBalance) {
    return NextResponse.json(
      {
        error: `${invalidBalance.label} already has ${invalidBalance.consumedKg.toFixed(2)}kg consumed. Increase stocked quantity or correct feed logs before reducing this purchase.`,
      },
      { status: 409 },
    );
  }
  Object.assign(entry, validated.value);
  inv.updatedAt = new Date();
  try {
    await inv.save();
    await syncFeedPurchaseExpense({
      userId,
      purchaseId: params.id,
      date: new Date(validated.value.date),
      totalCost: Number(validated.value.totalCost || 0),
      brand: String(validated.value.brand || ""),
      pelletSizeMm: validated.value.pelletSizeMm ?? null,
      bagSizeKg: Number(validated.value.bagSizeKg || 0),
      bags: Number(validated.value.bags || 0),
      supplier: String(validated.value.supplier || ""),
    });
  } catch (error) {
    Object.assign(entry, previousValue);
    inv.updatedAt = new Date();
    await inv.save();
    throw error;
  }
  return NextResponse.json(inv);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!Types.ObjectId.isValid(params.id)) return NextResponse.json({ error: "Invalid entry id" }, { status: 400 });

  await connectDB();
  const userId = (session.user as any).id;
  const [inv, logs] = await Promise.all([
    FeedInventory.findOne({ userId }),
    DailyLog.find({ userId }).select("feedGiven date feedType feedBrand feedSizeMm").lean<any[]>(),
  ]);
  if (!inv) return NextResponse.json({ error: "Feed inventory not found" }, { status: 404 });

  const entry = inv.purchases.id(params.id);
  if (!entry) return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
  const previousValue = entry.toObject ? entry.toObject() : { ...entry };
  const hypotheticalPurchases = inv.purchases
    .filter((purchase: any) => String(purchase._id) !== params.id)
    .map((purchase: any) => (purchase.toObject ? purchase.toObject() : purchase));
  const invalidBalance = getFeedProductBalances(
    {
      openingStockKg: inv.openingStockKg,
      openingStockBrand: inv.openingStockBrand,
      openingStockSizeMm: inv.openingStockSizeMm,
      purchases: hypotheticalPurchases,
    },
    logs,
  ).find((product) => product.remainingKg < 0);
  if (invalidBalance) {
    return NextResponse.json(
      {
        error: `${invalidBalance.label} already has ${invalidBalance.consumedKg.toFixed(2)}kg consumed. You cannot delete this purchase without first correcting feed logs or adding replacement stock.`,
      },
      { status: 409 },
    );
  }
  entry.deleteOne();
  inv.updatedAt = new Date();
  try {
    await inv.save();
    await removeFeedPurchaseExpense(userId, params.id);
  } catch (error) {
    inv.purchases.push(previousValue);
    inv.updatedAt = new Date();
    await inv.save();
    throw error;
  }
  return NextResponse.json(inv);
}
