import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Types } from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { FeedInventory } from "@/models/FeedInventory";
import { getFeedIdentity } from "@/lib/feed-inventory";

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
  const inv = await FeedInventory.findOne({ userId });
  if (!inv) return NextResponse.json({ error: "Feed inventory not found" }, { status: 404 });

  const entry = inv.purchases.id(params.id);
  if (!entry) return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
  Object.assign(entry, validated.value);
  inv.updatedAt = new Date();
  await inv.save();
  return NextResponse.json(inv);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!Types.ObjectId.isValid(params.id)) return NextResponse.json({ error: "Invalid entry id" }, { status: 400 });

  await connectDB();
  const userId = (session.user as any).id;
  const inv = await FeedInventory.findOne({ userId });
  if (!inv) return NextResponse.json({ error: "Feed inventory not found" }, { status: 404 });

  const entry = inv.purchases.id(params.id);
  if (!entry) return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
  entry.deleteOne();
  inv.updatedAt = new Date();
  await inv.save();
  return NextResponse.json(inv);
}
