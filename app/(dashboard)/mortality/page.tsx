"use client";
import { useEffect, useMemo, useState } from "react";
import { Skull, Loader2, CheckCircle, Search, X, Pencil, Trash2, AlertTriangle } from "lucide-react";

const CAUSES = ["Unknown", "Poor water quality", "Disease", "Cannibalism", "Handling stress", "Old age / natural"];

type Batch = { _id: string; name: string; tankAllocations?: Array<{ tankId?: string; tankName?: string }> };
type TankOption = { _id: string; name: string };
type MortalityLog = {
  _id: string;
  batchId: { _id: string; name?: string } | string;
  date: string;
  feedSession?: "morning" | "evening";
  tankId?: string;
  tankName?: string;
  mortality: number;
  mortalityCause?: string;
  observations?: string;
  feedGiven?: number;
  feedType?: string;
  ph?: number | null;
  ammonia?: number | null;
  temperature?: number | null;
  waterChanged?: boolean;
  waterChangePct?: number;
};

type FormState = {
  batchId: string;
  tankName: string;
  feedSession: "morning" | "evening";
  feedGiven: string;
  feedType: string;
  mortality: string;
  mortalityCause: string;
  ph: string;
  ammonia: string;
  temperature: string;
  waterChanged: boolean;
  waterChangePct: string;
  observations: string;
};

const initialForm: FormState = {
  batchId: "",
  tankName: "All Tanks",
  feedSession: "morning",
  feedGiven: "",
  feedType: "",
  mortality: "0",
  mortalityCause: "Unknown",
  ph: "",
  ammonia: "",
  temperature: "",
  waterChanged: false,
  waterChangePct: "",
  observations: "",
};

