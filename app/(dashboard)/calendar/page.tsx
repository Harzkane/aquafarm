"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Calendar, CheckCircle, Clock, Fish, Loader2 } from "lucide-react";
import { addWeeks, format } from "date-fns";
import { getBatchPhase, weeksSince } from "@/lib/utils";

type TankAllocation = {
  tankId?: string;
  tankName?: string;
  fishCount?: number;
  phase?: string;
};

type Tank = {
  _id: string;
  name: string;
  currentFish?: number;
};

type Batch = {
  _id: string;
  name: string;
  stockingDate: string;
  status: "active" | "partial" | "harvested";
  currentCount: number;
  tankAllocations?: TankAllocation[];
  harvestDate?: string | null;
};

type CalendarEvent = {
  _id: string;
  batchId: { _id: string; name?: string } | string;
  kind: "sort" | "harvest";
  milestoneWeek: number;
  completedAt: string;
  notes?: string;
};

type ReminderItem = {
  id: string;
  batchId: string;
  batchName: string;
  label: string;
  kind: "sort" | "harvest";
  week: number;
  dueDate: Date;
  dayOffset: number;
  status: "overdue" | "dueSoon" | "upcoming";
};

type Milestone = {
  week: number;
  label: string;
  desc: string;
  kind: "sort" | "harvest";
};

