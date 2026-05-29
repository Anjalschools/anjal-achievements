"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useClientMounted } from "@/hooks/useClientMounted";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";
import {
  ANALYTICS_COUNT_PERSPECTIVES,
  exportReportTitleSuffix,
  globalPrimaryKpiForPerspective,
  metricValueForPerspective,
  parsePerspectiveParam,
  perspectiveDescription,
  perspectiveLabel,
  perspectiveLevelTag,
  perspectiveToUrlValue,
  scaleSliceToPerspective,
  totalColumnLabel,
  totalColumnTooltip,
  type AnalyticsCountPerspective,
} from "@/lib/analytics/analytics-perspective";
import { t, type AnalyticsLocale } from "@/lib/analytics/analytics-semantic-registry";

const PERSPECTIVE_STORAGE_KEY = "anjal-analytics-count-perspective";
const PERSPECTIVE_URL_KEY = "countPerspective";

export type AnalyticsPerspectiveContextValue = {
  perspective: AnalyticsCountPerspective;
  setPerspective: (p: AnalyticsCountPerspective) => void;
  loc: AnalyticsLocale;
  isAr: boolean;
  label: string;
  description: string;
  levelTag: string;
  totalColumnLabel: string;
  totalColumnTooltip: string;
  exportTitleSuffix: string;
  metricForRow: (row: import("@/lib/achievement-participation-analytics").ParticipationActivityRow) => number;
  globalKpi: (data: ParticipationAnalyticsPayload) => { value: number; label: string };
  scaleSlice: (sliceParticipations: number, data: ParticipationAnalyticsPayload) => number;
  hydrated: boolean;
};

const AnalyticsPerspectiveContext = createContext<AnalyticsPerspectiveContextValue | null>(null);

export type AnalyticsPerspectiveProviderProps = {
  children: ReactNode;
  isAr: boolean;
  /** Optional controlled perspective (e.g. from saved view restore) */
  initialPerspective?: AnalyticsCountPerspective;
};

export const AnalyticsPerspectiveProvider = ({
  children,
  isAr,
  initialPerspective,
}: AnalyticsPerspectiveProviderProps) => {
  const mounted = useClientMounted();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const loc: AnalyticsLocale = isAr ? "ar" : "en";
  const skipUrlWriteRef = useRef(false);

  const [perspective, setPerspectiveState] = useState<AnalyticsCountPerspective>(
    initialPerspective ?? "participation"
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!mounted) return;
    const fromUrl = parsePerspectiveParam(searchParams.get(PERSPECTIVE_URL_KEY));
    if (searchParams.has(PERSPECTIVE_URL_KEY)) {
      skipUrlWriteRef.current = true;
      setPerspectiveState(fromUrl);
      setHydrated(true);
      return;
    }
    try {
      const stored = localStorage.getItem(PERSPECTIVE_STORAGE_KEY);
      if (stored) {
        setPerspectiveState(parsePerspectiveParam(stored));
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, [mounted, searchParams]);

  const writeUrl = useCallback(
    (p: AnalyticsCountPerspective) => {
      if (!pathname || !mounted) return;
      const params = new URLSearchParams(searchParams.toString());
      if (p === "participation") {
        params.delete(PERSPECTIVE_URL_KEY);
      } else {
        params.set(PERSPECTIVE_URL_KEY, perspectiveToUrlValue(p));
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [mounted, pathname, router, searchParams]
  );

  const setPerspective = useCallback(
    (p: AnalyticsCountPerspective) => {
      setPerspectiveState(p);
      if (!mounted) return;
      try {
        localStorage.setItem(PERSPECTIVE_STORAGE_KEY, perspectiveToUrlValue(p));
      } catch {
        /* ignore */
      }
      if (!skipUrlWriteRef.current) writeUrl(p);
      skipUrlWriteRef.current = false;
    },
    [mounted, writeUrl]
  );

  const value = useMemo<AnalyticsPerspectiveContextValue>(
    () => ({
      perspective,
      setPerspective,
      loc,
      isAr,
      label: perspectiveLabel(perspective, loc),
      description: perspectiveDescription(perspective, loc),
      levelTag: perspectiveLevelTag(perspective, loc),
      totalColumnLabel: totalColumnLabel(perspective, loc),
      totalColumnTooltip: totalColumnTooltip(perspective, loc),
      exportTitleSuffix: exportReportTitleSuffix(perspective, loc),
      metricForRow: (row) => metricValueForPerspective(row, perspective),
      globalKpi: (data) => {
        const { value, labelKey } = globalPrimaryKpiForPerspective(data, perspective);
        return { value, label: t(labelKey, loc) };
      },
      scaleSlice: (sliceParticipations, data) =>
        scaleSliceToPerspective(sliceParticipations, data, perspective),
      hydrated,
    }),
    [perspective, setPerspective, loc, isAr, hydrated]
  );

  return (
    <AnalyticsPerspectiveContext.Provider value={value}>{children}</AnalyticsPerspectiveContext.Provider>
  );
};

export const useAnalyticsPerspective = (): AnalyticsPerspectiveContextValue => {
  const ctx = useContext(AnalyticsPerspectiveContext);
  if (!ctx) {
    throw new Error("useAnalyticsPerspective must be used within AnalyticsPerspectiveProvider");
  }
  return ctx;
};

/** Safe hook for optional perspective (defaults to participation) */
export const useAnalyticsPerspectiveOptional = (): AnalyticsPerspectiveContextValue | null =>
  useContext(AnalyticsPerspectiveContext);

export { ANALYTICS_COUNT_PERSPECTIVES, PERSPECTIVE_URL_KEY, PERSPECTIVE_STORAGE_KEY };
