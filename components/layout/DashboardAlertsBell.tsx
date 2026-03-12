"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Loader2, X } from "lucide-react";
import { formatDateTimeNg } from "@/lib/dates";

type AlertCounts = {
  total: number;
  critical: number;
};

type AlertPreview = {
  _id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  href?: string;
  updatedAt: string;
};

type AlertsPayload = {
  alerts: AlertPreview[];
  counts?: AlertCounts;
};

export default function DashboardAlertsBell() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyAlertId, setBusyAlertId] = useState("");
  const [alerts, setAlerts] = useState<AlertPreview[]>([]);
  const [counts, setCounts] = useState<AlertCounts>({ total: 0, critical: 0 });
  const [hasNewAlerts, setHasNewAlerts] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const prevTotalRef = useRef(0);

  async function load() {
    try {
      const res = await fetch("/api/alerts?counts=1&limit=5", { cache: "no-store" });
      if (!res.ok) return;
      const payload = (await res.json()) as AlertsPayload;
      const row = payload?.counts || { total: 0, critical: 0 };
      const nextTotal = Number(row.total || 0);
      if (nextTotal > prevTotalRef.current) {
        setHasNewAlerts(true);
      }
      prevTotalRef.current = nextTotal;
      setCounts({
        total: nextTotal,
        critical: Number(row.critical || 0),
      });
      setAlerts(Array.isArray(payload?.alerts) ? payload.alerts : []);
    } catch {
      // Ignore header bell polling failures.
    } finally {
      setLoading(false);
    }
  }

  async function dismiss(alertId: string) {
    setBusyAlertId(alertId);
    try {
      const res = await fetch(`/api/alerts/${alertId}/ack`, { method: "POST" });
      if (!res.ok) return;
      setAlerts((prev) => prev.filter((alert) => alert._id !== alertId));
      setCounts((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }));
    } finally {
      setBusyAlertId("");
    }
  }

  function severityTone(severity: AlertPreview["severity"]) {
    if (severity === "critical") return "text-red-200 border-red-400/30 bg-red-500/10";
    if (severity === "warning") return "text-amber-200 border-amber-400/30 bg-amber-500/10";
    return "text-water-200 border-water-400/30 bg-water-500/10";
  }

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const run = async () => {
      if (!active) return;
      await load();
    };
    void run();
    timer = setInterval(run, 60000);

    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  useEffect(() => {
    if (open) setHasNewAlerts(false);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-pond-700/35 bg-black/25 text-pond-200 transition-colors hover:border-pond-500/50 hover:text-pond-100"
        title="Open alerts"
        aria-label="Open alerts"
        onClick={() => setOpen((v) => !v)}
      >
        {hasNewAlerts && !open ? (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-400" />
          </span>
        ) : null}
        <Bell className="h-5 w-5" />
        {counts.total > 0 ? (
          <span
            className={`absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold ${
              counts.critical > 0 ? "bg-red-500 text-white" : "bg-amber-500 text-black"
            }`}
          >
            {counts.critical > 0 ? counts.critical : counts.total}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[min(92vw,380px)] rounded-2xl border border-pond-700/35 bg-[rgba(12,12,14,0.98)] p-3 shadow-2xl backdrop-blur-xl">
          <div className="mb-2 flex items-center justify-between gap-2 px-1">
            <p className="text-sm font-medium text-pond-100">Alerts</p>
            <Link href="/alerts" className="text-xs text-water-200 hover:text-water-100">
              View all
            </Link>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-6 text-pond-300">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : alerts.length === 0 ? (
            <div className="rounded-xl border border-pond-700/35 bg-black/20 px-3 py-4 text-center text-xs text-pond-300">
              No active alerts
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div key={alert._id} className="rounded-xl border border-pond-700/35 bg-black/20 px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${severityTone(alert.severity)}`}>
                      {alert.severity}
                    </span>
                    <button
                      type="button"
                      className="text-pond-400 transition-colors hover:text-pond-200"
                      onClick={() => dismiss(alert._id)}
                      disabled={busyAlertId === alert._id}
                      aria-label="Dismiss alert"
                    >
                      {busyAlertId === alert._id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                  <p className="mt-1 text-xs font-medium text-pond-100">{alert.title}</p>
                  <p className="mt-0.5 text-xs text-pond-300 line-clamp-2">{alert.message}</p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p className="text-[10px] text-pond-400">{formatDateTimeNg(alert.updatedAt)}</p>
                    {alert.href ? (
                      <Link href={alert.href} className="text-[10px] text-water-200 hover:text-water-100">
                        Open
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
