"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Search, Pencil, Trash2, X, Wheat, CalendarDays } from "lucide-react";
import { formatNaira } from "@/lib/utils";

type FeedPurchase = {
  _id: string;
  date: string;
  brand: string;
  pelletSizeMm?: number | null;
  bagSizeKg: number;
  bags: number;
  totalKg: number;
  unitPrice: number;
  totalCost: number;
  supplier?: string;
  notes?: string;
};

type FeedProduct = {
  key: string;
  brand: string;
  pelletSizeMm: number | null;
  label: string;
  purchasedKg: number;
  purchasedCost: number;
  consumedKg: number;
  remainingKg: number;
  avgDailyUse: number;
  estimatedDaysLeft: number | null;
  feedingDays14: number;
  bagSizesKg: number[];
  purchaseCount: number;
  lastUsedAt: string | null;
  lowStockSeverity: "warning" | "critical" | null;
};

type FeedPayload = {
  openingStockKg: number;
  openingStockBrand: string;
  openingStockSizeMm: number | null;
  openingStockDate: string | null;
  openingStockTotalCost: number;
  openingStockSupplier: string;
  purchases: FeedPurchase[];
  products: FeedProduct[];
  lowStockProducts: FeedProduct[];
  totals: {
    stockedKg: number;
    purchasedKg: number;
    purchasedCost: number;
    consumedKg: number;
    remainingKg: number;
  };
};

