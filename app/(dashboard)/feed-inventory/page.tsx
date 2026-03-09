"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Search, Pencil, Trash2, X, Wheat } from "lucide-react";
import { formatNaira } from "@/lib/utils";

type FeedPurchase = {
  _id: string;
  date: string;
  brand: string;
  bagSizeKg: number;
  bags: number;
  totalKg: number;
  unitPrice: number;
  totalCost: number;
  supplier?: string;
  notes?: string;
};

type FeedPayload = {
  openingStockKg: number;
  purchases: FeedPurchase[];
  totals: {
    purchasedKg: number;
    purchasedCost: number;
    consumedKg: number;
    remainingKg: number;
    avgDailyUse: number;
    estimatedDaysLeft: number | null;
  };
};

export default function FeedInventoryPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<FeedPayload>({
    openingStockKg: 0,
    purchases: [],
    totals: { purchasedKg: 0, purchasedCost: 0, consumedKg: 0, remainingKg: 0, avgDailyUse: 0, estimatedDaysLeft: null },
  });
  const [query, setQuery] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [editEntry, setEditEntry] = useState<FeedPurchase | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<FeedPurchase | null>(null);
  const [openingStockEdit, setOpeningStockEdit] = useState("0");

  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    brand: "",
    bagSizeKg: "",
    bags: "",
    unitPrice: "",
    supplier: "",
    notes: "",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/feed-inventory");
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to load feed inventory");
      setData(payload);
      setOpeningStockEdit(String(payload?.openingStockKg ?? 0));
    } catch (err: any) {
      setError(err?.message || "Unable to load feed inventory");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const visiblePurchases = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data.purchases;
    return data.purchases.filter((p) => `${p.brand} ${p.supplier || ""} ${p.notes || ""}`.toLowerCase().includes(q));
  }, [data.purchases, query]);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetForm() {
    setForm({
      date: new Date().toISOString().split("T")[0],
      brand: "",
      bagSizeKg: "",
      bags: "",
      unitPrice: "",
      supplier: "",
      notes: "",
    });
  }

  async function saveOpeningStock() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/feed-inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openingStockKg: Number(openingStockEdit || 0) }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to update opening stock");
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to update opening stock");
    } finally {
      setSaving(false);
    }
  }

  async function createPurchase(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/feed-inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          bagSizeKg: Number(form.bagSizeKg),
          bags: Number(form.bags),
          unitPrice: Number(form.unitPrice),
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to create purchase");
      setShowCreate(false);
      resetForm();
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to create purchase");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(entry: FeedPurchase) {
    setEditEntry(entry);
    setForm({
      date: new Date(entry.date).toISOString().split("T")[0],
      brand: entry.brand || "",
      bagSizeKg: String(entry.bagSizeKg || ""),
      bags: String(entry.bags || ""),
      unitPrice: String(entry.unitPrice || ""),
      supplier: entry.supplier || "",
      notes: entry.notes || "",
    });
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editEntry?._id) return;
    setEditing(true);
    setError("");
    try {
      const res = await fetch(`/api/feed-inventory/entries/${editEntry._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          bagSizeKg: Number(form.bagSizeKg),
          bags: Number(form.bags),
          unitPrice: Number(form.unitPrice),
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to update purchase");
      setEditEntry(null);
      resetForm();
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to update purchase");
    } finally {
      setEditing(false);
    }
  }

  async function confirmDelete() {
    if (!deleteEntry?._id) return;
    setEditing(true);
    setError("");
    try {
      const res = await fetch(`/api/feed-inventory/entries/${deleteEntry._id}`, { method: "DELETE" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to delete purchase");
      setDeleteEntry(null);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to delete purchase");
    } finally {
      setEditing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-pond-400 animate-spin" />
      </div>
    );
  }

  const lowStock = data.totals.remainingKg <= Math.max(50, data.totals.avgDailyUse * 7);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-semibold text-pond-100">Feed Inventory</h1>
          <p className="text-pond-200/75 text-sm mt-1">Track purchases and auto-calculate stock balance from feed usage logs</p>
        </div>
        <button className="btn-primary" onClick={() => { resetForm(); setShowCreate(true); }}>
          <Plus className="w-4 h-4" /> Add Purchase
        </button>
      </div>

      {error && <div className="rounded-xl px-4 py-3 text-sm text-danger border border-red-400/30 bg-red-500/10">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card">
          <p className="text-xs text-pond-200/75 uppercase tracking-wider mb-2">Purchased (kg)</p>
          <p className="font-mono text-2xl font-semibold text-water-300">{data.totals.purchasedKg.toFixed(1)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-pond-200/75 uppercase tracking-wider mb-2">Consumed (kg)</p>
          <p className="font-mono text-2xl font-semibold text-pond-200">{data.totals.consumedKg.toFixed(1)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-pond-200/75 uppercase tracking-wider mb-2">Remaining (kg)</p>
          <p className={`font-mono text-2xl font-semibold ${lowStock ? "text-danger" : "text-success"}`}>{data.totals.remainingKg.toFixed(1)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-pond-200/75 uppercase tracking-wider mb-2">Estimated Days Left</p>
          <p className={`font-mono text-2xl font-semibold ${lowStock ? "text-danger" : "text-pond-200"}`}>
            {data.totals.estimatedDaysLeft != null ? data.totals.estimatedDaysLeft.toFixed(1) : "—"}
          </p>
        </div>
      </div>

      <div className="glass-card p-4 space-y-3">
        <h2 className="section-title !text-base">Stock Settings</h2>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
          <div>
            <label className="block text-xs text-pond-300 mb-1.5 font-medium">Opening Stock (kg)</label>
            <input className="field" type="number" min={0} step="0.1" value={openingStockEdit} onChange={(e) => setOpeningStockEdit(e.target.value)} />
          </div>
          <button className="btn-secondary self-end" onClick={saveOpeningStock} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Opening Stock"}
          </button>
        </div>
      </div>

      <div className="glass-card p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-3 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-pond-300" />
          <input className="field pl-9" placeholder="Search brand, supplier, notes" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 border-b border-pond-700/20 flex items-center justify-between gap-2">
          <h2 className="section-title">Feed Purchase Log</h2>
          <p className="text-xs text-pond-200/65">{visiblePurchases.length} records</p>
        </div>
        {visiblePurchases.length === 0 ? (
          <div className="p-12 text-center">
            <Wheat className="w-10 h-10 text-pond-500 mx-auto mb-3 opacity-40" />
            <p className="text-pond-200/65 text-sm">No purchases recorded yet</p>
          </div>
        ) : (
          <>
            <div className="md:hidden divide-y divide-pond-700/20">
              {visiblePurchases.map((p) => (
                <div key={p._id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-pond-200 font-medium">{p.brand}</p>
                    <span className="badge badge-water">{p.totalKg}kg</span>
                  </div>
                  <p className="text-xs text-pond-200/65">
                    {new Date(p.date).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <p className="text-pond-200/70">Bags: <span className="font-mono text-pond-200">{p.bags}</span></p>
                    <p className="text-pond-200/70">Bag size: <span className="font-mono text-pond-200">{p.bagSizeKg}kg</span></p>
                    <p className="text-pond-200/70">Unit: <span className="font-mono text-pond-200">{formatNaira(p.unitPrice)}</span></p>
                    <p className="text-pond-200/70">Total: <span className="font-mono text-success">{formatNaira(p.totalCost)}</span></p>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button className="btn-secondary !px-2.5 !py-1.5 text-xs" onClick={() => openEdit(p)}>
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button className="btn-secondary !px-2.5 !py-1.5 text-xs text-danger" onClick={() => setDeleteEntry(p)}>
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Brand</th>
                    <th>Bag Size (kg)</th>
                    <th>Bags</th>
                    <th>Total (kg)</th>
                    <th>Unit Price</th>
                    <th>Total Cost</th>
                    <th>Supplier</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePurchases.map((p) => (
                    <tr key={p._id}>
                      <td className="font-mono text-xs">
                        {new Date(p.date).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="text-xs">{p.brand}</td>
                      <td className="font-mono text-xs">{p.bagSizeKg}</td>
                      <td className="font-mono text-xs">{p.bags}</td>
                      <td className="font-mono text-xs">{p.totalKg}</td>
                      <td className="font-mono text-xs">{formatNaira(p.unitPrice)}</td>
                      <td className="font-mono text-success">{formatNaira(p.totalCost)}</td>
                      <td className="text-xs">{p.supplier || "—"}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button className="btn-secondary !px-2 !py-1 text-xs" onClick={() => openEdit(p)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button className="btn-secondary !px-2 !py-1 text-xs text-danger" onClick={() => setDeleteEntry(p)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(12, 12, 14,0.85)", backdropFilter: "blur(8px)" }}>
          <div className="glass-card w-full max-w-xl max-h-[85vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg text-pond-100">Add Feed Purchase</h2>
              <button onClick={() => setShowCreate(false)} className="text-pond-200/75 hover:text-pond-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={createPurchase} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Date</label>
                  <input className="field" type="date" value={form.date} onChange={(e) => update("date", e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Brand / Type *</label>
                  <input className="field" required value={form.brand} onChange={(e) => update("brand", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Bag Size (kg) *</label>
                  <input className="field" required min={0.1} step="0.1" type="number" value={form.bagSizeKg} onChange={(e) => update("bagSizeKg", e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Bags *</label>
                  <input className="field" required min={1} type="number" value={form.bags} onChange={(e) => update("bags", e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Unit Price (₦) *</label>
                  <input className="field" required min={0} type="number" value={form.unitPrice} onChange={(e) => update("unitPrice", e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-pond-300 mb-1.5 font-medium">Supplier</label>
                <input className="field" value={form.supplier} onChange={(e) => update("supplier", e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-pond-300 mb-1.5 font-medium">Notes</label>
                <textarea className="field resize-none" rows={2} value={form.notes} onChange={(e) => update("notes", e.target.value)} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {saving ? "Saving..." : "Save Purchase"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(12, 12, 14,0.85)", backdropFilter: "blur(8px)" }}>
          <div className="glass-card w-full max-w-xl max-h-[85vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg text-pond-100">Edit Feed Purchase</h2>
              <button onClick={() => setEditEntry(null)} className="text-pond-200/75 hover:text-pond-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={saveEdit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Date</label>
                  <input className="field" type="date" value={form.date} onChange={(e) => update("date", e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Brand / Type *</label>
                  <input className="field" required value={form.brand} onChange={(e) => update("brand", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Bag Size (kg) *</label>
                  <input className="field" required min={0.1} step="0.1" type="number" value={form.bagSizeKg} onChange={(e) => update("bagSizeKg", e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Bags *</label>
                  <input className="field" required min={1} type="number" value={form.bags} onChange={(e) => update("bags", e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Unit Price (₦) *</label>
                  <input className="field" required min={0} type="number" value={form.unitPrice} onChange={(e) => update("unitPrice", e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-pond-300 mb-1.5 font-medium">Supplier</label>
                <input className="field" value={form.supplier} onChange={(e) => update("supplier", e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-pond-300 mb-1.5 font-medium">Notes</label>
                <textarea className="field resize-none" rows={2} value={form.notes} onChange={(e) => update("notes", e.target.value)} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditEntry(null)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={editing} className="btn-primary flex-1">
                  {editing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
                  {editing ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(12, 12, 14,0.85)", backdropFilter: "blur(8px)" }}>
          <div className="glass-card w-full max-w-md max-h-[85vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg text-pond-100">Delete Feed Purchase</h2>
              <button onClick={() => setDeleteEntry(null)} className="text-pond-200/75 hover:text-pond-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-pond-200/75">
              Delete purchase for <span className="font-semibold text-pond-200">{deleteEntry.brand}</span>?
            </p>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setDeleteEntry(null)} className="btn-secondary flex-1">Cancel</button>
              <button type="button" onClick={confirmDelete} disabled={editing} className="btn-primary flex-1 bg-red-700 hover:bg-red-600">
                {editing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

