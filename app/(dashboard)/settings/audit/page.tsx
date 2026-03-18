"use client";

import { useDeferredValue, useEffect, useState } from "react";
import { Loader2, ShieldCheck, Search } from "lucide-react";
import { formatDateTimeNg } from "@/lib/dates";

type AuditItem = {
  _id: string;
  actorName: string;
  actorEmail: string;
  role: "owner" | "staff";
  action: string;
  resource: string;
  resourceId?: string;
  summary: string;
  createdAt: string;
};

type ResourceFilter = "all" | "billing" | "staff" | "batches" | "tanks" | "logs" | "water_quality";

const RESOURCE_FILTERS: Array<{ key: ResourceFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "billing", label: "Billing" },
  { key: "staff", label: "Staff" },
  { key: "batches", label: "Batches" },
  { key: "tanks", label: "Tanks" },
  { key: "logs", label: "Logs" },
  { key: "water_quality", label: "Water Quality" },
];

export default function AuditPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [resourceFilter, setResourceFilter] = useState<ResourceFilter>("all");
  const [logs, setLogs] = useState<AuditItem[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalLogs, setTotalLogs] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const deferredQuery = useDeferredValue(query);

  async function load(options?: { initial?: boolean }) {
    if (options?.initial) setLoading(true);
    else setRefreshing(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (deferredQuery.trim()) params.set("query", deferredQuery.trim());
      if (resourceFilter !== "all") params.set("resource", resourceFilter);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      const res = await fetch(`/api/audit?${params.toString()}`, { cache: "no-store" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to load audit logs");
      setLogs(Array.isArray(payload?.logs) ? payload.logs : []);
      setTotalLogs(Number(payload?.totals?.totalLogs || 0));
      setTotalPages(Math.max(1, Number(payload?.pagination?.totalPages || 1)));
    } catch (err: any) {
      setError(err?.message || "Failed to load audit logs");
    } finally {
      if (options?.initial) setLoading(false);
      else setRefreshing(false);
    }
  }

  useEffect(() => {
    void load({ initial: loading });
  }, [deferredQuery, resourceFilter, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [deferredQuery, resourceFilter]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  useEffect(() => {
    setPage(1);
  }, [pageSize]);

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
          <h1 className="font-display text-2xl font-semibold text-pond-100">Operational Audit</h1>
          <p className="mt-1 text-sm text-pond-200/75">Track who changed what and when across your farm operations.</p>
        </div>
        <div className="badge badge-green">
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          {totalLogs} events
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-400/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
      ) : null}

      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {RESOURCE_FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setResourceFilter(filter.key)}
              className={`badge transition-opacity ${resourceFilter === filter.key ? "badge-water" : "badge-green"}`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-pond-300" />
          <input
            className="field pl-9"
            placeholder="Search actor, action, resource, summary"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 border-b border-pond-700/20 flex items-center justify-between">
          <h2 className="section-title">Recent Activity</h2>
          <p className="text-xs text-pond-200/65">Dates shown in local formatted time</p>
        </div>
        {totalLogs === 0 ? (
          <div className="p-10 text-center text-sm text-pond-200/70">No audit events found.</div>
        ) : (
          <>
            <div className="divide-y divide-pond-700/20">
            {logs.map((log) => (
              <div key={log._id} className="px-5 py-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-pond-100 font-medium">{log.summary || `${log.action} ${log.resource}`}</p>
                  <p className="text-xs text-pond-200/70 mt-1">
                    {log.actorName || "Unknown"} ({log.actorEmail || "—"}) · {log.role} · {log.action} · {log.resource}
                  </p>
                </div>
                <p className="text-xs text-pond-300 font-mono whitespace-nowrap">
                  {formatDateTimeNg(log.createdAt)}
                </p>
              </div>
            ))}
            </div>
            <div className="px-5 py-3 border-t border-pond-700/20 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-pond-200/65">
                Showing {totalLogs === 0 ? 0 : (page - 1) * pageSize + 1}-{Math.min(page * pageSize, totalLogs)} of {totalLogs}
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
      </div>
    </div>
  );
}
