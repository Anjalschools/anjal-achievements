"use client";

import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ExecutiveFilterSnapshot } from "@/lib/competition-intelligence-persistence";
import type { ReportFilterUiState } from "@/lib/analytics/report-filter-params";
import {
  deserializeAnalyticsFiltersFromUrl,
  isAnalyticsUrlInSync,
  serializeAnalyticsFiltersToUrl,
  syncAnalyticsFiltersWithRouter,
  type AnalyticsUrlUiState,
  type AnalyticsViewScope,
} from "@/lib/analytics/report-filter-url-sync";

export type UseAnalyticsUrlSyncOptions<T extends ExecutiveFilterSnapshot | ReportFilterUiState> = {
  scope: AnalyticsViewScope;
  enabled?: boolean;
  debounceMs?: number;
  filter: T;
  ui?: AnalyticsUrlUiState;
  onHydrateFromUrl?: (payload: { filters: T; ui: AnalyticsUrlUiState; hasUrlFilters: boolean }) => void;
  hydrationDoneRef?: MutableRefObject<boolean>;
};

/**
 * Bidirectional sync between analytics filter state and URL query params.
 */
export const useAnalyticsUrlSync = <T extends ExecutiveFilterSnapshot | ReportFilterUiState>({
  scope,
  enabled = true,
  debounceMs = 320,
  filter,
  ui,
  onHydrateFromUrl,
  hydrationDoneRef,
}: UseAnalyticsUrlSyncOptions<T>) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryKey = searchParams.toString();
  const lastReadQueryRef = useRef<string | null>(null);
  const skipNextWriteRef = useRef(false);
  const hydratedOnceRef = useRef(false);

  useEffect(() => {
    const onPop = () => {
      lastReadQueryRef.current = null;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // URL → state (initial load + back/forward)
  useEffect(() => {
    if (!enabled || !onHydrateFromUrl) return;
    if (lastReadQueryRef.current === queryKey) return;
    if (
      hydratedOnceRef.current &&
      isAnalyticsUrlInSync(scope, queryKey, filter, ui)
    ) {
      lastReadQueryRef.current = queryKey;
      return;
    }
    lastReadQueryRef.current = queryKey;
    hydratedOnceRef.current = true;

    const { filters, ui: urlUi, hasUrlFilters } = deserializeAnalyticsFiltersFromUrl(scope, searchParams);
    skipNextWriteRef.current = true;
    onHydrateFromUrl({ filters: filters as T, ui: urlUi, hasUrlFilters });
    if (hydrationDoneRef) hydrationDoneRef.current = true;

    const t = window.setTimeout(() => {
      skipNextWriteRef.current = false;
    }, 50);
    return () => window.clearTimeout(t);
  }, [enabled, scope, queryKey, searchParams, onHydrateFromUrl, hydrationDoneRef]);

  const writeUrl = useCallback(() => {
    if (!enabled || !pathname) return;
    if (skipNextWriteRef.current) return;
    if (hydrationDoneRef && !hydrationDoneRef.current) return;

    if (isAnalyticsUrlInSync(scope, queryKey, filter, ui)) return;

    syncAnalyticsFiltersWithRouter({
      pathname,
      scope,
      filter,
      ui,
      replace: (href, options) => router.replace(href, options),
    });
  }, [enabled, pathname, scope, filter, ui, queryKey, router, hydrationDoneRef]);

  useEffect(() => {
    if (!enabled) return;
    const t = window.setTimeout(writeUrl, debounceMs);
    return () => window.clearTimeout(t);
  }, [enabled, debounceMs, writeUrl]);

  const copyShareUrl = useCallback((): string => {
    if (typeof window === "undefined" || !pathname) return "";
    const qs = serializeAnalyticsFiltersToUrl(scope, filter, ui).toString();
    return qs ? `${window.location.origin}${pathname}?${qs}` : `${window.location.origin}${pathname}`;
  }, [pathname, scope, filter, ui]);

  return { copyShareUrl, pathname, queryKey };
};
