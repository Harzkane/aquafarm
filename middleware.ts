import { NextRequest, NextResponse } from "next/server";

type RateState = {
  count: number;
  resetAt: number;
};

const rateBuckets = new Map<string, RateState>();

function getClientIp(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

function consumeRateLimit(key: string, limit: number, windowMs: number) {
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

function withSecurityHeaders(res: NextResponse) {
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  res.headers.set("Cross-Origin-Resource-Policy", "same-site");
  return res;
}

export function middleware(req: NextRequest) {
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
    const result = consumeRateLimit(key, limit, windowMs);
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

  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

