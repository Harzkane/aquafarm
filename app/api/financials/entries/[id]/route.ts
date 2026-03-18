import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Financial } from "@/models/Financial";
import { Batch } from "@/models/Batch";
import { Types } from "mongoose";

const EXPENSE_CATS = ["feed","juveniles","medication","labour","utilities","equipment","transport","other"] as const;
const CHANNELS = ["POK","restaurant","market","direct","hotel","other"] as const;

function normalizeBatchId(entry: Record<string, any>) {
  const normalized = { ...entry };
  if (typeof normalized.batchId === "string" && normalized.batchId.trim() === "") {
    delete normalized.batchId;
  }
  return normalized;
}

function parseDate(value: any) {
  if (!value) return new Date();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function validateExpense(raw: any) {
  const category = String(raw?.category || "");
  const amount = Number(raw?.amount);
  const date = parseDate(raw?.date);
  if (!EXPENSE_CATS.includes(category as any)) return { ok: false as const, error: "Invalid expense category" };
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false as const, error: "Expense amount must be greater than 0" };
  if (!date) return { ok: false as const, error: "Invalid expense date" };
  return {
    ok: true as const,
    value: normalizeBatchId({
      category,
      description: String(raw?.description || "").trim(),
      amount,
      date,
      batchId: raw?.batchId,
    }),
  };
}

function validateRevenue(raw: any) {
  const fishSold = Number(raw?.fishSold || 0);
  const weightKg = Number(raw?.weightKg || 0);
  const pricePerKg = Number(raw?.pricePerKg || 0);
  const totalAmount = Number(raw?.totalAmount ?? weightKg * pricePerKg);
  const channel = String(raw?.channel || "POK");
  const date = parseDate(raw?.date);
  if (!CHANNELS.includes(channel as any)) return { ok: false as const, error: "Invalid revenue channel" };
  if (!Number.isFinite(fishSold) || fishSold < 0) return { ok: false as const, error: "Fish sold cannot be negative" };
  if (!Number.isFinite(weightKg) || weightKg < 0) return { ok: false as const, error: "Weight cannot be negative" };
  if (!Number.isFinite(pricePerKg) || pricePerKg < 0) return { ok: false as const, error: "Price per kg cannot be negative" };
  if (!Number.isFinite(totalAmount) || totalAmount < 0) return { ok: false as const, error: "Total amount cannot be negative" };
  if (weightKg <= 0) return { ok: false as const, error: "Weight sold must be greater than 0" };
  if (pricePerKg <= 0) return { ok: false as const, error: "Price per kg must be greater than 0" };
  if (totalAmount <= 0) return { ok: false as const, error: "Total amount must be greater than 0" };
  if (!date) return { ok: false as const, error: "Invalid revenue date" };
  return {
    ok: true as const,
    value: normalizeBatchId({
      fishSold,
      weightKg,
      pricePerKg,
      totalAmount,
      buyer: String(raw?.buyer || "").trim(),
      channel,
      date,
      batchId: raw?.batchId,
    }),
  };
}

async function assertBatchOwnership(uid: string, batchId?: string) {
  if (!batchId) return { ok: true as const };
  if (!Types.ObjectId.isValid(String(batchId))) return { ok: false as const, error: "Invalid batch id" };
  const batch = await Batch.findOne({
    _id: batchId,
    userId: uid,
    $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
  });
  if (!batch) return { ok: false as const, error: "Batch not found" };
  return { ok: true as const };
}

function getType(req: NextRequest) {
  const t = new URL(req.url).searchParams.get("type");
  return t === "expense" || t === "revenue" ? t : null;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!Types.ObjectId.isValid(params.id)) return NextResponse.json({ error: "Invalid entry id" }, { status: 400 });

  const type = getType(req);
  if (!type) return NextResponse.json({ error: "Query param `type` is required" }, { status: 400 });

  const body = await req.json();
  const validated = type === "expense" ? validateExpense(body) : validateRevenue(body);
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });

  await connectDB();
  const uid = (session.user as any).id;
  const own = await assertBatchOwnership(uid, validated.value.batchId);
  if (!own.ok) return NextResponse.json({ error: own.error }, { status: 404 });

  const fin = await Financial.findOne({ userId: uid });
  if (!fin) return NextResponse.json({ error: "Financial record not found" }, { status: 404 });

  const coll = type === "expense" ? fin.expenses : fin.revenue;
  const entry = coll.id(params.id);
  if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

  if (type === "revenue") {
    const existingBatchId = entry.batchId ? String(entry.batchId) : "";
    const existingFishSold = Number(entry.fishSold || 0);
    const nextBatchId = validated.value.batchId ? String(validated.value.batchId) : "";
    const nextFishSold = Number(validated.value.fishSold || 0);

    if (existingBatchId && existingFishSold > 0) {
      if (existingBatchId !== nextBatchId || existingFishSold !== nextFishSold) {
        return NextResponse.json(
          {
            error:
              "Batch-linked harvest sales cannot change batch or fish sold after stock has been reconciled. Reopen the batch and record a corrected harvest instead.",
          },
          { status: 409 },
        );
      }
    }
  }

  Object.assign(entry, validated.value);

  fin.updatedAt = new Date();
  await fin.save();
  return NextResponse.json(fin);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!Types.ObjectId.isValid(params.id)) return NextResponse.json({ error: "Invalid entry id" }, { status: 400 });

  const type = getType(req);
  if (!type) return NextResponse.json({ error: "Query param `type` is required" }, { status: 400 });

  await connectDB();
  const uid = (session.user as any).id;
  const fin = await Financial.findOne({ userId: uid });
  if (!fin) return NextResponse.json({ error: "Financial record not found" }, { status: 404 });

  const coll = type === "expense" ? fin.expenses : fin.revenue;
  const entry = coll.id(params.id);
  if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

  if (type === "revenue") {
    const existingBatchId = entry.batchId ? String(entry.batchId) : "";
    const existingFishSold = Number(entry.fishSold || 0);
    if (existingBatchId && existingFishSold > 0) {
      return NextResponse.json(
        {
          error:
            "Batch-linked harvest sales cannot be deleted directly because they already affected fish stock. Reopen the batch and record a corrected harvest instead.",
        },
        { status: 409 },
      );
    }
  }

  entry.deleteOne();

  fin.updatedAt = new Date();
  await fin.save();
  return NextResponse.json(fin);
}