export default function FeedInventoryPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [openingError, setOpeningError] = useState("");
  const [createError, setCreateError] = useState("");
  const [editError, setEditError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [data, setData] = useState<FeedPayload>({
    openingStockKg: 0,
    openingStockBrand: "",
    openingStockSizeMm: null,
    openingStockDate: null,
    openingStockTotalCost: 0,
    openingStockSupplier: "",
    purchases: [],
    products: [],
    lowStockProducts: [],
    totals: { stockedKg: 0, purchasedKg: 0, purchasedCost: 0, consumedKg: 0, remainingKg: 0 },
  });
  const [query, setQuery] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [editEntry, setEditEntry] = useState<FeedPurchase | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<FeedPurchase | null>(null);
  const [openingStockEdit, setOpeningStockEdit] = useState("0");
  const [openingBrandEdit, setOpeningBrandEdit] = useState("");
  const [openingSizeEdit, setOpeningSizeEdit] = useState("");
  const [openingDateEdit, setOpeningDateEdit] = useState(new Date().toISOString().split("T")[0]);
  const [openingCostEdit, setOpeningCostEdit] = useState("");
  const [openingSupplierEdit, setOpeningSupplierEdit] = useState("");

  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    brand: "",
    pelletSizeMm: "",
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
      setOpeningBrandEdit(String(payload?.openingStockBrand ?? ""));
      setOpeningSizeEdit(payload?.openingStockSizeMm != null ? String(payload.openingStockSizeMm) : "");
      setOpeningDateEdit(payload?.openingStockDate ? new Date(payload.openingStockDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]);
      setOpeningCostEdit(payload?.openingStockTotalCost ? String(payload.openingStockTotalCost) : "");
      setOpeningSupplierEdit(String(payload?.openingStockSupplier ?? ""));
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
      pelletSizeMm: "",
      bagSizeKg: "",
      bags: "",
      unitPrice: "",
      supplier: "",
      notes: "",
    });
  }

  async function saveOpeningStock() {
    setSaving(true);
    setOpeningError("");
    try {
      const res = await fetch("/api/feed-inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openingStockKg: Number(openingStockEdit || 0),
          openingStockBrand: openingBrandEdit,
          openingStockSizeMm: openingSizeEdit === "" ? null : Number(openingSizeEdit),
          openingStockDate: openingDateEdit,
          openingStockTotalCost: Number(openingCostEdit || 0),
          openingStockSupplier: openingSupplierEdit,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to update opening stock");
      await loadData();
    } catch (err: any) {
      setOpeningError(err?.message || "Failed to update opening stock");
    } finally {
      setSaving(false);
    }
  }

  async function createPurchase(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setCreateError("");
    try {
      const res = await fetch("/api/feed-inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          pelletSizeMm: form.pelletSizeMm === "" ? null : Number(form.pelletSizeMm),
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
      setCreateError(err?.message || "Failed to create purchase");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(entry: FeedPurchase) {
    setEditEntry(entry);
    setEditError("");
    setForm({
      date: new Date(entry.date).toISOString().split("T")[0],
      brand: entry.brand || "",
      pelletSizeMm: entry.pelletSizeMm != null ? String(entry.pelletSizeMm) : "",
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
    setEditError("");
    try {
      const res = await fetch(`/api/feed-inventory/entries/${editEntry._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          pelletSizeMm: form.pelletSizeMm === "" ? null : Number(form.pelletSizeMm),
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
      setEditError(err?.message || "Failed to update purchase");
    } finally {
      setEditing(false);
    }
  }

  async function confirmDelete() {
    if (!deleteEntry?._id) return;
    setEditing(true);
    setDeleteError("");
    try {
      const res = await fetch(`/api/feed-inventory/entries/${deleteEntry._id}`, { method: "DELETE" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to delete purchase");
      setDeleteEntry(null);
      await loadData();
    } catch (err: any) {
      setDeleteError(err?.message || "Failed to delete purchase");
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

  const lowStock = data.lowStockProducts.length > 0;
  const hasOpeningStock = Number(data.openingStockKg || 0) > 0;
  const openingStockLabel = data.openingStockBrand
    ? `${data.openingStockBrand}${data.openingStockSizeMm != null ? ` ${data.openingStockSizeMm}mm` : ""}`
    : "Opening stock";
  const formatForecastHorizon = (days: number | null) => {
    if (days == null) return "—";
    if (days < 14) return `${days.toFixed(1)} days`;
    if (days < 60) return `${(days / 7).toFixed(1)} weeks`;
    return `${(days / 30.44).toFixed(1)} months`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-semibold text-pond-100">Feed Inventory</h1>
          <p className="text-pond-200/75 text-sm mt-1">Track initial stock, purchases, and auto-calculate balance from feed usage logs</p>
        </div>
        <button className="btn-primary" onClick={() => { resetForm(); setCreateError(""); setShowCreate(true); }}>
          <Plus className="w-4 h-4" /> Add Purchase
        </button>
      </div>

      {error && <div className="rounded-xl px-4 py-3 text-sm text-danger border border-red-400/30 bg-red-500/10">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card">
          <p className="text-xs text-pond-200/75 uppercase tracking-wider mb-2">Stocked In (kg)</p>
          <p className="font-mono text-2xl font-semibold text-water-300">{data.totals.stockedKg.toFixed(2)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-pond-200/75 uppercase tracking-wider mb-2">Consumed (kg)</p>
          <p className="font-mono text-2xl font-semibold text-pond-200">{data.totals.consumedKg.toFixed(2)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-pond-200/75 uppercase tracking-wider mb-2">Remaining (kg)</p>
          <p className={`font-mono text-2xl font-semibold ${lowStock ? "text-danger" : "text-success"}`}>{data.totals.remainingKg.toFixed(2)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-pond-200/75 uppercase tracking-wider mb-2">Tracked Products</p>
          <p className={`font-mono text-2xl font-semibold ${lowStock ? "text-danger" : "text-pond-200"}`}>
            {data.products.length}
          </p>
        </div>
      </div>

      {hasOpeningStock ? (
        <div className="glass-card p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="section-title !text-base">Opening Stock</h2>
              <p className="text-xs text-pond-200/70 mt-1">Initial stock carried into the system before purchase logging began.</p>
            </div>
            <span className="badge badge-water">{data.openingStockKg.toFixed(2)}kg on hand</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 text-xs">
            <div className="rounded-xl border border-pond-700/30 bg-black/20 px-4 py-3">
              <p className="text-pond-200/65 uppercase tracking-wider">Product</p>
              <p className="text-pond-100 mt-1">{openingStockLabel}</p>
            </div>
            <div className="rounded-xl border border-pond-700/30 bg-black/20 px-4 py-3">
              <p className="text-pond-200/65 uppercase tracking-wider">Value</p>
              <p className="font-mono text-pond-100 mt-1">
                {data.openingStockTotalCost > 0 ? formatNaira(data.openingStockTotalCost) : "Not set"}
              </p>
            </div>
            <div className="rounded-xl border border-pond-700/30 bg-black/20 px-4 py-3">
              <p className="text-pond-200/65 uppercase tracking-wider">Supplier</p>
              <p className="text-pond-100 mt-1">{data.openingStockSupplier || "Not set"}</p>
            </div>
            <div className="rounded-xl border border-pond-700/30 bg-black/20 px-4 py-3">
              <p className="text-pond-200/65 uppercase tracking-wider">Acquired</p>
              <p className="font-mono text-pond-100 mt-1">
                {data.openingStockDate
                  ? new Date(data.openingStockDate).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })
                  : "Not set"}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="glass-card p-4 space-y-3">
        <h2 className="section-title !text-base">Stock Settings</h2>
        <p className="text-xs text-pond-200/70">
          Assign opening stock to the exact feed product and record what that stock cost, so later usage is deducted from the correct pellet size without losing its value.
        </p>
        {openingError && <div className="rounded-xl px-4 py-3 text-sm text-danger border border-red-400/30 bg-red-500/10">{openingError}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-pond-300 mb-1.5 font-medium">Initial Stock (kg)</label>
            <input className="field" type="number" min={0} step="0.1" value={openingStockEdit} onChange={(e) => setOpeningStockEdit(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-pond-300 mb-1.5 font-medium">Opening Brand / Product</label>
            <input className="field" placeholder="Aller Aqua" value={openingBrandEdit} onChange={(e) => setOpeningBrandEdit(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-pond-300 mb-1.5 font-medium">Pellet Size (mm)</label>
            <input className="field" type="number" min={0.1} step="0.1" placeholder="2" value={openingSizeEdit} onChange={(e) => setOpeningSizeEdit(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-pond-300 mb-1.5 font-medium">Acquired Date</label>
            <div className="date-field-wrap">
              <span className="date-field-badge" />
              <CalendarDays className="date-field-icon h-5 w-5 text-pond-200/80" strokeWidth={2.25} />
              <input className="field" type="date" value={openingDateEdit} onChange={(e) => setOpeningDateEdit(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-pond-300 mb-1.5 font-medium">Opening Stock Value (₦)</label>
            <input className="field" type="number" min={0} placeholder="18500" value={openingCostEdit} onChange={(e) => setOpeningCostEdit(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-pond-300 mb-1.5 font-medium">Opening Supplier</label>
            <input className="field" placeholder="Chi Farms" value={openingSupplierEdit} onChange={(e) => setOpeningSupplierEdit(e.target.value)} />
          </div>
        </div>
        {Number(data.openingStockKg || 0) > 0 ? (
          <p className="text-xs text-pond-200/65">
            Opening stock on hand: <span className="font-mono text-pond-200">{data.openingStockKg.toFixed(2)}kg</span>
            {data.openingStockTotalCost > 0 ? <> valued at <span className="font-mono text-pond-200">{formatNaira(data.openingStockTotalCost)}</span></> : null}
            {data.openingStockSupplier ? <> from <span className="text-pond-100">{data.openingStockSupplier}</span></> : null}
            {data.openingStockDate ? <> on <span className="font-mono text-pond-200">{new Date(data.openingStockDate).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</span></> : null}.
          </p>
        ) : null}
        <div className="flex justify-end">
          <button className="btn-secondary self-end" onClick={saveOpeningStock} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Initial Stock"}
          </button>
        </div>
      </div>

      <div className="glass-card p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="section-title !text-base">Feed Products</h2>
            <p className="text-xs text-pond-200/70 mt-1">Stock is forecast per product, not just total kg.</p>
          </div>
          {lowStock ? <span className="badge badge-red">{data.lowStockProducts.length} low-stock</span> : <span className="badge badge-green">Healthy</span>}
        </div>
        {data.products.length === 0 ? (
          <p className="text-sm text-pond-200/65">No feed products tracked yet. Add a purchase or set opening stock details.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {data.products.map((product) => (
              <div
                key={product.key}
                className="rounded-xl p-4 space-y-2"
                style={{ background: "rgba(12, 12, 14, 0.7)", border: "1px solid rgba(148, 163, 184, 0.16)" }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-pond-100">{product.label}</p>
                    <p className="text-xs text-pond-200/65">
                      Bag sizes: {product.bagSizesKg.length > 0 ? product.bagSizesKg.map((size) => `${size}kg`).join(", ") : "opening stock only"}
                    </p>
                  </div>
                  {product.lowStockSeverity ? (
                    <span className={`badge ${product.lowStockSeverity === "critical" ? "badge-red" : "badge-water"}`}>
                      {product.lowStockSeverity === "critical" ? "Critical" : "Low"}
                    </span>
                  ) : (
                    <span className="badge badge-green">OK</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <p className="text-pond-200/70">Purchased: <span className="font-mono text-pond-200">{product.purchasedKg.toFixed(2)}kg</span></p>
                  <p className="text-pond-200/70">Consumed: <span className="font-mono text-pond-200">{product.consumedKg.toFixed(2)}kg</span></p>
                  <p className="text-pond-200/70">Remaining: <span className={`font-mono ${product.lowStockSeverity ? "text-danger" : "text-success"}`}>{product.remainingKg.toFixed(2)}kg</span></p>
                  <p className="text-pond-200/70">Avg use: <span className="font-mono text-pond-200">{product.avgDailyUse.toFixed(2)}kg/day</span></p>
                  <p className="text-pond-200/70">Forecast left: <span className="font-mono text-pond-200">{formatForecastHorizon(product.estimatedDaysLeft)}</span></p>
                  <p className="text-pond-200/70">Last used: <span className="font-mono text-pond-200">{product.lastUsedAt ? new Date(product.lastUsedAt).toLocaleDateString("en-NG", { day: "numeric", month: "short" }) : "—"}</span></p>
                </div>
              </div>
            ))}
          </div>
        )}
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
            <p className="text-pond-200/65 text-sm">
              No purchases recorded yet{data.openingStockKg > 0 ? ", but opening stock is already on hand." : ""}
            </p>
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
                  <p className="text-xs text-pond-200/65">{p.pelletSizeMm != null ? `${p.pelletSizeMm}mm pellets` : "Pellet size not set"}</p>
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
                    <th>Pellet Size (mm)</th>
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
                      <td className="font-mono text-xs">{p.pelletSizeMm ?? "—"}</td>
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
              <button onClick={() => { setShowCreate(false); setCreateError(""); }} className="text-pond-200/75 hover:text-pond-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            {createError && <div className="rounded-xl px-4 py-3 text-sm text-danger border border-red-400/30 bg-red-500/10 mb-4">{createError}</div>}
            <form onSubmit={createPurchase} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Date</label>
                  <div className="date-field-wrap">
                    <span className="date-field-badge" />
                    <CalendarDays className="date-field-icon h-5 w-5 text-pond-200/80" strokeWidth={2.25} />
                    <input className="field" type="date" value={form.date} onChange={(e) => update("date", e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Brand / Type *</label>
                  <input className="field" required placeholder="Aller Aqua" value={form.brand} onChange={(e) => update("brand", e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Pellet Size (mm)</label>
                  <input className="field" min={0.1} step="0.1" type="number" placeholder="2" value={form.pelletSizeMm} onChange={(e) => update("pelletSizeMm", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Bag Size (kg) *</label>
                  <input className="field" required min={0.1} step="0.1" type="number" placeholder="15" value={form.bagSizeKg} onChange={(e) => update("bagSizeKg", e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Bags *</label>
                  <input className="field" required min={1} type="number" placeholder="1" value={form.bags} onChange={(e) => update("bags", e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Unit Price (₦) *</label>
                  <input className="field" required min={0} type="number" placeholder="18500" value={form.unitPrice} onChange={(e) => update("unitPrice", e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-pond-300 mb-1.5 font-medium">Supplier</label>
                <input className="field" placeholder="Chi Farms" value={form.supplier} onChange={(e) => update("supplier", e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-pond-300 mb-1.5 font-medium">Notes</label>
                <textarea className="field resize-none" rows={2} placeholder="Juvenile feed for Batch A" value={form.notes} onChange={(e) => update("notes", e.target.value)} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowCreate(false); setCreateError(""); }} className="btn-secondary flex-1">Cancel</button>
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
              <button onClick={() => { setEditEntry(null); setEditError(""); }} className="text-pond-200/75 hover:text-pond-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            {editError && <div className="rounded-xl px-4 py-3 text-sm text-danger border border-red-400/30 bg-red-500/10 mb-4">{editError}</div>}
            <form onSubmit={saveEdit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Date</label>
                  <div className="date-field-wrap">
                    <span className="date-field-badge" />
                    <CalendarDays className="date-field-icon h-5 w-5 text-pond-200/80" strokeWidth={2.25} />
                    <input className="field" type="date" value={form.date} onChange={(e) => update("date", e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Brand / Type *</label>
                  <input className="field" required placeholder="Aller Aqua" value={form.brand} onChange={(e) => update("brand", e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Pellet Size (mm)</label>
                  <input className="field" min={0.1} step="0.1" type="number" placeholder="2" value={form.pelletSizeMm} onChange={(e) => update("pelletSizeMm", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Bag Size (kg) *</label>
                  <input className="field" required min={0.1} step="0.1" type="number" placeholder="15" value={form.bagSizeKg} onChange={(e) => update("bagSizeKg", e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Bags *</label>
                  <input className="field" required min={1} type="number" placeholder="1" value={form.bags} onChange={(e) => update("bags", e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Unit Price (₦) *</label>
                  <input className="field" required min={0} type="number" placeholder="18500" value={form.unitPrice} onChange={(e) => update("unitPrice", e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-pond-300 mb-1.5 font-medium">Supplier</label>
                <input className="field" placeholder="Chi Farms" value={form.supplier} onChange={(e) => update("supplier", e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-pond-300 mb-1.5 font-medium">Notes</label>
                <textarea className="field resize-none" rows={2} placeholder="Juvenile feed for Batch A" value={form.notes} onChange={(e) => update("notes", e.target.value)} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setEditEntry(null); setEditError(""); }} className="btn-secondary flex-1">Cancel</button>
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
              <button onClick={() => { setDeleteEntry(null); setDeleteError(""); }} className="text-pond-200/75 hover:text-pond-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            {deleteError && <div className="rounded-xl px-4 py-3 text-sm text-danger border border-red-400/30 bg-red-500/10">{deleteError}</div>}
            <p className="text-sm text-pond-200/75">
              Delete purchase for <span className="font-semibold text-pond-200">{deleteEntry.brand}</span>?
            </p>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => { setDeleteEntry(null); setDeleteError(""); }} className="btn-secondary flex-1">Cancel</button>
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
