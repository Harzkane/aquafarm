import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Batch } from "@/models/Batch";
import { DailyLog } from "@/models/DailyLog";
import { Financial } from "@/models/Financial";
import { Tank } from "@/models/Tank";
import { FeedInventory } from "@/models/FeedInventory";
import { CalendarEvent } from "@/models/CalendarEvent";
import DashboardClient from "./DashboardClient";
import { getBatchPhase, weeksSince } from "@/lib/utils";
import { summarizeFeedInventory } from "@/lib/feed-inventory";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;

  await connectDB();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [batches, tanks, financials, feedInventory, recentLogs, feedLogs, calendarEvents] = await Promise.all([
    Batch.find({
      userId,
      status: { $in: ["active", "partial"] },
      $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
    }).lean<any[]>(),
    Tank.find({ userId }).lean<any[]>(),
    Financial.findOne({ userId }).lean<any>(),
    FeedInventory.findOne({ userId }).lean<any>(),
    DailyLog.find({
      userId,
      date: { $gte: thirtyDaysAgo },
    }).sort({ date: 1 }).lean(),
    DailyLog.find({ userId }).select("date feedGiven feedType feedBrand feedSizeMm").lean(),
    CalendarEvent.find({ userId }).select("batchId kind milestoneWeek").lean<any[]>(),
  ]);

  const completedMilestones = new Set(
    calendarEvents.map((event: any) => `${String(event.batchId)}:${String(event.kind)}:${Number(event.milestoneWeek)}`)
  );
  const milestones: Array<{ week: number; kind: "sort" | "harvest"; label: string; dueNowLabel: string; dueSoonLabel: string }> = [
    { week: 3, kind: "sort", label: "Sort 1", dueNowLabel: "Sort 1 due", dueSoonLabel: "Sort 1 due within 1 week" },
    { week: 8, kind: "sort", label: "Sort 2", dueNowLabel: "Sort 2 due", dueSoonLabel: "Sort 2 due within 1 week" },
    { week: 14, kind: "sort", label: "Sort 3", dueNowLabel: "Sort 3 due", dueSoonLabel: "Sort 3 due within 1 week" },
    { week: 17, kind: "sort", label: "Pre-harvest sort", dueNowLabel: "Pre-harvest sort due", dueSoonLabel: "Pre-harvest sort due within 1 week" },
    { week: 18, kind: "harvest", label: "Harvest", dueNowLabel: "Harvest now!", dueSoonLabel: "Harvest due within 1 week" },
  ];

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
      const nextMilestone = milestones.find((milestone) => {
        const done =
          completedMilestones.has(`${String(batch._id)}:${milestone.kind}:${milestone.week}`) ||
          (milestone.kind === "harvest" && batch.status === "harvested");
        return !done;
      });

      if (!nextMilestone) continue;

      const weeksToNext = nextMilestone.week - weeks;
      if (weeksToNext >= 0 && weeksToNext <= 1) {
        actions.push({
          level: "warning",
          title: `${batch.name}: ${weeksToNext === 0 ? nextMilestone.dueNowLabel : nextMilestone.label}`,
          detail: weeksToNext === 0 ? "Due now." : nextMilestone.dueSoonLabel,
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

  const feedSummary = summarizeFeedInventory(feedInventory, feedLogs as any[]);
  const mostUrgentFeed = feedSummary.lowStockProducts[0];
  if (mostUrgentFeed) {
    actions.push({
      level: mostUrgentFeed.lowStockSeverity === "critical" ? "danger" : "warning",
      title: `${mostUrgentFeed.label} running low`,
      detail:
        mostUrgentFeed.estimatedDaysLeft != null
          ? `${mostUrgentFeed.remainingKg.toFixed(2)}kg left, about ${mostUrgentFeed.estimatedDaysLeft.toFixed(1)} feeding days remaining.`
          : `${mostUrgentFeed.remainingKg.toFixed(2)}kg left. Log recent usage to estimate days remaining.`,
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

  const batchSummaries = batches.map((batch: any) => {
    const batchId = String(batch._id);
    const batchLogs = recentLogs.filter((log: any) => String(log.batchId || "") === batchId);
    const batchExpenses = expenses.filter((entry: any) => String(entry.batchId || "") === batchId);
    const batchRevenue = revenues.filter((entry: any) => String(entry.batchId || "") === batchId);

    const batchChartData = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const dayLogs = batchLogs.filter((log: any) => new Date(log.date).toISOString().split("T")[0] === dateStr);
      batchChartData.push({
        date: d.toLocaleDateString("en-NG", { month: "short", day: "numeric" }),
        feed: dayLogs.reduce((s: number, log: any) => s + (log.feedGiven || 0), 0),
        mortality: dayLogs.reduce((s: number, log: any) => s + (log.mortality || 0), 0),
      });
    }

    return {
      batchId,
      totalFish: Number(batch.currentCount || 0),
      totalInitial: Number(batch.initialCount || 0),
      totalFeedToday: batchLogs
        .filter((log: any) => new Date(log.date).toDateString() === new Date().toDateString())
        .reduce((s: number, log: any) => s + (log.feedGiven || 0), 0),
      totalMortality30d: batchLogs.reduce((s: number, log: any) => s + (log.mortality || 0), 0),
      totalExpenses: batchExpenses.reduce((s: number, entry: any) => s + Number(entry.amount || 0), 0),
      totalRevenue: batchRevenue.reduce((s: number, entry: any) => s + Number(entry.totalAmount || 0), 0),
      chartData: batchChartData,
    };
  });

  const props = {
    totalFish, totalInitial, totalFeedToday,
    totalMortality30d, totalExpenses, totalRevenue,
    activeBatches: batches.length,
    totalTanks: tanks.length,
    chartData,
    batchSummaries,
    actions: actions.slice(0, 4),
    batches: JSON.parse(JSON.stringify(batches)),
    tanks: JSON.parse(JSON.stringify(tanks)),
    farmName: (session?.user as any)?.farmName || "My Catfish Farm",
    userName: session?.user?.name || "Farmer",
    plan: ((session?.user as any)?.plan || "free") as "free" | "pro" | "commercial",
  };

  return <DashboardClient {...props} />;
}