const MILESTONES: Milestone[] = [
  { week: 3, label: "Sort 1", desc: "Early check and split obvious shooters.", kind: "sort" },
  { week: 8, label: "Sort 2", desc: "Major grading across tanks (large / medium / small).", kind: "sort" },
  { week: 14, label: "Sort 3", desc: "Mid-cycle sort and consolidation.", kind: "sort" },
  { week: 17, label: "Sort 4", desc: "Pre-harvest selection of market-ready fish.", kind: "sort" },
  { week: 18, label: "Harvest", desc: "Target harvest window.", kind: "harvest" },
];

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dayDiff(from: Date, to: Date) {
  return Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

function eventKey(batchId: string, kind: "sort" | "harvest", week: number) {
  return `${batchId}:${kind}:${week}`;
}

export default function CalendarPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [tanks, setTanks] = useState<Tank[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [eventBusyKey, setEventBusyKey] = useState("");

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [batchesRes, tanksRes, eventsRes] = await Promise.all([
        fetch("/api/batches"),
        fetch("/api/tanks"),
        fetch("/api/calendar/events"),
      ]);
      const batchesPayload = await batchesRes.json();
      const tanksPayload = await tanksRes.json();
      const eventsPayload = await eventsRes.json();

      if (!batchesRes.ok) throw new Error(batchesPayload?.error || "Failed to load batches");
      if (!tanksRes.ok) throw new Error(tanksPayload?.error || "Failed to load tanks");
      if (!eventsRes.ok) throw new Error(eventsPayload?.error || "Failed to load calendar events");

      setBatches(batchesPayload || []);
      setTanks(tanksPayload || []);
      setEvents(eventsPayload || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load calendar data");
    } finally {
      setLoading(false);
    }
  }

  async function markMilestoneDone(batchId: string, week: number) {
    const key = eventKey(batchId, "sort", week);
    setEventBusyKey(key);
    setError("");
    try {
      const res = await fetch("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId, kind: "sort", milestoneWeek: week, completedAt: new Date().toISOString() }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to mark milestone complete");
      setEvents((prev) => {
        const normalizedBatchId = typeof payload.batchId === "string" ? payload.batchId : payload.batchId?._id || "";
        return [
          ...prev.filter((e) => {
            const eBatchId = typeof e.batchId === "string" ? e.batchId : e.batchId?._id || "";
            return !(eBatchId === normalizedBatchId && e.kind === payload.kind && e.milestoneWeek === payload.milestoneWeek);
          }),
          payload,
        ];
      });
    } catch (err: any) {
      setError(err?.message || "Failed to mark milestone complete");
    } finally {
      setEventBusyKey("");
    }
  }

  async function undoMilestone(eventId: string, batchId: string, week: number) {
    const key = eventKey(batchId, "sort", week);
    setEventBusyKey(key);
    setError("");
    try {
      const res = await fetch(`/api/calendar/events/${eventId}`, { method: "DELETE" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to undo milestone");
      setEvents((prev) => prev.filter((e) => e._id !== eventId));
    } catch (err: any) {
      setError(err?.message || "Failed to undo milestone");
    } finally {
      setEventBusyKey("");
    }
  }

  const eventsByKey = useMemo(() => {
    const map: Record<string, CalendarEvent> = {};
    for (const e of events) {
      const bId = typeof e.batchId === "string" ? e.batchId : e.batchId?._id || "";
      if (!bId) continue;
      map[eventKey(bId, e.kind, Number(e.milestoneWeek))] = e;
    }
    return map;
  }, [events]);

  const tankById = useMemo(() => {
    const map: Record<string, Tank> = {};
    for (const tank of tanks) map[tank._id] = tank;
    return map;
  }, [tanks]);

  const tankByName = useMemo(() => {
    const map: Record<string, Tank> = {};
    for (const tank of tanks) {
      const key = (tank.name || "").trim().toLowerCase();
      if (key) map[key] = tank;
    }
    return map;
  }, [tanks]);

  const activeBatchCount = useMemo(
    () => batches.filter((b) => b.status === "active" || b.status === "partial").length,
    [batches]
  );
  const reminders = useMemo<ReminderItem[]>(() => {
    const today = startOfDay(new Date());
    const list: ReminderItem[] = [];

    for (const batch of batches) {
      if (!(batch.status === "active" || batch.status === "partial")) continue;

      const stockDate = new Date(batch.stockingDate);
      for (const milestone of MILESTONES) {
        const key = eventKey(batch._id, milestone.kind, milestone.week);
        const confirmation = eventsByKey[key];
        const doneByEvent = milestone.kind === "sort" && Boolean(confirmation);
        const doneByHarvestStatus = milestone.kind === "harvest" && batch.status === "harvested";
        if (doneByEvent || doneByHarvestStatus) continue;

        const dueDate = startOfDay(addWeeks(stockDate, milestone.week));
        const dayOffset = dayDiff(today, dueDate);
        const status: ReminderItem["status"] =
          dayOffset < -3 ? "overdue" : dayOffset <= 7 ? "dueSoon" : "upcoming";

        list.push({
          id: `${batch._id}:${milestone.kind}:${milestone.week}`,
          batchId: batch._id,
          batchName: batch.name,
          label: milestone.label,
          kind: milestone.kind,
          week: milestone.week,
          dueDate,
          dayOffset,
          status,
        });
      }
    }

    return list
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
      .slice(0, 10);
  }, [batches, eventsByKey]);
  const dueSoonCount = reminders.filter((r) => r.status === "dueSoon").length;
  const overdueCount = reminders.filter((r) => r.status === "overdue").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-pond-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-pond-100">Production Calendar</h1>
        <p className="text-pond-200/75 text-sm mt-1">Timeline, confirmed sorting checkpoints and harvest readiness</p>
      </div>

      {error && (
        <div className="rounded-xl px-4 py-3 text-sm text-danger border border-red-400/30 bg-red-500/10 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="section-title !text-base">Upcoming Reminders</h2>
            <p className="text-xs text-pond-200/70 mt-1">Next calendar actions for your active batches.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="badge badge-amber text-xs">{dueSoonCount} due soon</span>
            <span className="badge badge-red text-xs">{overdueCount} overdue</span>
          </div>
        </div>
        {reminders.length === 0 ? (
          <p className="text-sm text-pond-200/70">No pending reminders. You are up to date.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {reminders.map((item) => (
              <div
                key={item.id}
                className="rounded-xl px-3 py-2.5 border"
                style={{ background: "rgba(12, 12, 14,0.5)", borderColor: "rgba(148, 163, 184,0.18)" }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-pond-100 font-medium truncate">{item.batchName}</p>
                  <span
                    className={`badge text-[10px] ${
                      item.status === "overdue" ? "badge-red" : item.status === "dueSoon" ? "badge-amber" : "badge-water"
                    }`}
                  >
                    {item.status === "overdue" ? "Overdue" : item.status === "dueSoon" ? "Due soon" : "Upcoming"}
                  </span>
                </div>
                <p className="text-xs text-pond-200/75 mt-1">
                  {item.label} (Week {item.week}) · {format(item.dueDate, "d MMM yyyy")}
                </p>
                <p className="text-[11px] text-pond-200/65 mt-1">
                  {item.dayOffset < 0 ? `${Math.abs(item.dayOffset)}d ago` : item.dayOffset === 0 ? "today" : `in ${item.dayOffset}d`}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {batches.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <Calendar className="w-12 h-12 text-pond-500 mx-auto mb-4 opacity-40" />
          <h3 className="font-display text-lg text-pond-200 mb-2">No batches to display</h3>
          <p className="text-pond-200/75 text-sm">Create a batch first to see your production calendar</p>
        </div>
      ) : (
        batches.map((batch) => {
          const stockDate = new Date(batch.stockingDate);
          const weeks = Math.max(0, weeksSince(stockDate));
          const { phase } = getBatchPhase(weeks);
          const progress = Math.max(0, Math.min((weeks / 18) * 100, 100));

          const activeAllocations = (batch.tankAllocations || [])
            .map((a) => {
              const fromId = a.tankId ? tankById[a.tankId] : undefined;
              const fromName = a.tankName ? tankByName[a.tankName.trim().toLowerCase()] : undefined;
              const matchedTank = fromId || fromName;
              const liveFish = matchedTank ? Number(matchedTank.currentFish || 0) : Number(a.fishCount || 0);
              return {
                ...a,
                tankName: matchedTank?.name || a.tankName,
                fishCount: liveFish,
              };
            })
            .filter((a) => Number(a.fishCount || 0) > 0)
            .sort((a, b) => Number(b.fishCount || 0) - Number(a.fishCount || 0));

          const fallbackLiveAllocations =
            activeAllocations.length === 0 && activeBatchCount === 1
              ? tanks
                  .filter((t) => Number(t.currentFish || 0) > 0)
                  .map((t) => ({ tankId: t._id, tankName: t.name, fishCount: Number(t.currentFish || 0), phase: "inferred-live" }))
              : [];

          const displayAllocations = activeAllocations.length > 0 ? activeAllocations : fallbackLiveAllocations;

          return (
            <div key={batch._id} className="glass-card p-5 space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#4b5563,#064b71)" }}>
                  <Fish className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="font-display text-lg text-pond-100">{batch.name}</h2>
                  <p className="text-xs text-pond-200/75">Started {format(stockDate, "d MMM yyyy")} · Currently Week {weeks} · {phase}</p>
                </div>
                <span className="sm:ml-auto badge badge-green shrink-0 whitespace-nowrap">Week {weeks} / 18</span>
              </div>

              <div className="relative">
                <div className="h-2 rounded-full mb-6 overflow-hidden" style={{ background: "rgba(12, 12, 14,0.8)" }}>
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progress}%`, background: "linear-gradient(90deg,#4b5563,#9ca3af)" }} />
                </div>

                <div className="space-y-3">
                  {MILESTONES.map((milestone) => {
                    const milestoneDate = addWeeks(stockDate, milestone.week);
                    const today = startOfDay(new Date());
                    const dueDate = startOfDay(milestoneDate);
                    const d = dayDiff(today, dueDate);

                    const key = eventKey(batch._id, milestone.kind, milestone.week);
                    const confirmation = eventsByKey[key];
                    const doneByEvent = milestone.kind === "sort" && Boolean(confirmation);
                    const doneByHarvestStatus = milestone.kind === "harvest" && batch.status === "harvested";
                    const isDone = doneByEvent || doneByHarvestStatus;

                    const completionDate = doneByEvent
                      ? startOfDay(new Date(confirmation.completedAt))
                      : doneByHarvestStatus && batch.harvestDate
                        ? startOfDay(new Date(batch.harvestDate))
                        : undefined;

                    const isEarly = Boolean(completionDate && completionDate.getTime() < dueDate.getTime() - 3 * 24 * 60 * 60 * 1000);
                    const isOverdue = !isDone && d < -3;
                    const isDueNow = !isDone && d >= -3 && d <= 3;
                    const canConfirmSort = milestone.kind === "sort" && (batch.status === "active" || batch.status === "partial");

                    return (
                      <div
                        key={milestone.week}
                        className={`flex items-start gap-4 rounded-xl p-4 transition-all duration-200 ${isDueNow ? "ring-1 ring-pond-400/40" : ""}`}
                        style={{ background: isDone ? "rgba(148, 163, 184,0.1)" : "rgba(12, 12, 14,0.45)", border: "1px solid rgba(148, 163, 184,0.1)" }}
                      >
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: isDone ? "rgba(148, 163, 184,0.3)" : "rgba(12, 12, 14,0.6)" }}>
                          {isDone
                            ? <CheckCircle className="w-4 h-4 text-pond-400" />
                            : isDueNow || isOverdue
                              ? <AlertTriangle className="w-4 h-4 text-mud-400" />
                              : <Clock className="w-4 h-4 text-pond-200/60" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-medium text-sm text-pond-100">{milestone.label}</span>
                            <span className="badge badge-water text-xs">Week {milestone.week}</span>
                            {isDone && !isEarly && <span className="badge badge-green text-xs">Done</span>}
                            {isDone && isEarly && <span className="badge badge-amber text-xs">Early</span>}
                            {isDueNow && <span className="badge badge-amber text-xs">Due now</span>}
                            {isOverdue && <span className="badge badge-red text-xs">Overdue</span>}
                            {!isDone && !isDueNow && !isOverdue && <span className="badge badge-water text-xs">Upcoming</span>}
                          </div>

                          <p className="text-xs text-pond-200/75 leading-relaxed">{milestone.desc}</p>
                          <p className="text-xs text-pond-200/60 mt-1 font-mono">
                            {format(milestoneDate, "d MMM yyyy")}
                            {" · "}
                            {d < 0 ? `${Math.abs(d)}d ago` : d === 0 ? "today" : `in ${d}d`}
                          </p>

                          {completionDate && (
                            <p className="text-[11px] text-pond-200/65 mt-1">
                              Completed on {format(completionDate, "d MMM yyyy")}
                            </p>
                          )}

                          {canConfirmSort && (
                            <div className="pt-2 flex items-center gap-2">
                              {!doneByEvent ? (
                                <button
                                  type="button"
                                  className="btn-secondary !px-2.5 !py-1 text-xs"
                                  disabled={eventBusyKey === key}
                                  onClick={() => markMilestoneDone(batch._id, milestone.week)}
                                >
                                  {eventBusyKey === key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Mark Done"}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn-secondary !px-2.5 !py-1 text-xs text-danger"
                                  disabled={eventBusyKey === key}
                                  onClick={() => undoMilestone(confirmation._id, batch._id, milestone.week)}
                                >
                                  {eventBusyKey === key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Undo"}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(6,75,113,0.15)", border: "1px solid rgba(0,134,204,0.15)" }}>
                <p className="text-xs font-medium text-water-300">Tank Allocation (Live)</p>
                {displayAllocations.length === 0 ? (
                  <p className="text-xs text-pond-200/70">No tank allocations recorded yet. Use Tanks → Move Fish to build batch-linked allocation history.</p>
                ) : (
                  <div className="space-y-2">
                    {activeAllocations.length === 0 && fallbackLiveAllocations.length > 0 && (
                      <p className="text-[11px] text-pond-200/65">Showing inferred live tank counts. Add a fish movement to start explicit batch-linked allocation.</p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {displayAllocations.map((a, idx) => (
                        <div key={`${a.tankId || a.tankName || "tank"}-${idx}`} className="rounded-lg px-3 py-2" style={{ background: "rgba(12, 12, 14,0.5)" }}>
                          <p className="text-pond-200/65">{a.tankName || "Unnamed tank"}</p>
                          <p className="text-pond-200 font-medium mt-0.5">{Number(a.fishCount || 0).toLocaleString()} fish</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
