"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Loader2, Pencil, Plus, Search, ShoppingBasket, Trash2, X } from "lucide-react";
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
type HarvestFormState = {
  batchId: string;
  date: string;
  fishSold: string;
  weightKg: string;
  pricePerKg: string;
  buyer: string;
  channel: string;
  markBatchHarvested: boolean;
};

function toDateInputValue(value?: string) {
  if (!value) return new Date().toISOString().split("T")[0];
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().split("T")[0];
  return parsed.toISOString().split("T")[0];
}

function createDefaultForm(batchId = ""): HarvestFormState {
  return {
    batchId,
    date: new Date().toISOString().split("T")[0],
    fishSold: "",
    weightKg: "",
    pricePerKg: "2800",
    buyer: "",
    channel: "POK",
    markBatchHarvested: false,
  };
}

export default function HarvestPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<HarvestRow[]>([]);
  const [allBatches, setAllBatches] = useState<Batch[]>([]);
  const [activeBatches, setActiveBatches] = useState<Batch[]>([]);
  const [editRow, setEditRow] = useState<HarvestRow | null>(null);
  const [editForm, setEditForm] = useState<HarvestFormState | null>(null);
  const [editError, setEditError] = useState("");
  const [editing, setEditing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<HarvestRow | null>(null);
  const [deletingId, setDeletingId] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const [batchFilter, setBatchFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [salesPage, setSalesPage] = useState(1);
  const [salesPageSize, setSalesPageSize] = useState(10);

  const [form, setForm] = useState<HarvestFormState>(createDefaultForm());

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/harvest");
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to load harvest records");
      setRows(Array.isArray(payload?.rows) ? payload.rows : []);
      const loadedBatches = Array.isArray(payload?.batches) ? payload.batches : [];
      const availableBatches = loadedBatches.filter((b: Batch) => b?.status !== "harvested");
      setAllBatches(loadedBatches);
      setActiveBatches(availableBatches);
      if (!form.batchId && availableBatches[0]?._id) setForm((f) => ({ ...f, batchId: availableBatches[0]._id }));
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
  const avgWeightPerFish = filteredTotals.fishSold > 0 ? filteredTotals.weightKg / filteredTotals.fishSold : 0;
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

  function updateEdit<K extends keyof HarvestFormState>(key: K, value: HarvestFormState[K]) {
    setEditForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function startEdit(row: HarvestRow) {
    setEditRow(row);
    setEditError("");
    setEditForm({
      batchId: row.batchId,
      date: toDateInputValue(row.date),
      fishSold: row.fishSold ? String(row.fishSold) : "",
      weightKg: String(row.weightKg || ""),
      pricePerKg: String(row.pricePerKg || ""),
      buyer: row.buyer || "",
      channel: row.channel || "POK",
      markBatchHarvested: false,
    });
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
      setForm(createDefaultForm(form.batchId));
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to save harvest");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editRow || !editForm) return;
    setEditing(true);
    setEditError("");
    try {
      const res = await fetch(`/api/financials/entries/${editRow._id}?type=revenue`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: editForm.batchId,
          date: editForm.date,
          fishSold: Number(editForm.fishSold || 0),
          weightKg: Number(editForm.weightKg || 0),
          pricePerKg: Number(editForm.pricePerKg || 0),
          buyer: editForm.buyer,
          channel: editForm.channel,
          totalAmount: Number(editForm.weightKg || 0) * Number(editForm.pricePerKg || 0),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update harvest sale");
      setEditRow(null);
      setEditForm(null);
      await loadData();
    } catch (err: any) {
      setEditError(err?.message || "Failed to update harvest sale");
    } finally {
      setEditing(false);
    }
  }

  async function deleteSale() {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget._id);
    setDeleteError("");
    try {
      const res = await fetch(`/api/financials/entries/${deleteTarget._id}?type=revenue`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to delete harvest sale");
      setDeleteTarget(null);
      await loadData();
    } catch (err: any) {
      setDeleteError(err?.message || "Failed to delete harvest sale");
    } finally {
      setDeletingId("");
    }
  }

  function canDeleteSale(row: HarvestRow) {
    return !(row.batchId && Number(row.fishSold || 0) > 0);
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
        <p className="text-pond-200/75 text-sm mt-1">Track harvest output, buyer activity, and revenue with a clean record for each batch.</p>
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

      <div className="glass-card p-5 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="section-title !text-base">Harvest Guide</h2>
          <p className="text-xs text-pond-200/65">Log once the sale is confirmed</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-pond-200/75">
          <div className="rounded-xl border border-pond-700/30 bg-black/15 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-pond-300 mb-1.5">Current Scope</p>
            <p>{batchFilter === "all" ? "All batches are included in this view." : `Showing sales for ${rows.find((row) => row.batchId === batchFilter)?.batchName || "the selected batch"}.`}</p>
          </div>
          <div className="rounded-xl border border-pond-700/30 bg-black/15 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-pond-300 mb-1.5">Average Size</p>
            <p>{avgWeightPerFish > 0 ? `${avgWeightPerFish.toFixed(2)}kg per fish in the current view.` : "Add fish sold and weight to monitor average harvest size."}</p>
          </div>
          <div className="rounded-xl border border-pond-700/30 bg-black/15 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-pond-300 mb-1.5">Stock Safety</p>
            <p>Once a sale updates live stock, fish sold and batch assignment stay locked to protect your records.</p>
          </div>
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
                {activeBatches.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-pond-200/60 mt-1">Choose the batch the harvested fish came from. Only active batches are available here.</p>
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
              <p className="text-xs text-pond-200/60 mt-1">Enter the actual number sold if you counted fish. Leave blank if you only tracked weight.</p>
            </div>
            <div>
              <label className="block text-xs text-pond-300 mb-1.5 font-medium">Weight (kg) *</label>
              <input className="field" type="number" min={0.1} step="0.1" required placeholder="850" value={form.weightKg} onChange={(e) => update("weightKg", e.target.value)} />
              <p className="text-xs text-pond-200/60 mt-1">Use the delivered or confirmed sale weight so revenue stays accurate.</p>
            </div>
            <div>
              <label className="block text-xs text-pond-300 mb-1.5 font-medium">Price/kg (₦) *</label>
              <input className="field" type="number" min={0} required placeholder="2200" value={form.pricePerKg} onChange={(e) => update("pricePerKg", e.target.value)} />
              <p className="text-xs text-pond-200/60 mt-1">Record the final agreed price per kilogram, not the expected asking price.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-pond-300 mb-1.5 font-medium">Buyer</label>
              <input className="field" placeholder="Kubwa Fish Market" value={form.buyer} onChange={(e) => update("buyer", e.target.value)} />
              <p className="text-xs text-pond-200/60 mt-1">Buyer names make it easier to follow repeat customers and trace each sale later.</p>
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
              <p className="text-xs text-pond-200/60 mt-1">Use one sales channel consistently so your channel breakdown stays meaningful.</p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-pond-300 cursor-pointer">
            <input type="checkbox" checked={form.markBatchHarvested} onChange={(e) => update("markBatchHarvested", e.target.checked)} />
            Mark selected batch as fully harvested
          </label>
          <p className="text-xs text-pond-200/60 -mt-1">Only check this when the batch is fully cleared. Partial sales should stay open for future harvest records.</p>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {saving ? "Saving..." : "Save Harvest Sale"}
          </button>
        </form>
      </div>

      <div className="glass-card p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <select className="field" aria-label="Filter harvest sales by batch" value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}>
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
          <p className="text-sm text-pond-200/70">No channel data yet. Start with one logged sale and this view will show where revenue is coming from.</p>
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
            <p className="text-pond-200/65 text-sm">No harvest records for the current filter.</p>
            <p className="text-pond-200/55 text-xs mt-2">Your first sale here will flow into reports and financial performance automatically.</p>
          </div>
        ) : (
          <>
            <div className="md:hidden divide-y divide-pond-700/20">
              {paginatedSalesRows.map((row) => (
                <div key={row._id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-pond-200 font-medium">{row.batchName}</p>
                    <div className="flex items-center gap-2">
                      <span className="badge badge-green">{formatNaira(row.totalAmount)}</span>
                      <button type="button" className="btn-secondary !px-2.5 !py-1.5 text-xs" onClick={() => startEdit(row)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        className="btn-secondary !px-2.5 !py-1.5 text-xs text-danger disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => {
                          setDeleteError("");
                          setDeleteTarget(row);
                        }}
                        disabled={!canDeleteSale(row)}
                        title={!canDeleteSale(row) ? "Stock-linked harvest sales cannot be deleted directly" : undefined}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
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
                    <th className="text-right">Actions</th>
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
                      <td>
                        <div className="flex items-center justify-end gap-2">
                          <button type="button" className="btn-secondary !px-2.5 !py-1.5 text-xs" onClick={() => startEdit(row)}>
                            <Pencil className="w-3.5 h-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn-secondary !px-2.5 !py-1.5 text-xs text-danger disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={() => {
                              setDeleteError("");
                              setDeleteTarget(row);
                            }}
                            disabled={!canDeleteSale(row)}
                            title={!canDeleteSale(row) ? "Stock-linked harvest sales cannot be deleted directly" : undefined}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </div>
                      </td>
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

      {editRow && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(12, 12, 14,0.85)", backdropFilter: "blur(8px)" }}>
          <div className="glass-card w-full max-w-xl max-h-[85vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg text-pond-100">Edit Harvest Sale</h2>
                <p className="text-xs text-pond-200/70 mt-1">{editRow.batchName}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditRow(null);
                  setEditForm(null);
                  setEditError("");
                }}
                className="text-pond-200/75 hover:text-pond-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && <div className="rounded-xl px-4 py-3 text-sm text-danger border border-red-400/30 bg-red-500/10">{editError}</div>}

            <form onSubmit={saveEdit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Batch *</label>
                  <select className="field" required value={editForm.batchId} disabled>
                    <option value="">Select batch…</option>
                    {allBatches.map((batch) => (
                      <option key={batch._id} value={batch._id}>
                        {batch.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-pond-200/60 mt-1">Batch is locked after stock has been reconciled.</p>
                </div>
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Harvest Date</label>
                  <div className="date-field-wrap">
                    <span className="date-field-badge" />
                    <CalendarDays className="date-field-icon h-5 w-5 text-pond-200/80" strokeWidth={2.25} />
                    <input className="field" type="date" value={editForm.date} onChange={(e) => updateEdit("date", e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Fish Sold</label>
                  <input className="field" type="number" min={0} placeholder="420" value={editForm.fishSold} disabled />
                  <p className="text-xs text-pond-200/60 mt-1">Fish sold is locked once batch stock has been updated.</p>
                </div>
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Weight (kg) *</label>
                  <input className="field" type="number" min={0.1} step="0.1" required placeholder="850" value={editForm.weightKg} onChange={(e) => updateEdit("weightKg", e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Price/kg (₦) *</label>
                  <input className="field" type="number" min={1} required placeholder="2200" value={editForm.pricePerKg} onChange={(e) => updateEdit("pricePerKg", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Buyer</label>
                  <input className="field" placeholder="Kubwa Fish Market" value={editForm.buyer} onChange={(e) => updateEdit("buyer", e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Channel</label>
                  <select className="field" value={editForm.channel} onChange={(e) => updateEdit("channel", e.target.value)}>
                    <option value="POK">POK</option>
                    <option value="restaurant">Restaurant</option>
                    <option value="market">Market</option>
                    <option value="direct">Direct</option>
                    <option value="hotel">Hotel</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditRow(null);
                    setEditForm(null);
                    setEditError("");
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button type="submit" disabled={editing} className="btn-primary flex-1">
                  {editing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
                  {editing ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(12, 12, 14,0.85)", backdropFilter: "blur(8px)" }}>
          <div className="glass-card w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg text-pond-100">Delete Harvest Sale</h2>
                <p className="text-xs text-pond-200/70 mt-1">{deleteTarget.batchName}</p>
              </div>
              <button type="button" onClick={() => { setDeleteTarget(null); setDeleteError(""); }} className="text-pond-200/75 hover:text-pond-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            {deleteError && <div className="rounded-xl px-4 py-3 text-sm text-danger border border-red-400/30 bg-red-500/10">{deleteError}</div>}
            <p className="text-sm text-pond-200/75">
              Remove this sale record for {formatNaira(deleteTarget.totalAmount)}? This updates Financials and Reports, but it will not reopen the batch automatically.
            </p>
            {!canDeleteSale(deleteTarget) && (
              <p className="text-xs text-pond-200/60">
                Stock-linked harvest sales can no longer be deleted directly. Reopen the batch and record a corrected harvest instead.
              </p>
            )}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => { setDeleteTarget(null); setDeleteError(""); }} className="btn-secondary flex-1" disabled={deletingId === deleteTarget._id}>
                Cancel
              </button>
              <button
                type="button"
                onClick={deleteSale}
                className="btn-primary flex-1 bg-red-700 hover:bg-red-600"
                disabled={deletingId === deleteTarget._id || !canDeleteSale(deleteTarget)}
              >
                {deletingId === deleteTarget._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {deletingId === deleteTarget._id ? "Deleting..." : "Delete Sale"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
