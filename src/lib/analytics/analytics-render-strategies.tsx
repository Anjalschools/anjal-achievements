"use client";

import type { ComponentType } from "react";
import dynamic from "next/dynamic";
import AnalyticsSectionSkeleton from "@/components/analytics/AnalyticsSectionSkeleton";

export type AnalyticsSectionId =
  | "hallOfFame"
  | "medalIntelligence"
  | "executiveSummary"
  | "analyticsTable"
  | "advancedAnalytics"
  | "narrativeInsights"
  | "comparisonWorkspace"
  | "equityPanel"
  | "demographicMatrix"
  | "competitionMatrix"
  | "opportunityPanel"
  | "recommendationPanel";

export type RenderStrategy = {
  ssr: boolean;
  lazy: boolean;
  suspense: boolean;
  deferUntilData?: boolean;
  preloadPriority: "immediate" | "defer" | "idle";
  clientOnly: boolean;
  skeletonLines: number;
};

export const ANALYTICS_RENDER_STRATEGIES: Record<AnalyticsSectionId, RenderStrategy> = {
  executiveSummary: {
    ssr: true,
    lazy: false,
    suspense: false,
    preloadPriority: "immediate",
    clientOnly: false,
    skeletonLines: 3,
  },
  hallOfFame: {
    ssr: false,
    lazy: true,
    suspense: true,
    deferUntilData: true,
    preloadPriority: "defer",
    clientOnly: true,
    skeletonLines: 6,
  },
  analyticsTable: {
    ssr: true,
    lazy: false,
    suspense: false,
    preloadPriority: "immediate",
    clientOnly: false,
    skeletonLines: 4,
  },
  medalIntelligence: {
    ssr: false,
    lazy: true,
    suspense: true,
    preloadPriority: "defer",
    clientOnly: true,
    skeletonLines: 4,
  },
  narrativeInsights: {
    ssr: true,
    lazy: false,
    suspense: false,
    preloadPriority: "immediate",
    clientOnly: false,
    skeletonLines: 2,
  },
  advancedAnalytics: {
    ssr: false,
    lazy: true,
    suspense: true,
    preloadPriority: "idle",
    clientOnly: true,
    skeletonLines: 3,
  },
  comparisonWorkspace: {
    ssr: false,
    lazy: true,
    suspense: true,
    deferUntilData: true,
    preloadPriority: "defer",
    clientOnly: true,
    skeletonLines: 4,
  },
  equityPanel: {
    ssr: false,
    lazy: true,
    suspense: true,
    deferUntilData: true,
    preloadPriority: "defer",
    clientOnly: true,
    skeletonLines: 3,
  },
  demographicMatrix: {
    ssr: false,
    lazy: false,
    suspense: true,
    deferUntilData: true,
    preloadPriority: "defer",
    clientOnly: true,
    skeletonLines: 4,
  },
  competitionMatrix: {
    ssr: false,
    lazy: false,
    suspense: true,
    deferUntilData: true,
    preloadPriority: "defer",
    clientOnly: true,
    skeletonLines: 3,
  },
  opportunityPanel: {
    ssr: false,
    lazy: true,
    suspense: true,
    deferUntilData: true,
    preloadPriority: "defer",
    clientOnly: true,
    skeletonLines: 5,
  },
  recommendationPanel: {
    ssr: false,
    lazy: true,
    suspense: true,
    deferUntilData: true,
    preloadPriority: "idle",
    clientOnly: true,
    skeletonLines: 6,
  },
};

export type ComparisonRenderOpts = {
  executiveMode?: boolean;
  comparisonOpen?: boolean;
  perspectiveAware?: boolean;
};

export const resolveComparisonRenderStrategy = (
  sectionId: Extract<
    AnalyticsSectionId,
    "comparisonWorkspace" | "equityPanel" | "opportunityPanel" | "recommendationPanel"
  >,
  opts?: ComparisonRenderOpts
): RenderStrategy => {
  const base = ANALYTICS_RENDER_STRATEGIES[sectionId];
  if (opts?.executiveMode) {
    return { ...base, preloadPriority: "idle", deferUntilData: true };
  }
  if (opts?.comparisonOpen) {
    return { ...base, preloadPriority: "immediate", lazy: false };
  }
  return base;
};

export const createComparisonAnalyticsSection = <P extends object>(
  sectionId: Extract<
    AnalyticsSectionId,
    "comparisonWorkspace" | "equityPanel" | "opportunityPanel" | "recommendationPanel"
  >,
  loader: () => Promise<{ default: ComponentType<P> }>,
  opts?: ComparisonRenderOpts & { isAr?: boolean }
) => {
  const strategy = resolveComparisonRenderStrategy(sectionId, opts);
  return dynamic(loader, {
    loading: () => (
      <AnalyticsSectionSkeleton lines={strategy.skeletonLines} isAr={opts?.isAr ?? true} />
    ),
    ssr: strategy.ssr,
  });
};

export const resolveRenderStrategy = (
  sectionId: AnalyticsSectionId,
  opts?: { executiveMode?: boolean }
): RenderStrategy => {
  const base = ANALYTICS_RENDER_STRATEGIES[sectionId];
  if (opts?.executiveMode && sectionId === "advancedAnalytics") {
    return { ...base, preloadPriority: "idle" };
  }
  return base;
};

export const shouldDeferSectionFetch = (
  sectionId: AnalyticsSectionId,
  hasGeneralData: boolean
): boolean => {
  const s = ANALYTICS_RENDER_STRATEGIES[sectionId];
  return Boolean(s.deferUntilData && !hasGeneralData);
};

export const createLazyAnalyticsSection = <P extends object>(
  sectionId: AnalyticsSectionId,
  loader: () => Promise<{ default: ComponentType<P> }>,
  opts?: { executiveMode?: boolean; isAr?: boolean }
) => {
  const strategy = resolveRenderStrategy(sectionId, opts);
  return dynamic(loader, {
    loading: () => (
      <AnalyticsSectionSkeleton lines={strategy.skeletonLines} isAr={opts?.isAr ?? true} />
    ),
    ssr: strategy.ssr,
  });
};
