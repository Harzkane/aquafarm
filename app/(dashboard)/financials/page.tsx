"use client";
import { useMemo, useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Plus, Loader2, DollarSign, Search, Pencil, Trash2, Download, X } from "lucide-react";
import { formatNaira } from "@/lib/utils";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

const EXPENSE_CATS = ["feed", "juveniles", "medication", "labour", "utilities", "equipment", "transport", "other"];
const CHANNELS = ["POK", "restaurant", "market", "direct", "hotel", "other"];
const CAT_COLORS: Record<string, string> = {
  feed: "#9ca3af", juveniles: "#75d7ff", medication: "#f87171",
  labour: "#d3bf86", utilities: "#a78bfa", equipment: "#60a5fa",
  transport: "#fb923c", other: "#6b7280",
};

type Batch = { _id: string; name: string };
type Expense = {
  _id?: string;
  category: string;
  description?: string;
  amount: number;
  date: string;
  batchId?: string;
};
type Revenue = {
  _id?: string;
  batchId?: string;
  fishSold?: number;
  weightKg?: number;
  pricePerKg?: number;
  totalAmount: number;
  buyer?: string;
  channel?: string;
  date: string;
};

type FinancialData = { expenses: Expense[]; revenue: Revenue[] };

type Transaction = {
  id?: string;
  type: "expense" | "revenue";
  category: string;
  description: string;
  amount: number;
  date: string;
  batchId?: string;
  raw: Expense | Revenue;
};

