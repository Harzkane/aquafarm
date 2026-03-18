"use client";

import { useDeferredValue, useEffect, useState } from "react";
import { ActivitySquare, AlertTriangle, Loader2, RefreshCw, Search } from "lucide-react";
import { formatDateTimeNg } from "@/lib/dates";

type CronRun = {
  _id?: string;
  job: string;
  status: "success" | "failed";
  dryRun: boolean;
  durationMs: number;
  metrics?: Record<string, unknown>;
  error?: string;
  createdAt: string;
};

type CronSummary = {
  job: string;
  totalRuns: number;
  failedRuns: number;
  latestStatus: "success" | "failed";
  latestRunAt: string | null;
  avgDurationMs: number;
};

type OpsTotals = {
  totalRuns: number;
  failedRuns: number;
  dryRuns: number;
  avgDurationMs: number;
};

type OpsPagination = {
  page: number;
  pageSize: number;
  totalPages: number;
  totalRuns: number;
};

export default function OpsMonitorPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "failed">("all");
  const [runs, setRuns] = useState<CronRun[]>([]);
  const [summary, setSummary] = useState<CronSummary[]>([]);
  const [totals, setTotals] = useState<OpsTotals>({ totalRuns: 0, failedRuns: 0, dryRuns: 0, avgDurationMs: 0 });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRuns, setTotalRuns] = useState(0);
  const deferredQuery = useDeferredValue(query);

  async function load(options?: { showRefreshing?: boolean }) {
    if (options?.showRefreshing) setRefreshing(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (deferredQuery.trim()) params.set("query", deferredQuery.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      const res = await fetch(`/api/ops/cron-runs?${params.toString()}`, { cache: "no-store" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to load ops telemetry");
      setRuns(Array.isArray(payload?.runs) ? payload.runs : []);
      setSummary(Array.isArray(payload?.summary) ? payload.summary : []);
      setTotals({
        totalRuns: Number(payload?.totals?.totalRuns || 0),
        failedRuns: Number(payload?.totals?.failedRuns || 0),
        dryRuns: Number(payload?.totals?.dryRuns || 0),
        avgDurationMs: Number(payload?.totals?.avgDurationMs || 0),
      });
      const pagination: OpsPagination | null = payload?.pagination || null;
      setTotalPages(Math.max(1, Number(pagination?.totalPages || 1)));
      setTotalRuns(Number(pagination?.totalRuns || 0));
    } catch (err: any) {
      setError(err?.message || "Failed to load ops telemetry");
    } finally {
      if (options?.showRefreshing) setRefreshing(false);
    }
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [deferredQuery, page, pageSize, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [deferredQuery, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  async function refresh() {
    await load({ showRefreshing: true });
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-pond-300" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-semibold text-pond-100">Ops Monitor</h1>
          <p className="mt-1 text-sm text-pond-200/75">Cron health and execution telemetry for billing controls.</p>
        </div>
        <button type="button" onClick={refresh} className="btn-secondary" disabled={refreshing}>
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-400/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
      ) : null}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="stat-card">
          <p className="text-xs uppercase tracking-wider text-pond-200/70">Runs matched</p>
          <p className="mt-2 text-2xl font-semibold text-pond-100">{totals.totalRuns}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs uppercase tracking-wider text-pond-200/70">Failures</p>
          <p className={`mt-2 text-2xl font-semibold ${totals.failedRuns > 0 ? "text-red-300" : "text-emerald-300"}`}>
            {totals.failedRuns}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-xs uppercase tracking-wider text-pond-200/70">Dry runs</p>
          <p className="mt-2 text-2xl font-semibold text-pond-100">{totals.dryRuns}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs uppercase tracking-wider text-pond-200/70">Avg duration</p>
          <p className="mt-2 text-2xl font-semibold text-pond-100">{totals.avgDurationMs}ms</p>
        </div>
      </section>

      <section className="glass-card p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pond-300" />
            <input
              className="field pl-9"
              placeholder="Search by job/status/error"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select className="field" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
            <option value="all">All statuses</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </section>

      <section className="glass-card overflow-hidden">
        <div className="border-b border-pond-700/20 px-5 py-4 flex items-center justify-between">
          <h2 className="section-title">Job Summary</h2>
          <span className="text-xs text-pond-200/65">{summary.length} jobs</span>
        </div>
        {summary.length === 0 ? (
          <div className="p-10 text-center text-sm text-pond-200/70">No cron summary available.</div>
        ) : (
          <div className="divide-y divide-pond-700/20">
            {summary.map((item) => (
              <div key={item.job} className="px-5 py-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-pond-100">{item.job}</p>
                  <p className="text-xs text-pond-200/70 mt-1">
                    total {item.totalRuns} · failed {item.failedRuns} · avg {item.avgDurationMs}ms
                  </p>
                </div>
                <div className="text-right">
                  <span className={`badge ${item.latestStatus === "failed" ? "badge-red" : "badge-green"}`}>
                    {item.latestStatus}
                  </span>
                  <p className="mt-1 text-xs text-pond-300">{item.latestRunAt ? formatDateTimeNg(item.latestRunAt) : "—"}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="glass-card overflow-hidden">
        <div className="border-b border-pond-700/20 px-5 py-4 flex items-center justify-between">
          <h2 className="section-title">Recent Runs</h2>
          <span className="text-xs text-pond-200/65">{totalRuns} entries</span>
        </div>
        {totalRuns === 0 ? (
          <div className="p-10 text-center text-sm text-pond-200/70">No runs for current filters.</div>
        ) : (
          <>
            <div className="divide-y divide-pond-700/20">
            {runs.map((run, idx) => (
              <div key={`${run.job}-${run.createdAt}-${idx}`} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-pond-100 flex items-center gap-2">
                      <ActivitySquare className="h-4 w-4 text-water-200" />
                      {run.job}
                    </p>
                    <p className="text-xs text-pond-200/70 mt-1">
                      {run.dryRun ? "dry-run" : "live"} · {run.durationMs || 0}ms
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`badge ${run.status === "failed" ? "badge-red" : "badge-green"}`}>
                      {run.status}
                    </span>
                    <p className="mt-1 text-xs text-pond-300">{formatDateTimeNg(run.createdAt)}</p>
                  </div>
                </div>
                {run.status === "failed" && run.error ? (
                  <div className="mt-2 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span className="break-words">{run.error}</span>
                  </div>
                ) : null}
              </div>
            ))}
            </div>
            <div className="px-5 py-3 border-t border-pond-700/20 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-pond-200/65">
                Showing {totalRuns === 0 ? 0 : (page - 1) * pageSize + 1}-{Math.min(page * pageSize, totalRuns)} of {totalRuns}
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
          </>
        )}
      </section>
    </div>
  );
}
