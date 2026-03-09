"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  Droplets,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Waves,
  X,
} from "lucide-react";

type TankType = "tarpaulin" | "half-cut" | "concrete" | "fiberglass";
type TankStatus = "empty" | "active" | "cleaning" | "quarantine";

type Tank = {
  _id: string;
  name: string;
  type: TankType;
  capacity: number;
  workingVolume?: number;
  dimensions?: string;
  status: TankStatus;
  currentFish?: number;
  targetFishCapacity?: number;
  notes?: string;
};

type BatchOption = {
  _id: string;
  name: string;
  status: "active" | "partial" | "harvested";
};

type TankMovement = {
  _id: string;
  batchId: { _id: string; name?: string } | string;
  fromTankName: string;
  toTankName: string;
  count: number;
  date: string;
  reason?: string;
  notes?: string;
};

type TankForm = {
  name: string;
  type: TankType;
  capacity: string;
  dimensions: string;
  notes: string;
  status: TankStatus;
  currentFish: string;
  targetFishCapacity: string;
};

type MoveForm = {
  batchId: string;
  fromTankId: string;
  toTankId: string;
  count: string;
  date: string;
  reason: string;
  notes: string;
};

const TANK_TYPES: TankType[] = [
  "tarpaulin",
  "half-cut",
  "concrete",
  "fiberglass",
];
const STATUSES: TankStatus[] = ["empty", "active", "cleaning", "quarantine"];
const STATUS_BADGE: Record<TankStatus, string> = {
  active: "badge-green",
  empty: "badge-water",
  cleaning: "badge-amber",
  quarantine: "badge-red",
};

const YOUR_TANKS: Array<
  Partial<Tank> & { name: string; type: TankType; capacity: number }
> = [
  {
    name: "Tarpaulin Tank",
    type: "tarpaulin",
    capacity: 10000,
    targetFishCapacity: 1000,
    dimensions: "12ft × 12ft × 4ft",
    notes: "Main grow-out tank. Move bigger fish",
    status: "empty",
  },
  {
    name: "5,000L Half-Tank",
    type: "half-cut",
    capacity: 2500,
    targetFishCapacity: 600,
    dimensions: "Half of 5,000L tank",
    notes: "Medium fish",
    status: "empty",
  },
  {
    name: "3,500L Half-Tank",
    type: "half-cut",
    capacity: 1750,
    targetFishCapacity: 520,
    dimensions: "Half of 3,500L tank",
    notes: "Start 520 juveniles here from Day 1",
    status: "empty",
  },
  {
    name: "2,500L Half-Tank",
    type: "half-cut",
    capacity: 1250,
    targetFishCapacity: 400,
    dimensions: "Half of 2,500L tank",
    notes: "Reserve for runts & quarantine",
    status: "empty",
  },
];

const initialForm: TankForm = {
  name: "",
  type: "half-cut",
  capacity: "",
  dimensions: "",
  notes: "",
  status: "empty",
  currentFish: "0",
  targetFishCapacity: "0",
};

const initialMoveForm: MoveForm = {
  batchId: "",
  fromTankId: "",
  toTankId: "",
  count: "",
  date: new Date().toISOString().split("T")[0],
  reason: "sorting",
  notes: "",
};

function toForm(tank: Tank): TankForm {
  return {
    name: tank.name || "",
    type: tank.type || "half-cut",
    capacity: String(tank.capacity || ""),
    dimensions: tank.dimensions || "",
    notes: tank.notes || "",
    status: tank.status || "empty",
    currentFish: String(tank.currentFish || 0),
    targetFishCapacity: String(tank.targetFishCapacity || 0),
  };
}

