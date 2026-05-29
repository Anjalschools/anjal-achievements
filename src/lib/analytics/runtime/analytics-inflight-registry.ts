/**
 * Dedupes in-flight analytics fetches and supports cooperative cancellation.
 */

type InflightEntry = {
  abortController: AbortController;
  promise: Promise<unknown>;
};

const inflight = new Map<string, InflightEntry>();

export const abortInflightByPrefix = (prefix: string): void => {
  for (const [key, entry] of inflight) {
    if (!key.startsWith(prefix)) continue;
    entry.abortController.abort();
    inflight.delete(key);
  }
};

export const abortInflightKey = (key: string): void => {
  const entry = inflight.get(key);
  if (!entry) return;
  entry.abortController.abort();
  inflight.delete(key);
};

export const fetchInflightDeduped = async <T>(
  key: string,
  fetcher: (signal: AbortSignal) => Promise<T>,
  opts?: { replace?: boolean }
): Promise<T> => {
  const existing = inflight.get(key);
  if (existing && !opts?.replace) {
    return existing.promise as Promise<T>;
  }
  if (existing) {
    existing.abortController.abort();
    inflight.delete(key);
  }

  const abortController = new AbortController();
  const promise = fetcher(abortController.signal).finally(() => {
    const cur = inflight.get(key);
    if (cur?.abortController === abortController) inflight.delete(key);
  });

  inflight.set(key, { abortController, promise });
  return promise as Promise<T>;
};

export const mergeAbortSignals = (
  ...signals: Array<AbortSignal | undefined>
): AbortSignal => {
  const defined = signals.filter((s): s is AbortSignal => Boolean(s));
  if (defined.length === 0) return new AbortController().signal;
  if (defined.length === 1) return defined[0]!;

  const controller = new AbortController();
  const onAbort = () => controller.abort();
  for (const s of defined) {
    if (s.aborted) {
      controller.abort();
      break;
    }
    s.addEventListener("abort", onAbort, { once: true });
  }
  return controller.signal;
};
