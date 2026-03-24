"use client";
import { useEffect, useMemo, useState } from "react";
import { Plus, Loader2, Fish, Droplets, Skull, ThermometerSun, CheckCircle, Search, X, Pencil, Trash2 } from "lucide-react";
import { formatFeedLabel, getFeedIdentity } from "@/lib/feed-inventory";

const CAUSES = ["Unknown", "Poor water quality", "Disease", "Cannibalism", "Handling stress", "Old age / natural"];

type Batch = { _id: string; name: string; tankAllocations?: Array<{ tankId?: string; tankName?: string }> };
type TankOption = { _id: string; name: string };
type LogEntry = {
  _id: string;
  batchId: { _id: string; name?: string } | string;
  date: string;
  feedSession?: "morning" | "evening";
  tankId?: string;
  tankName?: string;
  feedGiven?: number;
  feedType?: string;
  feedBrand?: string;
  feedSizeMm?: number | null;
  mortality?: number;
  mortalityCause?: string;
  ph?: number | null;
  ammonia?: number | null;
  temperature?: number | null;
  waterChanged?: boolean;
  waterChangePct?: number;
  observations?: string;
};

type FormState = {
  batchId: string;
  tankName: string;
  feedSession: "morning" | "evening";
  feedGiven: string;
  feedType: string;
  feedBrand: string;
  feedSizeMm: string;
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
  feedType: "Aller Aqua 2mm",
  feedBrand: "Aller Aqua",
  feedSizeMm: "2",
  mortality: "",
  mortalityCause: "Unknown",
  ph: "",
  ammonia: "",
  temperature: "",
  waterChanged: false,
  waterChangePct: "",
  observations: "",
};

type FeedProductOption = {
  key: string;
  label: string;
  brand: string;
  pelletSizeMm: number | null;
};

function getFeedProductKey(values: { feedBrand: string; feedSizeMm: string }, products: FeedProductOption[]) {
  const identity = getFeedIdentity({
    brand: values.feedBrand,
    pelletSizeMm: values.feedSizeMm,
  });
  const match = products.find(
    (product) => product.brand === identity.brand && (product.pelletSizeMm ?? null) === identity.pelletSizeMm
  );
  return match?.key || "";
}

