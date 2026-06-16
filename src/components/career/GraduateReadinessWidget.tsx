"use client";

import { useEffect, useState } from "react";
import SectionCard from "@/components/layout/SectionCard";
import { getLocale } from "@/lib/i18n";
import { Briefcase, Loader2 } from "lucide-react";

type ReadinessWidget = {
  trainingCount: number;
  totalHours: number;
  employabilityScore: number;
  employabilityBandAr: string;
  employabilityBandEn: string;
  institutionRecommendations: number;
  employmentRecommendations: number;
  finalOutcomeLevel: string | null;
  finalOutcomeLabelAr: string;
  finalOutcomeLabelEn: string;
  readinessScore: number;
};

const GraduateReadinessWidget = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReadinessWidget | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/user/training-readiness", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        setData(json.item || null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <SectionCard>
        <div className="flex items-center gap-2 text-sm text-text-light">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {isAr ? "جاري التحميل…" : "Loading…"}
        </div>
      </SectionCard>
    );
  }

  if (!data || data.trainingCount === 0) return null;

  const cards = [
    { label: isAr ? "عدد التدريبات" : "Training count", value: data.trainingCount },
    { label: isAr ? "إجمالي الساعات" : "Total hours", value: data.totalHours },
    { label: isAr ? "الجاهزية للتوظيف" : "Employability", value: data.employabilityScore },
    { label: isAr ? "توصيات المؤسسات" : "Institution recs", value: data.institutionRecommendations },
    { label: isAr ? "توصيات التوظيف" : "Employment recs", value: data.employmentRecommendations },
    {
      label: isAr ? "المستوى النهائي" : "Final outcome",
      value: isAr ? data.finalOutcomeLabelAr : data.finalOutcomeLabelEn,
    },
  ];

  return (
    <SectionCard>
      <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
        <Briefcase className="h-4 w-4 text-primary" aria-hidden />
        {isAr ? "جاهزية سوق العمل" : "Labor market readiness"}
      </h2>
      <p className="mb-3 text-xs text-text-light">
        {isAr
          ? `التصنيف: ${data.employabilityBandAr} · جاهزية برنامج التدريب: ${data.readinessScore}`
          : `Band: ${data.employabilityBandEn} · Training program readiness: ${data.readinessScore}`}
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl bg-muted/40 p-3">
            <p className="text-xs font-semibold text-text-light">{card.label}</p>
            <p className="mt-1 text-lg font-black text-primary">{card.value}</p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
};

export default GraduateReadinessWidget;
