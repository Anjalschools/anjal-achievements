/**
 * One-time environment validation at Node startup (instrumentation).
 * This app uses cookie sessions (userId / userEmail), not NextAuth — NEXTAUTH_* are optional unless you add NextAuth later.
 */

const stripTrailingSlash = (s: string): string => s.replace(/\/$/, "");

declare global {
  // eslint-disable-next-line no-var
  var __stEnvCheckRan: boolean | undefined;
}

export const runEnvCheckOnce = (): void => {
  if (globalThis.__stEnvCheckRan) return;
  globalThis.__stEnvCheckRan = true;

  const hasMongoUri = Boolean(process.env.MONGODB_URI?.trim());
  const hasNextAuthSecret = Boolean(process.env.NEXTAUTH_SECRET?.trim());
  const hasNextAuthUrl = Boolean(process.env.NEXTAUTH_URL?.trim());
  const rawUrl = process.env.NEXTAUTH_URL?.trim() || "";
  const nextAuthUrl = rawUrl ? stripTrailingSlash(rawUrl) : "(unset)";

  console.log("[env-check]", {
    hasNextAuthSecret,
    hasNextAuthUrl,
    hasMongoUri,
    nextAuthUrl: nextAuthUrl === "(unset)" ? "(unset)" : nextAuthUrl,
    nodeEnv: process.env.NODE_ENV ?? "(unset)",
  });

  if (!hasMongoUri) {
    throw new Error("[env-check] MONGODB_URI is required");
  }

  /** Misconfiguration: NextAuth-style URL without secret (would break real NextAuth; harmless for cookie-only app) */
  if (hasNextAuthUrl && !hasNextAuthSecret) {
    throw new Error(
      "[env-check] NEXTAUTH_URL is set but NEXTAUTH_SECRET is missing — remove NEXTAUTH_URL or set NEXTAUTH_SECRET"
    );
  }
};
