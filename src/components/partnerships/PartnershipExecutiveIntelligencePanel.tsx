"use client";

import Link from "next/link";
import { Download, Loader2 } from "lucide-react";
import SectionCard from "@/components/layout/SectionCard";
import { trainingOutcomeLabel } from "@/lib/partnerships/partnership-recommendation-constants";
import type { PartnershipExecutiveIntelligence } from "@/lib/partnerships/partnership-recommendation-types";

type PartnershipExecutiveIntelligencePanelProps = {
  intelligence: PartnershipExecutiveIntelligence | null;
  loading: boolean;
  isAr: boolean;
};

const PartnerList = ({
  rows,
  isAr,
  valueKey,
}: {
  rows: Array<{ organizationId: string; organizationName: string; [key: string]: string | number }>;
  isAr: boolean;
  valueKey: string;
}) => (
  <ul className="space-y-1 text-sm text-text-light">
    {rows.length === 0 ? (
      <li>{isAr ? "لا توجد بيانات." : "No data."}</li>
    ) : (
      rows.map((row) => (
        <li key={row.organizationId}>
          <Link
            href={`/admin/partnerships/organizations/${encodeURIComponent(row.organizationId)}`}
            className="font-semibold text-primary hover:underline"
          >
            {row.organizationName}
          </Link>{" "}
          — {String(row[valueKey])}
        </li>
      ))
    )}
  </ul>
);

const PartnershipExecutiveIntelligencePanel = ({
  intelligence,
  loading,
  isAr,
}: PartnershipExecutiveIntelligencePanelProps) => {
  if (loading) {
    return (
      <SectionCard className="mt-4">
        <div className="flex items-center justify-center gap-2 py-8 text-text-light">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          <span>{isAr ? "جاري تحميل ذكاء الشراكات…" : "Loading partnership intelligence…"}</span>
        </div>
      </SectionCard>
    );
  }

  if (!intelligence) return null;

  return (
    <SectionCard className="mt-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-base font-bold text-foreground">
          {isAr ? "ذكاء الشراكات" : "Partnership intelligence"}
        </h3>
        <div className="flex flex-wrap gap-2">
          <a
            href="/api/admin/partnerships/partnership-recommendations/annual-report?format=xlsx"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Download className="h-4 w-4" aria-hidden />
            {isAr ? "تصدير Excel" : "Export Excel"}
          </a>
          <a
            href="/api/admin/partnerships/partnership-recommendations/annual-report?format=pdf"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Download className="h-4 w-4" aria-hidden />
            {isAr ? "تصدير PDF" : "Export PDF"}
          </a>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-bold text-foreground">
            {isAr ? "أفضل الجهات أداءً" : "Best performing partners"}
          </p>
          <PartnerList rows={intelligence.bestPerformingPartners} isAr={isAr} valueKey="combinedScore" />
        </div>
        <div>
          <p className="mb-2 text-sm font-bold text-foreground">
            {isAr ? "الجهات المتراجعة" : "Declining partners"}
          </p>
          <PartnerList rows={intelligence.decliningPartners} isAr={isAr} valueKey="combinedScore" />
        </div>
        <div>
          <p className="mb-2 text-sm font-bold text-foreground">
            {isAr ? "الجهات عالية الطلب" : "High-demand partners"}
          </p>
          <PartnerList rows={intelligence.highDemandPartners} isAr={isAr} valueKey="applicantCount" />
        </div>
        <div>
          <p className="mb-2 text-sm font-bold text-foreground">
            {isAr ? "الجهات منخفضة الرضا" : "Low-satisfaction partners"}
          </p>
          <PartnerList
            rows={intelligence.lowSatisfactionPartners}
            isAr={isAr}
            valueKey="averageStudentSatisfaction"
          />
        </div>
        <div className="lg:col-span-2">
          <p className="mb-2 text-sm font-bold text-foreground">
            {isAr ? "الفرص التدريبية الأكثر نجاحاً" : "Most successful training opportunities"}
          </p>
          <ul className="space-y-1 text-sm text-text-light">
            {intelligence.mostSuccessfulOpportunities.length === 0 ? (
              <li>{isAr ? "لا توجد بيانات." : "No data."}</li>
            ) : (
              intelligence.mostSuccessfulOpportunities.map((row) => (
                <li key={row.opportunityId}>
                  {row.title} — {row.organizationName} · {row.successScore}% (
                  {trainingOutcomeLabel(row.trainingOutcomeLevel, isAr)})
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {intelligence.categoryRankings.map((group) => (
          <div key={group.groupKey} className="rounded-xl border border-border/70 p-4">
            <p className="mb-2 text-sm font-bold text-foreground">
              {isAr ? group.labelAr : group.labelEn}
            </p>
            <ul className="space-y-1 text-sm text-text-light">
              {group.partners.length === 0 ? (
                <li>{isAr ? "لا توجد بيانات." : "No data."}</li>
              ) : (
                group.partners.map((partner, index) => (
                  <li key={partner.organizationId}>
                    {index + 1}. {partner.organizationName} — {partner.combinedScore}%
                  </li>
                ))
              )}
            </ul>
          </div>
        ))}
      </div>
    </SectionCard>
  );
};

export default PartnershipExecutiveIntelligencePanel;
