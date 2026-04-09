"use client";
import { useEffect, useMemo, useState } from "react";
import { Loader2, AlertTriangle, TrendingUp, Droplets, Fish, Download } from "lucide-react";
import { formatNaira } from "@/lib/utils";
import { BarChart, Bar, ResponsiveContainer, Tooltip, CartesianGrid, XAxis, YAxis, LineChart, Line } from "recharts";
import CurrentPlanBadge from "@/components/billing/CurrentPlanBadge";
import { formatDateNg } from "@/lib/dates";

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
  avgDissolvedO2: number | null;
  waterRiskLogs: number;
  growthSampleCount: number;
  latestGrowthSampleAt: string | null;
  latestAvgWeight: number | null;
  latestFishCount: number | null;
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

type BatchPerformanceRow = {
  batchId: string;
  batchName: string;
  status: string;
  initialCount: number;
  currentCount: number;
  feedKg: number;
  mortality: number;
  waterRiskLogs: number;
  revenue: number;
  harvestedKg: number;
  survivalRate: number;
  feedPerFishKg: number;
  avgPricePerKg: number;
  readinessScore: number;
  readinessStatus: "growing" | "approaching" | "ready";
  latestAvgWeight: number | null;
  latestFishCount: number | null;
  latestGrowthDate: string | null;
  targetWeight: number | null;
  weightProgressPct: number | null;
  daysToTargetHarvest: number | null;
  cycleProgressPct: number;
};

type ChannelPerformanceRow = {
  channel: string;
  revenue: number;
  weightKg: number;
  fishSold: number;
  records: number;
};

