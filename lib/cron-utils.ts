export function isCronAuthorized(secret: string | undefined, authorizationHeader: string | null) {
  if (!secret) return false;
  return authorizationHeader === `Bearer ${secret}`;
}

export function parseDryRunFlag(value: string | null) {
  return value === "1";
}

export function clampInt(value: string | null, fallback: number, min: number, max: number) {
  const n = Number(value ?? fallback);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

