"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import SectionCard from "@/components/layout/SectionCard";
import type { AlumniTalentPreparationPayload } from "@/lib/talent-pathway/talent-pathway-intelligence-types";
import { getLocale } from "@/lib/i18n";
import { GraduationCap, Loader2, Users } from "lucide-react";

const AlumniTalentPreparationPanel = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [loading, setLoading] = useState(true);
  const [preparation, setPreparation] = useState<AlumniTalentPreparationPayload | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/user/talent-pathway?view=alumni-preparation", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPreparation(null);
        return;
      }
      setPreparation(json.preparation || null);
    } catch {
      setPreparation(null);
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
        <div className="flex items-center justify-center gap-2 py-6 text-text-light">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          <span>{isAr ? "جاري تحضير مسار الخريج…" : "Preparing alumni pathway…"}</span>
        </div>
      </SectionCard>
    );
  }

  if (!preparation) return null;

  return (
    <SectionCard>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-foreground">
        <GraduationCap className="h-5 w-5 text-primary" aria-hidden />
        {isAr ? "تحضير مجتمع خريجي الأنجال" : "Al-Anjal alumni community preparation"}
      </h2>
      <p className="mb-4 text-sm text-text-light">
        {isAr ? "جاهزية المجتمع:" : "Community readiness:"}{" "}
        <span className="font-bold text-primary">{preparation.communityReadinessScore}%</span>
      </p>

      <div className="grid gap-4 lg:grid-cols-3">
        <div>
          <p className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground">
            <Users className="h-4 w-4 text-primary" aria-hidden />
            {isAr ? "مرشدون مقترحون" : "Suggested mentors"}
          </p>
          <ul className="space-y-2 text-sm text-text-light">
            {preparation.recommendedMentors.map((row) => (
              <li key={row.focusAreaEn}>
                <p className="font-semibold text-foreground">{isAr ? row.focusAreaAr : row.focusAreaEn}</p>
                <p>{isAr ? row.reasonAr : row.reasonEn}</p>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 text-sm font-bold text-foreground">
            {isAr ? "مسارات مهنية" : "Career pathways"}
          </p>
          <ul className="space-y-2 text-sm text-text-light">
            {preparation.careerPathways.map((row) => (
              <li key={row.titleEn}>
                <p className="font-semibold text-foreground">{isAr ? row.titleAr : row.titleEn}</p>
                <p>{isAr ? row.reasonAr : row.reasonEn}</p>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 text-sm font-bold text-foreground">
            {isAr ? "تحضير جامعي" : "University preparation"}
          </p>
          <ul className="space-y-2 text-sm text-text-light">
            {preparation.universityPreparation.map((row) => (
              <li key={row.titleEn}>
                <p className="font-semibold text-foreground">{isAr ? row.titleAr : row.titleEn}</p>
                <p>{isAr ? row.reasonAr : row.reasonEn}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <Link
        href="/alumni/community"
        className="mt-4 inline-flex text-sm font-semibold text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {isAr ? "استكشاف مجتمع الخريجين ←" : "Explore alumni community →"}
      </Link>
    </SectionCard>
  );
};

export default AlumniTalentPreparationPanel;
