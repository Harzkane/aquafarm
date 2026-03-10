"use client";

import { useEffect, useMemo, useState } from "react";
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

function resourceMatchesFilter(resource: string, filter: ResourceFilter) {
  if (filter === "all") return true;
  if (filter === "billing") return resource === "billing";
  if (filter === "staff") return resource === "staff_user";
  if (filter === "batches") return resource === "batch";
  if (filter === "tanks") return resource === "tank";
  if (filter === "logs") return resource === "daily_log";
  if (filter === "water_quality") return resource === "water_quality";
  return true;
}

export default function AuditPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [resourceFilter, setResourceFilter] = useState<ResourceFilter>("all");
  const [logs, setLogs] = useState<AuditItem[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/audit?limit=200", { cache: "no-store" });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload?.error || "Failed to load audit logs");
        setLogs(Array.isArray(payload?.logs) ? payload.logs : []);
      } catch (err: any) {
        setError(err?.message || "Failed to load audit logs");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((log) => {
      if (!resourceMatchesFilter(log.resource, resourceFilter)) return false;
      if (!q) return true;
      const text = `${log.actorName || ""} ${log.actorEmail || ""} ${log.action || ""} ${log.resource || ""} ${log.summary || ""}`.toLowerCase();
      return text.includes(q);
    });
  }, [logs, query, resourceFilter]);

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
          <ShieldCheck className="h-4 w-4" />
          {filtered.length} events
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
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-pond-200/70">No audit events found.</div>
        ) : (
          <div className="divide-y divide-pond-700/20">
            {filtered.map((log) => (
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
        )}
      </div>
    </div>
  );
}
