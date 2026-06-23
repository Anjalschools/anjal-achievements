"use client";

import SectionCard from "@/components/layout/SectionCard";
import ConsistencyExplanationPanel from "@/components/partnerships/ConsistencyExplanationPanel";
import {
  TRAINING_INTELLIGENCE_RISK_LABELS,
  type TrainingIntelligenceRiskFlag,
} from "@/lib/partnerships/training-intelligence-constants";
import type { TrainingReportIntelligence } from "@/lib/partnerships/training-intelligence-types";
import { SEVERITY_TONES } from "@/lib/partnerships/final-report-review-ux-constants";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

type TrainingConsistencyPanelProps = {
  intelligence: TrainingReportIntelligence | null | undefined;
  locale: "ar" | "en";
};

const TrainingConsistencyPanel = ({ intelligence, locale }: TrainingConsistencyPanelProps) => {
  const isAr = locale === "ar";

  if (!intelligence) {
    return (
      <SectionCard className="!p-4">
        <h4 className="mb-2 text-sm font-black text-slate-900">{isAr ? "تحليل الاتساق" : "Consistency analysis"}</h4>
        <p className="text-xs text-slate-500">
          {isAr ? "لا تتوفر بيانات كافية لمقارنة التقريرين." : "Insufficient data to compare reports."}
        </p>
      </SectionCard>
    );
  }

  const riskLabel = (flag: TrainingIntelligenceRiskFlag) =>
    TRAINING_INTELLIGENCE_RISK_LABELS[flag]?.[isAr ? "ar" : "en"] || flag;

  return (
    <SectionCard className="!p-4">
      <h4 className="mb-3 text-sm font-black text-slate-900">{isAr ? "تحليل الاتساق" : "Consistency analysis"}</h4>

      <ConsistencyExplanationPanel intelligence={intelligence} locale={locale} />

      {intelligence.organizationTrainingQualityIndex != null ? (
        <div className={`mb-4 rounded-xl border px-4 py-3 ${SEVERITY_TONES.information}`}>
          <p className="text-xs font-bold">
            {isAr ? "مؤشر جودة المؤسسة" : "Organization quality index"}
          </p>
          <p className="text-lg font-black">
            {intelligence.organizationTrainingQualityIndex}% —{" "}
            {isAr ? intelligence.organizationQualityCategoryAr : intelligence.organizationQualityCategoryEn}
          </p>
        </div>
      ) : null}

      {intelligence.riskFlags.length > 0 ? (
        <ul className="mb-4 space-y-1" aria-label={isAr ? "مؤشرات المخاطر" : "Risk flags"}>
          {intelligence.riskFlags.map((flag) => (
            <li
              key={flag}
              className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-2 py-1 text-xs text-orange-900"
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {riskLabel(flag)}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mb-4">
        <p className="mb-2 text-xs font-black text-slate-800">
          {isAr ? "مقارنة الحقول" : "Field comparison"}
        </p>
        <ul className="space-y-1 text-xs">
          {intelligence.fieldComparisons.map((row) => (
            <li
              key={row.field}
              className={`rounded-lg px-2 py-1 ${
                row.mismatch ? "bg-red-50 text-red-900" : "bg-slate-50 text-slate-800"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-bold">{isAr ? row.labelAr : row.labelEn}</span>
                <span>{row.alignmentScore}%</span>
              </div>
              <p className="mt-1 text-[11px] opacity-90">
                {isAr ? "الطالب" : "Student"}: {String(row.studentValue ?? "—")} ·{" "}
                {isAr ? "المؤسسة" : "Institution"}: {String(row.institutionValue ?? "—")}
              </p>
            </li>
          ))}
        </ul>
      </div>

      {intelligence.narrativeSimilarity.length > 0 ? (
        <div className="mb-4">
          <p className="mb-2 text-xs font-black text-slate-800">
            {isAr ? "تشابه السرد" : "Narrative similarity"}
          </p>
          <ul className="space-y-1 text-xs">
            {intelligence.narrativeSimilarity.map((row) => (
              <li
                key={row.pairKey}
                className={`rounded-lg px-2 py-1 ${
                  row.highSimilarity ? "bg-amber-50 text-amber-900" : "bg-slate-50 text-slate-700"
                }`}
              >
                {isAr ? row.labelAr : row.labelEn}: {row.similarityPct}%
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {intelligence.warnings.length > 0 ? (
        <ul className="space-y-1 text-xs text-amber-800">
          {intelligence.warnings.map((warning) => (
            <li key={warning} className="rounded-lg bg-amber-50 px-2 py-1">
              {warning}
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-2 text-xs text-emerald-700">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          {isAr ? "لا توجد تعارضات حرجة بين التقريرين." : "No critical mismatches detected."}
        </p>
      )}
    </SectionCard>
  );
};

export default TrainingConsistencyPanel;
