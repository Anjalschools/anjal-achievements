/**
 * Debug helper — enable with COMPETITION_FILTER_DEBUG=1 (client: NEXT_PUBLIC_COMPETITION_FILTER_DEBUG=1)
 */

export const isCompetitionFilterDebugEnabled = (): boolean =>
  typeof process !== "undefined" &&
  (process.env.NEXT_PUBLIC_COMPETITION_FILTER_DEBUG === "1" ||
    process.env.COMPETITION_FILTER_DEBUG === "1");

export const logCompetitionFilterDebug = (
  label: string,
  payload: Record<string, unknown>
): void => {
  if (!isCompetitionFilterDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.info(`[competition-filter-debug] ${label}`, payload);
};
