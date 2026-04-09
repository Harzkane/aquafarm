import { Batch } from "@/models/Batch";
import { CalendarEvent } from "@/models/CalendarEvent";
import { CronRun } from "@/models/CronRun";
import { DailyLog } from "@/models/DailyLog";
import { FeedInventory } from "@/models/FeedInventory";
import { Financial } from "@/models/Financial";
import { User } from "@/models/User";
import { AlertNotification } from "@/models/AlertNotification";
import { AlertIncident } from "@/models/AlertIncident";
import { getPlanConfig } from "@/lib/plans";
import { AlertCandidate, AlertSeverity, severityRank } from "@/lib/alert-rules/types";
import { evaluateAlertRules } from "@/lib/alert-rules";
type AlertStatus = "new" | "acknowledged" | "in_progress" | "resolved" | "muted";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
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
  return evaluateAlertRules({
    now,
    owner,
    plan,
    batches,
    financial,
    calendarEvents,
    logs30d,
    logs3d,
    feedLogs,
    feedInventory,
    recentCronFailures,
    staffUsers,
  });
}

async function syncAlertIncidents(userId: string, now = new Date()) {
  const activeAlerts = await AlertNotification.find({ userId, active: true })
    .select("key source severity severityRank title message href meta status assignedToUserId assignedToName nextStepNote followUpDueAt verificationStatus verificationNote verifiedAt updatedAt createdAt")
    .lean<any[]>();

  const groups = new Map<string, any[]>();
  for (const alert of activeAlerts) {
    const incidentKey = String(alert.meta?.incidentKey || `incident:${alert.source}:${alert.key}`);
    if (!groups.has(incidentKey)) groups.set(incidentKey, []);
    groups.get(incidentKey)!.push(alert);
  }

  const existingIncidents = await AlertIncident.find({ userId })
    .select("incidentKey active nextStepNote followUpDueAt verificationStatus verificationNote verifiedAt")
    .lean<any[]>();
  const activeIncidentKeys = new Set(groups.keys());
  const ops: any[] = [];

  for (const [incidentKey, alerts] of Array.from(groups.entries())) {
    const sorted = [...alerts].sort((a, b) => Number(b.severityRank || 0) - Number(a.severityRank || 0) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    const primary = sorted[0];
    const preservedAssignee = sorted.find((item) => item.assignedToUserId);
    const preservedWorkflow = sorted.find(
      (item) => item.nextStepNote || item.followUpDueAt || item.verificationStatus === "scheduled" || item.verificationStatus === "verified" || item.verificationStatus === "needs_attention" || item.verificationNote,
    );
    const existingIncident = existingIncidents.find((row) => String(row.incidentKey) === incidentKey);
    const status =
      sorted.some((item) => item.status === "in_progress") ? "in_progress"
        : sorted.some((item) => item.status === "acknowledged") ? "acknowledged"
          : sorted.some((item) => item.status === "muted") ? "muted"
            : "new";
    ops.push({
      updateOne: {
        filter: { userId, incidentKey },
        update: {
          $set: {
            source: primary.source,
            severity: primary.severity,
            severityRank: primary.severityRank || severityRank(primary.severity),
            title: primary.title,
            summary: primary.message,
            href: primary.href || "",
            entityType: String(primary.meta?.entityType || ""),
            active: true,
            status,
            alertKeys: sorted.map((item) => String(item.key)),
            alertCount: sorted.length,
            assignedToUserId: preservedAssignee?.assignedToUserId || null,
            assignedToName: preservedAssignee?.assignedToName || "",
            nextStepNote: String(preservedWorkflow?.nextStepNote || existingIncident?.nextStepNote || ""),
            followUpDueAt: preservedWorkflow?.followUpDueAt || existingIncident?.followUpDueAt || null,
            verificationStatus: String(preservedWorkflow?.verificationStatus || existingIncident?.verificationStatus || "pending"),
            verificationNote: String(preservedWorkflow?.verificationNote || existingIncident?.verificationNote || ""),
            verifiedAt: preservedWorkflow?.verifiedAt || existingIncident?.verifiedAt || null,
            updatedAt: now,
            lastTriggeredAt: now,
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        upsert: true,
      },
    });
  }

  for (const row of existingIncidents.filter((row) => row.active && !activeIncidentKeys.has(String(row.incidentKey)))) {
    ops.push({
      updateOne: {
        filter: { userId, incidentKey: row.incidentKey },
        update: {
          $set: {
            active: false,
            status: "resolved",
            resolvedAt: now,
            updatedAt: now,
          },
        },
      },
    });
  }

  if (ops.length) {
    await AlertIncident.bulkWrite(ops, { ordered: false });
  }

  return { incidents: groups.size };
}

export async function syncAlertsForUser(userId: string, candidates: AlertCandidate[], now = new Date()) {
  const existing = await AlertNotification.find({ userId })
    .select("key active status assignedToUserId assignedToName nextStepNote followUpDueAt verificationStatus verificationNote verifiedAt")
    .lean<any[]>();
  const existingMap = new Map(existing.map((row) => [String(row.key), row]));
  const activeKeys = new Set(candidates.map((candidate) => candidate.key));
  const operations: any[] = [];

  for (const candidate of candidates) {
    const current = existingMap.get(candidate.key);
    const reopen = !current || !current.active || current.status === "resolved";
    const preservedStatus = current?.status === "muted"
      ? "muted"
      : current?.status === "acknowledged" || current?.status === "in_progress"
        ? current.status
        : "new";
    const setPayload: Record<string, unknown> = {
      source: candidate.source,
      severity: candidate.severity,
      severityRank: severityRank(candidate.severity),
      title: candidate.title,
      message: candidate.message,
      href: candidate.href,
      meta: candidate.meta || {},
      active: true,
      updatedAt: now,
      lastTriggeredAt: now,
      status: (reopen ? "new" : preservedStatus) as AlertStatus,
    };
    if (reopen) {
      setPayload.resolvedAt = null;
      setPayload.acknowledgedAt = null;
      setPayload.acknowledgedByUserId = null;
      setPayload.acknowledgedByName = "";
      setPayload.resolvedByUserId = null;
      setPayload.resolvedByName = "";
      setPayload.resolutionNote = "";
      setPayload.verificationStatus = "pending";
      setPayload.verificationNote = "";
      setPayload.verifiedAt = null;
    }
    operations.push({
      updateOne: {
        filter: { userId, key: candidate.key },
        update: {
          $set: setPayload,
          $setOnInsert: {
            createdAt: now,
            assignedToUserId: null,
            assignedToName: "",
            nextStepNote: "",
            followUpDueAt: null,
            verificationStatus: "pending",
            verificationNote: "",
            verifiedAt: null,
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
            status: "resolved" as AlertStatus,
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

  const incidentSync = await syncAlertIncidents(userId, now);

  return {
    active: candidates.length,
    resolved: staleActive.length,
    touched: operations.length,
    incidents: incidentSync.incidents,
  };
}