type AdvancedPayload = {
  batchPerformance: BatchPerformanceRow[];
  channelPerformance: ChannelPerformanceRow[];
  riskHotspots: BatchPerformanceRow[];
  harvestReadiness: BatchPerformanceRow[];
  generatedAt: string;
  batchesAnalyzed: number;
};

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [range, setRange] = useState<"30d" | "90d" | "all">("90d");
  const [planRestricted, setPlanRestricted] = useState(false);
  const [canExport, setCanExport] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [granularity, setGranularity] = useState<"daily" | "weekly" | "monthly">("monthly");
  const [canAdvancedReporting, setCanAdvancedReporting] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [monthly, setMonthly] = useState<MonthlyRow[]>([]);
  const [advanced, setAdvanced] = useState<AdvancedPayload | null>(null);
  const isFreeReports = !canExport;

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
        setPlanRestricted(Boolean(payload?.planRestricted));
        setCanExport(Boolean(payload?.canExport));
        setCanAdvancedReporting(Boolean(payload?.canAdvancedReporting));
        setGranularity((payload?.granularity as any) || "monthly");
        if (payload?.range && payload.range !== range) setRange(payload.range);
        setSummary(payload?.summary || null);
        setMonthly(Array.isArray(payload?.monthly) ? payload.monthly : []);
        setAdvanced(payload?.advanced || null);
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
  const reportScopeLabel = range === "all" ? "All Time" : range.toUpperCase();

  async function exportCsv() {
    if (!canExport) return;
    setExporting(true);
    setError("");
    try {
      const res = await fetch(`/api/reports/export?range=${range}`);
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || "Failed to export report");
      }
      const blob = await res.blob();
      const contentDisposition = res.headers.get("content-disposition") || "";
      const match = contentDisposition.match(/filename=\"?([^\";]+)\"?/i);
      const filename = match?.[1] || `aquafarm-report-${range}.csv`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message || "Failed to export report");
    } finally {
      setExporting(false);
    }
  }

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
          <p className="text-pond-200/75 text-sm mt-1">Review production, health, feed, and financial performance together in one decision view.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <CurrentPlanBadge />
          <button
            type="button"
            className="btn-secondary !px-3.5 !py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={exportCsv}
            disabled={!canExport || exporting}
            title={!canExport ? "Export is available on Pro and Commercial plans" : "Export report as CSV"}
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exporting ? "Exporting..." : "Export CSV"}
          </button>
          <div className="flex rounded-xl p-1" style={{ background: "rgba(12, 12, 14,0.6)" }}>
          {(["30d", "90d", "all"] as const).map((r) => {
            const lockedForFree = isFreeReports && r !== "30d";
            return (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              disabled={lockedForFree}
              className={`px-3 py-2 text-sm rounded-lg transition-all ${range === r ? "text-white" : "text-pond-200/75 hover:text-pond-300"}`}
              style={range === r ? { background: "linear-gradient(135deg,#4b5563,#374151)" } : {}}
              title={lockedForFree ? "Upgrade to Pro to unlock 90-day and all-time reports" : undefined}
            >
              {r === "all" ? "All Time" : r.toUpperCase()}
            </button>
          )})}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-water-300/20 bg-[rgba(6,75,113,0.18)] px-4 py-3 text-sm text-pond-100">
        <p className="font-medium">Quick guide</p>
        <p className="mt-1 text-pond-200/75">
          Use this page to compare survival, feed usage, water-risk pressure, and money flow over the same report period before making your next farm decision.
        </p>
      </div>

      {error && <div className="rounded-xl px-4 py-3 text-sm text-danger border border-red-400/30 bg-red-500/10">{error}</div>}
      {planRestricted ? (
        <div className="rounded-xl px-4 py-3 text-sm border border-amber-400/30 bg-amber-500/10 text-amber-200">
          Free plan is limited to 30-day report history. Upgrade for 90-day and all-time reports.
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="glass-card px-4 py-3">
          <p className="text-xs text-pond-200/65 uppercase tracking-wider">Report Scope</p>
          <p className="mt-2 text-2xl font-display text-pond-100">{reportScopeLabel}</p>
          <p className="text-xs text-pond-200/65 mt-1">The selected period for the numbers and charts on this page.</p>
        </div>
        <div className="glass-card px-4 py-3">
          <p className="text-xs text-pond-200/65 uppercase tracking-wider">Financial Health</p>
          <p className={`mt-2 text-2xl font-display ${summary.net >= 0 ? "text-success" : "text-danger"}`}>{financialHealth}</p>
          <p className="text-xs text-pond-200/65 mt-1">Based on revenue minus expenses in the selected period.</p>
        </div>
        <div className="glass-card px-4 py-3">
          <p className="text-xs text-pond-200/65 uppercase tracking-wider">Active Survival</p>
          <p className={`mt-2 text-2xl font-display ${summary.survivalRate >= 85 ? "text-success" : "text-warning"}`}>
            {summary.survivalRate.toFixed(1)}%
          </p>
          <p className="text-xs text-pond-200/65 mt-1">Live snapshot of survival across currently active fish.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card">
          <p className="text-xs text-pond-200/75 uppercase tracking-wider mb-2">Net Result</p>
          <p className={`font-mono text-2xl font-semibold ${summary.net >= 0 ? "text-success" : "text-danger"}`}>{formatNaira(summary.net)}</p>
          <p className="text-xs text-pond-200/65 mt-1">{financialHealth}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-pond-200/75 uppercase tracking-wider mb-2">Current Survival</p>
          <p className={`font-mono text-2xl font-semibold ${summary.survivalRate >= 85 ? "text-success" : "text-warning"}`}>{summary.survivalRate.toFixed(1)}%</p>
          <p className="text-xs text-pond-200/65 mt-1">{summary.fishAlive.toLocaleString()} fish alive right now</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-pond-200/75 uppercase tracking-wider mb-2">Feed Used</p>
          <p className="font-mono text-2xl font-semibold text-water-300">{summary.feedKg.toFixed(1)}kg</p>
          <p className="text-xs text-pond-200/65 mt-1">{summary.remainingFeedKg.toFixed(1)}kg remaining</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-pond-200/75 uppercase tracking-wider mb-2">Water Risk Logs</p>
          <p className={`font-mono text-2xl font-semibold ${summary.waterRiskLogs > 0 ? "text-danger" : "text-success"}`}>{summary.waterRiskLogs}</p>
          <p className="text-xs text-pond-200/65 mt-1">
            Avg pH {summary.avgPh != null ? summary.avgPh.toFixed(2) : "—"} · Avg DO {summary.avgDissolvedO2 != null ? `${summary.avgDissolvedO2.toFixed(1)} mg/L` : "—"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="chart-wrap">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-pond-300" />
            <h2 className="section-title !text-base">
              Revenue vs Expense ({granularity === "daily" ? "Daily" : granularity === "weekly" ? "Weekly" : "Monthly"})
            </h2>
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
            <h2 className="section-title !text-base">
              Feed vs Mortality Trend ({granularity === "daily" ? "Daily" : granularity === "weekly" ? "Weekly" : "Monthly"})
            </h2>
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
        <p className="text-xs text-pond-200/65">
          Current survival is a live farm snapshot. Revenue, feed, mortality, and charts follow the selected report range.
        </p>
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
            <p className="text-xs text-pond-200/65">Growth Samples</p>
            <p className="font-mono text-lg text-pond-200 mt-1">{summary.growthSampleCount}</p>
            <p className="text-xs text-pond-200/65 mt-1">
              {summary.latestGrowthSampleAt ? `Latest ${formatDateNg(summary.latestGrowthSampleAt)}` : "No recent growth check"}
            </p>
          </div>
          <div className="rounded-xl p-3" style={{ background: "rgba(12, 12, 14,0.5)", border: "1px solid rgba(148, 163, 184,0.12)" }}>
            <p className="text-xs text-pond-200/65">Latest Growth Snapshot</p>
            <p className="font-mono text-lg text-pond-200 mt-1">
              {summary.latestAvgWeight != null ? `${summary.latestAvgWeight.toFixed(1)}g` : "—"}
            </p>
            <p className="text-xs text-pond-200/65 mt-1">
              {summary.latestFishCount != null ? `${summary.latestFishCount.toLocaleString()} fish counted` : "Add fish count to strengthen timing confidence"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="glass-card px-4 py-3">
          <p className="text-xs text-pond-200/65 uppercase tracking-wider">Water Stability</p>
          <p className="mt-2 text-2xl font-display text-pond-100">
            {summary.avgDissolvedO2 != null ? `${summary.avgDissolvedO2.toFixed(1)} mg/L` : "—"}
          </p>
          <p className="text-xs text-pond-200/65 mt-1">Average dissolved oxygen in the selected report range.</p>
        </div>
        <div className="glass-card px-4 py-3">
          <p className="text-xs text-pond-200/65 uppercase tracking-wider">Avg Temperature</p>
          <p className="mt-2 text-2xl font-display text-pond-100">{summary.avgTemp != null ? `${summary.avgTemp.toFixed(1)}°C` : "—"}</p>
          <p className="text-xs text-pond-200/65 mt-1">Useful for spotting shifts that can affect appetite and oxygen stress.</p>
        </div>
        <div className="glass-card px-4 py-3">
          <p className="text-xs text-pond-200/65 uppercase tracking-wider">Mortality In Range</p>
          <p className="mt-2 text-2xl font-display text-danger">{summary.mortality.toLocaleString()}</p>
          <p className="text-xs text-pond-200/65 mt-1">Confirmed deaths recorded during the selected reporting period.</p>
        </div>
      </div>

      {canAdvancedReporting && advanced ? (
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="section-title !text-base">Advanced Reporting (Commercial)</h2>
            <p className="text-xs text-pond-200/65">
              {advanced.batchesAnalyzed} batches · generated {formatDateNg(advanced.generatedAt)}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="rounded-xl border border-pond-700/30 bg-black/20 p-4 lg:col-span-2">
              <p className="text-xs uppercase tracking-wider text-pond-300 mb-2">Batch Performance</p>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Batch</th>
                      <th>Status</th>
                      <th>Survival</th>
                      <th>Feed (kg)</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {advanced.batchPerformance.slice(0, 8).map((row) => (
                      <tr key={row.batchId}>
                        <td className="text-xs">{row.batchName}</td>
                        <td className="text-xs capitalize">{row.status}</td>
                        <td className="font-mono text-xs">{row.survivalRate.toFixed(1)}%</td>
                        <td className="font-mono text-xs">{row.feedKg.toFixed(1)}</td>
                        <td className="font-mono text-xs text-success">{formatNaira(row.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl border border-pond-700/30 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-wider text-pond-300 mb-2">Risk Hotspots</p>
              {advanced.riskHotspots.length === 0 ? (
                <p className="text-sm text-pond-200/70">No water-risk hotspots in selected range.</p>
              ) : (
                <div className="space-y-2">
                  {advanced.riskHotspots.slice(0, 6).map((row) => (
                    <div key={`risk-${row.batchId}`} className="rounded-lg border border-red-400/20 bg-red-500/5 px-3 py-2">
                      <p className="text-sm text-pond-100">{row.batchName}</p>
                      <p className="text-xs text-red-200 mt-0.5">{row.waterRiskLogs} risk logs</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-pond-700/30 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wider text-pond-300 mb-2">Channel Performance</p>
            {advanced.channelPerformance.length === 0 ? (
              <p className="text-sm text-pond-200/70">No harvest channel data in selected range.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                {advanced.channelPerformance.map((channel) => (
                  <div key={channel.channel} className="rounded-lg border border-pond-700/30 bg-black/20 px-3 py-2.5">
                    <p className="text-xs uppercase tracking-wider text-pond-300">{channel.channel}</p>
                    <p className="text-sm text-success font-mono mt-1">{formatNaira(channel.revenue)}</p>
                    <p className="text-xs text-pond-200/70 mt-1">
                      {channel.records} sale{channel.records > 1 ? "s" : ""} · {channel.weightKg.toFixed(1)}kg
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-pond-700/30 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wider text-pond-300 mb-2">Harvest Readiness</p>
            {advanced.harvestReadiness.length === 0 ? (
              <p className="text-sm text-pond-200/70">No active batches are ready for harvest analysis yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                {advanced.harvestReadiness.map((row) => (
                  <div key={`harvest-${row.batchId}`} className="rounded-lg border border-pond-700/30 bg-black/20 px-3 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-pond-100">{row.batchName}</p>
                      <span className={`badge ${row.readinessStatus === "ready" ? "badge-green" : row.readinessStatus === "approaching" ? "badge-amber" : "badge-water"}`}>
                        {row.readinessStatus}
                      </span>
                    </div>
                    <p className="mt-2 text-xl font-display text-pond-100">{row.readinessScore}%</p>
                    <div className="mt-2 space-y-1 text-xs text-pond-200/70">
                      <p>
                        Avg weight: <span className="font-mono text-pond-100">
                          {row.latestAvgWeight != null ? `${row.latestAvgWeight.toFixed(0)}g` : "—"}
                        </span>
                      </p>
                      <p>
                        Target: <span className="font-mono text-pond-100">
                          {row.targetWeight != null ? `${row.targetWeight.toFixed(0)}g` : "—"}
                        </span>
                      </p>
                      <p>
                        Timing: <span className="font-mono text-pond-100">
                          {row.daysToTargetHarvest == null ? "No date" : row.daysToTargetHarvest <= 0 ? "Due now" : `${row.daysToTargetHarvest}d left`}
                        </span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {summary.waterRiskLogs > 0 && (
        <div className="glass-card p-4 flex items-start gap-3 border border-red-400/25">
          <AlertTriangle className="w-4 h-4 text-danger mt-0.5" />
          <p className="text-sm text-pond-200/80">
            {summary.waterRiskLogs} water-quality risk logs in selected range. Prioritize pH, ammonia, and dissolved oxygen checks with corrective follow-up.
          </p>
        </div>
      )}

      <div className="glass-card p-4 flex items-start gap-3">
        <Fish className="w-4 h-4 text-water-300 mt-0.5" />
        <p className="text-sm text-pond-200/80">
          Report scope: <span className="font-semibold text-pond-200">{reportScopeLabel}</span>. Use this page for weekly review, not just record keeping.
        </p>
      </div>
    </div>
  );
}
