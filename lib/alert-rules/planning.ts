import { weeksSince } from "@/lib/utils";
import { AlertCandidate, AlertRule, buildMeta } from "./types";

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

export const planningRules: AlertRule[] = [
  (ctx) => {
    const alerts: AlertCandidate[] = [];
    const eventsKeySet = new Set(
      ctx.calendarEvents.map((event) => `${String(event.batchId)}:${String(event.kind)}:${Number(event.milestoneWeek)}`)
    );

    const today = startOfDay(ctx.now);
    let overdueCount = 0;
    let dueSoonCount = 0;
    let harvestWindowCount = 0;

    for (const batch of ctx.batches) {
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
        message: `${overdueCount} sort or harvest milestone${overdueCount > 1 ? "s are" : " is"} overdue.`,
        href: "/calendar",
        meta: buildMeta(undefined, {
          entityType: "calendar",
          incidentKey: "incident:planning",
          actualValue: overdueCount,
        }),
      });
    } else if (dueSoonCount > 0) {
      alerts.push({
        key: "planning:milestones-due-soon",
        source: "calendar",
        severity: "info",
        title: "Milestones due soon",
        message: `${dueSoonCount} milestone${dueSoonCount > 1 ? "s are" : " is"} due within 7 days.`,
        href: "/calendar",
        meta: buildMeta(undefined, {
          entityType: "calendar",
          incidentKey: "incident:planning",
          actualValue: dueSoonCount,
          windowDays: 7,
        }),
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
        meta: buildMeta(undefined, {
          entityType: "batch",
          incidentKey: "incident:harvest-readiness",
          actualValue: harvestWindowCount,
        }),
      });
    }

    return alerts;
  },
];
