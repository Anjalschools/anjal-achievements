"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ExecutiveFilterSnapshot } from "@/lib/competition-intelligence-persistence";
import type { HistoricalDimensionSlice } from "@/lib/analytics/historical-comparison-fetch";
import {
  buildCompetitionTableQueryKey,
  buildCompetitionTableQueryParams,
} from "@/lib/analytics/competition-table-query-params";
import type { UnifiedCompetitionAnalyticsPayload } from "@/lib/analytics/competition-table-unified-payload";
import { buildUnifiedCompetitionPayload } from "@/lib/analytics/competition-table-unified-payload";
import type { CompetitionTableModel } from "@/lib/analytics/competition-table-engine";
import { logCompetitionFilterDebug } from "@/lib/analytics/competition-filter-debug";
import { stableYearsKey } from "@/lib/analytics/historical-analytics-stable";

export type UseCompetitionTableQueryInput = {
  competitionKey: string;
  years: number[];
  filter: ExecutiveFilterSnapshot;
  /** Stable filter fingerprint from AnalyticsFilterContext */
  filterKey: string;
  dimension?: HistoricalDimensionSlice;
  enabled?: boolean;
};

export type UseCompetitionTableQueryResult = {
  payload: UnifiedCompetitionAnalyticsPayload | null;
  model: CompetitionTableModel | null;
  loading: boolean;
  error: string | null;
  queryKey: string;
  refetch: () => void;
};

export const useCompetitionTableQuery = (
  input: UseCompetitionTableQueryInput
): UseCompetitionTableQueryResult => {
  const { competitionKey, years, filter, filterKey, dimension = "combined", enabled = true } = input;

  const [payload, setPayload] = useState<UnifiedCompetitionAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const yearsKey = stableYearsKey(years);

  const queryKey = buildCompetitionTableQueryKey({
    filter,
    competitionKey,
    years,
    dimension,
  });

  const fetchTable = useCallback(async () => {
    if (!enabled || !competitionKey || years.length === 0) {
      setPayload(null);
      setError(null);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = ++requestIdRef.current;

    setLoading(true);
    setError(null);

    const params = buildCompetitionTableQueryParams({
      filter,
      competitionKey,
      years,
      dimension,
    });

    logCompetitionFilterDebug("fetch-start", {
      queryKey,
      filterKey,
      competitionKey,
      years,
      dimension,
      requestParams: params.toString(),
    });

    try {
      const res = await fetch(
        `/api/admin/reports/competition-analytics-table?${params.toString()}`,
        { signal: controller.signal, cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to load competition table");
      const json = (await res.json()) as {
        ok: boolean;
        model?: CompetitionTableModel;
        queryKey?: string;
      };
      if (requestId !== requestIdRef.current) return;
      if (!json.ok || !json.model) throw new Error("No competition data");

      const unified = buildUnifiedCompetitionPayload({
        competitionKey,
        years,
        model: json.model,
        queryKey: json.queryKey ?? queryKey,
      });

      logCompetitionFilterDebug("fetch-success", {
        queryKey: unified.queryKey,
        renderedYears: unified.model.years,
        rowCount: unified.model.rows.length,
        hasData: unified.model.hasData,
        metrics: unified.model.metrics,
      });

      setPayload(unified);
    } catch (e) {
      if (controller.signal.aborted) return;
      if (requestId !== requestIdRef.current) return;
      setPayload(null);
      setError(e instanceof Error ? e.message : "Error");
      logCompetitionFilterDebug("fetch-error", { queryKey, message: String(e) });
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [enabled, competitionKey, yearsKey, filterKey, dimension, queryKey]);

  useEffect(() => {
    void fetchTable();
    return () => abortRef.current?.abort();
  }, [fetchTable]);

  return {
    payload,
    model: payload?.model ?? null,
    loading,
    error,
    queryKey,
    refetch: fetchTable,
  };
};
