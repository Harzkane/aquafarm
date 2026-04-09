"use client";

import { useEffect, useState } from "react";
import { BellRing, Loader2, Save } from "lucide-react";

type AlertPrefsPayload = {
  phone: string;
  alertPrefs: {
    whatsappCritical: boolean;
  };
};

export default function AlertChannelsSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsappCritical, setWhatsappCritical] = useState(true);

  async function load() {
    setError("");
    try {
      const res = await fetch("/api/alerts/preferences", { cache: "no-store" });
      const payload = (await res.json()) as AlertPrefsPayload & { error?: string };
      if (!res.ok) throw new Error(payload?.error || "Failed to load alert settings");
      setPhone(payload.phone || "");
      setWhatsappCritical(payload.alertPrefs?.whatsappCritical !== false);
    } catch (err: any) {
      setError(err?.message || "Failed to load alert settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/alerts/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          alertPrefs: {
            whatsappCritical,
          },
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to save alert settings");
      setNotice("Alert channel settings updated.");
    } catch (err: any) {
      setError(err?.message || "Failed to save alert settings");
    } finally {
      setSaving(false);
    }
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
      <div>
        <h1 className="font-display text-2xl font-semibold text-pond-100">Alert Channels</h1>
        <p className="mt-1 text-sm text-pond-200/75">
          Decide who receives critical alerts and how the platform should route them when fast attention is needed.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-400/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
      ) : null}
      {notice ? (
        <div className="rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{notice}</div>
      ) : null}

      <form onSubmit={save} className="glass-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <BellRing className="h-4 w-4 text-water-300" />
          <h2 className="section-title !text-base">Critical Alert Routing</h2>
        </div>
        <p className="text-xs text-pond-200/65">
          WhatsApp is the only active outbound channel right now. Additional channels will appear here once delivery is live.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-pond-200/75">
          <div className="rounded-xl border border-pond-700/30 bg-black/20 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-pond-300 mb-1.5">Current Channel</p>
            <p>Critical alerts can currently route through WhatsApp when enabled below.</p>
          </div>
          <div className="rounded-xl border border-pond-700/30 bg-black/20 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-pond-300 mb-1.5">Fallback Behavior</p>
            <p>If no phone is saved here, the system falls back to the configured environment recipient.</p>
          </div>
          <div className="rounded-xl border border-pond-700/30 bg-black/20 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-pond-300 mb-1.5">Best Practice</p>
            <p>Use a monitored operations number so urgent issues are seen even when one team member is offline.</p>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-pond-300">WhatsApp recipient phone</label>
          <input
            className="field"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="2348012345678"
          />
          <p className="mt-1 text-xs text-pond-200/65">
            E.164 format recommended. If empty, dispatcher uses env fallback (`ALERTS_WHATSAPP_TO`).
          </p>
          <p className="mt-1 text-xs text-pond-200/55">
            Example: `2348012345678` for a Nigerian number without spaces, brackets, or a leading zero.
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm text-pond-200">
          <input
            type="checkbox"
            checked={whatsappCritical}
            onChange={(e) => setWhatsappCritical(e.target.checked)}
          />
          Send critical alerts via WhatsApp
        </label>
        <p className="-mt-2 text-xs text-pond-200/60">
          Turn this off only if you want critical alerts to stay in-product for now.
        </p>

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving..." : "Save settings"}
        </button>
      </form>
    </div>
  );
}
