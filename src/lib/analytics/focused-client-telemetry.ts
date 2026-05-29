/**
 * Client-side focused fetch telemetry (dev + optional CI debug).
 */

export const logFocusedClientTelemetry = (
  tag:
    | "[FOCUSED_FETCH_START]"
    | "[FOCUSED_FETCH_SUCCESS]"
    | "[FOCUSED_FETCH_ABORT]"
    | "[FOCUSED_FETCH_DEDUPED]"
    | "[FOCUSED_SECTION_EMPTY]"
    | "[FOCUSED_SECTION_RECOVERED]",
  payload: Record<string, unknown>
): void => {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_CI_DEBUG !== "1") return;
  // eslint-disable-next-line no-console
  console.info(tag, payload);
};

export const sanitizeFocusedClientError = (raw: string): string => {
  const lower = raw.toLowerCase();
  if (
    lower.includes("bson") ||
    lower.includes("16mb") ||
    lower.includes("aggregation") ||
    lower.includes("mongo") ||
    lower.includes("internal server")
  ) {
    return "focused_report_unavailable";
  }
  return raw;
};
