"use client";

import { memo, useCallback, type KeyboardEvent, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { CI_RADIUS, CI_SHADOW, CI_SPACING, CI_TYPOGRAPHY } from "@/lib/competition-intelligence-theme";
import { useExecutiveSectionVisibility } from "@/components/analytics/executive/ExecutiveSectionVisibilityStore";
import { useStableIntelligenceSectionOpen } from "@/lib/analytics/ai/executive-intelligence/stable-accordion-state";
import ExecutiveCollapsedPreview from "@/components/analytics/executive/ExecutiveCollapsedPreview";
import ExecutiveSectionSummaryBar from "@/components/analytics/executive/ExecutiveSectionSummaryBar";
import ExecutiveAccordionSummary from "@/components/analytics/executive/ExecutiveAccordionSummary";
import ExecutiveDeferredSection from "@/components/analytics/executive/ExecutiveDeferredSection";
import type { InsightConfidence } from "@/lib/analytics/intelligence/analytics-narrative-schema";

export type ExecutiveAccordionSectionProps = {
  id: string;
  title: string;
  hint?: string;
  isAr: boolean;
  defaultOpen?: boolean;
  density?: "executive" | "detailed";
  badge?: string;
  analyticsCount?: number;
  exploratory?: boolean;
  budgetHint?: string;
  collapsedPreview?: Array<{ label: string; value: string }>;
  summaryKpi?: string;
  summaryInsight?: string;
  summaryWarning?: string;
  summaryConfidence?: InsightConfidence;
  lazyMount?: boolean;
  deferContent?: boolean;
  anchorId?: string;
  children: ReactNode;
};

const ExecutiveAccordionSection = memo(
  ({
    id,
    title,
    hint,
    isAr,
    defaultOpen = false,
    density = "detailed",
    badge,
    analyticsCount,
    exploratory,
    budgetHint,
    collapsedPreview,
    summaryKpi,
    summaryInsight,
    summaryWarning,
    summaryConfidence,
    lazyMount = true,
    deferContent = true,
    anchorId,
    children,
  }: ExecutiveAccordionSectionProps) => {
    const isHistoricalIntelligence = id.startsWith("hist-");
    const execVisibility = useExecutiveSectionVisibility(id, defaultOpen);
    const histVisibility = useStableIntelligenceSectionOpen(id, defaultOpen);
    const { open, toggle, hasBeenOpen, mounted } = isHistoricalIntelligence
      ? histVisibility
      : execVisibility;

    const effectiveOpen = mounted ? open : defaultOpen;
    const shouldRenderBody = effectiveOpen && (!lazyMount || hasBeenOpen || effectiveOpen);

    const handleKeyDown = useCallback(
      (e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      },
      [toggle]
    );

    const pad = density === "executive" ? "p-4 sm:p-5" : CI_SPACING.sectionPad;

    return (
      <section
        id={anchorId}
        className={`${CI_RADIUS.card} border border-slate-200 bg-white ${CI_SHADOW.card} scroll-mt-24 print:break-inside-avoid`}
        dir={isAr ? "rtl" : "ltr"}
        aria-labelledby={`exec-section-${id}`}
      >
        <button
          type="button"
          id={`exec-section-${id}`}
          className={`flex w-full items-start justify-between gap-3 ${pad} text-start print:cursor-default`}
          onClick={toggle}
          onKeyDown={handleKeyDown}
          aria-expanded={effectiveOpen}
          aria-controls={`exec-panel-${id}`}
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className={CI_TYPOGRAPHY.sectionTitle}>{title}</h3>
              <span
                className={`rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-800 ${
                  badge ? "" : "invisible"
                }`}
                aria-hidden={!badge}
              >
                {badge ?? "\u00a0"}
              </span>
            </div>
            {hint ? <p className={`mt-1 ${CI_TYPOGRAPHY.sectionHint}`}>{hint}</p> : null}
            {!effectiveOpen && collapsedPreview?.length ? (
              <div className="mt-2">
                <ExecutiveCollapsedPreview isAr={isAr} items={collapsedPreview} />
              </div>
            ) : null}
            {!effectiveOpen ? (
              <ExecutiveAccordionSummary
                isAr={isAr}
                kpi={summaryKpi}
                insight={summaryInsight}
                warning={summaryWarning}
                confidence={summaryConfidence}
              />
            ) : null}
            <ExecutiveSectionSummaryBar
              isAr={isAr}
              analyticsCount={analyticsCount}
              exploratory={exploratory}
              budgetHint={budgetHint}
            />
          </div>
          <span className="mt-0.5 shrink-0 text-slate-500 print:hidden" aria-hidden="true">
            <ChevronDown className={`h-4 w-4 transition-transform ${effectiveOpen ? "rotate-180" : ""}`} />
          </span>
        </button>

        {effectiveOpen ? (
          <div
            id={`exec-panel-${id}`}
            className={`border-t border-slate-100 ${pad} pt-3 print:border-0`}
            role="region"
            aria-label={title}
          >
            {shouldRenderBody ? (
              <ExecutiveDeferredSection isAr={isAr} enabled idle={deferContent}>
                {children}
              </ExecutiveDeferredSection>
            ) : null}
          </div>
        ) : null}
      </section>
    );
  }
);

ExecutiveAccordionSection.displayName = "ExecutiveAccordionSection";

export default ExecutiveAccordionSection;
