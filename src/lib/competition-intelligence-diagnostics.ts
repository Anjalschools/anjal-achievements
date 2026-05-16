/**
 * Optional diagnostics for competition intelligence (exports, charts, filters).
 * Enable with NEXT_PUBLIC_COMPETITION_INTEL_DEBUG=1 (browser) or COMPETITION_INTEL_DEBUG=1 (Node).
 */

const isBrowser = typeof window !== "undefined";

export const isCompetitionIntelDebugEnabled = (): boolean => {
  if (isBrowser) {
    return process.env.NEXT_PUBLIC_COMPETITION_INTEL_DEBUG === "1";
  }
  return process.env.COMPETITION_INTEL_DEBUG === "1" || process.env.NEXT_PUBLIC_COMPETITION_INTEL_DEBUG === "1";
};

export const competitionIntelDebug = (...args: unknown[]) => {
  if (!isCompetitionIntelDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.info("[competition-intel]", ...args);
};

export const competitionIntelWarn = (...args: unknown[]) => {
  if (!isCompetitionIntelDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.warn("[competition-intel]", ...args);
};
