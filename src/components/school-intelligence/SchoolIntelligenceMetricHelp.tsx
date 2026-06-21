"use client";

import { HelpCircle } from "lucide-react";
import type { SchoolIntelligenceMetricHelpKey } from "@/lib/school-intelligence/school-intelligence-glossary";
import { SCHOOL_INTELLIGENCE_METRIC_HELP } from "@/lib/school-intelligence/school-intelligence-glossary";

type SchoolIntelligenceMetricHelpProps = {
  isAr: boolean;
  metricKey: SchoolIntelligenceMetricHelpKey;
  className?: string;
};

const SchoolIntelligenceMetricHelp = ({
  isAr,
  metricKey,
  className = "",
}: SchoolIntelligenceMetricHelpProps) => {
  const copy = SCHOOL_INTELLIGENCE_METRIC_HELP[metricKey];
  const title = isAr ? copy.titleAr : copy.titleEn;
  const body = isAr ? copy.bodyAr : copy.bodyEn;

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <button
        type="button"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-text-light hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        aria-label={title}
        title={`${title}: ${body}`}
      >
        <HelpCircle className="h-3.5 w-3.5" aria-hidden />
      </button>
    </span>
  );
};

export default SchoolIntelligenceMetricHelp;
