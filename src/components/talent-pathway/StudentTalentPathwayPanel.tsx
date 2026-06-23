"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import SectionCard from "@/components/layout/SectionCard";
import {
  careerReadinessIndexLabel,
  talentAreaLabel,
} from "@/lib/talent-pathway/talent-pathway-constants";
import type { StudentTalentPathwayPayload } from "@/lib/talent-pathway/talent-pathway-intelligence-types";
import { getLocale } from "@/lib/i18n";
import { Compass, Loader2, Sparkles, TrendingUp } from "lucide-react";

const StudentTalentPathwayPanel = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [loading, setLoading] = useState(true);
  const [pathway, setPathway] = useState<StudentTalentPathwayPayload | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/user/talent-pathway", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPathway(null);
        return;
      }
      setPathway(json.pathway || null);
    } catch {
      setPathway(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <SectionCard>
        <div className="flex items-center justify-center gap-2 py-8 text-text-light">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          <span>{isAr ? "جاري تحليل مسار المواهب…" : "Analyzing talent pathway…"}</span>
        </div>
      </SectionCard>
    );
  }

  if (!pathway) return null;

  return (
    <SectionCard>
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-foreground">
        <Sparkles className="h-5 w-5 text-primary" aria-hidden />
        {isAr ? "مسار المواهب والتطوير" : "Talent development pathway"}
      </h2>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border/70 p-4">
          <p className="text-sm font-bold text-foreground">
            {isAr ? "مجالات المواهب الأساسية" : "Primary talent areas"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {pathway.studentTalentProfile.primaryTalentAreas.map((area) => (
              <span
                key={area.key}
                className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary"
              >
                {isAr ? area.labelAr : area.labelEn} · {area.score}%
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border/70 p-4">
          <p className="text-sm font-bold text-foreground">
            {isAr ? "مؤشر الجاهزية المهنية المتكامل" : "Integrated career readiness index"}
          </p>
          <p className="mt-2 text-3xl font-black text-primary">
            {pathway.careerReadinessIndex.careerReadinessIndex}%
          </p>
          <p className="mt-1 text-sm text-text-light">
            {careerReadinessIndexLabel(pathway.careerReadinessIndex.careerReadinessBand, isAr)}
          </p>
        </div>
      </div>

      {pathway.achievementTrainingCorrelation.strongestPathways.length > 0 ? (
        <div className="mt-4 rounded-xl border border-border/70 p-4">
          <p className="mb-2 text-sm font-bold text-foreground">
            {isAr ? "أقوى المسارات (إنجاز ↔ تدريب)" : "Strongest pathways (achievement ↔ training)"}
          </p>
          <ul className="space-y-1 text-sm text-text-light">
            {pathway.achievementTrainingCorrelation.strongestPathways.slice(0, 4).map((row) => (
              <li key={row.successPattern}>
                {talentAreaLabel(row.achievementArea, isAr)} → {row.trainingCategory} · {row.correlationScore}%
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {pathway.futureRecommendations.length > 0 ? (
        <div className="mt-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground">
            <Compass className="h-4 w-4 text-primary" aria-hidden />
            {isAr ? "توصيات مستقبلية" : "Future recommendations"}
          </p>
          <ul className="space-y-2">
            {pathway.futureRecommendations.slice(0, 5).map((rec, index) => (
              <li key={`${rec.type}-${index}`} className="rounded-lg border border-border/60 px-3 py-2 text-sm">
                <p className="font-semibold text-foreground">{isAr ? rec.titleAr : rec.titleEn}</p>
                <p className="text-text-light">{isAr ? rec.reasonAr : rec.reasonEn}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 rounded-xl border border-border/70 p-4">
        <p className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground">
          <TrendingUp className="h-4 w-4 text-primary" aria-hidden />
          {isAr ? "نمو المسار عبر السنوات" : "Pathway growth over years"}
        </p>
        <p className="text-sm text-text-light">
          {isAr ? "الاتجاه العام:" : "Overall trend:"}{" "}
          {pathway.longitudinalGrowth.overallTrend === "rising"
            ? isAr
              ? "صاعد"
              : "Rising"
            : pathway.longitudinalGrowth.overallTrend === "stable"
              ? isAr
                ? "مستقر"
                : "Stable"
              : isAr
                ? "نامٍ"
                : "Emerging"}
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {pathway.longitudinalGrowth.careerReadinessGrowth.slice(-3).map((point) => (
            <div key={point.year} className="text-xs text-text-light">
              {point.year}: {point.value}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <Link
          href="/summer-training"
          className="text-sm font-semibold text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {isAr ? "استكشاف فرص التدريب المقترحة ←" : "Explore suggested training opportunities →"}
        </Link>
      </div>
    </SectionCard>
  );
};

export default StudentTalentPathwayPanel;
