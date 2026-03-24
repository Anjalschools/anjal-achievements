/**
 * Absolute site origin for public links, QR codes, and server-built portfolio URLs (no trailing slash).
 *
 * Priority (server):
 * 1. `NEXT_PUBLIC_APP_URL`, `APP_URL`, `SITE_URL` (first non-empty, non-localhost)
 * 2. `RENDER_EXTERNAL_URL` (Render.com)
 * 3. `VERCEL_URL` as https://…
 * 4. Production fallback: `https://anjal-achievements.onrender.com`
 * 5. Development: `http://localhost:3000`
 *
 * Browser: `window.location.origin`, except in production if it resolves to localhost/loopback
 * (misconfigured proxy) — then same server resolution as above.
 *
 * **Request-aware URLs:** For API routes and SSR that must match the deployment the client hit
 * (same DB / same host), use `getBaseUrlForRequest(request)` or `getBaseUrlFromHeaders()` instead
 * of `getBaseUrl()` alone — otherwise a local `.env` with a production `NEXT_PUBLIC_APP_URL` can
 * produce portfolio links that point at production while Mongo is local.
 */

const PRODUCTION_PUBLIC_ORIGIN = "https://anjal-achievements.onrender.com";

const stripTrailingSlash = (s: string): string => s.replace(/\/$/, "");

/** Safe token fragment for logs (first 6 + last 4, never full secret). */
export const tokenPreviewForLogs = (t: string | null | undefined): string => {
  const s = String(t ?? "").trim();
  if (!s) return "(empty)";
  if (s.length <= 10) return `${s.slice(0, 3)}…`;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
};

const isLocalRequestHost = (host: string): boolean => {
  const h = host.toLowerCase();
  if (h.startsWith("localhost:") || h === "localhost") return true;
  if (h.startsWith("127.")) return true;
  if (h.startsWith("[::1]")) return true;
  return false;
};

/**
 * Builds `protocol://host` from forwarded Host + proto (for reverse proxies).
 */
export const originFromRequestLike = (host: string, forwardedProto: string | null): string => {
  const ph = forwardedProto?.split(",")[0]?.trim().toLowerCase();
  const protocol =
    ph === "http" || ph === "https" ? ph : isLocalRequestHost(host) ? "http" : "https";
  return stripTrailingSlash(`${protocol}://${host}`);
};

/** Origin of the incoming HTTP request when derivable (no trailing slash). */
export const getRequestOrigin = (request: Request): string | null => {
  try {
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const hostHeader = request.headers.get("host")?.trim();
    const host = forwardedHost || hostHeader;
    if (host) {
      return originFromRequestLike(host, request.headers.get("x-forwarded-proto"));
    }
    const u = new URL(request.url);
    if (u.host) return stripTrailingSlash(u.origin);
    return null;
  } catch {
    return null;
  }
};

/**
 * Prefer the request’s own origin so portfolio links/redirects stay on the same host as the caller.
 * Falls back to `getBaseUrl()` when the request provides no host (e.g. some background callers).
 */
export const getBaseUrlForRequest = (request: Request): string => {
  const ro = getRequestOrigin(request);
  if (ro) return ro;
  return getBaseUrl();
};

const isLocalOrPrivateHost = (hostname: string): boolean => {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1" || h === "::1") return true;
  if (h.endsWith(".local")) return true;
  if (h.startsWith("192.168.") || h.startsWith("10.") || h.startsWith("172.16.")) return true;
  return false;
};

const isUnsafePublicOrigin = (url: string): boolean => {
  try {
    const u = new URL(url);
    return isLocalOrPrivateHost(u.hostname);
  } catch {
    return true;
  }
};

const firstEnvUrl = (...keys: string[]): string | undefined => {
  for (const k of keys) {
    const v = process.env[k]?.trim();
    if (v) return v;
  }
  return undefined;
};

const resolveServerSideOrigin = (): string => {
  const rawCandidates = [
    firstEnvUrl("NEXT_PUBLIC_APP_URL", "APP_URL", "SITE_URL"),
    process.env.RENDER_EXTERNAL_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  ].filter((x): x is string => Boolean(x));

  for (const c of rawCandidates) {
    const withProto = /^https?:\/\//i.test(c) ? c : `https://${c}`;
    const normalized = stripTrailingSlash(withProto);
    if (!isUnsafePublicOrigin(normalized)) {
      return normalized;
    }
  }

  if (process.env.NODE_ENV === "production") {
    return PRODUCTION_PUBLIC_ORIGIN;
  }
  return "http://localhost:3000";
};

export const getBaseUrl = (): string => {
  if (typeof window !== "undefined") {
    const o = stripTrailingSlash(window.location.origin);
    if (process.env.NODE_ENV === "production" && isUnsafePublicOrigin(o)) {
      return resolveServerSideOrigin();
    }
    return o;
  }
  return resolveServerSideOrigin();
};
