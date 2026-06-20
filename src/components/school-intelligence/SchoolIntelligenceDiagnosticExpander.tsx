"use client";

import SectionCard from "@/components/layout/SectionCard";
import type { SchoolIntelligencePageDiagnostics } from "@/lib/school-intelligence/school-intelligence-page-types";
import type { SchoolIntelligenceSectionKey } from "@/lib/school-intelligence/school-intelligence-page-types";
import type { SchoolIntelligenceSectionStatus } from "@/lib/school-intelligence/school-intelligence-page-types";
import { buildDiagnosticExpanderSections } from "@/lib/school-intelligence/school-intelligence-transparency-utils";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

type SchoolIntelligenceDiagnosticExpanderProps = {
  isAr: boolean;
  sectionStatusMap: Record<SchoolIntelligenceSectionKey, SchoolIntelligenceSectionStatus>;
  diagnostics?: SchoolIntelligencePageDiagnostics;
};

const SchoolIntelligenceDiagnosticExpander = ({
  isAr,
  sectionStatusMap,
  diagnostics,
}: SchoolIntelligenceDiagnosticExpanderProps) => {
  const [open, setOpen] = useState(false);
  const details = buildDiagnosticExpanderSections(sectionStatusMap, diagnostics);

  return (
    <SectionCard className="mb-4">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between text-start"
        aria-expanded={open}
      >
        <span className="text-base font-bold">
          {isAr ? "تفاصيل التشخيص (مسؤول)" : "Diagnostic details (admin)"}
        </span>
        {open ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
      </button>

      {open ? (
        <div className="mt-3 space-y-3 text-sm">
          <DiagnosticList
            title={isAr ? "أقسام فاشلة" : "Failed sections"}
            items={details.failedSections}
            emptyLabel={isAr ? "لا يوجد" : "None"}
          />
          <DiagnosticList
            title={isAr ? "استعلامات بطيئة" : "Slow queries"}
            items={details.slowQueries}
            emptyLabel={isAr ? "لا يوجد" : "None"}
          />
          <DiagnosticList
            title={isAr ? "فشل التجميع" : "Aggregation failures"}
            items={details.aggregationFailures}
            emptyLabel={isAr ? "لا يوجد" : "None"}
          />
          <DiagnosticList
            title={isAr ? "تحذيرات البيئة" : "Environment warnings"}
            items={details.environmentWarnings}
            emptyLabel={isAr ? "لا يوجد" : "None"}
          />
          {diagnostics?.warnings?.length ? (
            <div>
              <p className="mb-1 font-semibold">{isAr ? "جميع التحذيرات" : "All warnings"}</p>
              <ul className="list-inside list-disc text-xs text-text-light">
                {diagnostics.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </SectionCard>
  );
};

const DiagnosticList = ({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: string[];
  emptyLabel: string;
}) => (
  <div>
    <p className="mb-1 font-semibold">{title}</p>
    {items.length ? (
      <ul className="list-inside list-disc text-xs text-text-light">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    ) : (
      <p className="text-xs text-text-light">{emptyLabel}</p>
    )}
  </div>
);

export default SchoolIntelligenceDiagnosticExpander;