export default function MortalityPage() {
  const [logs, setLogs] = useState<MortalityLog[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [tankOptions, setTankOptions] = useState<TankOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isFreePlan, setIsFreePlan] = useState(false);
  const communitySupportHref = process.env.NEXT_PUBLIC_COMMUNITY_SUPPORT_URL || "";

  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d" | "all">("30d");
  const [batchFilter, setBatchFilter] = useState<string>("all");
  const [causeFilter, setCauseFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [editingLog, setEditingLog] = useState<MortalityLog | null>(null);
  const [editForm, setEditForm] = useState<FormState>(initialForm);
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState("");

  const [deletingLog, setDeletingLog] = useState<MortalityLog | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [logsRes, batchesRes, tanksRes, billingRes] = await Promise.all([
        fetch("/api/logs?limit=5000"),
        fetch("/api/batches"),
        fetch("/api/tanks"),
        fetch("/api/billing/status"),
      ]);
      const logsPayload = await logsRes.json();
      const batchesPayload = await batchesRes.json();
      const tanksPayload = await tanksRes.json();
      const billingPayload = billingRes.ok ? await billingRes.json() : null;

      if (!logsRes.ok) throw new Error(logsPayload?.error || "Failed to load mortality logs");
      if (!batchesRes.ok) throw new Error(batchesPayload?.error || "Failed to load batches");
      if (!tanksRes.ok) throw new Error(tanksPayload?.error || "Failed to load tanks");

      const mortalityOnly = (logsPayload as MortalityLog[]).filter((x) => Number(x.mortality || 0) > 0);
      setLogs(mortalityOnly);
      setBatches(batchesPayload);
      setTankOptions(tanksPayload || []);
      setIsFreePlan((billingPayload?.plan || "free") === "free");
    } catch (err: any) {
      setError(err?.message || "Failed to load mortality data");
    } finally {
      setLoading(false);
    }
  }

  function toPayload(values: FormState, date?: string) {
    return {
      ...values,
      tankId: tankOptions.find((tank) => tank.name === values.tankName)?._id || "",
      feedGiven: parseFloat(values.feedGiven) || 0,
      mortality: parseInt(values.mortality) || 0,
      ph: values.ph === "" ? null : parseFloat(values.ph),
      ammonia: values.ammonia === "" ? null : parseFloat(values.ammonia),
      temperature: values.temperature === "" ? null : parseFloat(values.temperature),
      waterChangePct: parseInt(values.waterChangePct) || 0,
      date,
    };
  }

  function fromLog(log: MortalityLog): FormState {
    return {
      batchId: typeof log.batchId === "string" ? log.batchId : log.batchId?._id || "",
      tankName: log.tankName || "All Tanks",
      feedSession: log.feedSession || "morning",
      feedGiven: log.feedGiven != null ? String(log.feedGiven) : "",
      feedType: log.feedType || "",
      mortality: String(log.mortality || 0),
      mortalityCause: log.mortalityCause || "Unknown",
      ph: log.ph != null ? String(log.ph) : "",
      ammonia: log.ammonia != null ? String(log.ammonia) : "",
      temperature: log.temperature != null ? String(log.temperature) : "",
      waterChanged: Boolean(log.waterChanged),
      waterChangePct: log.waterChangePct != null ? String(log.waterChangePct) : "",
      observations: log.observations || "",
    };
  }

  function startEdit(log: MortalityLog) {
    setEditingLog(log);
    setEditForm(fromLog(log));
    setEditError("");
    setError("");
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingLog) return;

    setEditing(true);
    setEditError("");

    try {
      const res = await fetch(`/api/logs/${editingLog._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(editForm, editingLog.date)),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to update log");

      await loadData();
      setEditingLog(null);
    } catch (err: any) {
      setEditError(err?.message || "Failed to update log");
    } finally {
      setEditing(false);
    }
  }

  async function confirmDelete() {
    if (!deletingLog) return;
    setDeleting(true);
    setDeleteError("");

    try {
      const res = await fetch(`/api/logs/${deletingLog._id}`, { method: "DELETE" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to delete log");

      await loadData();
      setDeletingLog(null);
    } catch (err: any) {
      setDeleteError(err?.message || "Failed to delete log");
    } finally {
      setDeleting(false);
    }
  }

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    let minTime = -Infinity;

    if (dateRange === "7d") minTime = now - 7 * 24 * 60 * 60 * 1000;
    if (dateRange === "30d") minTime = now - 30 * 24 * 60 * 60 * 1000;
    if (dateRange === "90d") minTime = now - 90 * 24 * 60 * 60 * 1000;

    return logs.filter((log) => {
      const logTime = new Date(log.date).getTime();
      if (logTime < minTime) return false;

      const bId = typeof log.batchId === "string" ? log.batchId : log.batchId?._id || "";
      if (batchFilter !== "all" && bId !== batchFilter) return false;

      const cause = (log.mortalityCause || "Unknown").toLowerCase();
      if (causeFilter !== "all" && cause !== causeFilter.toLowerCase()) return false;

      if (!q) return true;
      const batchName = typeof log.batchId === "string" ? "" : (log.batchId?.name || "").toLowerCase();
      const tank = (log.tankName || "").toLowerCase();
      const obs = (log.observations || "").toLowerCase();
      const date = new Date(log.date).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }).toLowerCase();
      return batchName.includes(q) || tank.includes(q) || obs.includes(q) || cause.includes(q) || date.includes(q);
    });
  }, [logs, dateRange, batchFilter, causeFilter, search]);

  const tankNames = useMemo(() => {
    const names = new Set<string>(["All Tanks"]);
    tankOptions.forEach((tank) => {
      if (tank?.name?.trim()) names.add(tank.name.trim());
    });
    logs.forEach((log) => {
      if (log?.tankName?.trim()) names.add(log.tankName.trim());
    });
    return Array.from(names);
  }, [tankOptions, logs]);
  const availableEditTankNames = useMemo(() => {
    const selectedBatch = batches.find((batch) => batch._id === editForm.batchId);
    if (!selectedBatch) return tankNames;
    const names = new Set<string>(["All Tanks"]);
    (selectedBatch.tankAllocations || []).forEach((allocation) => {
      const allocationName = (allocation?.tankName || "").trim();
      if (allocationName) names.add(allocationName);
      const matchedTank = tankOptions.find((tank) => tank._id === allocation?.tankId);
      if (matchedTank?.name?.trim()) names.add(matchedTank.name.trim());
    });
    return Array.from(names);
  }, [batches, editForm.batchId, tankNames, tankOptions]);

  useEffect(() => {
    if (!availableEditTankNames.includes(editForm.tankName)) {
      setEditForm((f) => ({ ...f, tankName: "All Tanks" }));
    }
  }, [availableEditTankNames, editForm.tankName]);

  useEffect(() => {
    setPage(1);
  }, [dateRange, batchFilter, causeFilter, search]);

  useEffect(() => {
    if (isFreePlan && (dateRange === "90d" || dateRange === "all")) {
      setDateRange("30d");
    }
  }, [dateRange, isFreePlan]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const paginatedLogs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, page, pageSize]);

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const totalDeaths = filteredLogs.reduce((s, l) => s + Number(l.mortality || 0), 0);
  const byTank: Record<string, number> = {};
  const byCause: Record<string, number> = {};
  filteredLogs.forEach((l) => {
    const tank = l.tankName || "Unknown";
    const cause = l.mortalityCause || "Unknown";
    byTank[tank] = (byTank[tank] || 0) + Number(l.mortality || 0);
    byCause[cause] = (byCause[cause] || 0) + Number(l.mortality || 0);
  });
  const topTank = Object.entries(byTank).sort((a, b) => b[1] - a[1])[0];
  const topCause = Object.entries(byCause).sort((a, b) => b[1] - a[1])[0];
  const avgDeathsPerIncident = filteredLogs.length > 0 ? totalDeaths / filteredLogs.length : 0;

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
        <h1 className="font-display text-2xl font-semibold text-pond-100">Mortality Log</h1>
        <p className="text-pond-200/75 text-sm mt-1">Review mortality patterns early so you can spot tank issues, likely causes, and rising losses before they spread.</p>
      </div>

      {isFreePlan ? (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <p>Starter Free keeps mortality history to the last 30 days.</p>
          {communitySupportHref ? (
            <a
              href={communitySupportHref}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex text-xs text-amber-200 underline underline-offset-4 hover:text-amber-100"
            >
              Need help? Join Community support
            </a>
          ) : null}
        </div>
      ) : null}

      {error && (
        <div className="rounded-xl px-4 py-3 text-sm text-danger border border-red-400/30 bg-red-500/10 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      <div className="glass-card p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
        <select className="field" aria-label="Filter mortality by date range" value={dateRange} onChange={(e) => setDateRange(e.target.value as any)}>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          {!isFreePlan ? <option value="90d">Last 90 days</option> : null}
          {!isFreePlan ? <option value="all">All time</option> : null}
        </select>
        <select className="field" aria-label="Filter mortality by batch" value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}>
          <option value="all">All batches</option>
          {batches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
        </select>
        <select className="field" aria-label="Filter mortality by cause" value={causeFilter} onChange={(e) => setCauseFilter(e.target.value)}>
          <option value="all">All causes</option>
          {CAUSES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="relative md:col-span-2">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-pond-300" />
          <input className="field pl-9" aria-label="Search mortality records" placeholder="Search cause, tank, note, date" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card">
          <p className="text-xs text-pond-200/75 uppercase tracking-wider mb-2">Total Deaths</p>
          <p className="font-mono text-2xl font-semibold text-danger">{totalDeaths}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-pond-200/75 uppercase tracking-wider mb-2">Incidents</p>
          <p className="font-mono text-2xl font-semibold text-pond-200">{filteredLogs.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-pond-200/75 uppercase tracking-wider mb-2">Worst Tank</p>
          <p className="font-mono text-sm font-semibold text-mud-300">{topTank?.[0] || "—"}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-pond-200/75 uppercase tracking-wider mb-2">Top Cause</p>
          <p className="font-mono text-sm font-semibold text-mud-300 capitalize">{topCause?.[0] || "—"}</p>
        </div>
      </div>

      <div className="glass-card p-5 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="section-title !text-base">Mortality Guide</h2>
          <p className="text-xs text-pond-200/65">Use this page to investigate patterns, not just count losses</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-pond-200/75">
          <div className="rounded-xl border border-pond-700/30 bg-black/15 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-pond-300 mb-1.5">Current Pattern</p>
            <p>{filteredLogs.length > 0 ? `${avgDeathsPerIncident.toFixed(1)} average deaths per incident in the current view.` : "No mortality incidents in the current view."}</p>
          </div>
          <div className="rounded-xl border border-pond-700/30 bg-black/15 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-pond-300 mb-1.5">Highest Risk Area</p>
            <p>{topTank ? `${topTank[0]} has the highest losses in this filter.` : "No tank pattern yet."}</p>
          </div>
          <div className="rounded-xl border border-pond-700/30 bg-black/15 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-pond-300 mb-1.5">Logging Habit</p>
            <p>Record the likely cause and any observations while the issue is fresh so later review stays useful.</p>
          </div>
        </div>
      </div>

      {filteredLogs.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <Skull className="w-12 h-12 text-pond-500 mx-auto mb-4 opacity-30" />
          <h3 className="font-display text-lg text-pond-200 mb-2">No mortality recorded</h3>
          <p className="text-pond-200/75 text-sm">That is a strong sign. Keep water quality, feeding, and sorting routines consistent.</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="px-5 py-4 border-b border-pond-700/20">
            <h2 className="section-title">Mortality Events</h2>
          </div>
          <div className="md:hidden divide-y divide-pond-700/20">
            {paginatedLogs.map((log) => {
              const batchName = typeof log.batchId === "string" ? "—" : log.batchId?.name || "—";
              return (
                <div key={log._id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-pond-200 font-medium">{batchName}</p>
                    <p className="font-mono text-xs text-pond-300">
                      {new Date(log.date).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <p className="text-pond-200/70">Session: <span className="text-pond-200 capitalize">{log.feedSession || "morning"}</span></p>
                    <p className="text-pond-200/70">Tank: <span className="text-pond-200">{log.tankName || "—"}</span></p>
                    <p className="text-pond-200/70">Deaths: <span className="text-danger font-mono">{log.mortality}</span></p>
                    <p className="text-pond-200/70">Cause: <span className="text-mud-300 capitalize">{log.mortalityCause || "Unknown"}</span></p>
                  </div>
                  {log.observations && <p className="text-xs text-pond-200/70">{log.observations}</p>}
                  <div className="flex items-center gap-2 pt-1">
                    <button className="btn-secondary !px-2.5 !py-1.5 text-xs" onClick={() => startEdit(log)}>
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button className="btn-secondary !px-2.5 !py-1.5 text-xs text-danger" onClick={() => setDeletingLog(log)}>
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th><th>Session</th><th>Batch</th><th>Tank</th><th>Deaths</th>
                  <th>Cause</th><th>Notes</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLogs.map((log) => {
                  const batchName = typeof log.batchId === "string" ? "—" : log.batchId?.name || "—";
                  return (
                    <tr key={log._id}>
                      <td className="font-mono text-xs">
                        {new Date(log.date).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="text-xs capitalize">{log.feedSession || "morning"}</td>
                      <td className="text-xs">{batchName}</td>
                      <td className="text-xs">{log.tankName || "—"}</td>
                      <td><span className="badge badge-red font-mono">{log.mortality}</span></td>
                      <td className="text-xs capitalize text-mud-300">{log.mortalityCause || "Unknown"}</td>
                      <td className="text-xs text-pond-200/65 max-w-xs truncate" title={log.observations || ""}>{log.observations || "—"}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button className="btn-secondary !px-2 !py-1 text-xs" onClick={() => startEdit(log)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button className="btn-secondary !px-2 !py-1 text-xs text-danger" onClick={() => setDeletingLog(log)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-pond-700/20 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-pond-200/65">
              Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, filteredLogs.length)} of {filteredLogs.length}
            </p>
            <div className="flex items-center gap-2">
              <select
                className="field !h-8 !py-1 text-xs"
                value={pageSize}
                onChange={(e) => setPageSize(parseInt(e.target.value, 10))}
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
              </select>
              <button className="btn-secondary !px-3 !py-1.5 text-xs" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                Prev
              </button>
              <span className="text-xs text-pond-200/75 font-mono">
                {page}/{totalPages}
              </span>
              <button className="btn-secondary !px-3 !py-1.5 text-xs" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {editingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(12, 12, 14,0.85)", backdropFilter: "blur(8px)" }}>
          <div className="glass-card w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg text-pond-100">Edit Mortality Event</h2>
              <button onClick={() => { setEditingLog(null); setEditError(""); }} className="text-pond-200/75 hover:text-pond-300"><X className="w-5 h-5" /></button>
            </div>
            {editError && (
              <div className="rounded-xl px-4 py-3 text-sm text-danger border border-red-400/30 bg-red-500/10 mb-4">
                {editError}
              </div>
            )}
            <form onSubmit={saveEdit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Batch *</label>
                  <select className="field" required value={editForm.batchId} onChange={(e) => setEditForm((f) => ({ ...f, batchId: e.target.value }))}>
                    <option value="">Select batch…</option>
                    {batches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
                  </select>
                  <p className="text-xs text-pond-200/60 mt-1">Keep the event attached to the correct batch so survival history stays accurate.</p>
                </div>
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Session</label>
                  <select className="field" value={editForm.feedSession} onChange={(e) => setEditForm((f) => ({ ...f, feedSession: e.target.value as "morning" | "evening" }))}>
                    <option value="morning">Morning</option>
                    <option value="evening">Evening</option>
                  </select>
                  <p className="text-xs text-pond-200/60 mt-1">Use the session that best matches when the deaths were observed or confirmed.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Tank</label>
                  <select className="field" value={editForm.tankName} onChange={(e) => setEditForm((f) => ({ ...f, tankName: e.target.value }))}>
                    {availableEditTankNames.map((t) => <option key={t}>{t}</option>)}
                  </select>
                  <p className="text-xs text-pond-200/60 mt-1">Use All Tanks only when the losses cannot be tied to one tank confidently.</p>
                </div>
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Deaths</label>
                  <input className="field" type="number" min={0} placeholder="12" value={editForm.mortality} onChange={(e) => setEditForm((f) => ({ ...f, mortality: e.target.value }))} />
                  <p className="text-xs text-pond-200/60 mt-1">This value affects live batch totals, so use the confirmed death count.</p>
                </div>
              </div>

              <div>
                <label className="block text-xs text-pond-300 mb-1.5 font-medium">Cause</label>
                <select className="field" value={editForm.mortalityCause} onChange={(e) => setEditForm((f) => ({ ...f, mortalityCause: e.target.value }))}>
                  {CAUSES.map((c) => <option key={c}>{c}</option>)}
                </select>
                <p className="text-xs text-pond-200/60 mt-1">Pick the most likely cause now, even if you plan to investigate further later.</p>
              </div>

              <div>
                <label className="block text-xs text-pond-300 mb-1.5 font-medium">Observations</label>
                <textarea className="field resize-none" rows={2} placeholder="Found floating fish near outlet pipe" value={editForm.observations} onChange={(e) => setEditForm((f) => ({ ...f, observations: e.target.value }))} />
                <p className="text-xs text-pond-200/60 mt-1">Short notes like smell, behavior, weather, or water color make later diagnosis much easier.</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setEditingLog(null); setEditError(""); }} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={editing} className="btn-primary flex-1">
                  {editing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  {editing ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(12, 12, 14,0.85)", backdropFilter: "blur(8px)" }}>
          <div className="glass-card w-full max-w-md max-h-[85vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg text-pond-100">Delete Mortality Event</h2>
              <button onClick={() => { setDeletingLog(null); setDeleteError(""); }} className="text-pond-200/75 hover:text-pond-300"><X className="w-5 h-5" /></button>
            </div>
            {deleteError && (
              <div className="rounded-xl px-4 py-3 text-sm text-danger border border-red-400/30 bg-red-500/10">
                {deleteError}
              </div>
            )}
            <p className="text-sm text-pond-200/75">Delete this event? Batch fish count will be reconciled automatically.</p>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => { setDeletingLog(null); setDeleteError(""); }} className="btn-secondary flex-1">Cancel</button>
              <button type="button" onClick={confirmDelete} disabled={deleting} className="btn-primary flex-1 bg-red-700 hover:bg-red-600">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
