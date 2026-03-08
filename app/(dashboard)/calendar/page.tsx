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

type Batch = {
  _id: string;
  name: string;
  stockingDate: string;
  status: "active" | "partial" | "harvested";
  currentCount: number;
  tankAllocations?: TankAllocation[];
  harvestDate?: string | null;
};

type TankMovement = {
  _id: string;
  batchId: { _id: string; name?: string } | string;
  date: string;
  reason?: string;
};

type Milestone = {
  week: number;
  label: string;
  desc: string;
  kind: "sort" | "harvest";
  requiredSortCount?: number;
};

const MILESTONES: Milestone[] = [
  { week: 3, label: "Sort 1", desc: "Early check and split obvious shooters.", kind: "sort", requiredSortCount: 1 },
  { week: 8, label: "Sort 2", desc: "Major grading across tanks (large / medium / small).", kind: "sort", requiredSortCount: 2 },
  { week: 14, label: "Sort 3", desc: "Mid-cycle sort and consolidation.", kind: "sort", requiredSortCount: 3 },
  { week: 17, label: "Sort 4", desc: "Pre-harvest selection of market-ready fish.", kind: "sort", requiredSortCount: 4 },
  { week: 18, label: "Harvest", desc: "Target harvest window.", kind: "harvest" },
];

const SORT_REASONS = new Set(["sorting", "grading", "split", "quarantine", "other"]);

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dayDiff(from: Date, to: Date) {
  return Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

export default function CalendarPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [movements, setMovements] = useState<TankMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [batchesRes, movesRes] = await Promise.all([
        fetch("/api/batches"),
        fetch("/api/tanks/movements?limit=500"),
      ]);
      const batchesPayload = await batchesRes.json();
      const movesPayload = await movesRes.json();

      if (!batchesRes.ok) throw new Error(batchesPayload?.error || "Failed to load batches");
      if (!movesRes.ok) throw new Error(movesPayload?.error || "Failed to load tank movements");

      setBatches(batchesPayload || []);
      setMovements(movesPayload || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load calendar data");
    } finally {
      setLoading(false);
    }
  }

  const movementByBatch = useMemo(() => {
    const map: Record<string, TankMovement[]> = {};
    for (const m of movements) {
      const batchId = typeof m.batchId === "string" ? m.batchId : m.batchId?._id || "";
      if (!batchId) continue;
      if (!map[batchId]) map[batchId] = [];
      map[batchId].push(m);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }
    return map;
  }, [movements]);

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
        <p className="text-pond-200/75 text-sm mt-1">Timeline, sorting checkpoints and harvest readiness from live farm records</p>
      </div>

      {error && (
        <div className="rounded-xl px-4 py-3 text-sm text-danger border border-red-400/30 bg-red-500/10 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {batches.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <Calendar className="w-12 h-12 text-pond-500 mx-auto mb-4 opacity-40" />
          <h3 className="font-display text-lg text-pond-200 mb-2">No batches to display</h3>
          <p className="text-pond-200/75 text-sm">Create a batch first to see your production calendar</p>
        </div>
      ) : (
        batches.map((batch) => {
          const stockDate = new Date(batch.stockingDate);
          const rawWeeks = weeksSince(stockDate);
          const weeks = Math.max(0, rawWeeks);
          const { phase } = getBatchPhase(weeks);
          const progress = Math.max(0, Math.min((weeks / 18) * 100, 100));

          const batchMoves = movementByBatch[batch._id] || [];
          const completedSortMoves = batchMoves.filter((m) => SORT_REASONS.has((m.reason || "sorting").toLowerCase()));

          const activeAllocations = (batch.tankAllocations || [])
            .filter((a) => Number(a.fishCount || 0) > 0)
            .sort((a, b) => Number(b.fishCount || 0) - Number(a.fishCount || 0));

          return (
            <div key={batch._id} className="glass-card p-5 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#4b5563,#064b71)" }}>
                  <Fish className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="font-display text-lg text-pond-100">{batch.name}</h2>
                  <p className="text-xs text-pond-200/75">Started {format(stockDate, "d MMM yyyy")} · Currently Week {weeks} · {phase}</p>
                </div>
                <span className="ml-auto badge badge-green">Week {weeks} / 18</span>
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

                    const sortDone = milestone.kind === "sort" && (completedSortMoves.length >= Number(milestone.requiredSortCount || 0));
                    const harvestDone = milestone.kind === "harvest" && batch.status === "harvested";
                    const isDone = sortDone || harvestDone;
                    const isOverdue = !isDone && d < -3;
                    const isDueNow = !isDone && d >= -3 && d <= 3;

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
                            {isDone && <span className="badge badge-green text-xs">Done</span>}
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
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(6,75,113,0.15)", border: "1px solid rgba(0,134,204,0.15)" }}>
                <p className="text-xs font-medium text-water-300">Tank Allocation (Live)</p>
                {activeAllocations.length === 0 ? (
                  <p className="text-xs text-pond-200/70">No tank allocations recorded yet. Use Tanks → Move Fish to build live allocation history.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {activeAllocations.map((a, idx) => (
                      <div key={`${a.tankId || a.tankName || "tank"}-${idx}`} className="rounded-lg px-3 py-2" style={{ background: "rgba(12, 12, 14,0.5)" }}>
                        <p className="text-pond-200/65">{a.tankName || "Unnamed tank"}</p>
                        <p className="text-pond-200 font-medium mt-0.5">{Number(a.fishCount || 0).toLocaleString()} fish</p>
                      </div>
                    ))}
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
