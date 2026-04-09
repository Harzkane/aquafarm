"use client";
import { useMemo, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { Fish, Droplets, TrendingUp, Package, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { formatNaira, calcSurvivalRate, weeksSince, getBatchPhase } from "@/lib/utils";
import Link from "next/link";
import CurrentPlanBadge from "@/components/billing/CurrentPlanBadge";
import { getPriorityWhatsAppHref } from "@/lib/support";

type DashboardTimeframe = "7" | "14" | "30" | "90";

interface ActionItem {
  level: "info" | "warning" | "danger";
  title: string;
  detail: string;
  href: string;
  category: "logging" | "planning" | "health" | "inventory" | "setup" | "harvest";
  actionLabel: string;
  whyNow: string;
}

type ChartPoint = {
  date: string;
  feed: number;
  mortality: number;
};

type TankHealthPoint = {
  date: string;
  feed: number;
  mortality: number;
  riskLogs: number;
  tanksLogged: number;
};

interface Props {
  totalFish: number; totalInitial: number; totalFeedToday: number;
  totalMortality30d: number; totalExpenses: number; totalRevenue: number;
  availableTimeframes: string[];
  activeBatches: number; totalTanks: number; chartDataByRange: Record<string, ChartPoint[]>;
  batchSummaries: Array<{
    batchId: string;
    totalFish: number;
    totalInitial: number;
    totalFeedToday: number;
    totalMortality30d: number;
    totalExpenses: number;
    totalRevenue: number;
    readinessScore: number;
    readinessStatus: "growing" | "approaching" | "ready";
    latestAvgWeight: number | null;
    latestFishCount: number | null;
    latestGrowthDate: string | null;
    targetWeight: number | null;
    weightProgressPct: number | null;
    daysToTargetHarvest: number | null;
    cycleProgressPct: number;
    chartDataByRange: Record<string, ChartPoint[]>;
  }>;
  batchReadiness: Array<{
    batchId: string;
    batchName: string;
    readinessScore: number;
    readinessStatus: "growing" | "approaching" | "ready";
    latestAvgWeight: number | null;
    latestFishCount: number | null;
    latestGrowthDate: string | null;
    targetWeight: number | null;
    weightProgressPct: number | null;
    daysToTargetHarvest: number | null;
    cycleProgressPct: number;
  }>;
  tankSnapshots: {
    all: Array<{
      tankId: string;
      tankName: string;
      currentFish: number;
      feedKg14d: number;
      mortality14d: number;
      waterRiskLogs: number;
      logCount: number;
    }>;
    byBatch: Record<string, Array<{
      tankId: string;
      tankName: string;
      currentFish: number;
      feedKg14d: number;
      mortality14d: number;
      waterRiskLogs: number;
      logCount: number;
    }>>;
  };
  tankHealthTrend: {
    all: Record<string, TankHealthPoint[]>;
    byBatch: Record<string, Record<string, TankHealthPoint[]>>;
  };
  recentMovements: Array<{
    id: string;
    batchId: string;
    batchName: string;
    fromTankName: string;
    toTankName: string;
    count: number;
    reason: string;
    date: string;
  }>;
  actions: ActionItem[];
  batches: any[]; tanks: any[]; farmName: string; userName: string;
  plan: "free" | "pro" | "commercial";
}

const FREE_LOCKED_ACTION_PREFIXES = ["/financials", "/harvest", "/calendar", "/playbook"];
const TIMEFRAME_OPTIONS: Array<{ value: DashboardTimeframe; label: string }> = [
  { value: "7", label: "7D" },
  { value: "14", label: "14D" },
  { value: "30", label: "30D" },
  { value: "90", label: "90D" },
];

function formatKg(value: number) {
  return Number(value || 0).toFixed(2);
}

function formatTooltipValue(item: any) {
  const value = Number(item?.value ?? 0);
  if (item?.dataKey === "feed" || /kg/i.test(String(item?.name || ""))) {
    return `${formatKg(value)}kg`;
  }
  return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2);
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card px-4 py-3 text-xs space-y-1">
      <p className="text-pond-300 font-medium">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: <span className="font-mono font-medium">{formatTooltipValue(p)}</span>
        </p>
      ))}
    </div>
  );
};

