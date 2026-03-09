import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Batch } from "@/models/Batch";
import { DailyLog } from "@/models/DailyLog";
import { Financial } from "@/models/Financial";
import { Tank } from "@/models/Tank";
import { FeedInventory } from "@/models/FeedInventory";
import DashboardClient from "./DashboardClient";
import { getBatchPhase, weeksSince } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;

  await connectDB();

  const batches = await Batch.find({ userId, status: "active" }).lean<any[]>();
  const tanks = await Tank.find({ userId }).lean<any[]>();
  const financials = await Financial.findOne({ userId }).lean<any>();
  const feedInventory = await FeedInventory.findOne({ userId }).lean<any>();

  // Get last 30 days of logs for active batches
  const batchIds = batches.map((b: any) => b._id);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentLogs = await DailyLog.find({
    userId, batchId: { $in: batchIds }, date: { $gte: thirtyDaysAgo }
  }).sort({ date: 1 }).lean();

  // Aggregate stats
  const totalFish    = batches.reduce((s: number, b: any) => s + (b.currentCount || 0), 0);
  const totalInitial = batches.reduce((s: number, b: any) => s + (b.initialCount || 0), 0);
  const totalFeedToday = recentLogs
    .filter((l: any) => new Date(l.date).toDateString() === new Date().toDateString())
    .reduce((s: number, l: any) => s + (l.feedGiven || 0), 0);
  const totalMortality30d = recentLogs.reduce((s: number, l: any) => s + (l.mortality || 0), 0);

  const expenses = financials?.expenses || [];
  const revenues = financials?.revenue || [];
  const totalExpenses = expenses.reduce((s: number, e: any) => s + e.amount, 0);
  const totalRevenue  = revenues.reduce((s: number, r: any) => s + r.totalAmount, 0);

  // Build action items for operator focus
  const actions: Array<{ level: "info" | "warning" | "danger"; title: string; detail: string; href: string }> = [];
  const today = new Date();
  const todayHasLog = recentLogs.some((l: any) => new Date(l.date).toDateString() === today.toDateString());
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const last3DaysLogs = recentLogs.filter((l: any) => new Date(l.date) >= threeDaysAgo);
  const recentMortality = last3DaysLogs.reduce((s: number, l: any) => s + (l.mortality || 0), 0);
  const waterAlerts = last3DaysLogs.filter((l: any) => (
    (typeof l.ph === "number" && (l.ph < 6.5 || l.ph > 8)) ||
    (typeof l.ammonia === "number" && l.ammonia >= 0.5)
  )).length;

  if (batches.length === 0) {
    actions.push({
      level: "info",
      title: "Create your first batch",
      detail: "Start with batch details so growth, feeding and mortality can be tracked.",
      href: "/batches",
    });
  } else {
    for (const batch of batches) {
      const weeks = weeksSince(batch.stockingDate);
      const { next, nextWeek } = getBatchPhase(weeks);
      const weeksToNext = nextWeek - weeks;
      if (weeksToNext >= 0 && weeksToNext <= 1) {
        actions.push({
          level: "warning",
          title: `${batch.name}: ${next}`,
          detail: weeksToNext === 0 ? "Due now." : "Due within 1 week.",
          href: "/calendar",
        });
      }
    }
  }

  if (tanks.length === 0) {
    actions.push({
      level: "warning",
      title: "No tanks configured",
      detail: "Add your tanks to improve planning and stocking decisions.",
      href: "/tanks",
    });
  }

  if (!todayHasLog && batches.length > 0) {
    actions.push({
      level: "warning",
      title: "No daily log yet",
      detail: "Record today's feed and water checks to keep trends accurate.",
      href: "/feeding",
    });
  }

  if (recentMortality > 0 && totalFish > 0 && recentMortality / totalFish >= 0.01) {
    actions.push({
      level: "danger",
      title: "Mortality spike in last 3 days",
      detail: `${recentMortality} deaths recorded recently. Review causes and tank conditions.`,
      href: "/mortality",
    });
  }

  if (waterAlerts > 0) {
    actions.push({
      level: "warning",
      title: "Water quality out of range",
      detail: `${waterAlerts} recent log${waterAlerts > 1 ? "s show" : " shows"} pH/ammonia risk.`,
      href: "/water-quality",
    });
  }

  const harvestReady = batches.filter((b: any) => weeksSince(b.stockingDate) >= 18).length;
  if (harvestReady > 0) {
    actions.push({
      level: "info",
      title: "Harvest window open",
      detail: `${harvestReady} batch${harvestReady > 1 ? "es are" : " is"} in harvest range.`,
      href: "/harvest",
    });
  }

  const openingFeed = Number(feedInventory?.openingStockKg || 0);
  const purchasedFeed = (feedInventory?.purchases || []).reduce((s: number, p: any) => s + Number(p.totalKg || 0), 0);
  const consumedFeed = recentLogs.reduce((s: number, l: any) => s + Number(l.feedGiven || 0), 0);
  const remainingFeed = Math.max(0, openingFeed + purchasedFeed - consumedFeed);
  if (remainingFeed > 0 && remainingFeed <= 50) {
    actions.push({
      level: "warning",
      title: "Feed stock running low",
      detail: `Only about ${remainingFeed.toFixed(1)}kg remains based on logged feed use.`,
      href: "/feed-inventory",
    });
  }

  // Build chart data (last 14 days)
  const chartData: any[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const dayLogs = recentLogs.filter((l: any) => new Date(l.date).toISOString().split("T")[0] === dateStr);
    chartData.push({
      date: d.toLocaleDateString("en-NG", { month: "short", day: "numeric" }),
      feed: dayLogs.reduce((s: number, l: any) => s + (l.feedGiven || 0), 0),
      mortality: dayLogs.reduce((s: number, l: any) => s + (l.mortality || 0), 0),
    });
  }

  const props = {
    totalFish, totalInitial, totalFeedToday,
    totalMortality30d, totalExpenses, totalRevenue,
    activeBatches: batches.length,
    totalTanks: tanks.length,
    chartData,
    actions: actions.slice(0, 4),
    batches: JSON.parse(JSON.stringify(batches)),
    tanks: JSON.parse(JSON.stringify(tanks)),
    farmName: (session?.user as any)?.farmName || "My Catfish Farm",
    userName: session?.user?.name || "Farmer",
  };

  return <DashboardClient {...props} />;
}
