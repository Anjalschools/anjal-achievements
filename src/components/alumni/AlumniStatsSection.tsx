"use client";

import { memo, useMemo } from "react";
import type { AlumniLocale } from "@/content/alumni-landing";
import { getAlumniSectionTitles } from "@/content/alumni-landing";
import type { AlumniPublicSummaryStats } from "@/lib/alumni/alumni-public-types";

type AlumniStatsSectionProps = {
  locale: AlumniLocale;
  stats?: AlumniPublicSummaryStats | null;
  /** While fetching public summary — show skeleton instead of mock em dash. */
  loading?: boolean;
};

const safeInt = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
};

const formatStat = (locale: AlumniLocale, value: number): string => {
  if (!Number.isFinite(value)) return "0";
  try {
    return value.toLocaleString(locale === "ar" ? "ar-SA" : "en-US", { maximumFractionDigits: 0 });
  } catch {
    return String(value);
  }
};

const AlumniStatsSectionInner = ({ locale, stats, loading }: AlumniStatsSectionProps) => {
  const titles = getAlumniSectionTitles(locale);
  const safeStats = useMemo(() => {
    const next = {
      alumniCount: safeInt(stats?.totalAlumni),
      universities: safeInt(stats?.universities),
      countries: safeInt(stats?.countries),
      companies: safeInt(stats?.companies),
      globalParticipation: safeInt(stats?.globalParticipation),
      mentorshipAvailable: safeInt(stats?.mentorshipAvailable),
      featuredAlumni: safeInt(stats?.featuredAlumni),
    };
    if (process.env.NODE_ENV === "development") {
      Object.freeze(next);
    }
    return next;
  }, [stats]);

  const cards = useMemo(() => {
    const s = safeStats;
    return [
      { key: "grads", value: formatStat(locale, s.alumniCount), labelAr: "عدد الخريجين", labelEn: "Total alumni" },
      { key: "uni", value: formatStat(locale, s.universities), labelAr: "الجامعات", labelEn: "Universities" },
      { key: "countries", value: formatStat(locale, s.countries), labelAr: "الدول", labelEn: "Countries" },
      { key: "co", value: formatStat(locale, s.companies), labelAr: "الشركات العالمية", labelEn: "Global companies" },
      {
        key: "global",
        value: formatStat(locale, s.globalParticipation),
        labelAr: "المشاركات العالمية",
        labelEn: "International participation",
      },
      {
        key: "intern",
        value: formatStat(locale, s.mentorshipAvailable),
        labelAr: "الخريجون المتاحون للإرشاد والتوجيه",
        labelEn: "Alumni available for mentoring",
      },
    ];
  }, [locale, safeStats]);

  if (loading) {
    return (
      <section className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white py-10 sm:py-12" aria-busy="true">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-7 h-8 max-w-md animate-pulse rounded-lg bg-slate-200" />
          <ul className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <li
                key={i}
                className="rounded-xl border border-slate-200/80 bg-white/95 px-4 py-4 text-center shadow-sm ring-1 ring-slate-100/80"
              >
                <div className="mx-auto h-9 w-16 animate-pulse rounded-md bg-slate-200" />
                <div className="mx-auto mt-3 h-3 w-24 animate-pulse rounded bg-slate-100" />
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  return (
    <section className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white py-10 sm:py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl font-black text-slate-900 sm:text-3xl">{titles.stats}</h2>
        <ul className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          {cards.map((s) => (
            <li
              key={s.key}
              className="rounded-xl border border-slate-200/80 bg-white/95 px-4 py-4 text-center shadow-[0_1px_2px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80 transition duration-200 hover:border-primary/25 hover:shadow-[0_4px_10px_rgba(15,23,42,0.08)]"
            >
              <p
                className="text-3xl font-black leading-none text-primary sm:text-[2rem]"
                style={{ fontVariantNumeric: "tabular-nums", direction: "ltr" }}
                dir="ltr"
              >
                <span className="inline-block tabular-nums" dir="ltr" suppressHydrationWarning>
                  {s.value}
                </span>
              </p>
              <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {locale === "ar" ? s.labelAr : s.labelEn}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export const AlumniStatsSection = memo(AlumniStatsSectionInner);
AlumniStatsSection.displayName = "AlumniStatsSection";
