"use client";

import type { ReactNode } from "react";
import ExecutiveAccordionSection from "@/components/analytics/executive/ExecutiveAccordionSection";

export type IntelligenceCollapsibleSectionProps = {
  id: string;
  title: string;
  hint?: string;
  isAr: boolean;
  defaultOpen?: boolean;
  density?: "executive" | "detailed";
  children: ReactNode;
  badge?: string;
  collapsedPreview?: Array<{ label: string; value: string }>;
  analyticsCount?: number;
};

/** Backward-compatible wrapper — lazy unmount + executive visibility store */
const IntelligenceCollapsibleSection = (props: IntelligenceCollapsibleSectionProps) => (
  <ExecutiveAccordionSection
    id={props.id}
    title={props.title}
    hint={props.hint}
    isAr={props.isAr}
    defaultOpen={props.defaultOpen}
    density={props.density}
    badge={props.badge}
    collapsedPreview={props.collapsedPreview}
    analyticsCount={props.analyticsCount}
    lazyMount
    deferContent
  >
    {props.children}
  </ExecutiveAccordionSection>
);

export default IntelligenceCollapsibleSection;
