import { Types } from "mongoose";

const CHANNELS = ["POK", "restaurant", "market", "direct", "hotel", "other"] as const;

export type HarvestPayload = {
  batchId: string;
  fishSold?: number;
  weightKg: number;
  pricePerKg: number;
  buyer?: string;
  channel?: string;
  date?: string;
  markBatchHarvested?: boolean;
  harvestNotes?: string;
};

function parseDate(value: unknown) {
  if (!value) return new Date();
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function validateHarvestPayload(
  body: any
): { ok: true; value: HarvestPayload } | { ok: false; error: string } {
  const batchId = String(body?.batchId || "").trim();
  if (!Types.ObjectId.isValid(batchId)) return { ok: false, error: "Valid batch is required" };

  const fishSold = Math.trunc(Number(body?.fishSold || 0));
  const weightKg = Number(body?.weightKg || 0);
  const pricePerKg = Number(body?.pricePerKg || 0);
  const channel = String(body?.channel || "POK");
  const date = parseDate(body?.date);

  if (!Number.isFinite(fishSold) || fishSold < 0) return { ok: false, error: "Fish sold cannot be negative" };
  if (!Number.isFinite(weightKg) || weightKg <= 0) return { ok: false, error: "Weight (kg) must be greater than 0" };
  if (!Number.isFinite(pricePerKg) || pricePerKg <= 0) return { ok: false, error: "Price/kg must be greater than 0" };
  if (!CHANNELS.includes(channel as any)) return { ok: false, error: "Invalid sales channel" };
  if (!date) return { ok: false, error: "Invalid harvest date" };

  return {
    ok: true,
    value: {
      batchId,
      fishSold,
      weightKg,
      pricePerKg,
      buyer: String(body?.buyer || "").trim(),
      channel,
      date: date.toISOString(),
      markBatchHarvested: Boolean(body?.markBatchHarvested),
      harvestNotes: String(body?.harvestNotes || "").trim(),
    },
  };
}
