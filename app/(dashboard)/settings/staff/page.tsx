"use client";

import { useEffect, useState } from "react";
import { Loader2, UserPlus, Trash2, X } from "lucide-react";
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
  const [staffToRemove, setStaffToRemove] = useState<StaffUser | null>(null);
  const [removingStaffId, setRemovingStaffId] = useState("");

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
    setRemovingStaffId(id);
    setError("");
    try {
      const res = await fetch(`/api/staff/${id}`, { method: "DELETE" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to remove staff");
      setStaff((prev) => prev.filter((user) => user._id !== id));
      setStaffToRemove(null);
      await loadStaff();
    } catch (err: any) {
      setError(err?.message || "Failed to remove staff");
    } finally {
      setRemovingStaffId("");
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
        <p className="mt-1 text-sm text-pond-200/75">Create team logins for the same farm workspace so staff can work inside the product without sharing the owner account.</p>
        <p className="mt-1 text-xs text-pond-300">Staff seats used: {staff.length}/{maxStaffUsers}</p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-400/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
      ) : null}

      <section className="glass-card p-5">
        <h2 className="text-lg font-semibold text-pond-100">Add Staff User</h2>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-pond-200/75">
          <div className="rounded-xl border border-pond-700/30 bg-black/20 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-pond-300 mb-1.5">Seat Usage</p>
            <p>{staff.length} of {maxStaffUsers} available staff seats are currently in use.</p>
          </div>
          <div className="rounded-xl border border-pond-700/30 bg-black/20 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-pond-300 mb-1.5">Access Model</p>
            <p>Staff work inside the same farm workspace, so everyone sees the same operating data.</p>
          </div>
          <div className="rounded-xl border border-pond-700/30 bg-black/20 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-pond-300 mb-1.5">Best Practice</p>
            <p>Create one login per person so actions and accountability stay clear as the team grows.</p>
          </div>
        </div>
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
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-pond-200/65">
          <p>Name should match the person who will actually use the login.</p>
          <p>Use a real email the staff member can remember and access consistently.</p>
          <p>Passwords should be temporary but strong, then changed later if your workflow requires it.</p>
        </div>
      </section>

      <section className="glass-card overflow-hidden">
        <div className="border-b border-pond-700/20 px-5 py-4 flex items-center justify-between">
          <h2 className="section-title">Staff Users</h2>
          <p className="text-xs text-pond-200/65">{staff.length} users</p>
        </div>
        {staff.length === 0 ? (
          <div className="p-8 text-sm text-pond-200/70 text-center">
            No staff users yet.
            <p className="mt-2 text-xs text-pond-200/55">Add your first teammate here when someone else needs direct access to farm operations.</p>
          </div>
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
                  onClick={() => setStaffToRemove(user)}
                  disabled={removingStaffId === user._id}
                >
                  {removingStaffId === user._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  {removingStaffId === user._id ? "Removing..." : "Remove"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {staffToRemove ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{
            background: "rgba(12, 12, 14,0.85)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div className="glass-card w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg text-pond-100">Remove Staff User</h2>
              <button
                type="button"
                onClick={() => setStaffToRemove(null)}
                className="text-pond-200/75 hover:text-pond-300"
                disabled={removingStaffId === staffToRemove._id}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-pond-200/80">
              Remove <span className="font-medium text-pond-100">{staffToRemove.name}</span> from this farm workspace?
            </p>
            <p className="text-xs text-pond-200/65">
              They will lose access immediately and will need to be added again to sign in later.
            </p>
            <p className="text-xs text-pond-200/55">
              This does not delete farm records. It only removes that user’s access to the shared workspace.
            </p>
            <div className="rounded-xl border border-pond-700/20 bg-black/20 px-4 py-3">
              <p className="text-sm text-pond-100">{staffToRemove.name}</p>
              <p className="text-xs text-pond-200/70 mt-1">{staffToRemove.email}</p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStaffToRemove(null)}
                className="btn-secondary flex-1"
                disabled={removingStaffId === staffToRemove._id}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => removeStaff(staffToRemove._id)}
                className="btn-secondary flex-1 text-danger"
                disabled={removingStaffId === staffToRemove._id}
              >
                {removingStaffId === staffToRemove._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {removingStaffId === staffToRemove._id ? "Removing..." : "Confirm Remove"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