export default function DashboardClient({
  totalFish, totalInitial, totalFeedToday, totalMortality30d,
  totalExpenses, totalRevenue, activeBatches, totalTanks,
  availableTimeframes, chartDataByRange, batchSummaries, batchReadiness, tankSnapshots, tankHealthTrend, recentMovements, actions, batches, tanks, farmName, userName, plan,
}: Props) {
  const timeframeOptions = TIMEFRAME_OPTIONS.filter((option) => availableTimeframes.includes(option.value));
  const defaultTimeframe = (timeframeOptions[timeframeOptions.length - 1]?.value || "14") as DashboardTimeframe;
  const [selectedBatchId, setSelectedBatchId] = useState("all");
  const [selectedTimeframe, setSelectedTimeframe] = useState<DashboardTimeframe>(defaultTimeframe);
  const isFree = plan === "free";
  const communitySupportHref = process.env.NEXT_PUBLIC_COMMUNITY_SUPPORT_URL || "";
  const prioritySupportHref = getPriorityWhatsAppHref(plan, userName);
  const selectedBatchSummary = useMemo(
    () => batchSummaries.find((summary) => summary.batchId === selectedBatchId) || null,
    [batchSummaries, selectedBatchId],
  );
  const selectedBatchReadiness = useMemo(
    () => batchReadiness.find((summary) => summary.batchId === selectedBatchId) || null,
    [batchReadiness, selectedBatchId],
  );
  const selectedBatch = useMemo(
    () => batches.find((batch) => String(batch._id) === selectedBatchId) || null,
    [batches, selectedBatchId],
  );

  const scope = selectedBatchSummary
    ? {
        totalFish: selectedBatchSummary.totalFish,
        totalInitial: selectedBatchSummary.totalInitial,
        totalFeedToday: selectedBatchSummary.totalFeedToday,
        totalMortality30d: selectedBatchSummary.totalMortality30d,
        totalExpenses: selectedBatchSummary.totalExpenses,
        totalRevenue: selectedBatchSummary.totalRevenue,
        chartDataByRange: selectedBatchSummary.chartDataByRange,
      }
    : {
        totalFish,
        totalInitial,
        totalFeedToday,
        totalMortality30d,
        totalExpenses,
        totalRevenue,
        chartDataByRange,
      };

  const survivalRate = calcSurvivalRate(scope.totalFish, scope.totalInitial);
  const netProfit = scope.totalRevenue - scope.totalExpenses;
  const scopeLabel = selectedBatch ? selectedBatch.name : "All Farm";
  const scopedTanks = selectedBatch
    ? (tankSnapshots.byBatch[selectedBatchId] || [])
    : tankSnapshots.all;
  const busiestTank = scopedTanks[0] || null;
  const riskTank = [...scopedTanks].sort((a, b) => b.waterRiskLogs - a.waterRiskLogs || b.mortality14d - a.mortality14d)[0] || null;
  const atRiskTanks = [...scopedTanks]
    .map((tank) => ({
      ...tank,
      riskScore: tank.waterRiskLogs * 4 + tank.mortality14d * 2 + (tank.logCount === 0 && tank.currentFish > 0 ? 3 : 0),
    }))
    .sort((a, b) => b.riskScore - a.riskScore || b.mortality14d - a.mortality14d || b.currentFish - a.currentFish)
    .filter((tank) => tank.riskScore > 0)
    .slice(0, 3);
  const scopedMovements = recentMovements
    .filter((movement) => !selectedBatch || movement.batchId === selectedBatchId)
    .slice(0, 4);
  const activeTimeframe = availableTimeframes.includes(selectedTimeframe) ? selectedTimeframe : defaultTimeframe;
  const scopedTankHealthTrend = selectedBatch
    ? (tankHealthTrend.byBatch[selectedBatchId]?.[activeTimeframe] || [])
    : (tankHealthTrend.all[activeTimeframe] || []);
  const scopedChartData = scope.chartDataByRange[activeTimeframe] || [];
  const timeframeLabel = `Last ${activeTimeframe} Days`;
  const firstName = userName.split(" ")[0] || "there";

  const visibleActions = (isFree
    ? actions.filter((a) => !FREE_LOCKED_ACTION_PREFIXES.some((prefix) => a.href.startsWith(prefix)))
    : actions
  ).slice(0, 6);
  const urgentCount = visibleActions.filter((action) => action.level === "danger" || action.level === "warning").length;
  const dangerCount = visibleActions.filter((action) => action.level === "danger").length;
  const infoCount = visibleActions.filter((action) => action.level === "info").length;
  const todaySummary =
    batches.length === 0
      ? "Set up your first batch to start building a reliable operating record."
      : urgentCount > 0
        ? `${urgentCount} item${urgentCount === 1 ? "" : "s"} need attention today.`
        : "No urgent issues detected right now. Keep logging consistently.";
  const readinessFocus = selectedBatchReadiness || batchReadiness[0] || null;
  const readinessStatusLabel =
    readinessFocus?.readinessStatus === "ready"
      ? "Ready now"
      : readinessFocus?.readinessStatus === "approaching"
        ? "Approaching"
        : "Growing";
  const readinessStatusClass =
    readinessFocus?.readinessStatus === "ready"
      ? "badge-green"
      : readinessFocus?.readinessStatus === "approaching"
        ? "badge-amber"
        : "badge-water";

  const kpis = isFree ? [
    {
      label: "Fish Alive",
      value: scope.totalFish.toLocaleString(),
      sub: `of ${scope.totalInitial.toLocaleString()} stocked`,
      icon: Fish,
      color: "#9ca3af",
      glow: "rgba(69,184,128,0.2)",
    },
    {
      label: "Survival Rate",
      value: `${survivalRate}%`,
      sub: `${scope.totalMortality30d} deaths (30 days)`,
      icon: CheckCircle,
      color: Number(survivalRate) > 85 ? "#9ca3af" : Number(survivalRate) > 70 ? "#d3bf86" : "#f87171",
      glow: "rgba(69,184,128,0.15)",
    },
    {
      label: "Feed Today",
      value: `${formatKg(scope.totalFeedToday)}kg`,
      sub: selectedBatch ? `${selectedBatch.name} only` : "across all tanks",
      icon: Droplets,
      color: "#75d7ff",
      glow: "rgba(117,215,255,0.15)",
    },
    {
      label: "Mortality (30d)",
      value: scope.totalMortality30d.toLocaleString(),
      sub: "logged fish deaths",
      icon: AlertCircle,
      color: scope.totalMortality30d > 0 ? "#fbbf24" : "var(--success)",
      glow: "rgba(245, 158, 11, 0.18)",
    },
  ] : [
    {
      label: "Fish Alive",
      value: scope.totalFish.toLocaleString(),
      sub: `of ${scope.totalInitial.toLocaleString()} stocked`,
      icon: Fish,
      color: "#9ca3af",
      glow: "rgba(69,184,128,0.2)",
    },
    {
      label: "Survival Rate",
      value: `${survivalRate}%`,
      sub: `${scope.totalMortality30d} deaths (30 days)`,
      icon: CheckCircle,
      color: Number(survivalRate) > 85 ? "#9ca3af" : Number(survivalRate) > 70 ? "#d3bf86" : "#f87171",
      glow: "rgba(69,184,128,0.15)",
    },
    {
      label: "Feed Today",
      value: `${formatKg(scope.totalFeedToday)}kg`,
      sub: selectedBatch ? `${selectedBatch.name} only` : "across all tanks",
      icon: Droplets,
      color: "#75d7ff",
      glow: "rgba(117,215,255,0.15)",
    },
    {
      label: "Net Profit",
      value: formatNaira(netProfit),
      sub: selectedBatch
        ? netProfit >= 0
          ? `${selectedBatch.name} is profitable`
          : `${selectedBatch.name} is still in investment phase`
        : netProfit >= 0
          ? "Revenue ahead of costs"
          : "Still in investment phase",
      icon: TrendingUp,
      color: netProfit >= 0 ? "var(--success)" : "var(--danger)",
      glow: "rgba(69,184,128,0.15)",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-semibold text-pond-100">
            Good morning, {firstName} 👋
          </h1>
          <p className="text-pond-400/70 text-sm mt-1">{farmName}</p>
          <p className="text-pond-200/65 text-sm mt-2 max-w-2xl">{todaySummary}</p>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <CurrentPlanBadge />
          <Link href="/batches" className="badge badge-green hover:opacity-90 transition-opacity">
            <span className="w-1.5 h-1.5 rounded-full bg-pond-400 animate-pulse-slow" />
            {activeBatches} Active {activeBatches === 1 ? "Batch" : "Batches"}
          </Link>
          <Link href="/tanks" className="badge badge-water hover:opacity-90 transition-opacity">{totalTanks} Tanks</Link>
          {!isFree && prioritySupportHref ? (
            <a href={prioritySupportHref} target="_blank" rel="noreferrer" className="badge badge-green hover:opacity-90 transition-opacity">
              Priority support
            </a>
          ) : null}
        </div>
      </div>

      {/* Action required */}
      {visibleActions.length > 0 && (
        <div className="glass-card p-5 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-warning" />
              <h2 className="section-title !text-base">Command Center</h2>
            </div>
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="badge badge-red">{dangerCount} critical</span>
              <span className="badge badge-amber">{urgentCount - dangerCount} urgent</span>
              <span className="badge badge-water">{infoCount} planned</span>
            </div>
          </div>
          <p className="text-xs text-pond-200/65">
            Start here each day. These priorities are generated from logs, milestones, mortality, water risk, harvest timing, and feed stock.
          </p>
          <div className="space-y-2.5">
            {visibleActions.map((action, i) => (
              <Link
                key={`${action.title}-${i}`}
                href={action.href}
                className="block rounded-xl px-4 py-3 transition-colors"
                style={{ background: "rgba(12, 12, 14, 0.7)", border: "1px solid rgba(148, 163, 184, 0.16)" }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`badge text-[10px] ${
                        action.level === "danger" ? "badge-red" : action.level === "warning" ? "badge-amber" : "badge-water"
                      }`}>
                        {action.level === "danger" ? "Critical" : action.level === "warning" ? "Urgent" : "Planned"}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-pond-300">{action.category}</span>
                    </div>
                    <p
                      className={`text-sm font-medium mt-2 ${
                        action.level === "danger" ? "text-danger" : action.level === "warning" ? "text-warning" : "text-pond-100"
                      }`}
                    >
                      {action.title}
                    </p>
                  </div>
                  <span className="text-xs text-pond-200/65">{action.actionLabel}</span>
                </div>
                <p className="text-xs text-pond-200/65 mt-2">{action.detail}</p>
                <p className="text-[11px] text-pond-300 mt-1">Why now: {action.whyNow}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* KPI Grid */}
      <div className="glass-card p-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <div>
            <h2 className="section-title !text-base">Current View</h2>
            <p className="text-xs text-pond-200/65 mt-1">
              Cards and charts below are showing <span className="text-pond-100 font-medium">{scopeLabel}</span>.
            </p>
          </div>
          <div>
            <p className="text-xs text-pond-300 mb-1.5 font-medium">Timeframe</p>
            <div className="flex flex-wrap gap-2">
              {timeframeOptions.map((option) => {
                const active = activeTimeframe === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSelectedTimeframe(option.value)}
                    className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                      active ? "text-pond-100" : "text-pond-200/75 hover:text-pond-100"
                    }`}
                    style={{
                      background: active ? "rgba(117,215,255,0.16)" : "rgba(12, 12, 14, 0.5)",
                      border: active ? "1px solid rgba(117,215,255,0.4)" : "1px solid rgba(148, 163, 184, 0.12)",
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="w-full sm:w-72">
          <label className="block text-xs text-pond-300 mb-1.5 font-medium">Batch Filter</label>
          <select className="field" value={selectedBatchId} onChange={(e) => setSelectedBatchId(e.target.value)}>
            <option value="all">All Farm</option>
            {batches.map((batch: any) => (
              <option key={batch._id} value={String(batch._id)}>
                {batch.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {kpis.map(({ label, value, sub, icon: Icon, color, glow }) => (
          <div key={label} className="stat-card" style={{ boxShadow: `0 4px 24px ${glow}` }}>
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs text-pond-200/75 font-medium uppercase tracking-wider">{label}</p>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                   style={{ background: `${color}20` }}>
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
            </div>
            <p className="font-display text-xl lg:text-2xl font-semibold" style={{ color }}>{value}</p>
            <p className="text-xs text-pond-200/65 mt-1 leading-tight">{sub}</p>
          </div>
        ))}
      </div>

      {readinessFocus ? (
        <div className="glass-card p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="section-title !text-base">Harvest Readiness</h2>
              <p className="text-xs text-pond-200/65 mt-1">
                Uses recent growth samples, target weight, timing, and current survival to guide harvest review.
              </p>
            </div>
            <span className={`badge ${readinessStatusClass}`}>{readinessStatusLabel}</span>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-[1.2fr,0.8fr] gap-4">
            <div className="rounded-xl px-4 py-4" style={{ background: "rgba(12, 12, 14,0.45)", border: "1px solid rgba(148, 163, 184,0.1)" }}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-pond-100">{readinessFocus.batchName || selectedBatch?.name || scopeLabel}</p>
                  <p className="text-xs text-pond-200/65 mt-1">
                    {readinessFocus.latestGrowthDate
                      ? `Latest growth sample recorded ${new Date(readinessFocus.latestGrowthDate).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}.`
                      : "No recent growth sample recorded yet."}
                  </p>
                </div>
                <p className="font-display text-3xl text-pond-100">{readinessFocus.readinessScore}%</p>
              </div>
              <div className="progress-track mt-4">
                <div className="progress-fill" style={{ width: `${Math.min(readinessFocus.readinessScore, 100)}%` }} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-pond-200/70">
                <p>
                  Avg weight: <span className="font-mono text-pond-100">
                    {readinessFocus.latestAvgWeight != null ? `${readinessFocus.latestAvgWeight.toFixed(0)}g` : "—"}
                  </span>
                </p>
                <p>
                  Target: <span className="font-mono text-pond-100">
                    {readinessFocus.targetWeight != null ? `${readinessFocus.targetWeight.toFixed(0)}g` : "—"}
                  </span>
                </p>
                <p>
                  Weight progress: <span className="font-mono text-pond-100">
                    {readinessFocus.weightProgressPct != null ? `${Math.min(readinessFocus.weightProgressPct, 999).toFixed(0)}%` : "—"}
                  </span>
                </p>
                <p>
                  Last count: <span className="font-mono text-pond-100">
                    {readinessFocus.latestFishCount != null ? readinessFocus.latestFishCount.toLocaleString() : "—"}
                  </span>
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl px-4 py-3" style={{ background: "rgba(12, 12, 14,0.45)", border: "1px solid rgba(148, 163, 184,0.1)" }}>
                <p className="text-xs uppercase tracking-wider text-pond-300">Timing Signal</p>
                <p className="mt-1 text-sm text-pond-100">
                  {readinessFocus.daysToTargetHarvest == null
                    ? "No target harvest date set."
                    : readinessFocus.daysToTargetHarvest <= 0
                      ? "Target harvest date has arrived."
                      : `${readinessFocus.daysToTargetHarvest} day${readinessFocus.daysToTargetHarvest === 1 ? "" : "s"} to target harvest date.`}
                </p>
              </div>
              <div className="rounded-xl px-4 py-3" style={{ background: "rgba(12, 12, 14,0.45)", border: "1px solid rgba(148, 163, 184,0.1)" }}>
                <p className="text-xs uppercase tracking-wider text-pond-300">Next Best Move</p>
                <p className="mt-1 text-sm text-pond-100">
                  {readinessFocus.readinessStatus === "ready"
                    ? "Review harvest timing, buyers, and tank turnover now."
                    : readinessFocus.readinessStatus === "approaching"
                      ? "Record a fresh growth sample and confirm pricing options soon."
                      : "Keep feeding and sampling consistently until weight and timing move closer to target."}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {scopedTanks.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr,0.8fr] gap-4">
          <div className="chart-wrap">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="section-title">Tank Snapshot</h2>
                <p className="text-xs text-pond-200/65 mt-1">Live fish distribution with recent feed and mortality by tank.</p>
              </div>
              <Link href="/tanks" className="text-xs text-pond-300 hover:text-pond-100 transition-colors">
                Open tanks
              </Link>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={scopedTanks} layout="vertical" margin={{ top: 4, right: 12, left: 12, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184,0.1)" />
                <XAxis type="number" tick={{ fill: "rgba(232,245,238,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="tankName" type="category" width={110} tick={{ fill: "rgba(232,245,238,0.55)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="currentFish" name="Fish alive" fill="#75d7ff" radius={[0, 6, 6, 0]} opacity={0.9} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="glass-card p-5">
            <h2 className="section-title mb-4">Tank Highlights</h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-xl p-3" style={{ background: "rgba(12, 12, 14,0.5)", border: "1px solid rgba(148, 163, 184,0.12)" }}>
                <p className="text-xs text-pond-200/65 uppercase tracking-wider">Most Loaded</p>
                <p className="text-sm text-pond-100 font-medium mt-1">{busiestTank?.tankName || "—"}</p>
                <p className="text-xs text-pond-300 mt-1">{Number(busiestTank?.currentFish || 0).toLocaleString()} fish</p>
              </div>
              <div className="rounded-xl p-3" style={{ background: "rgba(12, 12, 14,0.5)", border: "1px solid rgba(148, 163, 184,0.12)" }}>
                <p className="text-xs text-pond-200/65 uppercase tracking-wider">Watch Closely</p>
                <p className="text-sm text-pond-100 font-medium mt-1">{riskTank?.tankName || "—"}</p>
                <p className="text-xs text-pond-300 mt-1">
                  {Number(riskTank?.waterRiskLogs || 0)} water-risk logs, {Number(riskTank?.mortality14d || 0).toLocaleString()} deaths in 14d
                </p>
              </div>
            </div>
            <div className="space-y-2.5">
              {scopedTanks.map((tank) => (
                <div
                  key={tank.tankId || tank.tankName}
                  className="rounded-xl px-4 py-3"
                  style={{ background: "rgba(12, 12, 14,0.45)", border: "1px solid rgba(148, 163, 184,0.1)" }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-pond-100">{tank.tankName}</p>
                    <span className="text-xs text-pond-300">{tank.currentFish.toLocaleString()} fish</span>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-pond-200/65 flex-wrap">
                    <span>{tank.feedKg14d.toFixed(1)}kg feed / 14d</span>
                    <span>{tank.mortality14d.toLocaleString()} deaths / 14d</span>
                    <span>{tank.waterRiskLogs} risk logs</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="section-title">At Risk Tanks</h2>
              <p className="text-xs text-pond-200/65 mt-1">Ranked by mortality, water-risk logs, and missing recent logs.</p>
            </div>
            <Link href="/mortality" className="text-xs text-pond-300 hover:text-pond-100 transition-colors">
              Review mortality
            </Link>
          </div>
          {atRiskTanks.length === 0 ? (
            <div className="rounded-xl px-4 py-6 text-sm text-pond-200/65 text-center" style={{ background: "rgba(12, 12, 14,0.45)", border: "1px solid rgba(148, 163, 184,0.1)" }}>
              No urgent tank risks detected in the last 14 days.
            </div>
          ) : (
            <div className="space-y-2.5">
              {atRiskTanks.map((tank) => (
                <div
                  key={`risk-${tank.tankId || tank.tankName}`}
                  className="rounded-xl px-4 py-3"
                  style={{ background: "rgba(12, 12, 14,0.45)", border: "1px solid rgba(148, 163, 184,0.1)" }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-pond-100">{tank.tankName}</p>
                    <span className="text-xs text-warning">Risk score {tank.riskScore}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-pond-200/65 flex-wrap">
                    <span>{tank.mortality14d.toLocaleString()} deaths / 14d</span>
                    <span>{tank.waterRiskLogs} risk logs</span>
                    <span>{tank.logCount} log entries</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="section-title">Recent Tank Movements</h2>
              <p className="text-xs text-pond-200/65 mt-1">Latest fish transfers that changed tank distribution.</p>
            </div>
            <Link href="/tanks" className="text-xs text-pond-300 hover:text-pond-100 transition-colors">
              Open movements
            </Link>
          </div>
          {scopedMovements.length === 0 ? (
            <div className="rounded-xl px-4 py-6 text-sm text-pond-200/65 text-center" style={{ background: "rgba(12, 12, 14,0.45)", border: "1px solid rgba(148, 163, 184,0.1)" }}>
              No tank movements recorded in the last 14 days.
            </div>
          ) : (
            <div className="space-y-2.5">
              {scopedMovements.map((movement) => (
                <div
                  key={movement.id}
                  className="rounded-xl px-4 py-3"
                  style={{ background: "rgba(12, 12, 14,0.45)", border: "1px solid rgba(148, 163, 184,0.1)" }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-pond-100">
                      {movement.fromTankName} to {movement.toTankName}
                    </p>
                    <span className="text-xs text-pond-300">
                      {new Date(movement.date).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-pond-200/65 flex-wrap">
                    <span>{movement.count.toLocaleString()} fish moved</span>
                    <span className="capitalize">{movement.reason}</span>
                    <span>{movement.batchName || "Batch"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Charts row */}
      <div className="space-y-4">
        {/* Feed chart */}
        <div className="chart-wrap">
          <h2 className="section-title mb-4">Feed Given (kg) — {timeframeLabel}</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={scopedChartData}>
              <defs>
                <linearGradient id="feedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#4b5563" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#4b5563" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184,0.1)" />
              <XAxis dataKey="date" tick={{ fill: "rgba(232,245,238,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgba(232,245,238,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value: number) => formatKg(value)} />
              <Tooltip
                formatter={(value: number, name: string) => [`${formatKg(value)}kg`, name]}
                content={<CustomTooltip />}
              />
              <Area type="monotone" dataKey="feed" name="Feed (kg)" stroke="#9ca3af" strokeWidth={2} fill="url(#feedGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className={`grid grid-cols-1 gap-4 ${scopedTankHealthTrend.length > 0 ? "lg:grid-cols-2" : ""}`}>
          {scopedTankHealthTrend.length > 0 && (
            <div className="chart-wrap">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="section-title">Tank Health Trend</h2>
                  <p className="text-xs text-pond-200/65 mt-1">{timeframeLabel} view of tank-level mortality and water-risk pressure for {scopeLabel}.</p>
                </div>
                <Link href="/water-quality" className="text-xs text-pond-300 hover:text-pond-100 transition-colors">
                  Open water logs
                </Link>
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={scopedTankHealthTrend}>
                  <defs>
                    <linearGradient id="tankRiskGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f87171" stopOpacity={0.32} />
                      <stop offset="95%" stopColor="#f87171" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="tankMortGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#fbbf24" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184,0.1)" />
                  <XAxis dataKey="date" tick={{ fill: "rgba(232,245,238,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "rgba(232,245,238,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="riskLogs" name="Water-risk logs" stroke="#f87171" strokeWidth={2} fill="url(#tankRiskGrad)" dot={false} />
                  <Area type="monotone" dataKey="mortality" name="Deaths" stroke="#fbbf24" strokeWidth={2} fill="url(#tankMortGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
              <div className="mt-3 flex items-center gap-4 text-xs text-pond-200/65 flex-wrap">
                <span>Water-risk logs mark days with out-of-range pH or high ammonia.</span>
                <span>
                  Peak tanks logged: {Math.max(0, ...scopedTankHealthTrend.map((row) => Number(row.tanksLogged || 0))).toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {/* Mortality chart */}
          <div className="chart-wrap">
            <h2 className="section-title mb-4">Daily Mortality — {timeframeLabel}</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={scopedChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184,0.1)" />
                <XAxis dataKey="date" tick={{ fill: "rgba(232,245,238,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "rgba(232,245,238,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="mortality" name="Deaths" fill="#f87171" radius={[4, 4, 0, 0]} opacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Active batches */}
      {batches.length > 0 && (
        <div className="glass-card p-5">
          <h2 className="section-title mb-4">Active Batches</h2>
          <div className="space-y-3">
            {batches.map((batch: any) => {
              const weeks = weeksSince(batch.stockingDate);
              const { phase, next, nextWeek } = getBatchPhase(weeks);
              const survival = calcSurvivalRate(batch.currentCount, batch.initialCount);
              const progress = Math.min((weeks / 18) * 100, 100);
              const readiness = batchReadiness.find((item) => item.batchId === String(batch._id)) || null;
              const readinessBadgeClass =
                readiness?.readinessStatus === "ready"
                  ? "badge-green"
                  : readiness?.readinessStatus === "approaching"
                    ? "badge-amber"
                    : "badge-water";
              return (
                <div key={batch._id} className="flex items-center gap-4 p-4 rounded-xl"
                     style={{ background: "rgba(12, 12, 14,0.5)", border: "1px solid rgba(148, 163, 184,0.12)" }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                       style={{ background: "linear-gradient(135deg,#4b5563,#064b71)" }}>
                    <Fish className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm text-pond-100 truncate">{batch.name}</p>
                      <span className="badge badge-green text-xs">{phase}</span>
                      {readiness ? <span className={`badge text-xs ${readinessBadgeClass}`}>{readiness.readinessStatus}</span> : null}
                    </div>
                    <div className="progress-track mb-1">
                      <div className="progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-pond-200/75">
                      <span>Week {weeks} of 18</span>
                      <span>·</span>
                      <span>{batch.currentCount} fish</span>
                      <span>·</span>
                      <span>{survival}% survival</span>
                      {readiness?.latestAvgWeight != null ? (
                        <>
                          <span>·</span>
                          <span>{readiness.latestAvgWeight.toFixed(0)}g avg weight</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <div className="hidden sm:flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1 text-xs text-mud-300">
                      <Clock className="w-3 h-3" />
                      <span>{next}</span>
                    </div>
                    {readiness ? (
                      <p className="text-xs text-pond-300">{readiness.readinessScore}% ready</p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {batches.length === 0 && (
        <div className="glass-card p-12 text-center">
          <Fish className="w-12 h-12 text-pond-500 mx-auto mb-4 opacity-50" />
          <h3 className="font-display text-lg text-pond-200 mb-2">No active batches yet</h3>
          <p className="text-pond-200/75 text-sm mb-6">Start your first batch to begin building a clear operating record for the farm.</p>
          <a href="/batches" className="btn-primary inline-flex">
            <Package className="w-4 h-4" /> Create First Batch
          </a>
        </div>
      )}

      {/* Financial summary */}
      {!isFree ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: "Total Revenue", value: formatNaira(totalRevenue), color: "var(--success)" },
            { label: "Total Expenses", value: formatNaira(totalExpenses), color: "var(--danger)" },
            { label: "Net Profit / Loss", value: formatNaira(netProfit), color: netProfit >= 0 ? "var(--success)" : "var(--danger)" },
          ].map(({ label, value, color }) => (
            <div key={label} className="glass-card px-5 py-4 flex items-center justify-between">
              <p className="text-xs text-pond-200/75 uppercase tracking-wider font-medium">{label}</p>
              <p className="font-mono font-semibold text-sm" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs text-pond-200/75 uppercase tracking-wider font-medium">Starter Dashboard</p>
            <p className="text-sm text-pond-200/80 mt-1">Upgrade to unlock Financials, Harvest, Calendar, and advanced profitability views.</p>
          </div>
          <div className="flex items-center gap-2">
            {communitySupportHref ? (
              <a href={communitySupportHref} target="_blank" rel="noreferrer" className="btn-secondary !px-4 !py-2">
                Community support
              </a>
            ) : null}
            <Link href="/plans" className="btn-secondary !px-4 !py-2">See plans</Link>
          </div>
        </div>
      )}
    </div>
  );
}
