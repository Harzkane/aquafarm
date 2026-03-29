"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { AlertTriangle, Bell, CheckCircle2, Loader2 } from "lucide-react";
import { formatDateTimeNg } from "@/lib/dates";

type AlertRow = {
  _id: string;
  source: string;
  severity: "info" | "warning" | "critical";
  status?: "new" | "acknowledged" | "in_progress" | "resolved" | "muted";
  title: string;
  message: string;
  href?: string;
  updatedAt: string;
  triggerCount?: number;
  assignedToUserId?: string;
  assignedToName?: string;
  resolutionNote?: string;
  meta?: Record<string, unknown>;
};

type AlertResponse = {
  alerts: AlertRow[];
  counts?: {
    total: number;
    info: number;
    warning: number;
    critical: number;
  };
  statusCounts?: {
    new: number;
    acknowledged: number;
    in_progress: number;
    muted: number;
  };
  sourceCounts?: Array<{ source: string; count: number }>;
  incidents?: Array<{
    _id: string;
    title: string;
    summary: string;
    severity: "info" | "warning" | "critical";
    status: "new" | "acknowledged" | "in_progress" | "resolved" | "muted";
    source: string;
    href?: string;
    entityType?: string;
    alertCount?: number;
    assignedToUserId?: string;
    assignedToName?: string;
    updatedAt: string;
  }>;
  analytics?: {
    avgOpenAgeHours: number;
    avgTimeToAcknowledgeHours: number;
  };
};

type StaffOption = {
  _id: string;
  name: string;
};

const SEVERITY_FILTERS = ["all", "critical", "warning", "info"] as const;
const SOURCE_LABELS: Record<string, string> = {
  dashboard: "Operations",
  mortality: "Mortality",
  "water-quality": "Water quality",
  calendar: "Calendar",
  harvest: "Harvest",
  "feed-inventory": "Feed inventory",
  billing: "Billing",
  ops: "Platform ops",
  staff: "Staff",
  financials: "Financials",
};

function severityBadge(severity: AlertRow["severity"]) {
  if (severity === "critical") return "badge-red";
  if (severity === "warning") return "badge-amber";
  return "badge-water";
}

function statusBadge(status: AlertRow["status"] | undefined) {
  if (status === "in_progress") return "badge-water";
  if (status === "acknowledged") return "badge-amber";
  if (status === "muted") return "badge";
  return "badge-green";
}

function prevAlertsAfterUpdate(alerts: AlertRow[], id: string, patch: Partial<AlertRow>) {
  return alerts
    .map((alert) => (alert._id === id ? { ...alert, ...patch } : alert))
    .filter((alert) => alert.status !== "resolved");
}

function summarizeAlertCounts(alerts: AlertRow[]) {
  return {
    total: alerts.length,
    critical: alerts.filter((alert) => alert.severity === "critical").length,
    warning: alerts.filter((alert) => alert.severity === "warning").length,
    info: alerts.filter((alert) => alert.severity === "info").length,
  };
}

function summarizeStatusCounts(alerts: AlertRow[]) {
  return {
    new: alerts.filter((alert) => (alert.status || "new") === "new").length,
    acknowledged: alerts.filter((alert) => alert.status === "acknowledged").length,
    in_progress: alerts.filter((alert) => alert.status === "in_progress").length,
    muted: alerts.filter((alert) => alert.status === "muted").length,
  };
}

