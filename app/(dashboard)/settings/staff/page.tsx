"use client";

import { useEffect, useState } from "react";
import { Loader2, UserPlus, Trash2 } from "lucide-react";
import { formatDateNg } from "@/lib/dates";

type StaffUser = {
  _id: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: string;
};

export default function StaffAccessPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [maxStaffUsers, setMaxStaffUsers] = useState<number>(5);
  const [staffLimitReached, setStaffLimitReached] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  async function loadStaff() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/staff", { cache: "no-store" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to load staff");
      setStaff(Array.isArray(payload?.staff) ? payload.staff : []);
      const limit = Number(payload?.limits?.maxStaffUsers || 0);
      const used = Number(payload?.usage?.staffUsers || 0);
      if (Number.isFinite(limit) && limit > 0) setMaxStaffUsers(limit);
      setStaffLimitReached(Number.isFinite(limit) && limit > 0 ? used >= limit : false);
    } catch (err: any) {
      setError(err?.message || "Failed to load staff");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStaff();
  }, []);

  async function createStaff(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to create staff");
      setStaff((prev) => [payload.staff, ...prev]);
      setForm({ name: "", email: "", password: "" });
      await loadStaff();
    } catch (err: any) {
      setError(err?.message || "Failed to create staff");
    } finally {
      setSaving(false);
    }
  }

  async function removeStaff(id: string) {
    setError("");
    try {
      const res = await fetch(`/api/staff/${id}`, { method: "DELETE" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to remove staff");
      setStaff((prev) => prev.filter((user) => user._id !== id));
      await loadStaff();
    } catch (err: any) {
      setError(err?.message || "Failed to remove staff");
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
        <h1 className="font-display text-2xl font-semibold text-pond-100">Staff Access</h1>
        <p className="mt-1 text-sm text-pond-200/75">Commercial owners can create staff logins for the same farm workspace.</p>
        <p className="mt-1 text-xs text-pond-300">Staff seats used: {staff.length}/{maxStaffUsers}</p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-400/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
      ) : null}

      <section className="glass-card p-5">
        <h2 className="text-lg font-semibold text-pond-100">Add Staff User</h2>
        {staffLimitReached ? (
          <div className="mt-3 rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Staff seat limit reached ({maxStaffUsers}). Remove a staff user to add another.
          </div>
        ) : null}
        <form onSubmit={createStaff} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <input
            className="field"
            placeholder="Full name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
            disabled={staffLimitReached}
          />
          <input
            className="field"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            required
            disabled={staffLimitReached}
          />
          <input
            className="field"
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            minLength={6}
            required
            disabled={staffLimitReached}
          />
          <button type="submit" className="btn-primary w-full" disabled={saving || staffLimitReached}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            {saving ? "Creating..." : "Add Staff"}
          </button>
        </form>
      </section>

      <section className="glass-card overflow-hidden">
        <div className="border-b border-pond-700/20 px-5 py-4 flex items-center justify-between">
          <h2 className="section-title">Staff Users</h2>
          <p className="text-xs text-pond-200/65">{staff.length} users</p>
        </div>
        {staff.length === 0 ? (
          <div className="p-8 text-sm text-pond-200/70 text-center">No staff users yet.</div>
        ) : (
          <div className="divide-y divide-pond-700/20">
            {staff.map((user) => (
              <div key={user._id} className="px-5 py-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-pond-100">{user.name}</p>
                  <p className="text-xs text-pond-200/70">{user.email}</p>
                  <p className="text-[11px] text-pond-200/55 mt-1">
                    Added {formatDateNg(user.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-secondary !px-3 !py-2 text-danger"
                  onClick={() => removeStaff(user._id)}
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
