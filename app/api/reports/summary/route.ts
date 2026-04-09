import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Batch } from "@/models/Batch";
import { DailyLog } from "@/models/DailyLog";
import { Financial } from "@/models/Financial";
import { FeedInventory } from "@/models/FeedInventory";
import { User } from "@/models/User";
import { getPlanConfig } from "@/lib/plans";
import { analyzeHarvestReadiness, buildReportBuckets, getReportRangeStart } from "@/lib/reports";
import { weeksSince } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  const { searchParams } = new URL(req.url);
  const requestedRange = searchParams.get("range") || "90d";

  await connectDB();
  const user = await User.findById(userId).select("plan").lean<any>();
  const plan = getPlanConfig(user?.plan);

  const range = plan.reportHistoryDays === 30 ? "30d" : requestedRange;
  const start = getReportRangeStart(range);

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
  const dissolvedO2Values = logs.map((l: any) => Number(l.dissolvedO2)).filter((n: number) => Number.isFinite(n));
  const avgPh = phValues.length ? phValues.reduce((s: number, n: number) => s + n, 0) / phValues.length : null;
  const avgAmmonia = ammoniaValues.length ? ammoniaValues.reduce((s: number, n: number) => s + n, 0) / ammoniaValues.length : null;
  const avgTemp = tempValues.length ? tempValues.reduce((s: number, n: number) => s + n, 0) / tempValues.length : null;
  const avgDissolvedO2 = dissolvedO2Values.length ? dissolvedO2Values.reduce((s: number, n: number) => s + n, 0) / dissolvedO2Values.length : null;

  const growthLogs = logs.filter((l: any) => {
    const fishCount = Number(l.fishCount);
    const avgWeight = Number(l.avgWeight);
    return Number.isFinite(fishCount) || Number.isFinite(avgWeight);
  });
  const latestGrowthSample = growthLogs
    .slice()
    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] || null;

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
    const dissolvedO2 = Number(l.dissolvedO2);
    return (
      (Number.isFinite(ph) && (ph < 6.5 || ph > 8)) ||
      (Number.isFinite(ammo) && ammo >= 0.5) ||
      (Number.isFinite(dissolvedO2) && dissolvedO2 < 5)
    );
  }).length;
  const canAdvancedReporting = plan.key === "commercial";

  const { granularity, buckets } = buildReportBuckets(range, new Date(), logs, expenses, revenue);

  for (const e of expenses) {
    const d = new Date(e.date);
    if (Number.isNaN(d.getTime())) continue;
    const bucket = buckets.find((b) => d >= b.start && d <= b.end);
    if (bucket) bucket.expense += Number(e.amount || 0);
  }
  for (const r of revenue) {
    const d = new Date(r.date);
    if (Number.isNaN(d.getTime())) continue;
    const bucket = buckets.find((b) => d >= b.start && d <= b.end);
    if (bucket) bucket.revenue += Number(r.totalAmount || 0);
  }
  for (const l of logs) {
    const d = new Date(l.date);
    if (Number.isNaN(d.getTime())) continue;
    const bucket = buckets.find((b) => d >= b.start && d <= b.end);
    if (bucket) {
      bucket.mortality += Number(l.mortality || 0);
      bucket.feed += Number(l.feedGiven || 0);
    }
  }

  let advanced: any = null;
  if (canAdvancedReporting) {
    const batchMap = new Map<string, any>(batches.map((b: any) => [String(b._id), b]));
    const batchStats: Record<
      string,
      {
        batchId: string;
        batchName: string;
        status: string;
        initialCount: number;
        currentCount: number;
        feedKg: number;
        mortality: number;
        waterRiskLogs: number;
        revenue: number;
        harvestedKg: number;
      }
    > = {};

    for (const batch of batches) {
      const id = String(batch._id);
      batchStats[id] = {
        batchId: id,
        batchName: String(batch.name || "Unnamed batch"),
        status: String(batch.status || "active"),
        initialCount: Number(batch.initialCount || 0),
        currentCount: Number(batch.currentCount || 0),
        feedKg: 0,
        mortality: 0,
        waterRiskLogs: 0,
        revenue: 0,
        harvestedKg: 0,
      };
    }

    for (const log of logs) {
      const batchId = String(log.batchId || "");
      if (!batchId || !batchStats[batchId]) continue;
      batchStats[batchId].feedKg += Number(log.feedGiven || 0);
      batchStats[batchId].mortality += Number(log.mortality || 0);

      const ph = Number(log.ph);
      const ammo = Number(log.ammonia);
      const dissolvedO2 = Number(log.dissolvedO2);
      const isRisk =
        (Number.isFinite(ph) && (ph < 6.5 || ph > 8)) ||
        (Number.isFinite(ammo) && ammo >= 0.5) ||
        (Number.isFinite(dissolvedO2) && dissolvedO2 < 5);
      if (isRisk) batchStats[batchId].waterRiskLogs += 1;
    }

    for (const rev of revenue) {
      const batchId = String(rev.batchId || "");
      if (!batchId || !batchStats[batchId]) continue;
      batchStats[batchId].revenue += Number(rev.totalAmount || 0);
      batchStats[batchId].harvestedKg += Number(rev.weightKg || 0);
    }

    const batchPerformance = Object.values(batchStats)
      .map((row) => ({
        ...row,
        survivalRate: row.initialCount > 0 ? (row.currentCount / row.initialCount) * 100 : 0,
        feedPerFishKg: row.currentCount > 0 ? row.feedKg / row.currentCount : 0,
        avgPricePerKg: row.harvestedKg > 0 ? row.revenue / row.harvestedKg : 0,
        ...analyzeHarvestReadiness(
          batchMap.get(row.batchId),
          logs.filter((log: any) => String(log.batchId || "") === row.batchId),
          weeksSince(batchMap.get(row.batchId)?.stockingDate),
        ),
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const channelMap: Record<
      string,
      { channel: string; revenue: number; weightKg: number; fishSold: number; records: number }
    > = {};
    for (const rev of revenue) {
      const channel = String(rev.channel || "other").toLowerCase();
      if (!channelMap[channel]) {
        channelMap[channel] = { channel, revenue: 0, weightKg: 0, fishSold: 0, records: 0 };
      }
      channelMap[channel].revenue += Number(rev.totalAmount || 0);
      channelMap[channel].weightKg += Number(rev.weightKg || 0);
      channelMap[channel].fishSold += Number(rev.fishSold || 0);
      channelMap[channel].records += 1;
    }
    const channelPerformance = Object.values(channelMap).sort((a, b) => b.revenue - a.revenue);

    const riskHotspots = batchPerformance
      .filter((row) => row.waterRiskLogs > 0)
      .sort((a, b) => b.waterRiskLogs - a.waterRiskLogs)
      .slice(0, 8);
    const harvestReadiness = batchPerformance
      .filter((row) => row.status === "active" || row.status === "partial")
      .slice()
      .sort((a, b) => b.readinessScore - a.readinessScore)
      .slice(0, 8);

    advanced = {
      batchPerformance,
      channelPerformance,
      riskHotspots,
      harvestReadiness,
      generatedAt: new Date().toISOString(),
      batchesAnalyzed: batchPerformance.length,
    };
  }

  return NextResponse.json({
    requestedRange,
    planRestricted: range !== requestedRange,
    canExport: plan.key !== "free",
    canAdvancedReporting,
    granularity,
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
      avgDissolvedO2,
      waterRiskLogs,
      growthSampleCount: growthLogs.length,
      latestGrowthSampleAt: latestGrowthSample?.date || null,
      latestAvgWeight: Number.isFinite(Number(latestGrowthSample?.avgWeight)) ? Number(latestGrowthSample.avgWeight) : null,
      latestFishCount: Number.isFinite(Number(latestGrowthSample?.fishCount)) ? Number(latestGrowthSample.fishCount) : null,
      purchasedKg,
      purchasedCost,
      remainingFeedKg,
      activeBatches: batches.filter((b: any) => b.status === "active" || b.status === "partial").length,
      harvestedBatches: batches.filter((b: any) => b.status === "harvested").length,
    },
    monthly: buckets.map((b) => ({
      month: b.label,
      revenue: b.revenue,
      expense: b.expense,
      mortality: b.mortality,
      feed: b.feed,
    })),
    advanced,
  });
}
