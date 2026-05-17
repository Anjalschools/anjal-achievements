/**
 * Client fetch with timeout, retry on gateway errors, and optional stale session cache.
 */

export type ResilientFetchOptions = {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  staleKey?: string;
  staleMaxAgeMs?: number;
};

const GATEWAY_STATUSES = new Set([502, 503, 504]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const resilientFetchJson = async <T>(
  url: string,
  init?: RequestInit,
  opts?: ResilientFetchOptions
): Promise<{ ok: true; data: T; degraded?: boolean; fromStale?: boolean } | { ok: false; status: number; error: string }> => {
  const timeoutMs = opts?.timeoutMs ?? 45_000;
  const retries = opts?.retries ?? 2;
  const retryDelayMs = opts?.retryDelayMs ?? 800;

  const readStale = (): T | null => {
    if (!opts?.staleKey || typeof sessionStorage === "undefined") return null;
    try {
      const raw = sessionStorage.getItem(opts.staleKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { ts?: number; payload?: T };
      const max = opts.staleMaxAgeMs ?? 10 * 60_000;
      if (parsed.payload && parsed.ts && Date.now() - parsed.ts < max) {
        return parsed.payload;
      }
    } catch {
      /* ignore */
    }
    return null;
  };

  const writeStale = (data: T) => {
    if (!opts?.staleKey || typeof sessionStorage === "undefined") return;
    try {
      sessionStorage.setItem(opts.staleKey, JSON.stringify({ ts: Date.now(), payload: data }));
    } catch {
      /* ignore */
    }
  };

  let lastStatus = 0;
  let lastError = "Request failed";

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timer);
      lastStatus = res.status;
      const correlationId = res.headers.get("x-correlation-id") ?? undefined;
      const degraded = res.headers.get("x-degraded") === "1";

      if (GATEWAY_STATUSES.has(res.status) && attempt < retries) {
        await sleep(retryDelayMs * (attempt + 1));
        continue;
      }

      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string; correlationId?: string };
        lastError = j.error || `HTTP ${res.status}`;
        if (GATEWAY_STATUSES.has(res.status)) break;
        return { ok: false, status: res.status, error: lastError };
      }

      const data = (await res.json()) as T;
      writeStale(data);
      return { ok: true, data, degraded, ...(correlationId ? {} : {}) };
    } catch (e) {
      clearTimeout(timer);
      if (e instanceof DOMException && e.name === "AbortError") {
        lastError = "Request timed out";
        lastStatus = 504;
      } else {
        lastError = e instanceof Error ? e.message : "Network error";
      }
      if (attempt < retries) {
        await sleep(retryDelayMs * (attempt + 1));
        continue;
      }
    }
  }

  const stale = readStale();
  if (stale) {
    return { ok: true, data: stale, degraded: true, fromStale: true };
  }

  return { ok: false, status: lastStatus || 0, error: lastError };
};
