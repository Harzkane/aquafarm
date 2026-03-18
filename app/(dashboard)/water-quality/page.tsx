"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Loader2, TestTube2, CheckCircle2, Search, X, CalendarDays } from "lucide-react";

type Batch = { _id: string; name: string };
type TankOption = { _id: string; name: string };
type WaterLog = {
  _id: string;
  date: string;
  batchId: string | { _id: string; name: string };
  tankName?: string;
  feedSession?: "morning" | "evening";
  ph?: number | null;
  ammonia?: number | null;
  temperature?: number | null;
  dissolvedO2?: number | null;
  waterChanged?: boolean;
  waterChangePct?: number;
  observations?: string;
};

function inRangePh(ph?: number | null) {
  if (ph === null || ph === undefined) return true;
  return ph >= 6.5 && ph <= 8;
}

function inRangeAmmonia(n?: number | null) {
  if (n === null || n === undefined) return true;
  return n < 0.5;
}

function inRangeTemp(t?: number | null) {
  if (t === null || t === undefined) return true;
  return t >= 26 && t <= 30;
}

export default function WaterQualityPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [logs, setLogs] = useState<WaterLog[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [tankOptions, setTankOptions] = useState<TankOption[]>([]);
  const [isFreePlan, setIsFreePlan] = useState(false);
  const communitySupportHref = process.env.NEXT_PUBLIC_COMMUNITY_SUPPORT_URL || "";

  const [batchFilter, setBatchFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    batchId: "",
    date: new Date().toISOString().split("T")[0],
    feedSession: "morning" as "morning" | "evening",
    tankName: "All Tanks",
    ph: "",
    ammonia: "",
    temperature: "",
    dissolvedO2: "",
    waterChanged: false,
    waterChangePct: "",
    observations: "",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [logsRes, batchRes, tanksRes, billingRes] = await Promise.all([
        fetch("/api/water-quality?limit=5000"),
        fetch("/api/batches"),
        fetch("/api/tanks"),
        fetch("/api/billing/status"),
      ]);
      const logsPayload = await logsRes.json();
      const batchesPayload = await batchRes.json();
      const tanksPayload = await tanksRes.json();
      const billingPayload = billingRes.ok ? await billingRes.json() : null;
      if (!logsRes.ok) throw new Error(logsPayload?.error || "Failed to load water logs");
      if (!batchRes.ok) throw new Error(batchesPayload?.error || "Failed to load batches");
      if (!tanksRes.ok) throw new Error(tanksPayload?.error || "Failed to load tanks");
      setLogs(Array.isArray(logsPayload) ? logsPayload : []);
      setBatches(Array.isArray(batchesPayload) ? batchesPayload : []);
      setTankOptions(Array.isArray(tanksPayload) ? tanksPayload : []);
      setIsFreePlan((billingPayload?.plan || "free") === "free");
      if (!form.batchId && batchesPayload?.[0]?._id) {
        setForm((f) => ({ ...f, batchId: batchesPayload[0]._id }));
      }
    } catch (err: any) {
      setError(err?.message || "Unable to load water quality data");
    } finally {
      setLoading(false);
    }
  }, [form.batchId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((log) => {
      const batchId = typeof log.batchId === "string" ? log.batchId : log.batchId?._id;
      const batchName = typeof log.batchId === "string" ? "Unknown" : log.batchId?.name || "Unknown";
      if (batchFilter !== "all" && batchId !== batchFilter) return false;
      if (!q) return true;
      const text = `${batchName} ${log.tankName || ""} ${log.feedSession || ""} ${log.observations || ""}`.toLowerCase();
      return text.includes(q);
    });
  }, [logs, batchFilter, search]);

  const stats = useMemo(() => {
    if (!filteredLogs.length) return { avgPh: 0, avgAmmo: 0, avgTemp: 0, riskCount: 0 };
    const values = filteredLogs.reduce(
      (acc, log) => {
        if (log.ph !== null && log.ph !== undefined) {
          acc.phTotal += Number(log.ph);
          acc.phCount += 1;
        }
        if (log.ammonia !== null && log.ammonia !== undefined) {
          acc.ammoTotal += Number(log.ammonia);
          acc.ammoCount += 1;
        }
        if (log.temperature !== null && log.temperature !== undefined) {
          acc.tempTotal += Number(log.temperature);
          acc.tempCount += 1;
        }
        if (!inRangePh(log.ph) || !inRangeAmmonia(log.ammonia) || !inRangeTemp(log.temperature)) {
          acc.riskCount += 1;
        }
        return acc;
      },
      { phTotal: 0, phCount: 0, ammoTotal: 0, ammoCount: 0, tempTotal: 0, tempCount: 0, riskCount: 0 }
    );

    return {
      avgPh: values.phCount ? values.phTotal / values.phCount : 0,
      avgAmmo: values.ammoCount ? values.ammoTotal / values.ammoCount : 0,
      avgTemp: values.tempCount ? values.tempTotal / values.tempCount : 0,
      riskCount: values.riskCount,
    };
  }, [filteredLogs]);

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const payload: any = {
        ...form,
        ph: form.ph === "" ? undefined : Number(form.ph),
        ammonia: form.ammonia === "" ? undefined : Number(form.ammonia),
        temperature: form.temperature === "" ? undefined : Number(form.temperature),
        dissolvedO2: form.dissolvedO2 === "" ? undefined : Number(form.dissolvedO2),
        waterChangePct: form.waterChanged ? Number(form.waterChangePct || 0) : 0,
      };
      const res = await fetch("/api/water-quality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save reading");
      setShowForm(false);
      setForm((f) => ({ ...f, ph: "", ammonia: "", temperature: "", dissolvedO2: "", observations: "" }));
      await loadData();
    } catch (err: any) {
      setFormError(err?.message || "Failed to save reading");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-pond-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-semibold text-pond-100">Water Quality</h1>
          <p className="text-pond-200/75 text-sm mt-1">Dedicated pH/ammonia/temperature/DO monitoring by batch</p>
        </div>
        <button className="btn-primary" onClick={() => { setFormError(""); setShowForm(true); }}>
          <Plus className="w-4 h-4" /> Add Reading
        </button>
      </div>

      {isFreePlan ? (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <p>Starter Free keeps water-quality history to the last 30 days.</p>
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

      {error && <div className="rounded-xl px-4 py-3 text-sm text-danger border border-red-400/30 bg-red-500/10">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card">
          <p className="text-xs text-pond-200/75 uppercase tracking-wider mb-2">Avg pH</p>
          <p className={`font-mono text-2xl font-semibold ${inRangePh(stats.avgPh) ? "text-success" : "text-danger"}`}>
            {stats.avgPh ? stats.avgPh.toFixed(2) : "—"}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-pond-200/75 uppercase tracking-wider mb-2">Avg Ammonia</p>
          <p className={`font-mono text-2xl font-semibold ${inRangeAmmonia(stats.avgAmmo) ? "text-success" : "text-danger"}`}>
            {stats.avgAmmo ? stats.avgAmmo.toFixed(2) : "—"}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-pond-200/75 uppercase tracking-wider mb-2">Avg Temp</p>
          <p className={`font-mono text-2xl font-semibold ${inRangeTemp(stats.avgTemp) ? "text-success" : "text-danger"}`}>
            {stats.avgTemp ? `${stats.avgTemp.toFixed(1)}°C` : "—"}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-pond-200/75 uppercase tracking-wider mb-2">Risk Logs</p>
          <p className={`font-mono text-2xl font-semibold ${stats.riskCount > 0 ? "text-danger" : "text-success"}`}>
            {stats.riskCount}
          </p>
        </div>
      </div>

      <div className="glass-card p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <select className="field" value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}>
          <option value="all">All batches</option>
          {batches.map((b) => (
            <option key={b._id} value={b._id}>
              {b.name}
            </option>
          ))}
        </select>
        <div className="relative md:col-span-2">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-pond-300" />
          <input className="field pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tank, session, notes" />
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 border-b border-pond-700/20 flex items-center justify-between gap-2">
          <h2 className="section-title">Recent Water Readings</h2>
          <p className="text-xs text-pond-200/65">{filteredLogs.length} records</p>
        </div>
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center">
            <TestTube2 className="w-10 h-10 text-pond-500 mx-auto mb-3 opacity-40" />
            <p className="text-pond-200/65 text-sm">No water logs for current filter</p>
          </div>
        ) : (
          <>
            <div className="md:hidden divide-y divide-pond-700/20">
              {filteredLogs.map((log) => {
                const batchName = typeof log.batchId === "string" ? "Unknown" : log.batchId?.name || "Unknown";
                const risk = !inRangePh(log.ph) || !inRangeAmmonia(log.ammonia) || !inRangeTemp(log.temperature);
                return (
                  <div key={log._id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-pond-200 font-medium">{batchName}</p>
                      <span className={`badge ${risk ? "badge-red" : "badge-green"}`}>{risk ? "Risk" : "OK"}</span>
                    </div>
                    <p className="text-xs text-pond-200/65">
                      {new Date(log.date).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })} ·{" "}
                      {(log.feedSession || "morning").toUpperCase()} · {log.tankName || "All Tanks"}
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <p className="text-pond-200/70">pH: <span className={inRangePh(log.ph) ? "text-success font-mono" : "text-danger font-mono"}>{log.ph ?? "—"}</span></p>
                      <p className="text-pond-200/70">Ammonia: <span className={inRangeAmmonia(log.ammonia) ? "text-success font-mono" : "text-danger font-mono"}>{log.ammonia ?? "—"}</span></p>
                      <p className="text-pond-200/70">Temp: <span className={inRangeTemp(log.temperature) ? "text-success font-mono" : "text-danger font-mono"}>{log.temperature ?? "—"}</span></p>
                      <p className="text-pond-200/70">DO: <span className="text-pond-200 font-mono">{log.dissolvedO2 ?? "—"}</span></p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Session</th>
                    <th>Batch</th>
                    <th>Tank</th>
                    <th>pH</th>
                    <th>Ammonia</th>
                    <th>Temp</th>
                    <th>DO</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => {
                    const batchName = typeof log.batchId === "string" ? "Unknown" : log.batchId?.name || "Unknown";
                    const risk = !inRangePh(log.ph) || !inRangeAmmonia(log.ammonia) || !inRangeTemp(log.temperature);
                    return (
                      <tr key={log._id}>
                        <td className="font-mono text-xs">
                          {new Date(log.date).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                        <td className="text-xs capitalize">{log.feedSession || "morning"}</td>
                        <td className="text-xs">{batchName}</td>
                        <td className="text-xs">{log.tankName || "—"}</td>
                        <td className={`font-mono text-xs ${inRangePh(log.ph) ? "text-success" : "text-danger"}`}>{log.ph ?? "—"}</td>
                        <td className={`font-mono text-xs ${inRangeAmmonia(log.ammonia) ? "text-success" : "text-danger"}`}>{log.ammonia ?? "—"}</td>
                        <td className={`font-mono text-xs ${inRangeTemp(log.temperature) ? "text-success" : "text-danger"}`}>{log.temperature ?? "—"}</td>
                        <td className="font-mono text-xs">{log.dissolvedO2 ?? "—"}</td>
                        <td>{risk ? <span className="badge badge-red">Risk</span> : <span className="badge badge-green">OK</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(12, 12, 14,0.85)", backdropFilter: "blur(8px)" }}>
          <div className="glass-card w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg text-pond-100">New Water Reading</h2>
              <button onClick={() => { setShowForm(false); setFormError(""); }} className="text-pond-200/75 hover:text-pond-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            {formError && <div className="rounded-xl px-4 py-3 text-sm text-danger border border-red-400/30 bg-red-500/10 mb-4">{formError}</div>}
            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Batch *</label>
                  <select className="field" required value={form.batchId} onChange={(e) => setField("batchId", e.target.value)}>
                    <option value="">Select batch…</option>
                    {batches.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Date</label>
                  <div className="date-field-wrap">
                    <span className="date-field-badge" />
                    <CalendarDays className="date-field-icon h-5 w-5 text-pond-200/80" strokeWidth={2.25} />
                    <input className="field" type="date" value={form.date} onChange={(e) => setField("date", e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Session</label>
                  <select className="field" value={form.feedSession} onChange={(e) => setField("feedSession", e.target.value as "morning" | "evening")}>
                    <option value="morning">Morning</option>
                    <option value="evening">Evening</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Tank</label>
                  <select className="field" value={form.tankName} onChange={(e) => setField("tankName", e.target.value)}>
                    <option value="All Tanks">All Tanks</option>
                    {tankOptions.map((tank) => (
                      <option key={tank._id} value={tank.name}>
                        {tank.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">pH</label>
                  <input className="field" type="number" step="0.1" placeholder="7.2" value={form.ph} onChange={(e) => setField("ph", e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Ammonia (ppm)</label>
                  <input className="field" type="number" step="0.01" placeholder="0.12" value={form.ammonia} onChange={(e) => setField("ammonia", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Temperature (°C)</label>
                  <input className="field" type="number" step="0.1" placeholder="28.4" value={form.temperature} onChange={(e) => setField("temperature", e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Dissolved O₂ (mg/L)</label>
                  <input className="field" type="number" step="0.1" placeholder="5.8" value={form.dissolvedO2} onChange={(e) => setField("dissolvedO2", e.target.value)} />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-pond-300 cursor-pointer">
                  <input type="checkbox" checked={form.waterChanged} onChange={(e) => setField("waterChanged", e.target.checked)} />
                  Water changed?
                </label>
                {form.waterChanged && (
                  <input
                    className="field w-28"
                    type="number"
                    placeholder="% changed"
                    value={form.waterChangePct}
                    onChange={(e) => setField("waterChangePct", e.target.value)}
                  />
                )}
              </div>
              <div>
                <label className="block text-xs text-pond-300 mb-1.5 font-medium">Observations</label>
                <textarea className="field resize-none" rows={3} placeholder="Water slightly cloudy after morning feed" value={form.observations} onChange={(e) => setField("observations", e.target.value)} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setFormError(""); }} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {saving ? "Saving..." : "Save Reading"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
