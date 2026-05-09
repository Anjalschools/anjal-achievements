import { normalizeSearchQuery, type NormalizedQuery } from "./query-normalizer";
import type { Pagination } from "./global-search";

export const parseSearchPagination = (sp: URLSearchParams): Pagination => ({
  page: Math.max(1, Math.min(500, Number(sp.get("page")) || 1)),
  pageSize: Math.max(1, Math.min(40, Number(sp.get("pageSize")) || 12)),
});

export const parseSearchRequest = (sp: URLSearchParams): { nq: NormalizedQuery; pag: Pagination } => ({
  nq: normalizeSearchQuery(sp.get("q")),
  pag: parseSearchPagination(sp),
});
