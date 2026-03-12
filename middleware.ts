import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

type RateState = {
  count: number;
  resetAt: number;
};

const rateBuckets = new Map<string, RateState>();
const REDIS_KEY_PREFIX = "aquafarm:rl";

function getClientIp(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

function consumeLocalRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const existing = rateBuckets.get(key);

  if (!existing || now >= existing.resetAt) {
    const resetAt = now + windowMs;
    rateBuckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  rateBuckets.set(key, existing);
  return { allowed: true, remaining: Math.max(0, limit - existing.count), resetAt: existing.resetAt };
}

async function consumeUpstashRateLimit(key: string, limit: number, windowMs: number) {
  const restUrl = process.env.UPSTASH_REDIS_REST_URL;
  const restToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!restUrl || !restToken) return null;

  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
  const redisKey = `${REDIS_KEY_PREFIX}:${key}`;

  try {
    const response = await fetch(`${restUrl}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${restToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", redisKey],
        ["EXPIRE", redisKey, windowSeconds, "NX"],
        ["TTL", redisKey],
      ]),
      cache: "no-store",
    });

    if (!response.ok) return null;
    const payload = await response.json();
    if (!Array.isArray(payload) || payload.length < 3) return null;

    const count = Number(payload?.[0]?.result);
    const ttlSecondsRaw = Number(payload?.[2]?.result);
    if (!Number.isFinite(count)) return null;

    const ttlSeconds = Number.isFinite(ttlSecondsRaw) && ttlSecondsRaw >= 0 ? ttlSecondsRaw : windowSeconds;
    const resetAt = Date.now() + ttlSeconds * 1000;
    const allowed = count <= limit;
    const remaining = Math.max(0, limit - count);
    return { allowed, remaining, resetAt };
  } catch {
    return null;
  }
}

async function consumeRateLimit(key: string, limit: number, windowMs: number) {
  const distributed = await consumeUpstashRateLimit(key, limit, windowMs);
  if (distributed) return distributed;
  return consumeLocalRateLimit(key, limit, windowMs);
}

function withSecurityHeaders(res: NextResponse) {
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  res.headers.set("Cross-Origin-Resource-Policy", "same-site");
  return res;
}

const FREE_LOCKED_PAGE_PREFIXES = ["/financials", "/harvest", "/playbook", "/calendar"];
const FREE_LOCKED_API_PREFIXES = ["/api/financials", "/api/harvest", "/api/calendar/events"];
const COMMERCIAL_OWNER_PAGE_PREFIXES = ["/settings/staff", "/settings/audit", "/settings/ops"];
const COMMERCIAL_OWNER_API_PREFIXES = ["/api/staff", "/api/audit", "/api/ops"];
const STAFF_BLOCKED_PAGE_PREFIXES = ["/settings/billing", "/settings/alerts"];

function isLockedForFree(pathname: string) {
  if (FREE_LOCKED_PAGE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return true;
  if (FREE_LOCKED_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return true;
  return false;
}

function isCommercialOwnerOnly(pathname: string) {
  if (COMMERCIAL_OWNER_PAGE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return true;
  if (COMMERCIAL_OWNER_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return true;
  return false;
}

function isStaffBlocked(pathname: string) {
  return STAFF_BLOCKED_PAGE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const method = req.method.toUpperCase();

  const isRegister = pathname === "/api/auth/register" && method === "POST";
  const isCredentialsLogin = pathname === "/api/auth/callback/credentials" && method === "POST";
  const isWriteApi = pathname.startsWith("/api/") && ["POST", "PUT", "PATCH", "DELETE"].includes(method);

  if (isRegister || isCredentialsLogin || isWriteApi) {
    const ip = getClientIp(req);
    const bucket = isRegister || isCredentialsLogin ? "auth" : "write";
    const limit = bucket === "auth" ? 10 : 180;
    const windowMs = bucket === "auth" ? 10 * 60 * 1000 : 60 * 1000;
    const key = `${bucket}:${ip}:${pathname}`;
    const result = await consumeRateLimit(key, limit, windowMs);
    const retryAfterSeconds = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));

    if (!result.allowed) {
      const blocked = NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        { status: 429 }
      );
      blocked.headers.set("Retry-After", String(retryAfterSeconds));
      blocked.headers.set("X-RateLimit-Limit", String(limit));
      blocked.headers.set("X-RateLimit-Remaining", "0");
      blocked.headers.set("X-RateLimit-Reset", String(Math.floor(result.resetAt / 1000)));
      return withSecurityHeaders(blocked);
    }

    const res = NextResponse.next();
    res.headers.set("X-RateLimit-Limit", String(limit));
    res.headers.set("X-RateLimit-Remaining", String(result.remaining));
    res.headers.set("X-RateLimit-Reset", String(Math.floor(result.resetAt / 1000)));
    return withSecurityHeaders(res);
  }

  if (isLockedForFree(pathname)) {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });
    const plan = (token as any)?.plan || "free";

    if (plan === "free") {
      if (pathname.startsWith("/api/")) {
        return withSecurityHeaders(
          NextResponse.json(
            {
              error: "This feature is available on paid plans. Upgrade to continue.",
              code: "PLAN_FEATURE_LOCKED",
            },
            { status: 403 }
          )
        );
      }

      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = "/plans";
      redirectUrl.searchParams.set("upgrade", "1");
      return withSecurityHeaders(NextResponse.redirect(redirectUrl));
    }
  }

  if (isCommercialOwnerOnly(pathname)) {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });
    const plan = (token as any)?.plan || "free";
    const role = (token as any)?.role || "owner";
    const allowed = plan === "commercial" && role === "owner";

    if (!allowed) {
      if (pathname.startsWith("/api/")) {
        return withSecurityHeaders(
          NextResponse.json(
            {
              error: "This feature is available for Commercial account owners only.",
              code: "PLAN_FEATURE_LOCKED",
            },
            { status: 403 }
          )
        );
      }

      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = "/settings/billing";
      return withSecurityHeaders(NextResponse.redirect(redirectUrl));
    }
  }

  if (isStaffBlocked(pathname)) {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });
    const role = (token as any)?.role || "owner";
    if (role === "staff") {
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = "/dashboard";
      return withSecurityHeaders(NextResponse.redirect(redirectUrl));
    }
  }

  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
