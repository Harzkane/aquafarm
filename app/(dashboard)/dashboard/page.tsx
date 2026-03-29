import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Batch } from "@/models/Batch";
import { DailyLog } from "@/models/DailyLog";
import { Financial } from "@/models/Financial";
import { Tank } from "@/models/Tank";
import { FeedInventory } from "@/models/FeedInventory";
import { CalendarEvent } from "@/models/CalendarEvent";
import { TankMovement } from "@/models/TankMovement";
import DashboardClient from "./DashboardClient";
import { getBatchPhase, weeksSince } from "@/lib/utils";
import { summarizeFeedInventory } from "@/lib/feed-inventory";

const DASHBOARD_TIMEFRAMES = [7, 14, 30, 90] as const;

function buildRangeSeries(logs: any[], days: number) {
  const rows: Array<{ date: string; feed: number; mortality: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const dayLogs = logs.filter((l: any) => new Date(l.date).toISOString().split("T")[0] === dateStr);
    rows.push({
      date: d.toLocaleDateString("en-NG", { month: "short", day: "numeric" }),
      feed: dayLogs.reduce((sum: number, log: any) => sum + Number(log.feedGiven || 0), 0),
      mortality: dayLogs.reduce((sum: number, log: any) => sum + Number(log.mortality || 0), 0),
    });
  }
  return rows;
}

