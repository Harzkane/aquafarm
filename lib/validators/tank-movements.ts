import { Types } from "mongoose";

export type MovePayload = {
  batchId: string;
  fromTankId: string;
  toTankId: string;
  count: number;
  date: Date;
  reason: string;
  notes: string;
};

function normalizeText(v: unknown, maxLen: number) {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, maxLen);
}

export function validateMove(body: any): { ok: true; value: MovePayload } | { ok: false; error: string } {
  const batchId = normalizeText(body?.batchId, 80);
  const fromTankId = normalizeText(body?.fromTankId, 80);
  const toTankId = normalizeText(body?.toTankId, 80);
  const countRaw = Number(body?.count);
  const count = Math.trunc(countRaw);
  const date = body?.date ? new Date(body.date) : new Date();
  const reason = normalizeText(body?.reason, 80) || "sorting";
  const notes = normalizeText(body?.notes, 500);

  if (!Types.ObjectId.isValid(batchId)) return { ok: false, error: "Valid batch is required" };
  if (!Types.ObjectId.isValid(fromTankId)) return { ok: false, error: "Valid source tank is required" };
  if (!Types.ObjectId.isValid(toTankId)) return { ok: false, error: "Valid destination tank is required" };
  if (fromTankId === toTankId) return { ok: false, error: "Source and destination tank must be different" };
  if (!Number.isFinite(countRaw) || count <= 0) return { ok: false, error: "Move count must be greater than 0" };
  if (Number.isNaN(date.getTime())) return { ok: false, error: "Invalid move date" };

  return { ok: true, value: { batchId, fromTankId, toTankId, count, date, reason, notes } };
}

