"use client";

import { Loader2, Sparkles } from "lucide-react";
import SectionCard from "@/components/layout/SectionCard";
import type { ExecutiveTalentIntelligence } from "@/lib/talent-pathway/talent-pathway-intelligence-types";

type ExecutiveTalentIntelligencePanelProps = {
  intelligence: ExecutiveTalentIntelligence | null;
  loading: boolean;
  isAr: boolean;
};

const ExecutiveTalentIntelligencePanel = ({
  intelligence,
  loading,
  isAr,
}: ExecutiveTalentIntelligencePanelProps) => {
  if (loading) {
    return (
      <SectionCard className="mt-4">
        <div className="flex items-center justify-center gap-2 py-8 text-text-light">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          <span>{isAr ? "جاري تحميل ذكاء المسارات…" : "Loading pathway intelligence…"}</span>
        </div>
      </SectionCard>
    );
  }

  if (!intelligence) return null;

  return (
    <SectionCard className="mt-4">
      <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-foreground">
        <Sparkles className="h-4 w-4 text-primary" aria-hidden />
        {isAr ? "ذكاء المسارات والموهبة" : "Talent pathway intelligence"}
      </h3>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-bold text-foreground">
            {isAr ? "أفضل المسارات" : "Best pathways"}
          </p>
          <ul className="space-y-1 text-sm text-text-light">
            {intelligence.bestPathways.length === 0 ? (
              <li>{isAr ? "لا توجد بيانات." : "No data."}</li>
            ) : (
              intelligence.bestPathways.map((row) => (
                <li key={row.pathway}>
                  {row.pathway} — {row.correlationScore}%
                </li>
              ))
            )}
          </ul>
        </div>
        <div>
          <p className="mb-2 text-sm font-bold text-foreground">
            {isAr ? "أكثر البرامج تأثيراً" : "Most impactful programs"}
          </p>
          <ul className="space-y-1 text-sm text-text-light">
            {intelligence.mostImpactfulPrograms.map((row) => (
              <li key={row.programLabelEn}>
                {isAr ? row.programLabelAr : row.programLabelEn} — {row.impactScore}%
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 text-sm font-bold text-foreground">
            {isAr ? "أكثر الجهات تطويراً للمواهب" : "Top talent-developing partners"}
          </p>
          <ul className="space-y-1 text-sm text-text-light">
            {intelligence.topTalentDevelopingPartners.map((row) => (
              <li key={row.organizationName}>
                {row.organizationName} — {row.developmentScore}%
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 text-sm font-bold text-foreground">
            {isAr ? "المجالات الناشئة" : "Emerging fields"}
          </p>
          <ul className="space-y-1 text-sm text-text-light">
            {intelligence.emergingFields.map((row) => (
              <li key={row.fieldEn}>
                {isAr ? row.fieldAr : row.fieldEn} — {row.growthScore}%
              </li>
            ))}
          </ul>
        </div>
      </div>

      {intelligence.highPotentialStudents.length > 0 ? (
        <div className="mt-6">
          <p className="mb-2 text-sm font-bold text-foreground">
            {isAr ? "طلاب ذوو إمكانات عالية" : "High-potential students"}
          </p>
          <ul className="max-h-56 space-y-2 overflow-y-auto text-sm">
            {intelligence.highPotentialStudents.map((student) => (
              <li key={student.studentId} className="rounded-lg border border-border/60 px-3 py-2">
                <p className="font-semibold text-foreground">{student.studentName}</p>
                <p className="text-xs text-text-light">
                  {isAr ? student.alertReasonAr : student.alertReasonEn} · {student.compositeScore}%
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </SectionCard>
  );
};

export default ExecutiveTalentIntelligencePanel;