function buildTankHealthSeries(logs: any[], days: number) {
  const rows: Array<{
    date: string;
    feed: number;
    mortality: number;
    riskLogs: number;
    tanksLogged: number;
  }> = [];

  for (let i = days - 1; i >= 0; i--) {
    const day = new Date();
    day.setDate(day.getDate() - i);
    const isoDay = day.toISOString().split("T")[0];
    const dayLogs = logs.filter((log: any) => new Date(log.date).toISOString().split("T")[0] === isoDay);
    const tanksLogged = new Set(
      dayLogs
        .map((log: any) => String(log.tankId || "").trim() || String(log.tankName || "").trim().toLowerCase())
        .filter(Boolean),
    ).size;

    rows.push({
      date: day.toLocaleDateString("en-NG", { month: "short", day: "numeric" }),
      feed: dayLogs.reduce((sum: number, log: any) => sum + Number(log.feedGiven || 0), 0),
      mortality: dayLogs.reduce((sum: number, log: any) => sum + Number(log.mortality || 0), 0),
      riskLogs: dayLogs.filter((log: any) => {
        const ph = Number(log.ph);
        const ammonia = Number(log.ammonia);
        return (Number.isFinite(ph) && (ph < 6.5 || ph > 8)) || (Number.isFinite(ammonia) && ammonia >= 0.5);
      }).length,
      tanksLogged,
    });
  }

  return rows;
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;

  await connectDB();

  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const [batches, tanks, financials, feedInventory, recentLogs, feedLogs, calendarEvents, recentMovements] = await Promise.all([
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
      date: { $gte: ninetyDaysAgo },
    }).sort({ date: 1 }).lean(),
    DailyLog.find({ userId }).select("date feedGiven feedType feedBrand feedSizeMm").lean(),
    CalendarEvent.find({ userId }).select("batchId kind milestoneWeek").lean<any[]>(),
    TankMovement.find({ userId, date: { $gte: fourteenDaysAgo } })
      .sort({ date: -1, createdAt: -1 })
      .limit(12)
      .populate("batchId", "name")
      .lean<any[]>(),
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
  const totalMortality30d = recentLogs
    .filter((l: any) => new Date(l.date) >= thirtyDaysAgo)
    .reduce((s: number, l: any) => s + (l.mortality || 0), 0);

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

  const chartDataByRange = Object.fromEntries(
    DASHBOARD_TIMEFRAMES.map((days) => [String(days), buildRangeSeries(recentLogs, days)])
  );

  const batchSummaries = batches.map((batch: any) => {
    const batchId = String(batch._id);
    const batchLogs = recentLogs.filter((log: any) => String(log.batchId || "") === batchId);
    const batchExpenses = expenses.filter((entry: any) => String(entry.batchId || "") === batchId);
    const batchRevenue = revenues.filter((entry: any) => String(entry.batchId || "") === batchId);

    return {
      batchId,
      totalFish: Number(batch.currentCount || 0),
      totalInitial: Number(batch.initialCount || 0),
      totalFeedToday: batchLogs
        .filter((log: any) => new Date(log.date).toDateString() === new Date().toDateString())
        .reduce((s: number, log: any) => s + (log.feedGiven || 0), 0),
      totalMortality30d: batchLogs
        .filter((log: any) => new Date(log.date) >= thirtyDaysAgo)
        .reduce((s: number, log: any) => s + (log.mortality || 0), 0),
      totalExpenses: batchExpenses.reduce((s: number, entry: any) => s + Number(entry.amount || 0), 0),
      totalRevenue: batchRevenue.reduce((s: number, entry: any) => s + Number(entry.totalAmount || 0), 0),
      chartDataByRange: Object.fromEntries(
        DASHBOARD_TIMEFRAMES.map((days) => [String(days), buildRangeSeries(batchLogs, days)])
      ),
    };
  });

  const buildTankSnapshot = (batch: any | null) => {
    const batchId = batch ? String(batch._id) : "";
    const sourceLogs = (batchId
      ? recentLogs.filter((log: any) => String(log.batchId || "") === batchId)
      : recentLogs)
      .filter((log: any) => new Date(log.date) >= fourteenDaysAgo);
    const allocations = Array.isArray(batch?.tankAllocations) ? batch.tankAllocations : [];
    const tankMap = new Map<string, {
      tankId: string;
      tankName: string;
      currentFish: number;
      feedKg14d: number;
      mortality14d: number;
      waterRiskLogs: number;
      logCount: number;
    }>();

    const ensureTank = (tankId: string, tankName: string, currentFish = 0) => {
      const key = tankId || tankName.trim().toLowerCase();
      if (!key) return null;
      if (!tankMap.has(key)) {
        tankMap.set(key, {
          tankId,
          tankName,
          currentFish,
          feedKg14d: 0,
          mortality14d: 0,
          waterRiskLogs: 0,
          logCount: 0,
        });
      }
      const entry = tankMap.get(key)!;
      entry.tankId = entry.tankId || tankId;
      entry.tankName = entry.tankName || tankName;
      entry.currentFish = Math.max(entry.currentFish, Number(currentFish || 0));
      return entry;
    };

    if (batchId) {
      allocations.forEach((allocation: any) => {
        ensureTank(
          String(allocation?.tankId || ""),
          String(allocation?.tankName || "Unknown tank"),
          Number(allocation?.fishCount || 0),
        );
      });
    } else {
      tanks.forEach((tank: any) => {
        ensureTank(String(tank._id), String(tank.name || "Unnamed tank"), Number(tank.currentFish || 0));
      });
    }

    sourceLogs.forEach((log: any) => {
      const tankId = String(log.tankId || "");
      const tankName = String(log.tankName || "").trim() || "All Tanks";
      if (!tankId && tankName.toLowerCase() === "all tanks") return;
      const currentFish = batchId
        ? Number(
            allocations.find((allocation: any) =>
              (tankId && String(allocation?.tankId || "") === tankId) ||
              String(allocation?.tankName || "").trim().toLowerCase() === tankName.toLowerCase(),
            )?.fishCount || 0
          )
        : Number(
            tanks.find((tank: any) =>
              (tankId && String(tank._id) === tankId) ||
              String(tank.name || "").trim().toLowerCase() === tankName.toLowerCase(),
            )?.currentFish || 0
          );
      const entry = ensureTank(tankId, tankName, currentFish);
      if (!entry) return;
      entry.feedKg14d += Number(log.feedGiven || 0);
      entry.mortality14d += Number(log.mortality || 0);
      const ph = Number(log.ph);
      const ammonia = Number(log.ammonia);
      if ((Number.isFinite(ph) && (ph < 6.5 || ph > 8)) || (Number.isFinite(ammonia) && ammonia >= 0.5)) {
        entry.waterRiskLogs += 1;
      }
      entry.logCount += 1;
    });

    return Array.from(tankMap.values())
      .filter((item) => item.currentFish > 0 || item.feedKg14d > 0 || item.mortality14d > 0 || item.logCount > 0)
      .sort((a, b) => b.currentFish - a.currentFish || b.feedKg14d - a.feedKg14d || a.tankName.localeCompare(b.tankName))
      .slice(0, 6);
  };

  const movementSummaries = recentMovements.map((movement: any) => ({
    id: String(movement._id),
    batchId: String(movement.batchId?._id || movement.batchId || ""),
    batchName: String(movement.batchId?.name || ""),
    fromTankName: String(movement.fromTankName || ""),
    toTankName: String(movement.toTankName || ""),
    count: Number(movement.count || 0),
    reason: String(movement.reason || "sorting"),
    date: movement.date ? new Date(movement.date).toISOString() : new Date().toISOString(),
  }));

  const buildTankHealthTrend = (batch: any | null) => {
    const batchId = batch ? String(batch._id) : "";
    const scopedLogs = batchId
      ? recentLogs.filter((log: any) => String(log.batchId || "") === batchId)
      : recentLogs;

    return Object.fromEntries(
      DASHBOARD_TIMEFRAMES.map((days) => [String(days), buildTankHealthSeries(scopedLogs, days)])
    );
  };

  const tankSnapshots = {
    all: buildTankSnapshot(null),
    byBatch: Object.fromEntries(
      batches.map((batch: any) => [String(batch._id), buildTankSnapshot(batch)])
    ),
  };
  const tankHealthTrend = {
    all: buildTankHealthTrend(null),
    byBatch: Object.fromEntries(
      batches.map((batch: any) => [String(batch._id), buildTankHealthTrend(batch)])
    ),
  };

  const props = {
    totalFish, totalInitial, totalFeedToday,
    totalMortality30d, totalExpenses, totalRevenue,
    activeBatches: batches.length,
    totalTanks: tanks.length,
    chartDataByRange,
    batchSummaries,
    tankSnapshots,
    tankHealthTrend,
    recentMovements: movementSummaries,
    actions: actions.slice(0, 4),
    batches: JSON.parse(JSON.stringify(batches)),
    tanks: JSON.parse(JSON.stringify(tanks)),
    farmName: (session?.user as any)?.farmName || "My Catfish Farm",
    userName: session?.user?.name || "Farmer",
    plan: ((session?.user as any)?.plan || "free") as "free" | "pro" | "commercial",
  };

  return <DashboardClient {...props} />;
}
