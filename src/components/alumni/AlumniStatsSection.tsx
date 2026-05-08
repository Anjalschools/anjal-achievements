"use client";

import { memo, useMemo } from "react";
import type { AlumniLocale } from "@/content/alumni-landing";
import { getAlumniMockStats, getAlumniSectionTitles } from "@/content/alumni-landing";
import type { AlumniPublicSummaryStats } from "@/lib/alumni/alumni-public-types";

type AlumniStatsSectionProps = {
  locale: AlumniLocale;
  stats?: AlumniPublicSummaryStats | null;
};

const AlumniStatsSectionInner = ({ locale, stats }: AlumniStatsSectionProps) => {
  const titles = getAlumniSectionTitles(locale);
  const cards = useMemo(() => {
    if (!stats) return getAlumniMockStats();
    return [
      {
        key: "grads",
        value: stats.totalAlumni.toLocaleString(),
        labelAr: "عدد الخريجين",
        labelEn: "Total alumni",
      },
      {
        key: "uni",
        value: stats.universities.toLocaleString(),
        labelAr: "الجامعات",
        labelEn: "Universities",
      },
      {
        key: "countries",
        value: stats.countries.toLocaleString(),
        labelAr: "الدول",
        labelEn: "Countries",
      },
      {
        key: "co",
        value: stats.companies.toLocaleString(),
        labelAr: "الشركات العالمية",
        labelEn: "Global companies",
      },
      {
        key: "intern",
        value: stats.mentorshipAvailable.toLocaleString(),
        labelAr: "الإرشاد المتاح",
        labelEn: "Mentorship available",
      },
    ];
  }, [stats]);

  return (
    <section className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl font-black text-slate-900 sm:text-3xl">{titles.stats}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-slate-600">
          {locale === "ar"
            ? "أرقام استرشادية — جاهزة للربط مع واجهة برمجية لاحقًا دون تغيير التصميم."
            : "Illustrative figures — structured for future API integration without layout changes."}
        </p>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {cards.map((s) => (
            <li
              key={s.key}
              className="rounded-2xl border border-slate-200/90 bg-white p-5 text-center shadow-sm ring-1 ring-slate-100/80 transition hover:border-primary/25 hover:shadow-md"
            >
              <p className="text-2xl font-black tabular-nums text-primary sm:text-3xl">{s.value}</p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
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
