import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { warnSecurityEvent } from "@/lib/security-log";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 5;

type Entry = { count: number; resetAt: number };

/** In-memory fallback when Upstash env is not configured (e.g. local dev). */
const globalForRateLimit = globalThis as typeof globalThis & {
  ___stRateLimitStore?: Map<string, Entry>;
};

const memoryStore = globalForRateLimit.___stRateLimitStore ?? new Map<string, Entry>();
globalForRateLimit.___stRateLimitStore = memoryStore;

const sweepExpiredMemory = (now: number) => {
  for (const [k, v] of memoryStore) {
    if (now >= v.resetAt) memoryStore.delete(k);
  }
};

/** Upstash client + limiter singleton (survives HMR via globalThis). */
const globalForUpstash = globalThis as typeof globalThis & {
  ___stUpstashRatelimit?: Ratelimit | null;
  ___stUpstashRatelimitInit?: boolean;
};

const getUpstashRatelimit = (): Ratelimit | null => {
  if (globalForUpstash.___stUpstashRatelimitInit) {
    return globalForUpstash.___stUpstashRatelimit ?? null;
  }
  globalForUpstash.___stUpstashRatelimitInit = true;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    globalForUpstash.___stUpstashRatelimit = null;
    return null;
  }
  const redis = new Redis({ url, token });
  globalForUpstash.___stUpstashRatelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.fixedWindow(MAX_REQUESTS, "60 s"),
    prefix: "st_rl",
    analytics: false,
  });
  return globalForUpstash.___stUpstashRatelimit;
};

const LOCAL_FALLBACK_IP = "127.0.0.1";

const normalizeIp = (raw: string): string => {
  const s = raw.trim();
  if (!s) return s;
  if (s === "::1" || s === "0:0:0:0:0:0:0:1") return LOCAL_FALLBACK_IP;
  if (s === "::ffff:127.0.0.1" || s.startsWith("::ffff:127.0.0.1")) return LOCAL_FALLBACK_IP;
  return s;
};

/**
 * 1) x-forwarded-for → first IP
 * 2) x-real-ip
 * 3) 127.0.0.1 when request is clearly local
 */
export const getClientIp = (request: NextRequest): string => {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return normalizeIp(first);
  }
  const real = request.headers.get("x-real-ip");
  if (real?.trim()) return normalizeIp(real.trim());

  const host = (request.headers.get("host") || "").toLowerCase().split(":")[0] ?? "";
  const isLocalHost =
    host === "localhost" ||
    host === "127.0.0.1" ||
    process.env.NODE_ENV !== "production";

  if (isLocalHost) {
    return LOCAL_FALLBACK_IP;
  }

  return "unknown";
};

const buildTooManyRequestsResponse = (): NextResponse =>
  NextResponse.json(
    { error: "Too many requests" },
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": "60",
      },
    }
  );

/** Same semantics as pre-Redis: in-window increment; block when count > MAX_REQUESTS. */
const checkRateLimitMemory = (routeKey: string, key: string): NextResponse | null => {
  const now = Date.now();
  if (memoryStore.size > 5000) {
    sweepExpiredMemory(now);
  }

  let e = memoryStore.get(key);

  if (!e || now >= e.resetAt) {
    e = { count: 1, resetAt: now + WINDOW_MS };
    memoryStore.set(key, e);
    return null;
  }

  e.count += 1;
  if (e.count > MAX_REQUESTS) {
    warnSecurityEvent("rate_limited", { route: routeKey });
    return buildTooManyRequestsResponse();
  }

  return null;
};

/**
 * Key = `routeKey:ip`. Upstash: fixed 5 / 60s per key; memory fallback: identical behavior.
 * @returns `null` if allowed; 429 {@link NextResponse} if exceeded.
 */
export const checkRateLimit = async (
  request: NextRequest,
  routeKey: string
): Promise<NextResponse | null> => {
  const ip = getClientIp(request);
  const key = `${routeKey}:${ip}`;

  const ratelimit = getUpstashRatelimit();
  if (ratelimit) {
    const { success } = await ratelimit.limit(key);
    if (!success) {
      warnSecurityEvent("rate_limited", { route: routeKey });
      return buildTooManyRequestsResponse();
    }
    return null;
  }

  return checkRateLimitMemory(routeKey, key);
};

/** @returns `true` if allowed, `false` if limited. */
export const checkRouteRateLimit = async (
  request: NextRequest,
  routeKey: string
): Promise<boolean> => (await checkRateLimit(request, routeKey)) === null;

/** 429 with Retry-After — same body/headers as {@link checkRateLimit}. */
export const rateLimitExceededResponse = (): NextResponse => buildTooManyRequestsResponse();