export default function TanksPage() {
  const [tanks, setTanks] = useState<Tank[]>([]);
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [movements, setMovements] = useState<TankMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<TankForm>(initialForm);

  const [editingTank, setEditingTank] = useState<Tank | null>(null);
  const [editForm, setEditForm] = useState<TankForm>(initialForm);

  const [deletingTank, setDeletingTank] = useState<Tank | null>(null);

  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveForm, setMoveForm] = useState<MoveForm>(initialMoveForm);
  const [moveError, setMoveError] = useState("");

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [tanksRes, batchesRes, movesRes] = await Promise.all([
        fetch("/api/tanks"),
        fetch("/api/batches"),
        fetch("/api/tanks/movements?limit=100"),
      ]);

      const tanksPayload = await tanksRes.json();
      const batchesPayload = await batchesRes.json();
      const movesPayload = await movesRes.json();

      if (!tanksRes.ok)
        throw new Error(tanksPayload?.error || "Failed to load tanks");
      if (!batchesRes.ok)
        throw new Error(batchesPayload?.error || "Failed to load batches");
      if (!movesRes.ok)
        throw new Error(movesPayload?.error || "Failed to load tank movements");

      setTanks(tanksPayload || []);
      setBatches(
        (batchesPayload || []).filter(
          (b: BatchOption) => b.status === "active" || b.status === "partial",
        ),
      );
      setMovements(movesPayload || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load tanks");
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setCreateForm(initialForm);
    setShowCreate(true);
    setError("");
  }

  function openEdit(tank: Tank) {
    setEditingTank(tank);
    setEditForm(toForm(tank));
    setError("");
  }

  function openMove(fromTankId?: string) {
    const defaultBatchId = batches[0]?._id || "";
    const defaultFrom =
      fromTankId ||
      tanks.find((t) => Number(t.currentFish || 0) > 0)?._id ||
      "";
    const defaultTo = tanks.find((t) => t._id !== defaultFrom)?._id || "";
    setMoveForm({
      ...initialMoveForm,
      batchId: defaultBatchId,
      fromTankId: defaultFrom,
      toTankId: defaultTo,
    });
    setMoveError("");
    setShowMoveModal(true);
    setError("");
  }

  async function createTank(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/tanks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...createForm,
          capacity: Number(createForm.capacity),
          currentFish: Number(createForm.currentFish),
          targetFishCapacity: Number(createForm.targetFishCapacity),
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to create tank");

      setTanks((prev) => {
        const existing = prev.find((t) => t._id === payload._id);
        if (existing) return prev;
        return [...prev, payload];
      });
      setShowCreate(false);
      setCreateForm(initialForm);
    } catch (err: any) {
      setError(err?.message || "Failed to create tank");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTank) return;

    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/tanks/${editingTank._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editForm,
          capacity: Number(editForm.capacity),
          currentFish: Number(editForm.currentFish),
          targetFishCapacity: Number(editForm.targetFishCapacity),
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to update tank");

      setTanks((prev) =>
        prev.map((t) => (t._id === payload._id ? payload : t)),
      );
      setEditingTank(null);
    } catch (err: any) {
      setError(err?.message || "Failed to update tank");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deletingTank) return;
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/tanks/${deletingTank._id}`, {
        method: "DELETE",
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to delete tank");

      setTanks((prev) => prev.filter((t) => t._id !== deletingTank._id));
      setDeletingTank(null);
    } catch (err: any) {
      setError(err?.message || "Failed to delete tank");
    } finally {
      setSaving(false);
    }
  }

  async function submitMove(e: React.FormEvent) {
    e.preventDefault();
    setMoving(true);
    setError("");
    setMoveError("");

    try {
      const res = await fetch("/api/tanks/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...moveForm,
          count: Number(moveForm.count),
          date: moveForm.date,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to move fish");

      setShowMoveModal(false);
      setMoveForm(initialMoveForm);
      setMoveError("");
      await loadData();
    } catch (err: any) {
      const message = err?.message || "Failed to move fish";
      setMoveError(message);
      setError(message);
    } finally {
      setMoving(false);
    }
  }

  async function seedMyTanks() {
    setSaving(true);
    setError("");

    try {
      await Promise.all(
        YOUR_TANKS.map(async (tank) => {
          const res = await fetch("/api/tanks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(tank),
          });
          const payload = await res.json();
          if (!res.ok)
            throw new Error(payload?.error || `Failed creating ${tank.name}`);
        }),
      );
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to seed tanks");
    } finally {
      setSaving(false);
    }
  }

  const totalWorking = useMemo(
    () => tanks.reduce((sum, tank) => sum + Number(tank.workingVolume || 0), 0),
    [tanks],
  );
  const totalFish = useMemo(
    () => tanks.reduce((sum, tank) => sum + Number(tank.currentFish || 0), 0),
    [tanks],
  );
  const activeTanks = useMemo(
    () => tanks.filter((tank) => tank.status === "active").length,
    [tanks],
  );
  const totalFishTarget = useMemo(
    () =>
      tanks.reduce(
        (sum, tank) => sum + Number(tank.targetFishCapacity || 0),
        0,
      ),
    [tanks],
  );
  const overallFishLoadPct =
    totalFishTarget > 0 ? Math.round((totalFish / totalFishTarget) * 100) : 0;
  const selectedFromTank = useMemo(
    () => tanks.find((t) => t._id === moveForm.fromTankId) || null,
    [tanks, moveForm.fromTankId],
  );
  const selectedToTank = useMemo(
    () => tanks.find((t) => t._id === moveForm.toTankId) || null,
    [tanks, moveForm.toTankId],
  );
  const requestedMove = Number(moveForm.count || 0);
  const sourceAvailable = Number(selectedFromTank?.currentFish || 0);
  const toCurrent = Number(selectedToTank?.currentFish || 0);
  const toTarget = Number(selectedToTank?.targetFishCapacity || 0);
  const toRemaining =
    toTarget > 0 ? Math.max(0, toTarget - toCurrent) : Number.POSITIVE_INFINITY;
  const exceedsSource =
    Number.isFinite(requestedMove) && requestedMove > sourceAvailable;
  const exceedsTarget =
    Number.isFinite(requestedMove) &&
    Number.isFinite(toRemaining) &&
    requestedMove > toRemaining;
  const moveFormValid =
    !!moveForm.batchId &&
    !!moveForm.fromTankId &&
    !!moveForm.toTankId &&
    moveForm.fromTankId !== moveForm.toTankId &&
    !!moveForm.date &&
    Number.isFinite(requestedMove) &&
    requestedMove > 0 &&
    !exceedsSource &&
    !exceedsTarget;

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
          <h1 className="font-display text-2xl font-semibold text-pond-100">
            Tanks
          </h1>
          <p className="text-pond-200/75 text-sm mt-1">
            Manage your tank setup, status and fish allocation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => openMove()} className="btn-secondary">
            <ArrowRightLeft className="w-4 h-4" /> Move Fish
          </button>
          <button onClick={openCreate} className="btn-primary">
            <Plus className="w-4 h-4" /> Add Tank
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl px-4 py-3 text-sm text-danger border border-red-400/30 bg-red-500/10 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {tanks.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            {
              label: "Total Working Volume",
              value: `${totalWorking.toLocaleString()}L`,
            },
            {
              label: "Active Tanks",
              value: `${activeTanks} / ${tanks.length}`,
            },
            {
              label: "Total Fish Tracked / Capacity",
              value:
                totalFishTarget > 0
                  ? `${totalFish.toLocaleString()} / ${totalFishTarget.toLocaleString()} (${overallFishLoadPct}%)`
                  : totalFish.toLocaleString(),
            },
          ].map(({ label, value }) => (
            <div key={label} className="glass-card px-4 py-3">
              <p className="text-xs text-pond-200/75 mb-1">{label}</p>
              <p className="font-mono font-semibold text-pond-200">{value}</p>
            </div>
          ))}
        </div>
      )}

      {tanks.length === 0 && (
        <div className="glass-card p-6 text-center space-y-4">
          <Waves className="w-10 h-10 text-pond-500 mx-auto opacity-50" />
          <div>
            <h3 className="font-display text-lg text-pond-200 mb-1">
              Set up your tanks
            </h3>
            <p className="text-pond-200/75 text-sm">
              Quickly add your 4 tanks (tarpaulin + 3 half-cut) or add manually
            </p>
          </div>
          <div className="flex gap-3 justify-center flex-wrap">
            <button
              onClick={seedMyTanks}
              disabled={saving}
              className="btn-primary"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Droplets className="w-4 h-4" />
              )}
              Add My 4 Tanks
            </button>
            <button onClick={openCreate} className="btn-secondary">
              Add Manually
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tanks.map((tank) => {
          const fillPct =
            tank.capacity > 0
              ? Math.round(
                  (Number(tank.workingVolume || 0) / tank.capacity) * 100,
                )
              : 0;
          const currentFish = Number(tank.currentFish || 0);
          const targetFish = Number(tank.targetFishCapacity || 0);
          const fishPct =
            targetFish > 0 ? Math.round((currentFish / targetFish) * 100) : 0;
          const fishBarColor =
            fishPct >= 100
              ? "linear-gradient(90deg,#7f1d1d,#dc2626)"
              : fishPct >= 85
                ? "linear-gradient(90deg,#a16207,#f59e0b)"
                : "linear-gradient(90deg,#14532d,#16a34a)";
          return (
            <div key={tank._id} className="glass-card p-5 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: "linear-gradient(135deg,#064b71,#006ba5)",
                    }}
                  >
                    <Waves className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-medium text-pond-100 truncate">
                      {tank.name}
                    </h3>
                    <p className="text-xs text-pond-200/75 capitalize truncate">
                      {tank.type} · {tank.dimensions || "—"}
                    </p>
                  </div>
                </div>
                <span
                  className={`badge ${STATUS_BADGE[tank.status] || "badge-water"} capitalize`}
                >
                  {tank.status}
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs text-pond-200/75">
                  <span>Full capacity</span>
                  <span className="font-mono">
                    {tank.capacity.toLocaleString()}L
                  </span>
                </div>
                <div className="flex justify-between text-xs text-pond-300">
                  <span>Working volume (75-80%)</span>
                  <span className="font-mono font-medium">
                    {Number(tank.workingVolume || 0).toLocaleString()}L
                  </span>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${fillPct}%`,
                      background: "linear-gradient(90deg,#006ba5,#00a8f0)",
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs text-pond-200/75">
                  <span>Fish load</span>
                  <span className="font-mono">
                    {currentFish.toLocaleString()}
                    {targetFish > 0 ? ` / ${targetFish.toLocaleString()}` : ""}
                  </span>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${Math.min(fishPct, 100)}%`,
                      background: fishBarColor,
                    }}
                  />
                </div>
                <p
                  className={`text-[11px] ${fishPct >= 100 ? "text-danger" : fishPct >= 85 ? "text-amber-400" : "text-success"}`}
                >
                  {targetFish > 0
                    ? `${fishPct}% of fish capacity`
                    : "Set fish capacity to track fish load"}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div
                  className="rounded-lg px-3 py-2"
                  style={{
                    background: "rgba(12, 12, 14,0.5)",
                    border: "1px solid rgba(148, 163, 184,0.1)",
                  }}
                >
                  <p className="text-pond-200/65">Current fish</p>
                  <p className="font-mono font-medium text-pond-200 mt-0.5">
                    {currentFish.toLocaleString()}
                  </p>
                </div>
                <div
                  className="rounded-lg px-3 py-2"
                  style={{
                    background: "rgba(12, 12, 14,0.5)",
                    border: "1px solid rgba(148, 163, 184,0.1)",
                  }}
                >
                  <p className="text-pond-200/65">Fish Capacity</p>
                  <p className="font-medium text-water-300 mt-0.5">
                    {targetFish > 0 ? targetFish.toLocaleString() : "Not set"}
                  </p>
                </div>
              </div>

              {tank.notes && (
                <p className="text-xs text-pond-200/65 italic">{tank.notes}</p>
              )}

              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <button
                  className="btn-secondary !px-2.5 !py-1.5 text-xs"
                  onClick={() => openMove(tank._id)}
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" /> Move Fish
                </button>
                <button
                  className="btn-secondary !px-2.5 !py-1.5 text-xs"
                  onClick={() => openEdit(tank)}
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  className="btn-secondary !px-2.5 !py-1.5 text-xs text-danger"
                  onClick={() => setDeletingTank(tank)}
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 border-b border-pond-700/20 flex items-center justify-between gap-2">
          <h2 className="section-title">Movement History</h2>
          <p className="text-xs text-pond-200/65">{movements.length} records</p>
        </div>
        {movements.length === 0 ? (
          <div className="p-6 text-center text-pond-200/65 text-sm">No movements recorded yet</div>
        ) : (
          <>
            <div className="md:hidden divide-y divide-pond-700/20">
              {movements.map((move) => (
                <div key={move._id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-pond-200 font-medium">{move.fromTankName} → {move.toTankName}</p>
                    <p className="font-mono text-xs text-pond-300">
                      {new Date(move.date).toLocaleDateString("en-NG", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <p className="text-pond-200/70">Batch: <span className="text-pond-200">{typeof move.batchId === "string" ? "—" : move.batchId?.name || "—"}</span></p>
                    <p className="text-pond-200/70">Count: <span className="font-mono text-water-300">{move.count}</span></p>
                    <p className="text-pond-200/70">Reason: <span className="text-pond-200 capitalize">{move.reason || "sorting"}</span></p>
                  </div>
                  {move.notes && <p className="text-xs text-pond-200/70">{move.notes}</p>}
                </div>
              ))}
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Batch</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Count</th>
                    <th>Reason</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((move) => (
                    <tr key={move._id}>
                      <td className="font-mono text-xs">
                        {new Date(move.date).toLocaleDateString("en-NG", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="text-xs">
                        {typeof move.batchId === "string"
                          ? "—"
                          : move.batchId?.name || "—"}
                      </td>
                      <td className="text-xs">{move.fromTankName}</td>
                      <td className="text-xs">{move.toTankName}</td>
                      <td>
                        <span className="badge badge-water font-mono">
                          {move.count}
                        </span>
                      </td>
                      <td className="text-xs capitalize">
                        {move.reason || "sorting"}
                      </td>
                      <td
                        className="text-xs text-pond-200/65 max-w-xs truncate"
                        title={move.notes || ""}
                      >
                        {move.notes || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {showMoveModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{
            background: "rgba(12, 12, 14,0.85)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div className="glass-card w-full max-w-lg max-h-[85vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg text-pond-100">
                Move Fish (Sorting/Transfer)
              </h2>
              <button
                onClick={() => setShowMoveModal(false)}
                className="text-pond-200/75 hover:text-pond-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={submitMove} className="space-y-4">
              {moveError && (
                <div className="rounded-xl px-3 py-2 text-sm text-danger border border-red-400/30 bg-red-500/10">
                  {moveError}
                </div>
              )}
              <div>
                <label className="block text-xs text-pond-300 mb-1.5 font-medium">
                  Batch *
                </label>
                <select
                  className="field"
                  required
                  value={moveForm.batchId}
                  onChange={(e) =>
                    setMoveForm((f) => ({ ...f, batchId: e.target.value }))
                  }
                >
                  <option value="">Select batch…</option>
                  {batches.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">
                    From Tank *
                  </label>
                  <select
                    className="field"
                    required
                    value={moveForm.fromTankId}
                    onChange={(e) =>
                      setMoveForm((f) => ({ ...f, fromTankId: e.target.value }))
                    }
                  >
                    <option value="">Select source…</option>
                    {tanks.map((tank) => (
                      <option key={tank._id} value={tank._id}>
                        {tank.name} ({Number(tank.currentFish || 0)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">
                    To Tank *
                  </label>
                  <select
                    className="field"
                    required
                    value={moveForm.toTankId}
                    onChange={(e) =>
                      setMoveForm((f) => ({ ...f, toTankId: e.target.value }))
                    }
                  >
                    <option value="">Select destination…</option>
                    {tanks
                      .filter((t) => t._id !== moveForm.fromTankId)
                      .map((tank) => (
                        <option key={tank._id} value={tank._id}>
                          {tank.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">
                    Count *
                  </label>
                  <input
                    className="field"
                    required
                    min={1}
                    type="number"
                    value={moveForm.count}
                    onChange={(e) =>
                      setMoveForm((f) => ({ ...f, count: e.target.value }))
                    }
                  />
                  <p className="text-[11px] text-pond-200/65 mt-1">
                    Source available: {sourceAvailable.toLocaleString()}
                    {Number.isFinite(toRemaining)
                      ? ` • Destination room: ${Math.max(0, toRemaining).toLocaleString()}`
                      : ""}
                  </p>
                  {(exceedsSource || exceedsTarget) && (
                    <p className="text-[11px] text-danger mt-1">
                      {exceedsSource
                        ? "Count exceeds fish available in source tank."
                        : "Count exceeds destination fish capacity."}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">
                    Date *
                  </label>
                  <input
                    className="field"
                    required
                    type="date"
                    value={moveForm.date}
                    onChange={(e) =>
                      setMoveForm((f) => ({ ...f, date: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">
                    Reason
                  </label>
                  <select
                    className="field"
                    value={moveForm.reason}
                    onChange={(e) =>
                      setMoveForm((f) => ({ ...f, reason: e.target.value }))
                    }
                  >
                    <option value="sorting">Sorting</option>
                    <option value="grading">Grading</option>
                    <option value="split">Split</option>
                    <option value="quarantine">Quarantine</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-pond-300 mb-1.5 font-medium">
                  Notes
                </label>
                <textarea
                  className="field resize-none"
                  rows={2}
                  value={moveForm.notes}
                  onChange={(e) =>
                    setMoveForm((f) => ({ ...f, notes: e.target.value }))
                  }
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowMoveModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={moving || !moveFormValid}
                  className="btn-primary flex-1"
                >
                  {moving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowRightLeft className="w-4 h-4" />
                  )}
                  {moving ? "Moving..." : "Confirm Move"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{
            background: "rgba(12, 12, 14,0.85)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div className="glass-card w-full max-w-md max-h-[85vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg text-pond-100">Add Tank</h2>
              <button
                onClick={() => setShowCreate(false)}
                className="text-pond-200/75 hover:text-pond-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={createTank} className="space-y-4">
              <div>
                <label className="block text-xs text-pond-300 mb-1.5 font-medium">
                  Tank Name
                </label>
                <input
                  className="field"
                  required
                  value={createForm.name}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">
                    Type
                  </label>
                  <select
                    className="field"
                    value={createForm.type}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        type: e.target.value as TankType,
                      }))
                    }
                  >
                    {TANK_TYPES.map((type) => (
                      <option key={type} value={type} className="capitalize">
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">
                    Capacity (L)
                  </label>
                  <input
                    className="field"
                    type="number"
                    min={1}
                    required
                    value={createForm.capacity}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, capacity: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">
                    Status
                  </label>
                  <select
                    className="field"
                    value={createForm.status}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        status: e.target.value as TankStatus,
                      }))
                    }
                  >
                    {STATUSES.map((status) => (
                      <option
                        key={status}
                        value={status}
                        className="capitalize"
                      >
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">
                    Current Fish
                  </label>
                  <input
                    className="field"
                    type="number"
                    min={0}
                    value={createForm.currentFish}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        currentFish: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-pond-300 mb-1.5 font-medium">
                  Fish Capacity
                </label>
                <p className="text-[11px] text-pond-200/65 mb-1">
                  Maximum fish count this tank should hold.
                </p>
                <input
                  className="field"
                  type="number"
                  min={0}
                  value={createForm.targetFishCapacity}
                  onChange={(e) =>
                    setCreateForm((f) => ({
                      ...f,
                      targetFishCapacity: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="block text-xs text-pond-300 mb-1.5 font-medium">
                  Dimensions
                </label>
                <input
                  className="field"
                  value={createForm.dimensions}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, dimensions: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-xs text-pond-300 mb-1.5 font-medium">
                  Notes
                </label>
                <textarea
                  className="field resize-none"
                  rows={2}
                  value={createForm.notes}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, notes: e.target.value }))
                  }
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary flex-1"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Add Tank
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingTank && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{
            background: "rgba(12, 12, 14,0.85)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div className="glass-card w-full max-w-md max-h-[85vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg text-pond-100">Edit Tank</h2>
              <button
                onClick={() => setEditingTank(null)}
                className="text-pond-200/75 hover:text-pond-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={saveEdit} className="space-y-4">
              <div>
                <label className="block text-xs text-pond-300 mb-1.5 font-medium">
                  Tank Name
                </label>
                <input
                  className="field"
                  required
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">
                    Type
                  </label>
                  <select
                    className="field"
                    value={editForm.type}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        type: e.target.value as TankType,
                      }))
                    }
                  >
                    {TANK_TYPES.map((type) => (
                      <option key={type} value={type} className="capitalize">
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">
                    Capacity (L)
                  </label>
                  <input
                    className="field"
                    type="number"
                    min={1}
                    required
                    value={editForm.capacity}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, capacity: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">
                    Status
                  </label>
                  <select
                    className="field"
                    value={editForm.status}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        status: e.target.value as TankStatus,
                      }))
                    }
                  >
                    {STATUSES.map((status) => (
                      <option
                        key={status}
                        value={status}
                        className="capitalize"
                      >
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">
                    Current Fish
                  </label>
                  <input
                    className="field"
                    type="number"
                    min={0}
                    value={editForm.currentFish}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        currentFish: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-pond-300 mb-1.5 font-medium">
                  Fish Capacity
                </label>
                <p className="text-[11px] text-pond-200/65 mb-1">
                  Maximum fish count this tank should hold.
                </p>
                <input
                  className="field"
                  type="number"
                  min={0}
                  value={editForm.targetFishCapacity}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      targetFishCapacity: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="block text-xs text-pond-300 mb-1.5 font-medium">
                  Dimensions
                </label>
                <input
                  className="field"
                  value={editForm.dimensions}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, dimensions: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-xs text-pond-300 mb-1.5 font-medium">
                  Notes
                </label>
                <textarea
                  className="field resize-none"
                  rows={2}
                  value={editForm.notes}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, notes: e.target.value }))
                  }
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingTank(null)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary flex-1"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Pencil className="w-4 h-4" />
                  )}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingTank && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{
            background: "rgba(12, 12, 14,0.85)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div className="glass-card w-full max-w-md max-h-[85vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg text-pond-100">
                Delete Tank
              </h2>
              <button
                onClick={() => setDeletingTank(null)}
                className="text-pond-200/75 hover:text-pond-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-pond-200/75">
              Delete{" "}
              <span className="font-semibold text-pond-200">
                {deletingTank.name}
              </span>
              ? This action cannot be undone.
            </p>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setDeletingTank(null)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={saving}
                className="btn-primary flex-1 bg-red-700 hover:bg-red-600"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
