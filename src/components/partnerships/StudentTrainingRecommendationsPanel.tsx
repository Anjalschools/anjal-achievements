"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import SectionCard from "@/components/layout/SectionCard";
import { getLocale } from "@/lib/i18n";
import { AlertTriangle, Loader2, Sparkles } from "lucide-react";

type RecommendationRow = {
  opportunityId: string;
  organizationId: string;
  organizationName: string;
  title: string;
  trainingOpportunityMatchScore: number;
  reasonAr: string;
  reasonEn: string;
  organizationCity?: string;
  organizationSector?: string;
};

type EarlyRisk = {
  applicationId: string;
  opportunityTitle: string;
  riskFlags: string[];
  warningsAr: string[];
  warningsEn: string[];
};

const StudentTrainingRecommendationsPanel = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<RecommendationRow[]>([]);
  const [earlyRisk, setEarlyRisk] = useState<EarlyRisk | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/partnerships/student-training-recommendations", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setItems([]);
        setEarlyRisk(null);
        return;
      }
      setItems(Array.isArray(json.recommendations) ? json.recommendations : []);
      setEarlyRisk(json.earlyRisk || null);
    } catch {
      setItems([]);
      setEarlyRisk(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <SectionCard className="mb-6">
        <div className="flex items-center justify-center gap-2 py-6 text-text-light">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          <span>{isAr ? "جاري تحليل التوصيات…" : "Analyzing recommendations…"}</span>
        </div>
      </SectionCard>
    );
  }

  if (items.length === 0 && !earlyRisk) return null;

  return (
    <SectionCard className="mb-6">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-foreground">
        <Sparkles className="h-5 w-5 text-primary" aria-hidden />
        {isAr ? "جهات تدريب مقترحة لك" : "Recommended training partners for you"}
      </h2>

      {earlyRisk ? (
        <div
          className="mb-4 rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="alert"
        >
          <p className="flex items-center gap-2 font-bold">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            {isAr ? "تنبيه مبكر" : "Early risk alert"} — {earlyRisk.opportunityTitle}
          </p>
          <ul className="mt-2 list-disc space-y-1 ps-5">
            {(isAr ? earlyRisk.warningsAr : earlyRisk.warningsEn).map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {items.length > 0 ? (
        <ul className="space-y-3" aria-label={isAr ? "توصيات التدريب" : "Training recommendations"}>
          {items.map((item) => (
            <li key={item.opportunityId}>
              <article className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <Link
                      href={`/summer-training/${encodeURIComponent(item.opportunityId)}`}
                      className="font-bold text-foreground hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      {item.organizationName}
                    </Link>
                    <p className="text-sm text-text-light">{item.title}</p>
                    <p className="mt-2 text-sm text-foreground">
                      {isAr ? item.reasonAr : item.reasonEn}
                    </p>
                    {item.organizationCity || item.organizationSector ? (
                      <p className="mt-1 text-xs text-text-light">
                        {[item.organizationCity, item.organizationSector].filter(Boolean).join(" · ")}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className="inline-flex shrink-0 items-center rounded-full bg-primary px-3 py-1 text-sm font-black text-white"
                    aria-label={
                      isAr
                        ? `درجة التوافق ${item.trainingOpportunityMatchScore} بالمئة`
                        : `Match score ${item.trainingOpportunityMatchScore} percent`
                    }
                  >
                    {item.trainingOpportunityMatchScore}%
                  </span>
                </div>
              </article>
            </li>
          ))}
        </ul>
      ) : null}
    </SectionCard>
  );
};

export default StudentTrainingRecommendationsPanel;