export default function FeedingPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [tankOptions, setTankOptions] = useState<TankOption[]>([]);
  const [feedProducts, setFeedProducts] = useState<FeedProductOption[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [entryError, setEntryError] = useState("");
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [isFreePlan, setIsFreePlan] = useState(false);
  const communitySupportHref = process.env.NEXT_PUBLIC_COMMUNITY_SUPPORT_URL || "";

  const [form, setForm] = useState<FormState>(initialForm);
  const [editingLog, setEditingLog] = useState<LogEntry | null>(null);
  const [editForm, setEditForm] = useState<FormState>(initialForm);
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState("");
  const [deletingLog, setDeletingLog] = useState<LogEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [batchFilter, setBatchFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [createCustomFeed, setCreateCustomFeed] = useState(false);
  const [editCustomFeed, setEditCustomFeed] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [batchesRes, logsRes, tanksRes, billingRes, feedInventoryRes] = await Promise.all([
        fetch("/api/batches"),
        fetch("/api/logs?limit=5000"),
        fetch("/api/tanks"),
        fetch("/api/billing/status"),
        fetch("/api/feed-inventory"),
      ]);
      const batchesPayload = await batchesRes.json();
      const logsPayload = await logsRes.json();
      const tanksPayload = await tanksRes.json();
      const billingPayload = billingRes.ok ? await billingRes.json() : null;
      const feedInventoryPayload = feedInventoryRes.ok ? await feedInventoryRes.json() : null;

      if (!batchesRes.ok) throw new Error(batchesPayload?.error || "Failed to load batches");
      if (!logsRes.ok) throw new Error(logsPayload?.error || "Failed to load logs");
      if (!tanksRes.ok) throw new Error(tanksPayload?.error || "Failed to load tanks");

      setBatches(batchesPayload);
      setLogs(logsPayload);
      setTankOptions(tanksPayload || []);
      setIsFreePlan((billingPayload?.plan || "free") === "free");
      setFeedProducts(feedInventoryPayload?.products || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load daily logs");
    } finally {
      setLoading(false);
    }
  }

  const update = (k: keyof FormState, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const updateEdit = (k: keyof FormState, v: any) => setEditForm((f) => ({ ...f, [k]: v }));
  const applyFeedProduct = (productKey: string, target: "create" | "edit") => {
    const product = feedProducts.find((item) => item.key === productKey);
    if (!product) return;
    const next = {
      feedBrand: product.brand,
      feedSizeMm: product.pelletSizeMm != null ? String(product.pelletSizeMm) : "",
      feedType: formatFeedLabel(product.brand, product.pelletSizeMm),
    };
    if (target === "create") {
      setCreateCustomFeed(false);
      setForm((f) => ({ ...f, ...next }));
      return;
    }
    setEditCustomFeed(false);
    setEditForm((f) => ({ ...f, ...next }));
  };

  function toPayload(values: FormState, date?: string) {
    const feedIdentity = getFeedIdentity({
      brand: values.feedBrand,
      pelletSizeMm: values.feedSizeMm,
      feedType: values.feedType,
    });
    return {
      ...values,
      tankId: tankOptions.find((tank) => tank.name === values.tankName)?._id || "",
      feedType: formatFeedLabel(feedIdentity.brand, feedIdentity.pelletSizeMm),
      feedBrand: feedIdentity.brand,
      feedSizeMm: feedIdentity.pelletSizeMm,
      feedGiven: parseFloat(values.feedGiven) || 0,
      mortality: parseInt(values.mortality) || 0,
      feedSession: values.feedSession,
      ph: values.ph === "" ? null : parseFloat(values.ph),
      ammonia: values.ammonia === "" ? null : parseFloat(values.ammonia),
      temperature: values.temperature === "" ? null : parseFloat(values.temperature),
      waterChangePct: parseInt(values.waterChangePct) || 0,
      date: date || new Date().toISOString(),
    };
  }

  function fromLog(log: LogEntry): FormState {
    const batchId = typeof log.batchId === "string" ? log.batchId : log.batchId?._id || "";
    const feedIdentity = getFeedIdentity({
      brand: log.feedBrand,
      pelletSizeMm: log.feedSizeMm,
      feedType: log.feedType,
    });
    return {
      batchId,
      tankName: log.tankName || "All Tanks",
      feedSession: log.feedSession || "morning",
      feedGiven: log.feedGiven != null ? String(log.feedGiven) : "",
      feedType: formatFeedLabel(feedIdentity.brand, feedIdentity.pelletSizeMm),
      feedBrand: feedIdentity.brand,
      feedSizeMm: feedIdentity.pelletSizeMm != null ? String(feedIdentity.pelletSizeMm) : "",
      mortality: log.mortality != null ? String(log.mortality) : "",
      mortalityCause: log.mortalityCause || "Unknown",
      ph: log.ph != null ? String(log.ph) : "",
      ammonia: log.ammonia != null ? String(log.ammonia) : "",
      temperature: log.temperature != null ? String(log.temperature) : "",
      waterChanged: Boolean(log.waterChanged),
      waterChangePct: log.waterChangePct != null ? String(log.waterChangePct) : "",
      observations: log.observations || "",
    };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setEntryError("");
    setSuccess(false);

    try {
      const res = await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(form)),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to save log entry");

      await loadData();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      setShowEntryForm(false);
      setCreateCustomFeed(false);
      setForm((f) => ({ ...f, feedGiven: "", mortality: "", ph: "", ammonia: "", temperature: "", observations: "", waterChangePct: "" }));
    } catch (err: any) {
      setEntryError(err?.message || "Failed to save log entry");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(log: LogEntry) {
    setEditingLog(log);
    setEditForm(fromLog(log));
    setEditCustomFeed(false);
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

  const visibleLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((log) => {
      const logBatchId = typeof log.batchId === "string" ? log.batchId : log.batchId?._id || "";
      if (batchFilter !== "all" && logBatchId !== batchFilter) return false;

      if (!q) return true;
      const batchName = typeof log.batchId === "string" ? "" : (log.batchId?.name || "").toLowerCase();
      const tank = (log.tankName || "").toLowerCase();
      const obs = (log.observations || "").toLowerCase();
      const date = new Date(log.date).toLocaleDateString("en-NG", { day: "numeric", month: "short" }).toLowerCase();
      return batchName.includes(q) || tank.includes(q) || obs.includes(q) || date.includes(q);
    });
  }, [logs, batchFilter, search]);

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
  const availableTankNames = useMemo(() => {
    const selectedBatch = batches.find((batch) => batch._id === form.batchId);
    if (!selectedBatch) return tankNames;
    const names = new Set<string>(["All Tanks"]);
    (selectedBatch.tankAllocations || []).forEach((allocation) => {
      const allocationName = (allocation?.tankName || "").trim();
      if (allocationName) names.add(allocationName);
      const matchedTank = tankOptions.find((tank) => tank._id === allocation?.tankId);
      if (matchedTank?.name?.trim()) names.add(matchedTank.name.trim());
    });
    return Array.from(names);
  }, [batches, form.batchId, tankNames, tankOptions]);
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
    if (!availableTankNames.includes(form.tankName)) {
      setForm((f) => ({ ...f, tankName: "All Tanks" }));
    }
  }, [availableTankNames, form.tankName]);

  useEffect(() => {
    if (!availableEditTankNames.includes(editForm.tankName)) {
      setEditForm((f) => ({ ...f, tankName: "All Tanks" }));
    }
  }, [availableEditTankNames, editForm.tankName]);

  useEffect(() => {
    setPage(1);
  }, [batchFilter, search]);

  const totalPages = Math.max(1, Math.ceil(visibleLogs.length / pageSize));
  const selectedCreateFeedKey = getFeedProductKey(form, feedProducts);
  const selectedEditFeedKey = getFeedProductKey(editForm, feedProducts);
  const paginatedLogs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return visibleLogs.slice(start, start + pageSize);
  }, [visibleLogs, page, pageSize]);

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-pond-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-semibold text-pond-100">Daily Log</h1>
          <p className="text-pond-200/75 text-sm mt-1">Record today&apos;s feeding, water quality and any mortality</p>
        </div>
        <button onClick={() => { setEntryError(""); setShowEntryForm(true); }} className="btn-primary">
          <Plus className="w-4 h-4" /> Today&apos;s Entry
        </button>
      </div>

      {isFreePlan ? (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <p>Starter Free includes Daily Logs with a 30-day history window.</p>
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
        <div className="rounded-xl px-4 py-3 text-sm text-danger border border-red-400/30 bg-red-500/10">{error}</div>
      )}

      <div className="space-y-3">
          <div className="glass-card p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <select className="field" value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}>
              <option value="all">All batches</option>
              {batches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
            <div className="relative md:col-span-2">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-pond-300" />
              <input className="field pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tank, note, or date" />
            </div>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="px-5 py-4 border-b border-pond-700/20">
              <h2 className="section-title">Recent Entries</h2>
            </div>
            {visibleLogs.length === 0 ? (
              <div className="p-12 text-center">
                <Fish className="w-10 h-10 text-pond-500 mx-auto mb-3 opacity-40" />
                <p className="text-pond-200/65 text-sm">No entries found with current filter</p>
              </div>
            ) : (
              <>
                <div className="md:hidden divide-y divide-pond-700/20">
                  {paginatedLogs.map((log) => {
                    const batchName = typeof log.batchId === "string" ? "—" : log.batchId?.name || "—";
                    return (
                      <div key={log._id} className="p-4 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm text-pond-200 font-medium">{batchName}</p>
                          <p className="font-mono text-xs text-pond-300">
                            {new Date(log.date).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <p className="text-pond-200/70">Session: <span className="text-pond-200 capitalize">{log.feedSession || "morning"}</span></p>
                          <p className="text-pond-200/70">Tank: <span className="text-pond-200">{log.tankName || "—"}</span></p>
                          <p className="text-pond-200/70">Feed: <span className="font-mono text-pond-200">{log.feedGiven || "—"} kg</span></p>
                          <p className="text-pond-200/70">Deaths: {log.mortality && log.mortality > 0 ? <span className="text-danger font-mono">{log.mortality}</span> : <span className="text-pond-500">—</span>}</p>
                          <p className="text-pond-200/70">pH: {log.ph != null ? <span className={`font-mono ${log.ph >= 6.5 && log.ph <= 8 ? "text-success" : "text-danger"}`}>{log.ph}</span> : <span className="text-pond-500">—</span>}</p>
                          <p className="text-pond-200/70">NH3: {log.ammonia != null ? <span className={`font-mono ${(log.ammonia || 0) < 0.5 ? "text-success" : "text-danger"}`}>{log.ammonia}</span> : <span className="text-pond-500">—</span>}</p>
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
                        <th>Date</th><th>Session</th><th>Batch</th><th>Tank</th><th>Feed (kg)</th>
                        <th>Deaths</th><th>pH</th><th>Ammonia</th><th>Temp</th><th>Observations</th><th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedLogs.map((log) => {
                        const batchName = typeof log.batchId === "string" ? "—" : log.batchId?.name || "—";
                        return (
                          <tr key={log._id}>
                            <td className="font-mono text-xs text-pond-300">
                              {new Date(log.date).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
                            </td>
                            <td className="text-xs capitalize">{log.feedSession || "morning"}</td>
                            <td className="text-xs">{batchName}</td>
                            <td className="text-xs">{log.tankName || "—"}</td>
                            <td className="font-mono text-pond-200">{log.feedGiven || "—"}</td>
                            <td>
                              {log.mortality && log.mortality > 0 ? <span className="badge badge-red">{log.mortality}</span> : <span className="text-pond-500">—</span>}
                            </td>
                            <td className="font-mono text-xs">
                              {log.ph != null ? <span className={log.ph >= 6.5 && log.ph <= 8 ? "text-success" : "text-danger"}>{log.ph}</span> : "—"}
                            </td>
                            <td className="font-mono text-xs">
                              {log.ammonia != null ? <span className={(log.ammonia || 0) < 0.5 ? "text-success" : "text-danger"}>{log.ammonia}</span> : "—"}
                            </td>
                            <td className="font-mono text-xs">{log.temperature != null ? `${log.temperature}°` : "—"}</td>
                            <td className="text-xs text-pond-200/65 max-w-[180px] truncate" title={log.observations || ""}>
                              {log.observations || "—"}
                            </td>
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
              </>
            )}
            {visibleLogs.length > 0 && (
              <div className="px-5 py-3 border-t border-pond-700/20 flex items-center justify-between gap-3 flex-wrap">
                <p className="text-xs text-pond-200/65">
                  Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, visibleLogs.length)} of {visibleLogs.length}
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
            )}
          </div>
      </div>

      {showEntryForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(12, 12, 14,0.85)", backdropFilter: "blur(8px)" }}>
          <div className="glass-card w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg text-pond-100">Today&apos;s Entry</h2>
              <button onClick={() => { setShowEntryForm(false); setEntryError(""); }} className="text-pond-200/75 hover:text-pond-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            {entryError && (
              <div className="rounded-xl px-4 py-3 text-sm text-danger border border-red-400/30 bg-red-500/10 mb-4">
                {entryError}
              </div>
            )}
            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Batch *</label>
                  <select className="field" required value={form.batchId} onChange={(e) => update("batchId", e.target.value)}>
                    <option value="">Select batch…</option>
                    {batches.map((b) => (
                      <option key={b._id} value={b._id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Tank</label>
                  <select className="field" value={form.tankName} onChange={(e) => update("tankName", e.target.value)}>
                    {availableTankNames.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-pond-300 mb-1.5 font-medium">Session</label>
                <select className="field" value={form.feedSession} onChange={(e) => update("feedSession", e.target.value as "morning" | "evening")}>
                  <option value="morning">Morning</option>
                  <option value="evening">Evening</option>
                </select>
              </div>

              <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(12, 12, 14,0.5)", border: "1px solid rgba(148, 163, 184,0.12)" }}>
                <p className="text-xs font-medium text-pond-300 flex items-center gap-1.5">
                  <Droplets className="w-3.5 h-3.5" /> Feeding
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs text-pond-200/75 mb-1">Feed Given (kg)</label>
                    <input className="field" type="number" step="0.1" placeholder="0.0" value={form.feedGiven} onChange={(e) => update("feedGiven", e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs text-pond-200/75 mb-1">Inventory Product</label>
                    <select
                      className="field"
                      value={createCustomFeed ? "__custom__" : selectedCreateFeedKey}
                      onChange={(e) => {
                        if (e.target.value === "__custom__") {
                          setCreateCustomFeed(true);
                          return;
                        }
                        applyFeedProduct(e.target.value, "create");
                      }}
                    >
                      <option value="">Pick from inventory…</option>
                      {feedProducts.map((product) => <option key={product.key} value={product.key}>{product.label}</option>)}
                      <option value="__custom__">Custom feed</option>
                    </select>
                  </div>
                  {createCustomFeed && (
                    <>
                      <div>
                        <label className="block text-xs text-pond-200/75 mb-1">Brand</label>
                        <input className="field" placeholder="Aller Aqua" value={form.feedBrand} onChange={(e) => update("feedBrand", e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs text-pond-200/75 mb-1">Pellet Size (mm)</label>
                        <input className="field" type="number" min="0.1" step="0.1" placeholder="2" value={form.feedSizeMm} onChange={(e) => update("feedSizeMm", e.target.value)} />
                      </div>
                    </>
                  )}
                </div>
                {!createCustomFeed && selectedCreateFeedKey ? (
                  <p className="text-xs text-pond-200/65">
                    Using inventory product <span className="text-pond-100 font-medium">{form.feedType}</span>.
                  </p>
                ) : null}
              </div>

              <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(6,75,113,0.2)", border: "1px solid rgba(0,134,204,0.15)" }}>
                <p className="text-xs font-medium text-water-300 flex items-center gap-1.5">
                  <ThermometerSun className="w-3.5 h-3.5" /> Water Quality
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs text-pond-200/75 mb-1">pH</label>
                    <input className="field" type="number" step="0.1" placeholder="7.2" value={form.ph} onChange={(e) => update("ph", e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs text-pond-200/75 mb-1">Ammonia</label>
                    <input className="field" type="number" step="0.01" placeholder="0.0" value={form.ammonia} onChange={(e) => update("ammonia", e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs text-pond-200/75 mb-1">Temp °C</label>
                    <input className="field" type="number" step="0.5" placeholder="28" value={form.temperature} onChange={(e) => update("temperature", e.target.value)} />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-pond-300 cursor-pointer">
                    <input type="checkbox" checked={form.waterChanged} onChange={(e) => update("waterChanged", e.target.checked)} className="rounded" /> Water changed?
                  </label>
                  {form.waterChanged && (
                    <input className="field w-24" type="number" placeholder="% changed" value={form.waterChangePct} onChange={(e) => update("waterChangePct", e.target.value)} />
                  )}
                </div>
              </div>

              <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(220,53,69,0.08)", border: "1px solid rgba(220,53,69,0.15)" }}>
                <p className="text-xs font-medium text-red-300 flex items-center gap-1.5">
                  <Skull className="w-3.5 h-3.5" /> Mortality
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-pond-200/75 mb-1">Deaths today</label>
                    <input className="field" type="number" min="0" placeholder="0" value={form.mortality} onChange={(e) => update("mortality", e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs text-pond-200/75 mb-1">Cause</label>
                    <select className="field" value={form.mortalityCause} onChange={(e) => update("mortalityCause", e.target.value)}>
                      {CAUSES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs text-pond-300 mb-1.5 font-medium">Observations</label>
                <textarea className="field resize-none" rows={3} placeholder="Any notes about fish behaviour, water colour, feeding response…" value={form.observations} onChange={(e) => update("observations", e.target.value)} />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowEntryForm(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : success ? <CheckCircle className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  {saving ? "Saving…" : success ? "Saved!" : "Save Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(12, 12, 14,0.85)", backdropFilter: "blur(8px)" }}>
          <div className="glass-card w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg text-pond-100">Edit Daily Log</h2>
              <button
                onClick={() => {
                  setEditError("");
                  setEditingLog(null);
                }}
                className="text-pond-200/75 hover:text-pond-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={saveEdit} className="space-y-4">
              {editError ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {editError}
                </div>
              ) : null}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Batch *</label>
                  <select className="field" required value={editForm.batchId} onChange={(e) => updateEdit("batchId", e.target.value)}>
                    <option value="">Select batch…</option>
                    {batches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Tank</label>
                  <select className="field" value={editForm.tankName} onChange={(e) => updateEdit("tankName", e.target.value)}>
                    {availableEditTankNames.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-pond-300 mb-1.5 font-medium">Session</label>
                <select className="field" value={editForm.feedSession} onChange={(e) => updateEdit("feedSession", e.target.value as "morning" | "evening")}>
                  <option value="morning">Morning</option>
                  <option value="evening">Evening</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Feed (kg)</label>
                  <input className="field" type="number" step="0.1" value={editForm.feedGiven} onChange={(e) => updateEdit("feedGiven", e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Inventory Product</label>
                  <select
                    className="field"
                    value={editCustomFeed ? "__custom__" : selectedEditFeedKey}
                    onChange={(e) => {
                      if (e.target.value === "__custom__") {
                        setEditCustomFeed(true);
                        return;
                      }
                      applyFeedProduct(e.target.value, "edit");
                    }}
                  >
                    <option value="">Pick from inventory…</option>
                    {feedProducts.map((product) => <option key={product.key} value={product.key}>{product.label}</option>)}
                    <option value="__custom__">Custom feed</option>
                  </select>
                </div>
                {editCustomFeed && (
                  <>
                    <div>
                      <label className="block text-xs text-pond-300 mb-1.5 font-medium">Brand</label>
                      <input className="field" value={editForm.feedBrand} onChange={(e) => updateEdit("feedBrand", e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs text-pond-300 mb-1.5 font-medium">Pellet Size (mm)</label>
                      <input className="field" type="number" min={0.1} step="0.1" value={editForm.feedSizeMm} onChange={(e) => updateEdit("feedSizeMm", e.target.value)} />
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Deaths</label>
                  <input className="field" type="number" min={0} value={editForm.mortality} onChange={(e) => updateEdit("mortality", e.target.value)} />
                </div>
                <div className="lg:col-span-2">
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Mortality cause</label>
                  <select className="field" value={editForm.mortalityCause} onChange={(e) => updateEdit("mortalityCause", e.target.value)}>
                    {CAUSES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              {!editCustomFeed && selectedEditFeedKey ? (
                <p className="text-xs text-pond-200/65">
                  Using inventory product <span className="text-pond-100 font-medium">{editForm.feedType}</span>.
                </p>
              ) : null}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">pH</label>
                  <input className="field" type="number" step="0.1" value={editForm.ph} onChange={(e) => updateEdit("ph", e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Ammonia</label>
                  <input className="field" type="number" step="0.01" value={editForm.ammonia} onChange={(e) => updateEdit("ammonia", e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Temp °C</label>
                  <input className="field" type="number" step="0.5" value={editForm.temperature} onChange={(e) => updateEdit("temperature", e.target.value)} />
                </div>
              </div>

              <div>
                <label className="block text-xs text-pond-300 mb-1.5 font-medium">Observations</label>
                <textarea className="field resize-none" rows={2} value={editForm.observations} onChange={(e) => updateEdit("observations", e.target.value)} />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditError("");
                    setEditingLog(null);
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
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
              <h2 className="font-display text-lg text-pond-100">Delete Log Entry</h2>
              <button
                onClick={() => {
                  setDeleteError("");
                  setDeletingLog(null);
                }}
                className="text-pond-200/75 hover:text-pond-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {deleteError ? (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {deleteError}
              </div>
            ) : null}
            <p className="text-sm text-pond-200/75">Delete this entry? Batch fish count will be reconciled automatically.</p>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  setDeleteError("");
                  setDeletingLog(null);
                }}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
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
