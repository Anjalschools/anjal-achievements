"use client";

import SectionCard from "@/components/layout/SectionCard";
import type { SchoolIntelligenceExecutiveSummary } from "@/lib/school-intelligence/school-intelligence-diagnostics-types";
import { formatSchoolIntelligenceConfidence } from "@/lib/school-intelligence/school-intelligence-confidence";

type SchoolIntelligenceExecutiveSummaryPanelProps = {
  isAr: boolean;
  summary?: SchoolIntelligenceExecutiveSummary;
};

const renderList = (
  title: string,
  items: SchoolIntelligenceExecutiveSummary["strengths"],
  isAr: boolean
) => (
  <div>
    <h3 className="text-sm font-bold">{title}</h3>
    <ul className="mt-2 space-y-1 text-sm text-text-light">
      {items.length === 0 ? (
        <li>{isAr ? "—" : "—"}</li>
      ) : (
        items.map((item, index) => (
          <li key={`${title}-${index}`} className="rounded-lg bg-muted/40 px-3 py-2 text-text">
            <p>{isAr ? item.ar : item.en}</p>
            {item.confidence != null ? (
              <p className="mt-1 text-[11px] font-semibold text-slate-500">
                {formatSchoolIntelligenceConfidence(item.confidence, isAr).label}
              </p>
            ) : null}
          </li>
        ))
      )}
    </ul>
  </div>
);

const SchoolIntelligenceExecutiveSummaryPanel = ({
  isAr,
  summary,
}: SchoolIntelligenceExecutiveSummaryPanelProps) => {
  if (!summary) return null;

  return (
    <SectionCard className="mb-4">
      <h2 className="text-base font-bold">
        {isAr ? "الملخص التنفيذي" : "Executive summary"}
      </h2>
      <p className="mt-1 text-sm text-text-light">
        {isAr
          ? "ملخص استراتيجي تلقائي من نتائج الذكاء المدرسي."
          : "Automatically generated strategic summary from school intelligence results."}
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {renderList(isAr ? "نقاط القوة" : "Strengths", summary.strengths, isAr)}
        {renderList(isAr ? "المخاطر" : "Risks", summary.risks, isAr)}
        {renderList(isAr ? "الفرص" : "Opportunities", summary.opportunities, isAr)}
        {renderList(isAr ? "التوصيات" : "Recommendations", summary.recommendations, isAr)}
      </div>

      <div className="mt-4">
        {renderList(isAr ? "الاتجاهات الرئيسية" : "Key trends", summary.growthTrends, isAr)}
      </div>
    </SectionCard>
  );
};

export default SchoolIntelligenceExecutiveSummaryPanel;
