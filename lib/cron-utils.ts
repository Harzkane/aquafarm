export function isCronAuthorized(secret: string | undefined, authorizationHeader: string | null) {
  if (!secret || !authorizationHeader) return false;
  const normalized = authorizationHeader.trim();
  const match = normalized.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  const token = match[1].trim();
  return token === secret.trim();
}

export function parseDryRunFlag(value: string | null) {
  return value === "1";
}

export function clampInt(value: string | null, fallback: number, min: number, max: number) {
  const n = Number(value ?? fallback);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}
