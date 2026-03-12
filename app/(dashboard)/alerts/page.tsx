"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Bell, CheckCircle2, Loader2 } from "lucide-react";
import { formatDateTimeNg } from "@/lib/dates";

type AlertRow = {
  _id: string;
  source: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  href?: string;
  updatedAt: string;
  triggerCount?: number;
};

type AlertResponse = {
  alerts: AlertRow[];
  counts?: {
    total: number;
    info: number;
    warning: number;
    critical: number;
  };
};

function severityBadge(severity: AlertRow["severity"]) {
  if (severity === "critical") return "badge-red";
  if (severity === "warning") return "badge-amber";
  return "badge-water";
}

export default function AlertsPage() {
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [payload, setPayload] = useState<AlertResponse>({ alerts: [] });

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

  async function dismiss(id: string) {
    setBusyId(id);
    setError("");
    try {
      const res = await fetch(`/api/alerts/${id}/ack`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to dismiss alert");
      setPayload((prev) => ({
        ...prev,
        alerts: prev.alerts.filter((alert) => alert._id !== id),
        counts: prev.counts
          ? { ...prev.counts, total: Math.max(0, prev.counts.total - 1) }
          : prev.counts,
      }));
    } catch (err: any) {
      setError(err?.message || "Failed to dismiss alert");
    } finally {
      setBusyId("");
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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-semibold text-pond-100">Alerts</h1>
          <p className="mt-1 text-sm text-pond-200/75">Central farm and SaaS control notifications.</p>
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

      <section className="glass-card overflow-hidden">
        <div className="border-b border-pond-700/20 px-5 py-4 flex items-center justify-between">
          <h2 className="section-title">Active Alerts</h2>
          <span className="text-xs text-pond-200/65">{payload.alerts.length} entries</span>
        </div>
        {payload.alerts.length === 0 ? (
          <div className="p-10 text-center text-sm text-pond-200/70">
            <CheckCircle2 className="h-5 w-5 mx-auto mb-2 text-emerald-300" />
            No active alerts right now.
          </div>
        ) : (
          <div className="divide-y divide-pond-700/20">
            {payload.alerts.map((alert) => (
              <div key={alert._id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-pond-100 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-mud-300" />
                      {alert.title}
                    </p>
                    <p className="text-xs text-pond-200/75 mt-1">{alert.message}</p>
                    <p className="text-[11px] text-pond-300 mt-1">
                      {alert.href ? `Action: ${alert.href} · ` : ""}
                      Source: {alert.source} · Last seen: {formatDateTimeNg(alert.updatedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`badge ${severityBadge(alert.severity)}`}>{alert.severity}</span>
                    <button
                      type="button"
                      className="btn-secondary !px-3 !py-1.5"
                      onClick={() => dismiss(alert._id)}
                      disabled={busyId === alert._id}
                    >
                      {busyId === alert._id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Dismiss"}
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
