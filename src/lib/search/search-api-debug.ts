import { alumniDebugLog } from "@/lib/alumni/alumni-debug-log";
import { parseGraduationYearToken } from "@/lib/alumni/normalize-arabic-digits";
import type { NormalizedQuery } from "@/lib/search/query-normalizer";
import type { Pagination } from "@/lib/search/global-search";

/** Logs token counts and result sizes only (no raw query text). Enable with ALUMNI_DEBUG=1. */
export const logUnifiedSearchRequest = (
  routeKey: string,
  nq: NormalizedQuery,
  pag: Pagination,
  extra?: Record<string, string | number | boolean | null | undefined>
): void => {
  const yearTokensResolved = nq.tokens.map((t) => parseGraduationYearToken(t)).filter((y): y is number => y != null);
  alumniDebugLog(`search-api:${routeKey}`, {
    page: pag.page,
    pageSize: pag.pageSize,
    tokenCount: nq.tokens.length,
    rawLen: nq.raw.length,
    yearTokensResolved: yearTokensResolved.slice(0, 6),
    ...extra,
  });
};
