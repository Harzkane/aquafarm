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

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const fin = await Financial.findOne({ userId: (session.user as any).id });
  return NextResponse.json(fin || { expenses: [], revenue: [] });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { type, entry } = await req.json(); // type: "expense" | "revenue"
  if (!entry || (type !== "expense" && type !== "revenue")) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  await connectDB();
  const uid = (session.user as any).id;

  function validateDate(value: any) {
    if (!value) return new Date();
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function validateExpense(raw: any) {
    const category = String(raw?.category || "");
    const amount = Number(raw?.amount);
    const date = validateDate(raw?.date);
    if (!EXPENSE_CATS.includes(category as any)) return { ok: false as const, error: "Invalid expense category" };
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false as const, error: "Expense amount must be greater than 0" };
    if (!date) return { ok: false as const, error: "Invalid expense date" };
    return {
      ok: true as const,
      value: {
        category,
        description: String(raw?.description || "").trim(),
        amount,
        date,
        batchId: raw?.batchId,
      },
    };
  }

  function validateRevenue(raw: any) {
    const fishSold = Number(raw?.fishSold || 0);
    const weightKg = Number(raw?.weightKg || 0);
    const pricePerKg = Number(raw?.pricePerKg || 0);
    const totalAmount = Number(raw?.totalAmount ?? weightKg * pricePerKg);
    const date = validateDate(raw?.date);
    const channel = String(raw?.channel || "POK");
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
      value: {
        fishSold,
        weightKg,
        pricePerKg,
        totalAmount,
        buyer: String(raw?.buyer || "").trim(),
        channel,
        date,
        batchId: raw?.batchId,
      },
    };
  }

  let fin = await Financial.findOne({ userId: uid });
  if (!fin) fin = await Financial.create({ userId: uid, expenses: [], revenue: [] });

  const validated = type === "expense" ? validateExpense(entry) : validateRevenue(entry);
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });
  const normalizedEntry = normalizeBatchId(validated.value as any);

  if (normalizedEntry.batchId) {
    if (!Types.ObjectId.isValid(String(normalizedEntry.batchId))) {
      return NextResponse.json({ error: "Invalid batch id" }, { status: 400 });
    }
    const batch = await Batch.findOne({
      _id: normalizedEntry.batchId,
      userId: uid,
      $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
    });
    if (!batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  if (type === "expense") fin.expenses.push(normalizedEntry);
  else fin.revenue.push(normalizedEntry);
  fin.updatedAt = new Date();
  await fin.save();
  return NextResponse.json(fin, { status: 201 });
}
