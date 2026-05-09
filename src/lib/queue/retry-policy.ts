export type RetryPolicy = {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
};

export const defaultRetryPolicy: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 60_000,
  maxDelayMs: 15 * 60_000,
};

export const delayForAttempt = (policy: RetryPolicy, attemptIndex: number): number => {
  const raw = policy.baseDelayMs * Math.pow(2, Math.max(0, attemptIndex - 1));
  return Math.min(policy.maxDelayMs, raw);
};
