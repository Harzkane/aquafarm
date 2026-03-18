"use client";
import { useEffect, useMemo, useState } from "react";
import { Plus, Fish, Loader2, X, Calendar, CalendarDays, Package, Search, Trash2 } from "lucide-react";
import { weeksSince, getBatchPhase, calcSurvivalRate } from "@/lib/utils";
import CurrentPlanBadge from "@/components/billing/CurrentPlanBadge";
import Link from "next/link";

type BatchStatus = "active" | "harvested" | "partial";

type Batch = {
  _id: string;
  name: string;
  initialCount: number;
  currentCount: number;
  stockingDate: string;
  juvenileCost?: number;
  targetWeight?: number;
  status: BatchStatus;
  notes?: string;
  harvestDate?: string | null;
  harvestedWeightKg?: number;
  harvestPricePerKg?: number;
  harvestNotes?: string;
};

type BatchForm = {
  name: string;
  initialCount: number;
  stockingDate: string;
  juvenileCost: number;
  targetWeight: number;
  notes: string;
};

type HarvestForm = {
  harvestDate: string;
  harvestedWeightKg: number;
  harvestPricePerKg: number;
  harvestNotes: string;
};

type ConfirmAction = {
  kind: "reopen" | "delete";
  batch: Batch;
};

type TankOption = {
  _id: string;
  name: string;
  currentFish?: number;
};

const STATUS_FILTERS: Array<{ key: "all" | BatchStatus; label: string }> = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "partial", label: "Partial" },
  { key: "harvested", label: "Harvested" },
];