export default function FinancialsPage() {
  const [data, setData] = useState<FinancialData>({ expenses: [], revenue: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [batches, setBatches] = useState<Batch[]>([]);
  const batchNameMap = useMemo(() => Object.fromEntries(batches.map((b) => [b._id, b.name])), [batches]);

  const [tab, setTab] = useState<"expense" | "revenue">("expense");
  const [eForm, setEForm] = useState({ category: "feed", description: "", amount: "", batchId: "" });
  const [rForm, setRForm] = useState({ fishSold: "", weightKg: "", pricePerKg: "2800", buyer: "", channel: "POK", batchId: "" });

  const [typeFilter, setTypeFilter] = useState<"all" | "expense" | "revenue">("all");
  const [batchFilter, setBatchFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<"30d" | "90d" | "all">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editTab, setEditTab] = useState<"expense" | "revenue">("expense");
  const [editExpense, setEditExpense] = useState({ category: "feed", description: "", amount: "", batchId: "", date: "" });
  const [editRevenue, setEditRevenue] = useState({ fishSold: "", weightKg: "", pricePerKg: "", buyer: "", channel: "POK", batchId: "", date: "" });

  const [deletingTx, setDeletingTx] = useState<Transaction | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [finRes, batchesRes] = await Promise.all([
        fetch("/api/financials"),
        fetch("/api/batches"),
      ]);
      const fin = await finRes.json();
      const b = await batchesRes.json();
      if (!finRes.ok) throw new Error(fin?.error || "Failed to load financials");
      if (!batchesRes.ok) throw new Error(b?.error || "Failed to load batches");
      setData(fin || { expenses: [], revenue: [] });
      setBatches(b || []);
    } catch (err: any) {
      setError(err?.message || "Unable to load financial data");
    } finally {
      setLoading(false);
    }
  }

  const allTransactions = useMemo<Transaction[]>(() => {
    const expenses = (data.expenses || []).map((e) => ({
      id: e._id,
      type: "expense" as const,
      category: e.category,
      description: e.description || "—",
      amount: e.amount || 0,
      date: e.date,
      batchId: e.batchId,
      raw: e,
    }));

    const revenues = (data.revenue || []).map((r) => ({
      id: r._id,
      type: "revenue" as const,
      category: r.channel || "sale",
      description: r.buyer ? `${r.buyer} — ${r.fishSold || "?"} fish` : `Sale — ${r.fishSold || "?"} fish`,
      amount: r.totalAmount || 0,
      date: r.date,
      batchId: r.batchId,
      raw: r,
    }));

    return [...expenses, ...revenues].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data]);

  const filteredTransactions = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    let minTs = -Infinity;
    if (dateRange === "30d") minTs = now - 30 * 24 * 60 * 60 * 1000;
    if (dateRange === "90d") minTs = now - 90 * 24 * 60 * 60 * 1000;

    return allTransactions.filter((tx) => {
      if (typeFilter !== "all" && tx.type !== typeFilter) return false;
      if (batchFilter !== "all") {
        const batchVal = tx.batchId || "general";
        if (batchVal !== batchFilter) return false;
      }
      if (new Date(tx.date).getTime() < minTs) return false;
      if (!q) return true;
      const text = `${tx.category} ${tx.description} ${batchNameMap[tx.batchId || ""] || "General"} ${new Date(tx.date).toLocaleDateString("en-NG")}`.toLowerCase();
      return text.includes(q);
    });
  }, [allTransactions, typeFilter, batchFilter, dateRange, search, batchNameMap]);

  useEffect(() => {
    setPage(1);
  }, [typeFilter, batchFilter, dateRange, search]);

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
  const paginatedTransactions = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredTransactions.slice(start, start + pageSize);
  }, [filteredTransactions, page, pageSize]);

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const totals = useMemo(() => {
    const expenses = filteredTransactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const revenue = filteredTransactions.filter((t) => t.type === "revenue").reduce((s, t) => s + t.amount, 0);
    const net = revenue - expenses;
    const roi = expenses > 0 ? ((net / expenses) * 100).toFixed(1) : "0.0";
    return { expenses, revenue, net, roi };
  }, [filteredTransactions]);

  const pieData = useMemo(() => {
    const expByCategory: Record<string, number> = {};
    filteredTransactions.filter((t) => t.type === "expense").forEach((t) => {
      expByCategory[t.category] = (expByCategory[t.category] || 0) + t.amount;
    });
    return Object.entries(expByCategory).map(([name, value]) => ({ name, value }));
  }, [filteredTransactions]);

  const profitabilityRows = useMemo(() => {
    const map: Record<string, { revenue: number; expense: number }> = {};
    for (const tx of filteredTransactions) {
      const key = tx.batchId || "general";
      if (!map[key]) map[key] = { revenue: 0, expense: 0 };
      if (tx.type === "revenue") map[key].revenue += tx.amount;
      else map[key].expense += tx.amount;
    }

    return Object.entries(map)
      .map(([batchId, v]) => ({
        batchId,
        batchName: batchId === "general" ? "General" : batchNameMap[batchId] || "Unknown Batch",
        revenue: v.revenue,
        expense: v.expense,
        net: v.revenue - v.expense,
      }))
      .sort((a, b) => b.net - a.net);
  }, [filteredTransactions, batchNameMap]);

  async function addExpense(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const entry: any = { ...eForm, amount: parseFloat(eForm.amount) };
    if (!entry.batchId) delete entry.batchId;

    try {
      const res = await fetch("/api/financials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "expense", entry }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to add expense");
      setData(payload);
      setEForm((f) => ({ ...f, description: "", amount: "" }));
    } catch (err: any) {
      setError(err?.message || "Failed to add expense");
    } finally {
      setSaving(false);
    }
  }

  async function addRevenue(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const totalAmount = parseFloat(rForm.weightKg || "0") * parseFloat(rForm.pricePerKg || "0");
    const entry: any = {
      ...rForm,
      fishSold: +rForm.fishSold,
      weightKg: +rForm.weightKg,
      pricePerKg: +rForm.pricePerKg,
      totalAmount,
    };
    if (!entry.batchId) delete entry.batchId;

    try {
      const res = await fetch("/api/financials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "revenue", entry }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to add revenue");
      setData(payload);
      setRForm((f) => ({ ...f, fishSold: "", weightKg: "", buyer: "" }));
    } catch (err: any) {
      setError(err?.message || "Failed to add revenue");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(tx: Transaction) {
    setEditingTx(tx);
    if (tx.type === "expense") {
      setEditTab("expense");
      const e = tx.raw as Expense;
      setEditExpense({
        category: e.category || "feed",
        description: e.description || "",
        amount: String(e.amount || 0),
        batchId: e.batchId || "",
        date: new Date(e.date).toISOString().split("T")[0],
      });
    } else {
      setEditTab("revenue");
      const r = tx.raw as Revenue;
      setEditRevenue({
        fishSold: String(r.fishSold || 0),
        weightKg: String(r.weightKg || 0),
        pricePerKg: String(r.pricePerKg || 0),
        buyer: r.buyer || "",
        channel: r.channel || "POK",
        batchId: r.batchId || "",
        date: new Date(r.date).toISOString().split("T")[0],
      });
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTx?.id) return;
    setSaving(true);
    setError("");

    try {
      if (editTab === "expense") {
        const entry: any = { ...editExpense, amount: parseFloat(editExpense.amount), date: editExpense.date };
        if (!entry.batchId) delete entry.batchId;
        const res = await fetch(`/api/financials/entries/${editingTx.id}?type=expense`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entry),
        });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload?.error || "Failed to update expense");
        setData(payload);
      } else {
        const totalAmount = parseFloat(editRevenue.weightKg || "0") * parseFloat(editRevenue.pricePerKg || "0");
        const entry: any = {
          ...editRevenue,
          fishSold: +editRevenue.fishSold,
          weightKg: +editRevenue.weightKg,
          pricePerKg: +editRevenue.pricePerKg,
          totalAmount,
          date: editRevenue.date,
        };
        if (!entry.batchId) delete entry.batchId;
        const res = await fetch(`/api/financials/entries/${editingTx.id}?type=revenue`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entry),
        });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload?.error || "Failed to update revenue");
        setData(payload);
      }
      setEditingTx(null);
    } catch (err: any) {
      setError(err?.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deletingTx?.id) return;
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/financials/entries/${deletingTx.id}?type=${deletingTx.type}`, {
        method: "DELETE",
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to delete transaction");
      setData(payload);
      setDeletingTx(null);
    } catch (err: any) {
      setError(err?.message || "Failed to delete transaction");
    } finally {
      setSaving(false);
    }
  }

  function exportCSV() {
    const rows = [
      ["Type", "Date", "Batch", "Category/Channel", "Description", "Amount"],
      ...filteredTransactions.map((tx) => [
        tx.type,
        new Date(tx.date).toISOString().split("T")[0],
        tx.batchId ? (batchNameMap[tx.batchId] || "Unknown") : "General",
        tx.category,
        tx.description,
        String(tx.amount),
      ]),
    ];
    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financials-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 text-pond-400 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-semibold text-pond-100">Financials</h1>
          <p className="text-pond-200/75 text-sm mt-1">Track costs, revenue and profitability</p>
        </div>
        <button className="btn-secondary" onClick={exportCSV}>
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {error && (
        <div className="rounded-xl px-4 py-3 text-sm text-danger border border-red-400/30 bg-red-500/10">{error}</div>
      )}

      <div className="glass-card p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <select className="field" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)}>
          <option value="all">All types</option>
          <option value="expense">Expenses</option>
          <option value="revenue">Revenue</option>
        </select>
        <select className="field" value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}>
          <option value="all">All batches</option>
          <option value="general">General</option>
          {batches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
        </select>
        <select className="field" value={dateRange} onChange={(e) => setDateRange(e.target.value as any)}>
          <option value="all">All time</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
        </select>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-pond-300" />
          <input className="field pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search transactions" />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Revenue", value: formatNaira(totals.revenue), color: "var(--success)", icon: TrendingUp },
          { label: "Total Expenses", value: formatNaira(totals.expenses), color: "var(--danger)", icon: TrendingDown },
          { label: "Net Profit", value: formatNaira(totals.net), color: totals.net >= 0 ? "var(--success)" : "var(--danger)", icon: DollarSign },
          { label: "ROI", value: `${totals.roi}%`, color: +totals.roi >= 0 ? "var(--success)" : "var(--danger)", icon: TrendingUp },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="stat-card">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-pond-200/75 uppercase tracking-wider font-medium">{label}</p>
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <p className="font-mono font-semibold text-lg" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-5 space-y-4">
          <div className="flex rounded-xl p-1" style={{ background: "rgba(12, 12, 14,0.6)" }}>
            {(["expense", "revenue"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all capitalize ${tab === t ? "text-white" : "text-pond-200/75 hover:text-pond-300"}`}
                style={tab === t ? { background: t === "expense" ? "linear-gradient(135deg,#7f1d1d,#991b1b)" : "linear-gradient(135deg,#4b5563,#374151)" } : {}}
              >
                {t === "expense" ? "Add Expense" : "Record Sale"}
              </button>
            ))}
          </div>

          {tab === "expense" ? (
            <form onSubmit={addExpense} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Category</label>
                  <select className="field" value={eForm.category} onChange={(e) => setEForm((f) => ({ ...f, category: e.target.value }))}>
                    {EXPENSE_CATS.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Amount (₦)</label>
                  <input className="field" type="number" required min={1} placeholder="0" value={eForm.amount} onChange={(e) => setEForm((f) => ({ ...f, amount: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-pond-300 mb-1.5 font-medium">Description</label>
                <input className="field" placeholder="e.g. Aller Aqua 15kg bags × 3" value={eForm.description} onChange={(e) => setEForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-pond-300 mb-1.5 font-medium">Batch (optional)</label>
                <select className="field" value={eForm.batchId} onChange={(e) => setEForm((f) => ({ ...f, batchId: e.target.value }))}>
                  <option value="">All / General</option>
                  {batches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
                </select>
              </div>
              <button type="submit" disabled={saving} className="btn-primary w-full" style={{ background: "linear-gradient(135deg,#7f1d1d,#dc2626)" }}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add Expense
              </button>
            </form>
          ) : (
            <form onSubmit={addRevenue} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Fish Sold</label>
                  <input className="field" type="number" required min={0} placeholder="0" value={rForm.fishSold} onChange={(e) => setRForm((f) => ({ ...f, fishSold: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Weight (kg)</label>
                  <input className="field" type="number" step="0.1" min={0} placeholder="0.0" value={rForm.weightKg} onChange={(e) => setRForm((f) => ({ ...f, weightKg: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Price/kg (₦)</label>
                  <input className="field" type="number" min={0} placeholder="2800" value={rForm.pricePerKg} onChange={(e) => setRForm((f) => ({ ...f, pricePerKg: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Buyer</label>
                  <input className="field" placeholder="e.g. Mama Nkechi POK" value={rForm.buyer} onChange={(e) => setRForm((f) => ({ ...f, buyer: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Channel</label>
                  <select className="field" value={rForm.channel} onChange={(e) => setRForm((f) => ({ ...f, channel: e.target.value }))}>
                    {CHANNELS.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-pond-300 mb-1.5 font-medium">Batch (optional)</label>
                <select className="field" value={rForm.batchId} onChange={(e) => setRForm((f) => ({ ...f, batchId: e.target.value }))}>
                  <option value="">All / General</option>
                  {batches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
                </select>
              </div>
              <button type="submit" disabled={saving} className="btn-primary w-full">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Record Sale
              </button>
            </form>
          )}
        </div>

        <div className="chart-wrap">
          <h2 className="section-title mb-4">Expense Breakdown</h2>
          {pieData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-pond-200/60 text-sm">No expenses recorded yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                  {pieData.map((entry, i) => <Cell key={i} fill={CAT_COLORS[entry.name] || "#6b7280"} />)}
                </Pie>
                <Tooltip
                  formatter={(v: any) => formatNaira(v)}
                  contentStyle={{ background: "#111317", border: "1px solid rgba(148, 163, 184, 0.35)", borderRadius: "12px", fontSize: "12px" }}
                  labelStyle={{ color: "rgba(229, 231, 235, 0.7)" }}
                  itemStyle={{ color: "#f3f4f6" }}
                />
                <Legend formatter={(v) => <span style={{ color: "rgba(232,245,238,0.7)", fontSize: "11px" }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 border-b border-pond-700/20">
          <h2 className="section-title">Per-Batch Profitability</h2>
        </div>
        {profitabilityRows.length === 0 ? (
          <div className="p-6 text-center text-pond-200/65 text-sm">No data for selected filters</div>
        ) : (
          <>
            <div className="md:hidden divide-y divide-pond-700/20">
              {profitabilityRows.map((r) => (
                <div key={r.batchId} className="p-4 space-y-2">
                  <p className="text-sm text-pond-200 font-medium">{r.batchName}</p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <p className="text-pond-200/70">Revenue<br /><span className="font-mono text-success">{formatNaira(r.revenue)}</span></p>
                    <p className="text-pond-200/70">Expenses<br /><span className="font-mono text-danger">{formatNaira(r.expense)}</span></p>
                    <p className="text-pond-200/70">Net<br /><span className={`font-mono ${r.net >= 0 ? "text-success" : "text-danger"}`}>{formatNaira(r.net)}</span></p>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Batch</th><th>Revenue</th><th>Expenses</th><th>Net</th></tr></thead>
                <tbody>
                  {profitabilityRows.map((r) => (
                    <tr key={r.batchId}>
                      <td className="text-xs">{r.batchName}</td>
                      <td className="font-mono text-success">{formatNaira(r.revenue)}</td>
                      <td className="font-mono text-danger">{formatNaira(r.expense)}</td>
                      <td className={`font-mono ${r.net >= 0 ? "text-success" : "text-danger"}`}>{formatNaira(r.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 border-b border-pond-700/20">
          <h2 className="section-title">Recent Transactions</h2>
        </div>
        <div className="md:hidden divide-y divide-pond-700/20">
          {paginatedTransactions.map((tx, i) => (
            <div key={`${tx.id || "noid"}-${i}`} className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className={`badge ${tx.type === "revenue" ? "badge-green" : "badge-red"}`}>{tx.type === "revenue" ? "Sale" : "Expense"}</span>
                <p className="text-xs text-pond-200/65 font-mono">{new Date(tx.date).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <p className="text-pond-200/70">Batch: <span className="text-pond-200">{tx.batchId ? (batchNameMap[tx.batchId] || "Unknown") : "General"}</span></p>
                <p className="text-pond-200/70">Category: <span className="text-pond-200 capitalize">{tx.category || "—"}</span></p>
              </div>
              <p className="text-xs text-pond-400/70">{tx.description || "—"}</p>
              <p className={`font-mono text-sm font-medium ${tx.type === "revenue" ? "text-success" : "text-danger"}`}>
                {tx.type === "revenue" ? "+" : "-"}{formatNaira(tx.amount || 0)}
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button className="btn-secondary !px-2.5 !py-1.5 text-xs" onClick={() => openEdit(tx)} disabled={!tx.id}>
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                <button className="btn-secondary !px-2.5 !py-1.5 text-xs text-danger" onClick={() => setDeletingTx(tx)} disabled={!tx.id}>
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden md:block overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Type</th><th>Batch</th><th>Category</th><th>Description</th><th>Amount</th><th>Date</th><th>Actions</th></tr></thead>
            <tbody>
              {paginatedTransactions.map((tx, i) => (
                <tr key={`${tx.id || "noid"}-${i}`}>
                  <td><span className={`badge ${tx.type === "revenue" ? "badge-green" : "badge-red"}`}>{tx.type === "revenue" ? "Sale" : "Expense"}</span></td>
                  <td className="text-xs">{tx.batchId ? (batchNameMap[tx.batchId] || "Unknown") : "General"}</td>
                  <td className="text-xs capitalize">{tx.category || "—"}</td>
                  <td className="text-xs text-pond-400/70">{tx.description || "—"}</td>
                  <td className={`font-mono text-sm font-medium ${tx.type === "revenue" ? "text-success" : "text-danger"}`}>
                    {tx.type === "revenue" ? "+" : "-"}{formatNaira(tx.amount || 0)}
                  </td>
                  <td className="text-xs text-pond-200/65 font-mono">{new Date(tx.date).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button className="btn-secondary !px-2 !py-1 text-xs" onClick={() => openEdit(tx)} disabled={!tx.id}><Pencil className="w-3.5 h-3.5" /></button>
                      <button className="btn-secondary !px-2 !py-1 text-xs text-danger" onClick={() => setDeletingTx(tx)} disabled={!tx.id}><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredTransactions.length > 0 && (
          <div className="px-5 py-3 border-t border-pond-700/20 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-pond-200/65">
              Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, filteredTransactions.length)} of {filteredTransactions.length}
            </p>
            <div className="flex items-center gap-2">
              <select
                className="field !h-8 !py-1 text-xs"
                value={pageSize}
                onChange={(e) => setPageSize(parseInt(e.target.value, 10))}
              >
                <option value={15}>15 / page</option>
                <option value={30}>30 / page</option>
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

      {editingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(12, 12, 14,0.85)", backdropFilter: "blur(8px)" }}>
          <div className="glass-card w-full max-w-xl max-h-[85vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg text-pond-100">Edit Transaction</h2>
              <button onClick={() => setEditingTx(null)} className="text-pond-200/75 hover:text-pond-300"><X className="w-5 h-5" /></button>
            </div>

            {editTab === "expense" ? (
              <form onSubmit={saveEdit} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-pond-300 mb-1.5 font-medium">Category</label>
                    <select className="field" value={editExpense.category} onChange={(e) => setEditExpense((f) => ({ ...f, category: e.target.value }))}>
                      {EXPENSE_CATS.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-pond-300 mb-1.5 font-medium">Amount</label>
                    <input className="field" type="number" min={1} value={editExpense.amount} onChange={(e) => setEditExpense((f) => ({ ...f, amount: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Description</label>
                  <input className="field" value={editExpense.description} onChange={(e) => setEditExpense((f) => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-pond-300 mb-1.5 font-medium">Batch</label>
                    <select className="field" value={editExpense.batchId} onChange={(e) => setEditExpense((f) => ({ ...f, batchId: e.target.value }))}>
                      <option value="">General</option>
                      {batches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-pond-300 mb-1.5 font-medium">Date</label>
                    <input className="field" type="date" value={editExpense.date} onChange={(e) => setEditExpense((f) => ({ ...f, date: e.target.value }))} />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setEditingTx(null)} className="btn-secondary flex-1">Cancel</button>
                  <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}</button>
                </div>
              </form>
            ) : (
              <form onSubmit={saveEdit} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-pond-300 mb-1.5 font-medium">Fish Sold</label>
                    <input className="field" type="number" min={0} value={editRevenue.fishSold} onChange={(e) => setEditRevenue((f) => ({ ...f, fishSold: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs text-pond-300 mb-1.5 font-medium">Weight Kg</label>
                    <input className="field" type="number" min={0} step="0.1" value={editRevenue.weightKg} onChange={(e) => setEditRevenue((f) => ({ ...f, weightKg: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs text-pond-300 mb-1.5 font-medium">Price/Kg</label>
                    <input className="field" type="number" min={0} value={editRevenue.pricePerKg} onChange={(e) => setEditRevenue((f) => ({ ...f, pricePerKg: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-pond-300 mb-1.5 font-medium">Buyer</label>
                    <input className="field" value={editRevenue.buyer} onChange={(e) => setEditRevenue((f) => ({ ...f, buyer: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs text-pond-300 mb-1.5 font-medium">Channel</label>
                    <select className="field" value={editRevenue.channel} onChange={(e) => setEditRevenue((f) => ({ ...f, channel: e.target.value }))}>
                      {CHANNELS.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-pond-300 mb-1.5 font-medium">Batch</label>
                    <select className="field" value={editRevenue.batchId} onChange={(e) => setEditRevenue((f) => ({ ...f, batchId: e.target.value }))}>
                      <option value="">General</option>
                      {batches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-pond-300 mb-1.5 font-medium">Date</label>
                    <input className="field" type="date" value={editRevenue.date} onChange={(e) => setEditRevenue((f) => ({ ...f, date: e.target.value }))} />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setEditingTx(null)} className="btn-secondary flex-1">Cancel</button>
                  <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {deletingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(12, 12, 14,0.85)", backdropFilter: "blur(8px)" }}>
          <div className="glass-card w-full max-w-md max-h-[85vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg text-pond-100">Delete Transaction</h2>
              <button onClick={() => setDeletingTx(null)} className="text-pond-200/75 hover:text-pond-300"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-pond-200/75">Delete this transaction permanently?</p>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setDeletingTx(null)} className="btn-secondary flex-1">Cancel</button>
              <button type="button" onClick={confirmDelete} disabled={saving} className="btn-primary flex-1 bg-red-700 hover:bg-red-600">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
