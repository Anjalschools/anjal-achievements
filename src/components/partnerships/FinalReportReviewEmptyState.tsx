"use client";

import SectionCard from "@/components/layout/SectionCard";
import type { FinalReportReviewEmptyStateStats } from "@/lib/partnerships/final-report-review-empty-state-stats";
import { ClipboardList } from "lucide-react";

type FinalReportReviewEmptyStateProps = {
  stats: FinalReportReviewEmptyStateStats;
  locale: "ar" | "en";
};

const FinalReportReviewEmptyState = ({ stats, locale }: FinalReportReviewEmptyStateProps) => {
  const isAr = locale === "ar";

  const cards = [
    {
      label: isAr ? "بانتظار المراجعة" : "Awaiting review",
      value: stats.awaitingReview,
      tone: "text-amber-700",
    },
    {
      label: isAr ? "تحتاج تعديل" : "Need revision",
      value: stats.needsRevision,
      tone: "text-orange-700",
    },
    {
      label: isAr ? "متوسط درجة الاتساق" : "Average consistency",
      value: stats.averageConsistencyScore != null ? `${stats.averageConsistencyScore}%` : "—",
      tone: "text-blue-700",
    },
    {
      label: isAr ? "معدل نجاح التحقق" : "Validation success rate",
      value: stats.validationSuccessRate != null ? `${stats.validationSuccessRate}%` : "—",
      tone: "text-emerald-700",
    },
  ];

  return (
    <div className="space-y-4 py-4">
      <div className="flex flex-col items-center text-center">
        <ClipboardList className="mb-3 h-10 w-10 text-slate-300" aria-hidden />
        <h3 className="text-lg font-black text-slate-900">
          {isAr ? "لوحة مراجعة التقارير" : "Report review dashboard"}
        </h3>
        <p className="mt-1 max-w-sm text-sm text-slate-500">
          {isAr
            ? "اختر تقريراً من القائمة لبدء المراجعة. فيما يلي ملخص سريع من البيانات الحالية."
            : "Select a report from the list to begin review. Quick summary from current data:"}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((card) => (
          <SectionCard key={card.label} className="!p-4">
            <p className="text-xs text-slate-500">{card.label}</p>
            <p className={`text-2xl font-black ${card.tone}`}>{card.value}</p>
          </SectionCard>
        ))}
      </div>
    </div>
  );
};

export default FinalReportReviewEmptyState;
