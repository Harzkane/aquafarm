import { Batch } from "@/models/Batch";
import { CalendarEvent } from "@/models/CalendarEvent";
import { CronRun } from "@/models/CronRun";
import { DailyLog } from "@/models/DailyLog";
import { FeedInventory } from "@/models/FeedInventory";
import { Financial } from "@/models/Financial";
import { User } from "@/models/User";
import { AlertNotification } from "@/models/AlertNotification";
import { getPlanConfig } from "@/lib/plans";
import { weeksSince } from "@/lib/utils";
import { summarizeFeedInventory } from "@/lib/feed-inventory";

type AlertSeverity = "info" | "warning" | "critical";

type AlertCandidate = {
  key: string;
  source: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  href: string;
  meta?: Record<string, unknown>;
};

const MILESTONES: Array<{ week: number; kind: "sort" | "harvest"; label: string }> = [
  { week: 3, kind: "sort", label: "Sort 1" },
  { week: 8, kind: "sort", label: "Sort 2" },
  { week: 14, kind: "sort", label: "Sort 3" },
  { week: 17, kind: "sort", label: "Sort 4" },
  { week: 18, kind: "harvest", label: "Harvest" },
];

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dayDiff(from: Date, to: Date) {
  return Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

function severityRank(severity: AlertSeverity) {
  if (severity === "critical") return 3;
  if (severity === "warning") return 2;
  return 1;
}

function toFiniteNumber(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function collectAlertCandidates(userId: string, now = new Date()) {
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [owner, batches, feedInventory, financial, calendarEvents, recentCronFailures, staffUsers] =
    await Promise.all([
      User.findById(userId)
        .select("plan billingStatus billingExpiresAt cancelAtPeriodEnd role")
        .lean<any>(),
      Batch.find({
        userId,
        status: { $in: ["active", "partial"] },
        $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
      })
        .select("_id name status stockingDate initialCount currentCount")
        .lean<any[]>(),
      FeedInventory.findOne({ userId }).select("openingStockKg openingStockBrand openingStockSizeMm purchases").lean<any>(),
      Financial.findOne({ userId }).select("expenses revenue").lean<any>(),
      CalendarEvent.find({ userId }).select("batchId kind milestoneWeek").lean<any[]>(),
      CronRun.countDocuments({ status: "failed", createdAt: { $gte: oneDayAgo } }),
      User.countDocuments({ role: "staff", farmOwnerId: userId }),
    ]);

  if (!owner) return [] as AlertCandidate[];

  const plan = getPlanConfig(owner.plan);
  const batchIds = batches.map((b) => b._id);

  const [logs30d, feedLogs, logs3d] = await Promise.all([
    DailyLog.find({
      userId,
      ...(batchIds.length ? { batchId: { $in: batchIds } } : {}),
      date: { $gte: thirtyDaysAgo },
    })
      .select("date feedGiven mortality ph ammonia")
      .lean<any[]>(),
    DailyLog.find({
      userId,
    })
      .select("date feedGiven feedType feedBrand feedSizeMm")
      .lean<any[]>(),
    DailyLog.find({
      userId,
      ...(batchIds.length ? { batchId: { $in: batchIds } } : {}),
      date: { $gte: threeDaysAgo },
    })
      .select("date mortality ph ammonia")
      .lean<any[]>(),
  ]);

  const alerts: AlertCandidate[] = [];
  const totalFish = batches.reduce((sum, b) => sum + toFiniteNumber(b.currentCount), 0);
  const todayStart = startOfDay(now);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(todayStart.getDate() + 1);
  const hasLogToday = logs30d.some((log) => {
    const dt = new Date(log.date);
    return dt >= todayStart && dt < tomorrowStart;
  });

  if (batches.length > 0 && !hasLogToday) {
    alerts.push({
      key: "ops:no-daily-log",
      source: "dashboard",
      severity: "warning",
      title: "No daily log for today",
      message: "No feed/water log has been recorded yet for active batches today.",
      href: "/feeding",
    });
  }

  const mortality3d = logs3d.reduce((sum, log) => sum + toFiniteNumber(log.mortality), 0);
  if (totalFish > 0 && mortality3d / totalFish >= 0.01) {
    alerts.push({
      key: "health:mortality-spike-3d",
      source: "mortality",
      severity: mortality3d / totalFish >= 0.02 ? "critical" : "warning",
      title: "Mortality spike detected",
      message: `${mortality3d} deaths logged in the last 3 days (${((mortality3d / totalFish) * 100).toFixed(2)}% of current stock).`,
      href: "/mortality",
      meta: { mortality3d, totalFish },
    });
  }

  const waterRisk3d = logs3d.filter((log) => {
    const ph = Number(log.ph);
    const ammonia = Number(log.ammonia);
    return (Number.isFinite(ph) && (ph < 6.5 || ph > 8)) || (Number.isFinite(ammonia) && ammonia >= 0.5);
  }).length;
  if (waterRisk3d > 0) {
    alerts.push({
      key: "health:water-risk-3d",
      source: "water-quality",
      severity: waterRisk3d >= 3 ? "critical" : "warning",
      title: "Water quality out of range",
      message: `${waterRisk3d} recent log${waterRisk3d > 1 ? "s show" : " shows"} pH/ammonia risk in the last 3 days.`,
      href: "/water-quality",
      meta: { waterRisk3d },
    });
  }

  const eventsKeySet = new Set(
    calendarEvents.map((event) => `${String(event.batchId)}:${String(event.kind)}:${Number(event.milestoneWeek)}`)
  );
  const today = startOfDay(now);
  let overdueCount = 0;
  let dueSoonCount = 0;
  let harvestWindowCount = 0;

  for (const batch of batches) {
    const stockDate = new Date(batch.stockingDate);
    const weeks = weeksSince(stockDate);
    if (weeks >= 18) harvestWindowCount += 1;

    for (const milestone of MILESTONES) {
      const doneByEvent = eventsKeySet.has(`${String(batch._id)}:${milestone.kind}:${milestone.week}`);
      const doneByHarvestStatus = milestone.kind === "harvest" && batch.status === "harvested";
      if (doneByEvent || doneByHarvestStatus) continue;

      const dueDate = startOfDay(new Date(stockDate.getTime() + milestone.week * 7 * 24 * 60 * 60 * 1000));
      const offset = dayDiff(today, dueDate);
      if (offset < -3) overdueCount += 1;
      else if (offset <= 7) dueSoonCount += 1;
    }
  }

  if (overdueCount > 0) {
    alerts.push({
      key: "planning:milestones-overdue",
      source: "calendar",
      severity: overdueCount >= 3 ? "critical" : "warning",
      title: "Milestones overdue",
      message: `${overdueCount} sort/harvest milestone${overdueCount > 1 ? "s are" : " is"} overdue.`,
      href: "/calendar",
      meta: { overdueCount },
    });
  } else if (dueSoonCount > 0) {
    alerts.push({
      key: "planning:milestones-due-soon",
      source: "calendar",
      severity: "info",
      title: "Milestones due soon",
      message: `${dueSoonCount} milestone${dueSoonCount > 1 ? "s are" : " is"} due within 7 days.`,
      href: "/calendar",
      meta: { dueSoonCount },
    });
  }

  if (harvestWindowCount > 0) {
    alerts.push({
      key: "planning:harvest-window-open",
      source: "harvest",
      severity: "info",
      title: "Harvest window open",
      message: `${harvestWindowCount} batch${harvestWindowCount > 1 ? "es are" : " is"} in harvest range (18+ weeks).`,
      href: "/harvest",
      meta: { harvestWindowCount },
    });
  }

  const feedSummary = summarizeFeedInventory(feedInventory, feedLogs);
  const mostUrgentFeed = feedSummary.lowStockProducts[0];
  if (mostUrgentFeed) {
    const severity: AlertSeverity = mostUrgentFeed.lowStockSeverity === "critical" ? "critical" : "warning";
    alerts.push({
      key: `feed:stock-low:${mostUrgentFeed.key}`,
      source: "feed-inventory",
      severity,
      title: `${mostUrgentFeed.label} running low`,
      message:
        mostUrgentFeed.estimatedDaysLeft != null
          ? `${mostUrgentFeed.remainingKg.toFixed(2)}kg left, about ${mostUrgentFeed.estimatedDaysLeft.toFixed(1)} feeding days remaining.`
          : `${mostUrgentFeed.remainingKg.toFixed(2)}kg left. Recent usage is not enough to forecast days left.`,
      href: "/feed-inventory",
      meta: {
        feedKey: mostUrgentFeed.key,
        feedLabel: mostUrgentFeed.label,
        remainingFeedKg: mostUrgentFeed.remainingKg,
        avgDailyUse: mostUrgentFeed.avgDailyUse,
        estimatedDaysLeft: mostUrgentFeed.estimatedDaysLeft,
      },
    });
  }

  const nowTime = now.getTime();
  if (owner.billingStatus === "past_due") {
    alerts.push({
      key: "billing:past-due",
      source: "billing",
      severity: "critical",
      title: "Billing is past due",
      message: "Payment is overdue. Update billing now to avoid interruption.",
      href: "/settings/billing",
    });
  }
  if (owner.cancelAtPeriodEnd) {
    alerts.push({
      key: "billing:cancel-at-period-end",
      source: "billing",
      severity: "warning",
      title: "Plan downgrade scheduled",
      message: "Auto-renew is disabled and your plan is scheduled to downgrade at period end.",
      href: "/settings/billing",
    });
  }
  if (owner.billingExpiresAt && owner.plan !== "free") {
    const expiresAt = new Date(owner.billingExpiresAt).getTime();
    const daysToExpiry = Math.ceil((expiresAt - nowTime) / (1000 * 60 * 60 * 24));
    if (daysToExpiry <= 3) {
      alerts.push({
        key: "billing:expiring-soon",
        source: "billing",
        severity: daysToExpiry <= 0 ? "critical" : "warning",
        title: daysToExpiry <= 0 ? "Billing period expired" : "Billing period ending soon",
        message:
          daysToExpiry <= 0
            ? "Your billing period has expired. Confirm plan status immediately."
            : `Your billing period ends in ${daysToExpiry} day${daysToExpiry > 1 ? "s" : ""}.`,
        href: "/settings/billing",
        meta: { daysToExpiry },
      });
    }
  }

  if (recentCronFailures > 0 && owner.plan === "commercial") {
    alerts.push({
      key: "ops:cron-failures-24h",
      source: "ops",
      severity: recentCronFailures >= 3 ? "critical" : "warning",
      title: "Cron failures in last 24h",
      message: `${recentCronFailures} cron run${recentCronFailures > 1 ? "s have" : " has"} failed in the past 24 hours.`,
      href: "/settings/ops",
      meta: { recentCronFailures },
    });
  }

  if (owner.role !== "staff" && plan.maxStaffUsers && plan.maxStaffUsers > 0) {
    if (staffUsers >= plan.maxStaffUsers) {
      alerts.push({
        key: "staff:seat-limit-reached",
        source: "staff",
        severity: "critical",
        title: "Staff seat limit reached",
        message: `${staffUsers}/${plan.maxStaffUsers} staff seats are in use.`,
        href: "/settings/staff",
        meta: { staffUsers, maxStaffUsers: plan.maxStaffUsers },
      });
    } else if (staffUsers >= Math.ceil(plan.maxStaffUsers * 0.8)) {
      alerts.push({
        key: "staff:seat-limit-near",
        source: "staff",
        severity: "warning",
        title: "Staff seat usage is high",
        message: `${staffUsers}/${plan.maxStaffUsers} staff seats are used.`,
        href: "/settings/staff",
        meta: { staffUsers, maxStaffUsers: plan.maxStaffUsers },
      });
    }
  }

  const last30Expenses = (financial?.expenses || [])
    .filter((item: any) => new Date(item.date).getTime() >= thirtyDaysAgo.getTime())
    .reduce((sum: number, item: any) => sum + toFiniteNumber(item.amount), 0);
  const last30Revenue = (financial?.revenue || [])
    .filter((item: any) => new Date(item.date).getTime() >= thirtyDaysAgo.getTime())
    .reduce((sum: number, item: any) => sum + toFiniteNumber(item.totalAmount), 0);
  const net30 = last30Revenue - last30Expenses;
  if (last30Revenue > 0 && net30 < 0) {
    alerts.push({
      key: "financials:negative-net-30d",
      source: "financials",
      severity: "warning",
      title: "30-day net is negative",
      message: "Revenue is below expenses in the last 30 days.",
      href: "/financials",
      meta: { last30Revenue, last30Expenses, net30 },
    });
  }

  return alerts;
}

export async function syncAlertsForUser(userId: string, candidates: AlertCandidate[], now = new Date()) {
  const existing = await AlertNotification.find({ userId }).select("key active").lean<any[]>();
  const activeKeys = new Set(candidates.map((candidate) => candidate.key));
  const operations: any[] = [];

  for (const candidate of candidates) {
    operations.push({
      updateOne: {
        filter: { userId, key: candidate.key },
        update: {
          $set: {
            source: candidate.source,
            severity: candidate.severity,
            severityRank: severityRank(candidate.severity),
            title: candidate.title,
            message: candidate.message,
            href: candidate.href,
            meta: candidate.meta || {},
            active: true,
            resolvedAt: null,
            updatedAt: now,
            lastTriggeredAt: now,
          },
          $setOnInsert: {
            createdAt: now,
            acknowledgedAt: null,
          },
          $inc: { triggerCount: 1 },
        },
        upsert: true,
      },
    });
  }

  const staleActive = existing.filter((row) => row.active && !activeKeys.has(String(row.key)));
  for (const row of staleActive) {
    operations.push({
      updateOne: {
        filter: { userId, key: row.key },
        update: {
          $set: {
            active: false,
            resolvedAt: now,
            updatedAt: now,
          },
        },
      },
    });
  }

  if (operations.length > 0) {
    await AlertNotification.bulkWrite(operations, { ordered: false });
  }

  return {
    active: candidates.length,
    resolved: staleActive.length,
    touched: operations.length,
  };
}