export default function BatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [tanks, setTanks] = useState<TankOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showHarvestForm, setShowHarvestForm] = useState(false);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [harvestBatchId, setHarvestBatchId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [harvesting, setHarvesting] = useState(false);
  const [busyBatchId, setBusyBatchId] = useState<string | null>(null);
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [error, setError] = useState("");
  const [createError, setCreateError] = useState("");
  const [editError, setEditError] = useState("");
  const [harvestError, setHarvestError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeModalMessage, setUpgradeModalMessage] = useState(
    "You have reached your active batch limit for this plan. Upgrade your plan to create additional active batches."
  );
  const [planLabel, setPlanLabel] = useState("Free");
  const [activeBatchLimit, setActiveBatchLimit] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | BatchStatus>("all");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "name" | "survival">("newest");
  const [reopenForm, setReopenForm] = useState({ restoreCount: "", tankId: "" });

  const [form, setForm] = useState<BatchForm>({
    name: "Batch A",
    initialCount: 550,
    stockingDate: new Date().toISOString().split("T")[0],
    juvenileCost: 35000,
    targetWeight: 1000,
    notes: "",
  });

  const [editForm, setEditForm] = useState<BatchForm>({
    name: "",
    initialCount: 0,
    stockingDate: "",
    juvenileCost: 0,
    targetWeight: 1000,
    notes: "",
  });

  const [harvestForm, setHarvestForm] = useState<HarvestForm>({
    harvestDate: new Date().toISOString().split("T")[0],
    harvestedWeightKg: 0,
    harvestPricePerKg: 0,
    harvestNotes: "",
  });

  async function loadBatches() {
    const res = await fetch("/api/batches");
    const payload = await res.json();
    if (!res.ok) throw new Error(payload?.error || "Failed to load batches");
    setBatches(payload);
  }

  useEffect(() => {
    Promise.all([fetch("/api/batches"), fetch("/api/billing/status"), fetch("/api/tanks")])
      .then(async ([batchesRes, billingRes, tanksRes]) => {
        const batchesPayload = await batchesRes.json();
        const billingPayload = billingRes.ok ? await billingRes.json() : null;
        const tanksPayload = tanksRes.ok ? await tanksRes.json() : [];

        if (!batchesRes.ok) throw new Error("Failed to load batches");

        setBatches(batchesPayload);
        setTanks(Array.isArray(tanksPayload) ? tanksPayload : []);
        setPlanLabel(billingPayload?.planLabel || "Free");
        setActiveBatchLimit(
          typeof billingPayload?.limits?.maxActiveBatches === "number"
            ? billingPayload.limits.maxActiveBatches
            : null
        );
      })
      .catch((e) => setError(e.message || "Unable to load batches"))
      .finally(() => setLoading(false));
  }, []);

  function validateFormValues(values: BatchForm) {
    if (!values.name.trim()) return "Batch name is required";
    if (!Number.isFinite(values.initialCount) || values.initialCount <= 0) return "Fish count must be greater than 0";
    if (!values.stockingDate) return "Stocking date is required";
    if (!Number.isFinite(values.juvenileCost) || values.juvenileCost < 0) return "Juvenile cost cannot be negative";
    if (!Number.isFinite(values.targetWeight) || values.targetWeight <= 0) return "Target weight must be greater than 0";
    return "";
  }

  function validateHarvestValues(values: HarvestForm) {
    if (!values.harvestDate) return "Harvest date is required";
    if (!Number.isFinite(values.harvestedWeightKg) || values.harvestedWeightKg <= 0) return "Harvested weight must be greater than 0";
    if (!Number.isFinite(values.harvestPricePerKg) || values.harvestPricePerKg <= 0) return "Harvest price must be greater than 0";
    return "";
  }

  const visibleBatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = [...batches];

    if (statusFilter !== "all") list = list.filter((b) => b.status === statusFilter);
    if (q) {
      list = list.filter((b) => {
        const started = new Date(b.stockingDate).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }).toLowerCase();
        return b.name.toLowerCase().includes(q) || started.includes(q);
      });
    }

    list.sort((a, b) => {
      if (sortBy === "newest") return new Date(b.stockingDate).getTime() - new Date(a.stockingDate).getTime();
      if (sortBy === "oldest") return new Date(a.stockingDate).getTime() - new Date(b.stockingDate).getTime();
      if (sortBy === "name") return a.name.localeCompare(b.name);
      const aSurvival = Number(calcSurvivalRate(a.currentCount, a.initialCount));
      const bSurvival = Number(calcSurvivalRate(b.currentCount, b.initialCount));
      return bSurvival - aSurvival;
    });

    return list;
  }, [batches, query, sortBy, statusFilter]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");
    setCreateError("");
    const validationError = validateFormValues(form);
    if (validationError) {
      setCreating(false);
      setCreateError(validationError);
      return;
    }

    try {
      const res = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await res.json();
      if (!res.ok) {
        if (payload?.code === "PLAN_LIMIT_ACTIVE_BATCHES") {
          setShowForm(false);
          setShowUpgradeModal(true);
          setUpgradeModalMessage(
            payload?.error || "You have reached your active batch limit for this plan. Upgrade to add more."
          );
          setError("");
          setCreateError("");
          return;
        }
        throw new Error(payload?.error || "Failed to create batch");
      }
      setBatches((prev) => [payload, ...prev]);
      setShowForm(false);
      setCreateError("");
    } catch (err: any) {
      setCreateError(err?.message || "Failed to create batch");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(batch: Batch) {
    setEditingBatchId(batch._id);
    setEditForm({
      name: batch.name,
      initialCount: batch.initialCount,
      stockingDate: new Date(batch.stockingDate).toISOString().split("T")[0],
      juvenileCost: batch.juvenileCost || 0,
      targetWeight: batch.targetWeight || 1000,
      notes: batch.notes || "",
    });
    setShowEditForm(true);
    setError("");
    setEditError("");
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingBatchId) return;

    setEditing(true);
    setEditError("");
    const validationError = validateFormValues(editForm);
    if (validationError) {
      setEditing(false);
      setEditError(validationError);
      return;
    }

    try {
      const res = await fetch(`/api/batches/${editingBatchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to update batch");
      setBatches((prev) => prev.map((b) => (b._id === editingBatchId ? payload : b)));
      setShowEditForm(false);
      setEditingBatchId(null);
      setEditError("");
    } catch (err: any) {
      setEditError(err?.message || "Failed to update batch");
    } finally {
      setEditing(false);
    }
  }

  function startHarvest(batch: Batch) {
    setHarvestBatchId(batch._id);
    setHarvestForm({
      harvestDate: new Date().toISOString().split("T")[0],
      harvestedWeightKg: batch.harvestedWeightKg || 0,
      harvestPricePerKg: batch.harvestPricePerKg || 0,
      harvestNotes: batch.harvestNotes || "",
    });
    setShowHarvestForm(true);
    setError("");
    setHarvestError("");
  }

  function startReopen(batch: Batch) {
    setReopenForm({
      restoreCount: String(batch.currentCount > 0 ? batch.currentCount : batch.initialCount),
      tankId: "",
    });
    setConfirmError("");
    setConfirmAction({ kind: "reopen", batch });
  }

  async function confirmHarvest(e: React.FormEvent) {
    e.preventDefault();
    if (!harvestBatchId) return;
    const batch = batches.find((item) => item._id === harvestBatchId);
    if (!batch) {
      setHarvestError("Selected batch could not be found");
      return;
    }

    setHarvesting(true);
    setHarvestError("");
    const validationError = validateHarvestValues(harvestForm);
    if (validationError) {
      setHarvesting(false);
      setHarvestError(validationError);
      return;
    }

    try {
      const res = await fetch("/api/harvest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: harvestBatchId,
          fishSold: batch.currentCount,
          date: harvestForm.harvestDate,
          weightKg: harvestForm.harvestedWeightKg,
          pricePerKg: harvestForm.harvestPricePerKg,
          buyer: "",
          channel: "other",
          markBatchHarvested: true,
          harvestNotes: harvestForm.harvestNotes,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to mark harvested");
      await loadBatches();
      setShowHarvestForm(false);
      setHarvestBatchId(null);
      setHarvestError("");
    } catch (err: any) {
      setHarvestError(err?.message || "Failed to mark harvested");
    } finally {
      setHarvesting(false);
    }
  }

  async function reopenBatch(batch: Batch) {
    setBusyBatchId(batch._id);
    setConfirmError("");

    try {
      const res = await fetch(`/api/batches/${batch._id}/reopen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restoreCount: Number(reopenForm.restoreCount || 0),
          tankId: reopenForm.tankId || undefined,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to reopen batch");
      await loadBatches();
      setConfirmAction(null);
    } catch (err: any) {
      setConfirmError(err?.message || "Failed to reopen batch");
    } finally {
      setBusyBatchId(null);
    }
  }

  async function deleteBatch(batch: Batch) {
    setDeletingBatchId(batch._id);
    setConfirmError("");

    try {
      const res = await fetch(`/api/batches/${batch._id}`, { method: "DELETE" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to delete batch");
      setBatches((prev) => prev.filter((b) => b._id !== batch._id));
    } catch (err: any) {
      setConfirmError(err?.message || "Failed to delete batch");
    } finally {
      setDeletingBatchId(null);
    }
  }

  async function confirmAndRunAction() {
    if (!confirmAction) return;
    const action = confirmAction;
    if (action.kind === "reopen") await reopenBatch(action.batch);
    else {
      setConfirmAction(null);
      await deleteBatch(action.batch);
    }
  }

  const PHASE_COLORS: Record<string, string> = {
    Juvenile: "badge-water",
    "Post-Juvenile": "badge-green",
    Grower: "badge-amber",
    Finisher: "badge-amber",
    "Harvest Ready": "badge-green",
  };
  const activeBatchCount = batches.filter((batch) => batch.status === "active").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-pond-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-semibold text-pond-100">Batches</h1>
          <p className="text-pond-200/75 text-sm mt-1">Manage your production batches</p>
          {activeBatchLimit !== null ? (
            <p className="text-xs text-pond-300 mt-1">
              {planLabel}: {activeBatchCount}/{activeBatchLimit} active batches used
            </p>
          ) : (
            <p className="text-xs text-pond-300 mt-1">{planLabel}: Unlimited active batches</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <CurrentPlanBadge />
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> New Batch
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl px-4 py-3 text-sm text-danger border border-red-400/30 bg-red-500/10">
          {error}
        </div>
      )}

      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            onClick={() => setShowUpgradeModal(false)}
            aria-label="Close upgrade prompt"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-amber-400/35 bg-[#0f141b] p-5 shadow-2xl">
            <p className="text-xs uppercase tracking-wider text-amber-200/70">Plan limit reached</p>
            <h3 className="mt-1 text-xl font-semibold text-pond-100">Upgrade to create more active batches</h3>
            <p className="mt-2 text-sm text-pond-200/80">
              {upgradeModalMessage}
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setShowUpgradeModal(false)}
                className="btn-secondary w-full"
              >
                Close
              </button>
              <Link href="/settings/billing" className="btn-primary w-full text-center">
                Go to Billing
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="glass-card p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              className={`badge transition-opacity ${statusFilter === f.key ? "badge-water" : "badge-green"}`}
              onClick={() => setStatusFilter(f.key)}
              type="button"
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-pond-300" />
            <input
              className="field pl-9"
              placeholder="Search by batch name or date"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select className="field" value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name">Name (A-Z)</option>
            <option value="survival">Highest survival</option>
          </select>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(12, 12, 14,0.85)", backdropFilter: "blur(8px)" }}>
          <div className="glass-card w-full max-w-md max-h-[85vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg text-pond-100">New Batch</h2>
              <button
                onClick={() => {
                  setCreateError("");
                  setShowForm(false);
                }}
                className="text-pond-200/75 hover:text-pond-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={create} className="space-y-4">
              {createError && (
                <div className="rounded-xl px-4 py-3 text-sm text-danger border border-red-400/30 bg-red-500/10">
                  {createError}
                </div>
              )}
              <div>
                <label className="block text-xs text-pond-300 mb-1.5 font-medium">Batch Name</label>
                <input className="field" required placeholder="Batch A - January Juveniles" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Initial Fish Count</label>
                  <input className="field" type="number" min={1} required placeholder="1000" value={form.initialCount} onChange={(e) => setForm((f) => ({ ...f, initialCount: +e.target.value }))} />
                  <p className="text-xs text-pond-200/60 mt-1">Original stocked fish count. Use Reopen Batch or Tanks flows to repair live fish totals.</p>
                </div>
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Juvenile Cost (₦)</label>
                  <input className="field" type="number" min={0} placeholder="450000" value={form.juvenileCost} onChange={(e) => setForm((f) => ({ ...f, juvenileCost: +e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-pond-300 mb-1.5 font-medium">Target Weight (g)</label>
                <input className="field" type="number" min={1} placeholder="1200" value={form.targetWeight} onChange={(e) => setForm((f) => ({ ...f, targetWeight: +e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-pond-300 mb-1.5 font-medium">Stocking Date</label>
                <div className="date-field-wrap">
                  <span className="date-field-badge" />
                  <CalendarDays className="date-field-icon h-5 w-5 text-pond-200/80" strokeWidth={2.25} />
                  <input className="field" type="date" required value={form.stockingDate} onChange={(e) => setForm((f) => ({ ...f, stockingDate: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-pond-300 mb-1.5 font-medium">Notes</label>
                <textarea className="field resize-none" rows={2} placeholder="Stocked from Ibadan hatchery" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setCreateError("");
                    setShowForm(false);
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button type="submit" disabled={creating} className="btn-primary flex-1">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {creating ? "Creating…" : "Create Batch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(12, 12, 14,0.85)", backdropFilter: "blur(8px)" }}>
          <div className="glass-card w-full max-w-md max-h-[85vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg text-pond-100">Edit Batch</h2>
              <button
                onClick={() => {
                  setEditError("");
                  setShowEditForm(false);
                  setEditingBatchId(null);
                }}
                className="text-pond-200/75 hover:text-pond-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={saveEdit} className="space-y-4">
              {editError && (
                <div className="rounded-xl px-4 py-3 text-sm text-danger border border-red-400/30 bg-red-500/10">
                  {editError}
                </div>
              )}
              <div>
                <label className="block text-xs text-pond-300 mb-1.5 font-medium">Batch Name</label>
                <input className="field" required placeholder="Batch A - January Juveniles" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Initial Fish Count</label>
                  <input className="field" type="number" min={1} required placeholder="1000" value={editForm.initialCount} onChange={(e) => setEditForm((f) => ({ ...f, initialCount: +e.target.value }))} />
                  <p className="text-xs text-pond-200/60 mt-1">Original stocked fish count only. This does not change the current fish alive in tanks.</p>
                </div>
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Juvenile Cost (₦)</label>
                  <input className="field" type="number" min={0} placeholder="450000" value={editForm.juvenileCost} onChange={(e) => setEditForm((f) => ({ ...f, juvenileCost: +e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-pond-300 mb-1.5 font-medium">Target Weight (g)</label>
                <input className="field" type="number" min={1} placeholder="1200" value={editForm.targetWeight} onChange={(e) => setEditForm((f) => ({ ...f, targetWeight: +e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-pond-300 mb-1.5 font-medium">Stocking Date</label>
                <div className="date-field-wrap">
                  <span className="date-field-badge" />
                  <CalendarDays className="date-field-icon h-5 w-5 text-pond-200/80" strokeWidth={2.25} />
                  <input className="field" type="date" required value={editForm.stockingDate} onChange={(e) => setEditForm((f) => ({ ...f, stockingDate: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-pond-300 mb-1.5 font-medium">Notes</label>
                <textarea className="field resize-none" rows={2} placeholder="Stocked from Ibadan hatchery" value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditError("");
                    setShowEditForm(false);
                    setEditingBatchId(null);
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button type="submit" disabled={editing} className="btn-primary flex-1">
                  {editing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {editing ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showHarvestForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(12, 12, 14,0.85)", backdropFilter: "blur(8px)" }}>
          <div className="glass-card w-full max-w-md max-h-[85vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg text-pond-100">Confirm Harvest</h2>
              <button
                onClick={() => {
                  setHarvestError("");
                  setShowHarvestForm(false);
                  setHarvestBatchId(null);
                }}
                className="text-pond-200/75 hover:text-pond-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={confirmHarvest} className="space-y-4">
              {harvestError && (
                <div className="rounded-xl px-4 py-3 text-sm text-danger border border-red-400/30 bg-red-500/10">
                  {harvestError}
                </div>
              )}
              <div>
                <label className="block text-xs text-pond-300 mb-1.5 font-medium">Harvest Date</label>
                <div className="date-field-wrap">
                  <span className="date-field-badge" />
                  <CalendarDays className="date-field-icon h-5 w-5 text-pond-200/80" strokeWidth={2.25} />
                  <input className="field" type="date" required value={harvestForm.harvestDate} onChange={(e) => setHarvestForm((f) => ({ ...f, harvestDate: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Harvested Weight (kg)</label>
                  <input className="field" type="number" min={0.1} step="0.1" placeholder="850" value={harvestForm.harvestedWeightKg} onChange={(e) => setHarvestForm((f) => ({ ...f, harvestedWeightKg: +e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Price/kg (₦)</label>
                  <input className="field" type="number" min={1} placeholder="2200" value={harvestForm.harvestPricePerKg} onChange={(e) => setHarvestForm((f) => ({ ...f, harvestPricePerKg: +e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-pond-300 mb-1.5 font-medium">Harvest Notes</label>
                <textarea className="field resize-none" rows={2} placeholder="Sold to local market buyers" value={harvestForm.harvestNotes} onChange={(e) => setHarvestForm((f) => ({ ...f, harvestNotes: e.target.value }))} />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setHarvestError("");
                    setShowHarvestForm(false);
                    setHarvestBatchId(null);
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button type="submit" disabled={harvesting} className="btn-primary flex-1">
                  {harvesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                  {harvesting ? "Saving…" : "Mark Harvested"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(12, 12, 14,0.85)", backdropFilter: "blur(8px)" }}>
          <div className="glass-card w-full max-w-md max-h-[85vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg text-pond-100">
                {confirmAction.kind === "delete" ? "Delete Batch" : "Reopen Batch"}
              </h2>
              <button onClick={() => { setConfirmAction(null); setConfirmError(""); }} className="text-pond-200/75 hover:text-pond-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            {confirmError && (
              <div className="rounded-xl px-4 py-3 text-sm text-danger border border-red-400/30 bg-red-500/10">
                {confirmError}
              </div>
            )}
            <p className="text-sm text-pond-200/75">
              {confirmAction.kind === "delete"
                ? `Delete ${confirmAction.batch.name}? This will remove it from your active records.`
                : `Reopen ${confirmAction.batch.name}? Harvest metadata will be cleared and the restored fish count will become the live batch total again.`}
            </p>
            {confirmAction.kind === "reopen" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Restore Fish Alive</label>
                  <input
                    className="field"
                    type="number"
                    min={1}
                    placeholder="537"
                    value={reopenForm.restoreCount}
                    onChange={(e) => setReopenForm((form) => ({ ...form, restoreCount: e.target.value }))}
                  />
                  <p className="text-xs text-pond-200/60 mt-1">
                    Enter the correct remaining fish count for this batch.
                  </p>
                </div>
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Assign to Tank (optional)</label>
                  <select
                    className="field"
                    value={reopenForm.tankId}
                    onChange={(e) => setReopenForm((form) => ({ ...form, tankId: e.target.value }))}
                  >
                    <option value="">Leave fish unassigned</option>
                    {tanks.map((tank) => (
                      <option key={tank._id} value={tank._id}>
                        {tank.name} ({Number(tank.currentFish || 0).toLocaleString()} fish)
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-pond-200/60 mt-1">
                    Pick the tank that already shows these fish, or leave blank and allocate later from Tanks.
                  </p>
                </div>
              </div>
            )}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => { setConfirmAction(null); setConfirmError(""); }} className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmAndRunAction}
                className={`btn-primary flex-1 ${confirmAction.kind === "delete" ? "bg-red-700 hover:bg-red-600" : ""}`}
              >
                {confirmAction.kind === "delete" ? "Delete Batch" : "Reopen Batch"}
              </button>
            </div>
          </div>
        </div>
      )}

      {visibleBatches.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <Package className="w-12 h-12 text-pond-500 mx-auto mb-4 opacity-40" />
          <h3 className="font-display text-lg text-pond-200 mb-2">No batches found</h3>
          <p className="text-pond-200/75 text-sm mb-6">Try changing filters/search or create a new batch.</p>
          <button onClick={() => setShowForm(true)} className="btn-primary inline-flex">
            <Plus className="w-4 h-4" /> Create Batch
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleBatches.map((batch) => {
            const weeks = weeksSince(new Date(batch.stockingDate));
            const { phase, next } = getBatchPhase(weeks);
            const survival = calcSurvivalRate(batch.currentCount, batch.initialCount);
            const progress = Math.min((weeks / 18) * 100, 100);
            const harvestEta = new Date(batch.stockingDate);
            harvestEta.setDate(harvestEta.getDate() + 18 * 7);
            const rowBusy = busyBatchId === batch._id || deletingBatchId === batch._id;

            return (
              <div key={batch._id} className="glass-card p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg,#4b5563,#064b71)" }}>
                      <Fish className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-medium text-pond-100">{batch.name}</h3>
                      <p className="text-xs text-pond-200/75">
                        Started {new Date(batch.stockingDate).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className={`badge ${PHASE_COLORS[phase] || "badge-green"}`}>{phase}</span>
                    <span className={`badge ${batch.status === "active" ? "badge-water" : "badge-amber"}`}>{batch.status}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { label: "Fish Alive", value: batch.currentCount.toLocaleString(), color: "#9ca3af" },
                    { label: "Survival", value: `${survival}%`, color: +survival > 85 ? "#9ca3af" : "#d3bf86" },
                    { label: "Week", value: `${weeks} / 18`, color: "#75d7ff" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="text-center rounded-xl py-3" style={{ background: "rgba(12, 12, 14,0.5)", border: "1px solid rgba(148, 163, 184,0.1)" }}>
                      <p className="font-mono font-semibold text-lg" style={{ color }}>{value}</p>
                      <p className="text-xs text-pond-200/65 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>

                <div>
                  <div className="flex justify-between text-xs text-pond-200/65 mb-1.5">
                    <span>Cycle progress</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-mud-300">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Harvest est. {harvestEta.toLocaleDateString("en-NG", { day: "numeric", month: "short" })}</span>
                  </div>
                  <span className="badge badge-amber">{next}</span>
                </div>

                {batch.notes && <p className="text-xs text-pond-200/65 italic border-t border-pond-700/20 pt-3">{batch.notes}</p>}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button className="btn-secondary !px-3 !py-2 text-xs" onClick={() => startEdit(batch)} disabled={rowBusy}>Edit</button>
                  {batch.status !== "harvested" ? (
                    <button className="btn-secondary !px-3 !py-2 text-xs" onClick={() => startHarvest(batch)} disabled={rowBusy}>Mark Harvested</button>
                  ) : (
                    <button className="btn-secondary !px-3 !py-2 text-xs" onClick={() => startReopen(batch)} disabled={rowBusy}>
                      {busyBatchId === batch._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Reopen Batch"}
                    </button>
                  )}
                  <button className="btn-secondary !px-3 !py-2 text-xs text-danger" onClick={() => setConfirmAction({ kind: "delete", batch })} disabled={rowBusy}>
                    {deletingBatchId === batch._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    {deletingBatchId === batch._id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
