"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, ShoppingBasket, Search, CalendarDays } from "lucide-react";
import { formatNaira } from "@/lib/utils";

type Batch = { _id: string; name: string; status?: string };
type HarvestRow = {
  _id: string;
  batchId: string;
  batchName: string;
  fishSold: number;
  weightKg: number;
  pricePerKg: number;
  totalAmount: number;
  buyer: string;
  channel: string;
  date: string;
  avgPricePerFish: number;
};

export default function HarvestPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<HarvestRow[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);

  const [batchFilter, setBatchFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [salesPage, setSalesPage] = useState(1);
  const [salesPageSize, setSalesPageSize] = useState(10);

  const [form, setForm] = useState({
    batchId: "",
    date: new Date().toISOString().split("T")[0],
    fishSold: "",
    weightKg: "",
    pricePerKg: "2800",
    buyer: "",
    channel: "POK",
    markBatchHarvested: true,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/harvest");
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to load harvest records");
      setRows(Array.isArray(payload?.rows) ? payload.rows : []);
      const activeBatches = (Array.isArray(payload?.batches) ? payload.batches : []).filter((b: Batch) => b?.status !== "harvested");
      setBatches(activeBatches);
      if (!form.batchId && activeBatches[0]?._id) setForm((f) => ({ ...f, batchId: activeBatches[0]._id }));
    } catch (err: any) {
      setError(err?.message || "Unable to load harvest data");
    } finally {
      setLoading(false);
    }
  }, [form.batchId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (batchFilter !== "all" && row.batchId !== batchFilter) return false;
      if (!q) return true;
      const text = `${row.batchName} ${row.buyer || ""} ${row.channel || ""}`.toLowerCase();
      return text.includes(q);
    });
  }, [rows, batchFilter, search]);

  const filteredTotals = useMemo(() => {
    return visibleRows.reduce(
      (acc, row) => {
        acc.fishSold += Number(row.fishSold || 0);
        acc.weightKg += Number(row.weightKg || 0);
        acc.revenue += Number(row.totalAmount || 0);
        return acc;
      },
      { fishSold: 0, weightKg: 0, revenue: 0 }
    );
  }, [visibleRows]);
  const channelBreakdown = useMemo(() => {
    const map: Record<string, { channel: string; revenue: number; fishSold: number; weightKg: number; records: number }> = {};
    for (const row of visibleRows) {
      const channel = (row.channel || "other").toLowerCase();
      if (!map[channel]) {
        map[channel] = { channel, revenue: 0, fishSold: 0, weightKg: 0, records: 0 };
      }
      map[channel].revenue += Number(row.totalAmount || 0);
      map[channel].fishSold += Number(row.fishSold || 0);
      map[channel].weightKg += Number(row.weightKg || 0);
      map[channel].records += 1;
    }
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [visibleRows]);
  const salesTotalPages = Math.max(1, Math.ceil(visibleRows.length / salesPageSize));
  const salesPageStart = visibleRows.length === 0 ? 0 : (salesPage - 1) * salesPageSize + 1;
  const salesPageEnd = Math.min(visibleRows.length, salesPage * salesPageSize);
  const paginatedSalesRows = useMemo(() => {
    const start = (salesPage - 1) * salesPageSize;
    return visibleRows.slice(start, start + salesPageSize);
  }, [salesPage, salesPageSize, visibleRows]);

  useEffect(() => {
    setSalesPage(1);
  }, [batchFilter, search, salesPageSize]);

  useEffect(() => {
    setSalesPage((prev) => Math.min(prev, salesTotalPages));
  }, [salesTotalPages]);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        fishSold: Number(form.fishSold || 0),
        weightKg: Number(form.weightKg || 0),
        pricePerKg: Number(form.pricePerKg || 0),
      };
      const res = await fetch("/api/harvest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save harvest");
      setForm((f) => ({ ...f, fishSold: "", weightKg: "", buyer: "" }));
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to save harvest");
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
      <div>
        <h1 className="font-display text-2xl font-semibold text-pond-100">Harvest & Sales</h1>
        <p className="text-pond-200/75 text-sm mt-1">Log harvest output and sales revenue by batch</p>
      </div>

      {error && <div className="rounded-xl px-4 py-3 text-sm text-danger border border-red-400/30 bg-red-500/10">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card">
          <p className="text-xs text-pond-200/75 uppercase tracking-wider mb-2">Fish Sold</p>
          <p className="font-mono text-2xl font-semibold text-water-300">{filteredTotals.fishSold.toLocaleString()}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-pond-200/75 uppercase tracking-wider mb-2">Harvested Weight</p>
          <p className="font-mono text-2xl font-semibold text-pond-200">{filteredTotals.weightKg.toFixed(1)}kg</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-pond-200/75 uppercase tracking-wider mb-2">Revenue</p>
          <p className="font-mono text-2xl font-semibold text-success">{formatNaira(filteredTotals.revenue)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-pond-200/75 uppercase tracking-wider mb-2">Avg Price/kg</p>
          <p className="font-mono text-2xl font-semibold text-pond-200">
            {filteredTotals.weightKg > 0 ? formatNaira(filteredTotals.revenue / filteredTotals.weightKg) : "—"}
          </p>
        </div>
      </div>

      <div className="glass-card p-5 space-y-4">
        <h2 className="section-title !text-base">Record Harvest Sale</h2>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-pond-300 mb-1.5 font-medium">Batch *</label>
              <select className="field" required value={form.batchId} onChange={(e) => update("batchId", e.target.value)}>
                <option value="">Select batch…</option>
                {batches.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-pond-300 mb-1.5 font-medium">Harvest Date</label>
              <div className="date-field-wrap">
                <span className="date-field-badge" />
                <CalendarDays className="date-field-icon h-5 w-5 text-pond-200/80" strokeWidth={2.25} />
                <input className="field" type="date" value={form.date} onChange={(e) => update("date", e.target.value)} />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-pond-300 mb-1.5 font-medium">Fish Sold</label>
              <input className="field" type="number" min={0} placeholder="420" value={form.fishSold} onChange={(e) => update("fishSold", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-pond-300 mb-1.5 font-medium">Weight (kg) *</label>
              <input className="field" type="number" min={0.1} step="0.1" required placeholder="850" value={form.weightKg} onChange={(e) => update("weightKg", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-pond-300 mb-1.5 font-medium">Price/kg (₦) *</label>
              <input className="field" type="number" min={0} required placeholder="2200" value={form.pricePerKg} onChange={(e) => update("pricePerKg", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-pond-300 mb-1.5 font-medium">Buyer</label>
              <input className="field" placeholder="Kubwa Fish Market" value={form.buyer} onChange={(e) => update("buyer", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-pond-300 mb-1.5 font-medium">Channel</label>
              <select className="field" value={form.channel} onChange={(e) => update("channel", e.target.value)}>
                <option value="POK">POK</option>
                <option value="restaurant">Restaurant</option>
                <option value="market">Market</option>
                <option value="direct">Direct</option>
                <option value="hotel">Hotel</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-pond-300 cursor-pointer">
            <input type="checkbox" checked={form.markBatchHarvested} onChange={(e) => update("markBatchHarvested", e.target.checked)} />
            Mark selected batch as harvested
          </label>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {saving ? "Saving..." : "Save Harvest"}
          </button>
        </form>
      </div>

      <div className="glass-card p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <select className="field" value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}>
          <option value="all">All batches</option>
          {Array.from(new Set(rows.map((r) => r.batchId))).map((id) => {
            const label = rows.find((r) => r.batchId === id)?.batchName || id;
            return (
              <option key={id} value={id}>
                {label}
              </option>
            );
          })}
        </select>
        <div className="relative md:col-span-2">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-pond-300" />
          <input className="field pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search buyer, channel, batch" />
        </div>
      </div>

      <div className="glass-card p-5 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="section-title">Harvest Channels</h2>
          <p className="text-xs text-pond-200/65">{channelBreakdown.length} channels</p>
        </div>
        {channelBreakdown.length === 0 ? (
          <p className="text-sm text-pond-200/70">No channel data yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {channelBreakdown.map((channel) => (
              <div key={channel.channel} className="rounded-xl border border-pond-700/30 bg-black/20 px-4 py-3">
                <p className="text-xs uppercase tracking-wider text-pond-300">{channel.channel}</p>
                <p className="text-lg font-semibold text-success mt-1">{formatNaira(channel.revenue)}</p>
                <p className="text-xs text-pond-200/70 mt-1">
                  {channel.records} sale{channel.records > 1 ? "s" : ""} · {channel.weightKg.toFixed(1)}kg · {channel.fishSold.toLocaleString()} fish
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 border-b border-pond-700/20 flex items-center justify-between gap-2">
          <h2 className="section-title">Recent Harvest Sales</h2>
          <p className="text-xs text-pond-200/65">{visibleRows.length} records</p>
        </div>
        {visibleRows.length === 0 ? (
          <div className="p-12 text-center">
            <ShoppingBasket className="w-10 h-10 text-pond-500 mx-auto mb-3 opacity-40" />
            <p className="text-pond-200/65 text-sm">No harvest records for current filter</p>
          </div>
        ) : (
          <>
            <div className="md:hidden divide-y divide-pond-700/20">
              {paginatedSalesRows.map((row) => (
                <div key={row._id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-pond-200 font-medium">{row.batchName}</p>
                    <span className="badge badge-green">{formatNaira(row.totalAmount)}</span>
                  </div>
                  <p className="text-xs text-pond-200/65">
                    {new Date(row.date).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <p className="text-pond-200/70">Weight: <span className="font-mono text-pond-200">{row.weightKg}kg</span></p>
                    <p className="text-pond-200/70">Fish: <span className="font-mono text-pond-200">{row.fishSold || "—"}</span></p>
                    <p className="text-pond-200/70">Price/kg: <span className="font-mono text-pond-200">{formatNaira(row.pricePerKg)}</span></p>
                    <p className="text-pond-200/70">Buyer: <span className="text-pond-200">{row.buyer || "—"}</span></p>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Batch</th>
                    <th>Fish Sold</th>
                    <th>Weight (kg)</th>
                    <th>Price/kg</th>
                    <th>Revenue</th>
                    <th>Buyer</th>
                    <th>Channel</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSalesRows.map((row) => (
                    <tr key={row._id}>
                      <td className="font-mono text-xs">
                        {new Date(row.date).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="text-xs">{row.batchName}</td>
                      <td className="font-mono text-xs">{row.fishSold || "—"}</td>
                      <td className="font-mono text-xs">{row.weightKg}</td>
                      <td className="font-mono text-xs">{formatNaira(row.pricePerKg)}</td>
                      <td className="font-mono text-success">{formatNaira(row.totalAmount)}</td>
                      <td className="text-xs">{row.buyer || "—"}</td>
                      <td className="text-xs capitalize">{row.channel || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-pond-700/20 px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-pond-200/65">
                Showing {salesPageStart}-{salesPageEnd} of {visibleRows.length}
              </p>
              <div className="flex items-center gap-2 overflow-x-auto">
                <select
                  className="field !w-auto !py-1.5 !px-2.5 !text-xs shrink-0"
                  value={salesPageSize}
                  onChange={(e) => setSalesPageSize(Number(e.target.value))}
                >
                  <option value={10}>10 / page</option>
                  <option value={20}>20 / page</option>
                  <option value={50}>50 / page</option>
                </select>
                <button
                  type="button"
                  className="btn-secondary !px-3 !py-1.5 text-xs"
                  onClick={() => setSalesPage((p) => Math.max(1, p - 1))}
                  disabled={salesPage <= 1}
                >
                  Previous
                </button>
                <span className="text-xs text-pond-200/75">
                  Page {salesPage} of {salesTotalPages}
                </span>
                <button
                  type="button"
                  className="btn-secondary !px-3 !py-1.5 text-xs"
                  onClick={() => setSalesPage((p) => Math.min(salesTotalPages, p + 1))}
                  disabled={salesPage >= salesTotalPages}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
