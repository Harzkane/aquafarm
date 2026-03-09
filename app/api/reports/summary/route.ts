import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Batch } from "@/models/Batch";
import { DailyLog } from "@/models/DailyLog";
import { Financial } from "@/models/Financial";
import { FeedInventory } from "@/models/FeedInventory";

function getRangeStart(range: string) {
  const now = Date.now();
  if (range === "30d") return new Date(now - 30 * 24 * 60 * 60 * 1000);
  if (range === "90d") return new Date(now - 90 * 24 * 60 * 60 * 1000);
  return null;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  const { searchParams } = new URL(req.url);
  const range = searchParams.get("range") || "90d";
  const start = getRangeStart(range);

  await connectDB();

  const [batches, logs, financials, feedInventory] = await Promise.all([
    Batch.find({
      userId,
      $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
    }).lean<any[]>(),
    DailyLog.find(start ? { userId, date: { $gte: start } } : { userId }).lean<any[]>(),
    Financial.findOne({ userId }).lean<any>(),
    FeedInventory.findOne({ userId }).lean<any>(),
  ]);

  const expenses = (financials?.expenses || []).filter((e: any) => !start || new Date(e.date).getTime() >= start.getTime());
  const revenue = (financials?.revenue || []).filter((r: any) => !start || new Date(r.date).getTime() >= start.getTime());
  const feedPurchases = (feedInventory?.purchases || []).filter((p: any) => !start || new Date(p.date).getTime() >= start.getTime());

  const totalExpenses = expenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
  const totalRevenue = revenue.reduce((s: number, r: any) => s + Number(r.totalAmount || 0), 0);
  const totalFeedKg = logs.reduce((s: number, l: any) => s + Number(l.feedGiven || 0), 0);
  const totalMortality = logs.reduce((s: number, l: any) => s + Number(l.mortality || 0), 0);

  const phValues = logs.map((l: any) => Number(l.ph)).filter((n: number) => Number.isFinite(n));
  const ammoniaValues = logs.map((l: any) => Number(l.ammonia)).filter((n: number) => Number.isFinite(n));
  const tempValues = logs.map((l: any) => Number(l.temperature)).filter((n: number) => Number.isFinite(n));
  const avgPh = phValues.length ? phValues.reduce((s: number, n: number) => s + n, 0) / phValues.length : null;
  const avgAmmonia = ammoniaValues.length ? ammoniaValues.reduce((s: number, n: number) => s + n, 0) / ammoniaValues.length : null;
  const avgTemp = tempValues.length ? tempValues.reduce((s: number, n: number) => s + n, 0) / tempValues.length : null;

  const fishAlive = batches
    .filter((b: any) => b.status === "active" || b.status === "partial")
    .reduce((s: number, b: any) => s + Number(b.currentCount || 0), 0);
  const initialFish = batches
    .filter((b: any) => b.status === "active" || b.status === "partial")
    .reduce((s: number, b: any) => s + Number(b.initialCount || 0), 0);
  const survivalRate = initialFish > 0 ? (fishAlive / initialFish) * 100 : 0;

  const purchasedKg = feedPurchases.reduce((s: number, p: any) => s + Number(p.totalKg || 0), 0);
  const purchasedCost = feedPurchases.reduce((s: number, p: any) => s + Number(p.totalCost || 0), 0);
  const openingStock = Number(feedInventory?.openingStockKg || 0);
  const remainingFeedKg = Math.max(0, openingStock + purchasedKg - totalFeedKg);

  const waterRiskLogs = logs.filter((l: any) => {
    const ph = Number(l.ph);
    const ammo = Number(l.ammonia);
    return (Number.isFinite(ph) && (ph < 6.5 || ph > 8)) || (Number.isFinite(ammo) && ammo >= 0.5);
  }).length;

  const monthlyMap: Record<string, { month: string; revenue: number; expense: number; mortality: number; feed: number }> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthlyMap[key] = {
      month: d.toLocaleDateString("en-NG", { month: "short" }),
      revenue: 0,
      expense: 0,
      mortality: 0,
      feed: 0,
    };
  }

  for (const e of expenses) {
    const d = new Date(e.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (monthlyMap[key]) monthlyMap[key].expense += Number(e.amount || 0);
  }
  for (const r of revenue) {
    const d = new Date(r.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (monthlyMap[key]) monthlyMap[key].revenue += Number(r.totalAmount || 0);
  }
  for (const l of logs) {
    const d = new Date(l.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (monthlyMap[key]) {
      monthlyMap[key].mortality += Number(l.mortality || 0);
      monthlyMap[key].feed += Number(l.feedGiven || 0);
    }
  }

  return NextResponse.json({
    range,
    summary: {
      totalRevenue,
      totalExpenses,
      net: totalRevenue - totalExpenses,
      feedKg: totalFeedKg,
      mortality: totalMortality,
      fishAlive,
      survivalRate,
      avgPh,
      avgAmmonia,
      avgTemp,
      waterRiskLogs,
      purchasedKg,
      purchasedCost,
      remainingFeedKg,
      activeBatches: batches.filter((b: any) => b.status === "active" || b.status === "partial").length,
      harvestedBatches: batches.filter((b: any) => b.status === "harvested").length,
    },
    monthly: Object.values(monthlyMap),
  });
}