export default function AlertsPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [busyIncidentId, setBusyIncidentId] = useState("");
  const [error, setError] = useState("");
  const [payload, setPayload] = useState<AlertResponse>({ alerts: [] });
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [severityFilter, setSeverityFilter] = useState<(typeof SEVERITY_FILTERS)[number]>("all");
  const [sourceFilter, setSourceFilter] = useState("all");

  async function load(refresh = false) {
    setError("");
    try {
      const res = await fetch(`/api/alerts?limit=100&counts=1${refresh ? "&refresh=1" : ""}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load alerts");
      setPayload(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load alerts");
    }
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load(true);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/staff", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) return;
        setStaffOptions(Array.isArray(data?.staff) ? data.staff.map((user: any) => ({
          _id: String(user._id),
          name: String(user.name || "Staff"),
        })) : []);
      } catch {
        // Staff assignment is optional; ignore if unavailable.
      }
    })();
  }, []);

  async function updateAlert(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    setError("");
    try {
      const res = await fetch(`/api/alerts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update alert");
      setPayload((prev) => ({
        ...prev,
        alerts: (() => {
          const nextAlerts = prevAlertsAfterUpdate(prev.alerts, id, data?.alert || {});
          return nextAlerts;
        })(),
        counts: (() => {
          const nextAlerts = prevAlertsAfterUpdate(prev.alerts, id, data?.alert || {});
          return summarizeAlertCounts(nextAlerts);
        })(),
        statusCounts: (() => {
          const nextAlerts = prevAlertsAfterUpdate(prev.alerts, id, data?.alert || {});
          return summarizeStatusCounts(nextAlerts);
        })(),
      }));
    } catch (err: any) {
      setError(err?.message || "Failed to update alert");
    } finally {
      setBusyId("");
    }
  }

  async function updateIncident(id: string, body: Record<string, unknown>) {
    setBusyIncidentId(id);
    setError("");
    try {
      const res = await fetch(`/api/incidents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update incident");
      await load();
    } catch (err: any) {
      setError(err?.message || "Failed to update incident");
    } finally {
      setBusyIncidentId("");
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-pond-300" />
      </div>
    );
  }

  const counts = payload.counts || { total: payload.alerts.length, info: 0, warning: 0, critical: 0 };
  const statusCounts = payload.statusCounts || { new: 0, acknowledged: 0, in_progress: 0, muted: 0 };
  const sourceOptions = ["all", ...Array.from(new Set(payload.alerts.map((alert) => alert.source))).sort()];
  const visibleAlerts = payload.alerts.filter((alert) => {
    if (severityFilter !== "all" && alert.severity !== severityFilter) return false;
    if (sourceFilter !== "all" && alert.source !== sourceFilter) return false;
    return true;
  });
  const assigneeOptions: StaffOption[] = [
    ...(session?.user ? [{
      _id: String((session.user as any).id || ""),
      name: `${String(session.user.name || "Owner")} (Owner)`,
    }] : []),
    ...staffOptions.filter((user) => String(user._id) !== String((session?.user as any)?.id || "")),
  ].filter((user) => user._id);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-semibold text-pond-100">Alerts</h1>
          <p className="mt-1 text-sm text-pond-200/75">Review important farm, billing, and platform issues in one place.</p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => load(true)}>
          <Bell className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-400/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
      ) : null}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="stat-card">
          <p className="text-xs uppercase tracking-wider text-pond-200/70">Total active</p>
          <p className="mt-2 text-2xl font-semibold text-pond-100">{counts.total}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs uppercase tracking-wider text-pond-200/70">Critical</p>
          <p className="mt-2 text-2xl font-semibold text-red-300">{counts.critical || 0}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs uppercase tracking-wider text-pond-200/70">Warning</p>
          <p className="mt-2 text-2xl font-semibold text-amber-300">{counts.warning || 0}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs uppercase tracking-wider text-pond-200/70">Info</p>
          <p className="mt-2 text-2xl font-semibold text-water-300">{counts.info || 0}</p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="stat-card">
          <p className="text-xs uppercase tracking-wider text-pond-200/70">New</p>
          <p className="mt-2 text-2xl font-semibold text-pond-100">{statusCounts.new}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs uppercase tracking-wider text-pond-200/70">Acknowledged</p>
          <p className="mt-2 text-2xl font-semibold text-amber-300">{statusCounts.acknowledged}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs uppercase tracking-wider text-pond-200/70">In progress</p>
          <p className="mt-2 text-2xl font-semibold text-water-300">{statusCounts.in_progress}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs uppercase tracking-wider text-pond-200/70">Avg ack time</p>
          <p className="mt-2 text-2xl font-semibold text-pond-100">{payload.analytics?.avgTimeToAcknowledgeHours || 0}h</p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr,0.8fr]">
        <div className="glass-card overflow-hidden">
          <div className="border-b border-pond-700/20 px-5 py-4 flex items-center justify-between">
            <h2 className="section-title">Active Incidents</h2>
            <span className="text-xs text-pond-200/65">{payload.incidents?.length || 0} grouped issues</span>
          </div>
          {payload.incidents?.length ? (
            <div className="divide-y divide-pond-700/20">
              {payload.incidents.map((incident) => (
                <div key={incident._id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-pond-100">{incident.title}</p>
                      <p className="mt-1 text-xs text-pond-200/75">{incident.summary}</p>
                      <div className="mt-2 flex items-center gap-2 flex-wrap text-[11px] text-pond-300">
                        <span className={`badge ${severityBadge(incident.severity)}`}>{incident.severity}</span>
                        <span className={`badge ${statusBadge(incident.status)}`}>{incident.status}</span>
                        {incident.entityType ? <span className="rounded-full border border-pond-700/30 bg-black/20 px-2 py-1 capitalize">{incident.entityType}</span> : null}
                        {incident.alertCount ? <span>{incident.alertCount} linked alerts</span> : null}
                        {incident.assignedToName ? <span>Assigned to {incident.assignedToName}</span> : null}
                        <span>Updated {formatDateTimeNg(incident.updatedAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <div className="w-48">
                        <select
                          className="field !py-1.5 !text-xs"
                          value={incident.assignedToUserId || ""}
                          onChange={(e) => updateIncident(incident._id, { assignedToUserId: e.target.value || null })}
                          disabled={busyIncidentId === incident._id}
                        >
                          <option value="">Unassigned</option>
                          {assigneeOptions.map((option) => (
                            <option key={option._id} value={option._id}>
                              {option.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      {incident.href ? (
                        <Link href={incident.href} className="btn-secondary !px-3 !py-1.5">
                          Open
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        className="btn-secondary !px-3 !py-1.5"
                        onClick={() => updateIncident(incident._id, { status: "acknowledged" })}
                        disabled={busyIncidentId === incident._id || incident.status === "acknowledged"}
                      >
                        {busyIncidentId === incident._id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Acknowledge"}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary !px-3 !py-1.5"
                        onClick={() => updateIncident(incident._id, { status: "in_progress" })}
                        disabled={busyIncidentId === incident._id || incident.status === "in_progress"}
                      >
                        {busyIncidentId === incident._id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Start work"}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary !px-3 !py-1.5"
                        onClick={() => updateIncident(incident._id, { status: "muted" })}
                        disabled={busyIncidentId === incident._id || incident.status === "muted"}
                      >
                        {busyIncidentId === incident._id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mute"}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary !px-3 !py-1.5 text-emerald-200"
                        onClick={() => updateIncident(incident._id, { status: "resolved" })}
                        disabled={busyIncidentId === incident._id}
                      >
                        {busyIncidentId === incident._id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Resolve"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-pond-200/70">No grouped incidents are active right now.</div>
          )}
        </div>

        <div className="glass-card p-5 space-y-4">
          <div>
            <h2 className="section-title">Engine Signals</h2>
            <p className="mt-1 text-xs text-pond-200/65">Quick view of where alert volume is clustering.</p>
          </div>
          <div className="rounded-xl border border-pond-700/30 bg-black/20 px-4 py-3">
            <p className="text-xs text-pond-200/65">Average open age</p>
            <p className="mt-1 text-lg font-semibold text-pond-100">{payload.analytics?.avgOpenAgeHours || 0}h</p>
          </div>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-pond-200/70">Top sources</p>
            {(payload.sourceCounts || []).length ? (
              payload.sourceCounts!.slice(0, 6).map((row) => (
                <div key={row.source} className="flex items-center justify-between rounded-xl border border-pond-700/30 bg-black/20 px-3 py-2 text-sm">
                  <span className="text-pond-200/80">{SOURCE_LABELS[row.source] || row.source}</span>
                  <span className="text-pond-100 font-medium">{row.count}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-pond-200/70">No active source clusters.</p>
            )}
          </div>
        </div>
      </section>

      <section className="glass-card p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="section-title">Triage Filters</h2>
            <p className="mt-1 text-xs text-pond-200/65">Narrow alerts by severity or source so action is easier to prioritize.</p>
          </div>
          <p className="text-xs text-pond-300">{visibleAlerts.length} of {payload.alerts.length} visible</p>
        </div>
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="flex flex-wrap gap-2">
            {SEVERITY_FILTERS.map((option) => {
              const active = severityFilter === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSeverityFilter(option)}
                  className={`rounded-full px-3 py-1.5 text-xs capitalize transition-colors ${
                    active ? "text-pond-100" : "text-pond-200/75 hover:text-pond-100"
                  }`}
                  style={{
                    background: active ? "rgba(117,215,255,0.16)" : "rgba(12, 12, 14, 0.5)",
                    border: active ? "1px solid rgba(117,215,255,0.4)" : "1px solid rgba(148, 163, 184, 0.12)",
                  }}
                >
                  {option}
                </button>
              );
            })}
          </div>
          <div className="w-full lg:ml-auto lg:w-64">
            <label className="mb-1.5 block text-xs font-medium text-pond-300">Source</label>
            <select className="field" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
              {sourceOptions.map((source) => (
                <option key={source} value={source}>
                  {source === "all" ? "All sources" : (SOURCE_LABELS[source] || source)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="glass-card overflow-hidden">
        <div className="border-b border-pond-700/20 px-5 py-4 flex items-center justify-between">
          <h2 className="section-title">Active Alerts</h2>
          <span className="text-xs text-pond-200/65">{visibleAlerts.length} entries</span>
        </div>
        {visibleAlerts.length === 0 ? (
          <div className="p-10 text-center text-sm text-pond-200/70">
            <CheckCircle2 className="h-5 w-5 mx-auto mb-2 text-emerald-300" />
            {payload.alerts.length === 0 ? "No active alerts right now." : "No alerts match the current filters."}
          </div>
        ) : (
          <div className="divide-y divide-pond-700/20">
            {visibleAlerts.map((alert) => (
              <div key={alert._id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-pond-100 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-mud-300" />
                      {alert.title}
                    </p>
                    <p className="text-xs text-pond-200/75 mt-1">{alert.message}</p>
                    <div className="mt-2 flex items-center gap-2 flex-wrap text-[11px] text-pond-300">
                      <span className="rounded-full border border-pond-700/30 bg-black/20 px-2 py-1">
                        {SOURCE_LABELS[alert.source] || alert.source}
                      </span>
                      {typeof alert.meta?.entityType === "string" ? (
                        <span className="rounded-full border border-pond-700/30 bg-black/20 px-2 py-1 capitalize">
                          {String(alert.meta.entityType)}
                        </span>
                      ) : null}
                      {typeof alert.meta?.windowDays === "number" ? (
                        <span className="rounded-full border border-pond-700/30 bg-black/20 px-2 py-1">
                          {Number(alert.meta.windowDays)}d window
                        </span>
                      ) : null}
                      <span className={`badge ${statusBadge(alert.status)}`}>{alert.status || "new"}</span>
                      {alert.assignedToName ? (
                        <span>Assigned to {alert.assignedToName}</span>
                      ) : (
                        <span>Unassigned</span>
                      )}
                      {typeof alert.triggerCount === "number" && alert.triggerCount > 1 ? (
                        <span>Triggered {alert.triggerCount} times</span>
                      ) : null}
                      <span>Last seen: {formatDateTimeNg(alert.updatedAt)}</span>
                    </div>
                    {alert.resolutionNote ? (
                      <p className="mt-2 text-[11px] text-pond-200/65">Resolution note: {alert.resolutionNote}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <div className="w-48">
                      <select
                        className="field !py-1.5 !text-xs"
                        value={alert.assignedToUserId || ""}
                        onChange={(e) => updateAlert(alert._id, { assignedToUserId: e.target.value || null })}
                        disabled={busyId === alert._id}
                      >
                        <option value="">Unassigned</option>
                        {assigneeOptions.map((option) => (
                          <option key={option._id} value={option._id}>
                            {option.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <span className={`badge ${severityBadge(alert.severity)}`}>{alert.severity}</span>
                    {alert.href ? (
                      <Link href={alert.href} className="btn-secondary !px-3 !py-1.5">
                        Open
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      className="btn-secondary !px-3 !py-1.5"
                      onClick={() => updateAlert(alert._id, { status: "acknowledged" })}
                      disabled={busyId === alert._id || alert.status === "acknowledged"}
                    >
                      {busyId === alert._id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Acknowledge"}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary !px-3 !py-1.5"
                      onClick={() => updateAlert(alert._id, { status: "in_progress" })}
                      disabled={busyId === alert._id || alert.status === "in_progress"}
                    >
                      {busyId === alert._id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Start work"}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary !px-3 !py-1.5"
                      onClick={() => updateAlert(alert._id, { status: "muted" })}
                      disabled={busyId === alert._id || alert.status === "muted"}
                    >
                      {busyId === alert._id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mute"}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary !px-3 !py-1.5 text-emerald-200"
                      onClick={() => updateAlert(alert._id, { status: "resolved" })}
                      disabled={busyId === alert._id}
                    >
                      {busyId === alert._id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Resolve"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
