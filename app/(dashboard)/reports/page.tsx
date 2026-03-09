"use client";
import { useEffect, useMemo, useState } from "react";
import { Loader2, AlertTriangle, TrendingUp, Droplets, Fish } from "lucide-react";
import { formatNaira } from "@/lib/utils";
import { BarChart, Bar, ResponsiveContainer, Tooltip, CartesianGrid, XAxis, YAxis, LineChart, Line } from "recharts";

type Summary = {
  totalRevenue: number;
  totalExpenses: number;
  net: number;
  feedKg: number;
  mortality: number;
  fishAlive: number;
  survivalRate: number;
  avgPh: number | null;
  avgAmmonia: number | null;
  avgTemp: number | null;
  waterRiskLogs: number;
  purchasedKg: number;
  purchasedCost: number;
  remainingFeedKg: number;
  activeBatches: number;
  harvestedBatches: number;
};

type MonthlyRow = {
  month: string;
  revenue: number;
  expense: number;
  mortality: number;
  feed: number;
};

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [range, setRange] = useState<"30d" | "90d" | "all">("90d");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [monthly, setMonthly] = useState<MonthlyRow[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/reports/summary?range=${range}`);
        const payload = await res.json();
        if (!res.ok) throw new Error(payload?.error || "Failed to load reports");
        if (!active) return;
        setSummary(payload?.summary || null);
        setMonthly(Array.isArray(payload?.monthly) ? payload.monthly : []);
      } catch (err: any) {
        if (active) setError(err?.message || "Unable to load reports");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [range]);

  const financialHealth = useMemo(() => {
    if (!summary) return "—";
    if (summary.net > 0) return "Profitable";
    if (summary.net === 0) return "Break-even";
    return "Investment phase";
  }, [summary]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-pond-400 animate-spin" />
      </div>
    );
  }

  if (!summary) {
    return <div className="glass-card p-8 text-sm text-pond-200/70">No report data available yet.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-semibold text-pond-100">Reports</h1>
          <p className="text-pond-200/75 text-sm mt-1">Cross-module performance snapshot (production, health, finances, feed)</p>
        </div>
        <div className="flex rounded-xl p-1" style={{ background: "rgba(12, 12, 14,0.6)" }}>
          {(["30d", "90d", "all"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`px-3 py-2 text-sm rounded-lg transition-all ${range === r ? "text-white" : "text-pond-200/75 hover:text-pond-300"}`}
              style={range === r ? { background: "linear-gradient(135deg,#4b5563,#374151)" } : {}}
            >
              {r === "all" ? "All Time" : r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="rounded-xl px-4 py-3 text-sm text-danger border border-red-400/30 bg-red-500/10">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card">
          <p className="text-xs text-pond-200/75 uppercase tracking-wider mb-2">Net Result</p>
          <p className={`font-mono text-2xl font-semibold ${summary.net >= 0 ? "text-success" : "text-danger"}`}>{formatNaira(summary.net)}</p>
          <p className="text-xs text-pond-200/65 mt-1">{financialHealth}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-pond-200/75 uppercase tracking-wider mb-2">Survival Rate</p>
          <p className={`font-mono text-2xl font-semibold ${summary.survivalRate >= 85 ? "text-success" : "text-warning"}`}>{summary.survivalRate.toFixed(1)}%</p>
          <p className="text-xs text-pond-200/65 mt-1">{summary.fishAlive.toLocaleString()} fish alive</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-pond-200/75 uppercase tracking-wider mb-2">Feed Used</p>
          <p className="font-mono text-2xl font-semibold text-water-300">{summary.feedKg.toFixed(1)}kg</p>
          <p className="text-xs text-pond-200/65 mt-1">{summary.remainingFeedKg.toFixed(1)}kg remaining</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-pond-200/75 uppercase tracking-wider mb-2">Water Risk Logs</p>
          <p className={`font-mono text-2xl font-semibold ${summary.waterRiskLogs > 0 ? "text-danger" : "text-success"}`}>{summary.waterRiskLogs}</p>
          <p className="text-xs text-pond-200/65 mt-1">Avg pH {summary.avgPh ? summary.avgPh.toFixed(2) : "—"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="chart-wrap">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-pond-300" />
            <h2 className="section-title !text-base">Revenue vs Expense (Monthly)</h2>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184,0.1)" />
              <XAxis dataKey="month" tick={{ fill: "rgba(232,245,238,0.5)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgba(232,245,238,0.5)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: any) => formatNaira(Number(v || 0))} />
              <Bar dataKey="revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" fill="#f87171" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-wrap">
          <div className="flex items-center gap-2 mb-3">
            <Droplets className="w-4 h-4 text-water-300" />
            <h2 className="section-title !text-base">Feed vs Mortality Trend</h2>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184,0.1)" />
              <XAxis dataKey="month" tick={{ fill: "rgba(232,245,238,0.5)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgba(232,245,238,0.5)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Line type="monotone" dataKey="feed" stroke="#75d7ff" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="mortality" stroke="#f87171" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass-card p-5 space-y-3">
        <h2 className="section-title !text-base">Operational Highlights</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl p-3" style={{ background: "rgba(12, 12, 14,0.5)", border: "1px solid rgba(148, 163, 184,0.12)" }}>
            <p className="text-xs text-pond-200/65">Active Batches</p>
            <p className="font-mono text-lg text-pond-200 mt-1">{summary.activeBatches}</p>
          </div>
          <div className="rounded-xl p-3" style={{ background: "rgba(12, 12, 14,0.5)", border: "1px solid rgba(148, 163, 184,0.12)" }}>
            <p className="text-xs text-pond-200/65">Harvested Batches</p>
            <p className="font-mono text-lg text-pond-200 mt-1">{summary.harvestedBatches}</p>
          </div>
          <div className="rounded-xl p-3" style={{ background: "rgba(12, 12, 14,0.5)", border: "1px solid rgba(148, 163, 184,0.12)" }}>
            <p className="text-xs text-pond-200/65">Mortality</p>
            <p className="font-mono text-lg text-danger mt-1">{summary.mortality.toLocaleString()}</p>
          </div>
          <div className="rounded-xl p-3" style={{ background: "rgba(12, 12, 14,0.5)", border: "1px solid rgba(148, 163, 184,0.12)" }}>
            <p className="text-xs text-pond-200/65">Avg Temp</p>
            <p className="font-mono text-lg text-pond-200 mt-1">{summary.avgTemp != null ? `${summary.avgTemp.toFixed(1)}°C` : "—"}</p>
          </div>
        </div>
      </div>

      {summary.waterRiskLogs > 0 && (
        <div className="glass-card p-4 flex items-start gap-3 border border-red-400/25">
          <AlertTriangle className="w-4 h-4 text-danger mt-0.5" />
          <p className="text-sm text-pond-200/80">
            {summary.waterRiskLogs} water-quality risk logs in selected range. Prioritize pH/ammonia checks and corrective actions.
          </p>
        </div>
      )}

      <div className="glass-card p-4 flex items-start gap-3">
        <Fish className="w-4 h-4 text-water-300 mt-0.5" />
        <p className="text-sm text-pond-200/80">
          Report scope: <span className="font-semibold text-pond-200">{range === "all" ? "All Time" : range.toUpperCase()}</span>. Use this page for weekly review and decision tracking.
        </p>
      </div>
    </div>
  );
}

