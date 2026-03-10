import { Types } from "mongoose";

export type LogPayload = {
  batchId: string;
  date?: string;
  feedSession?: "morning" | "evening";
  tankId?: string;
  tankName?: string;
  feedGiven?: number;
  feedType?: string;
  mortality?: number;
  mortalityCause?: string;
  fishCount?: number;
  avgWeight?: number;
  ph?: number | null;
  ammonia?: number | null;
  temperature?: number | null;
  dissolvedO2?: number | null;
  waterChanged?: boolean;
  waterChangePct?: number;
  observations?: string;
};

function normalizeOptionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function validateLogPayload(body: any): { ok: true; value: LogPayload } | { ok: false; error: string } {
  const batchId = typeof body?.batchId === "string" ? body.batchId.trim() : "";
  if (!batchId || !Types.ObjectId.isValid(batchId)) return { ok: false, error: "Valid batch is required" };

  const feedGiven = normalizeOptionalNumber(body?.feedGiven) ?? 0;
  const feedSession = body?.feedSession === "evening" ? "evening" : "morning";
  const mortality = Math.trunc(normalizeOptionalNumber(body?.mortality) ?? 0);
  const ph = normalizeOptionalNumber(body?.ph);
  const ammonia = normalizeOptionalNumber(body?.ammonia);
  const temperature = normalizeOptionalNumber(body?.temperature);
  const waterChangePct = Math.trunc(normalizeOptionalNumber(body?.waterChangePct) ?? 0);
  const fishCount = normalizeOptionalNumber(body?.fishCount);
  const avgWeight = normalizeOptionalNumber(body?.avgWeight);
  const dissolvedO2 = normalizeOptionalNumber(body?.dissolvedO2);
  const waterChanged = Boolean(body?.waterChanged);
  const date = body?.date ? new Date(body.date) : new Date();

  if (Number.isNaN(date.getTime())) return { ok: false, error: "Invalid log date" };
  if (feedGiven < 0) return { ok: false, error: "Feed given cannot be negative" };
  if (mortality < 0) return { ok: false, error: "Mortality cannot be negative" };
  if (ph !== undefined && (ph < 0 || ph > 14)) return { ok: false, error: "pH must be between 0 and 14" };
  if (ammonia !== undefined && ammonia < 0) return { ok: false, error: "Ammonia cannot be negative" };
  if (temperature !== undefined && (temperature < -10 || temperature > 60)) {
    return { ok: false, error: "Temperature is out of valid range" };
  }
  if (waterChangePct < 0 || waterChangePct > 100) {
    return { ok: false, error: "Water change % must be between 0 and 100" };
  }
  if (waterChanged && waterChangePct <= 0) {
    return { ok: false, error: "Enter water change % when water was changed" };
  }

  return {
    ok: true,
    value: {
      batchId,
      date: date.toISOString(),
      feedSession,
      tankId: typeof body?.tankId === "string" ? body.tankId.trim() : "",
      tankName: typeof body?.tankName === "string" ? body.tankName.trim() : "",
      feedGiven,
      feedType: typeof body?.feedType === "string" ? body.feedType.trim() : "",
      mortality,
      mortalityCause: typeof body?.mortalityCause === "string" ? body.mortalityCause.trim() : "",
      fishCount,
      avgWeight,
      ph,
      ammonia,
      temperature,
      dissolvedO2,
      waterChanged,
      waterChangePct: waterChanged ? waterChangePct : 0,
      observations: typeof body?.observations === "string" ? body.observations.trim() : "",
    },
  };
}

