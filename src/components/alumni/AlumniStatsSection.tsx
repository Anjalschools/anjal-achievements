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
        key: "global",
        value: (stats.globalParticipation ?? 0).toLocaleString(),
        labelAr: "المشاركات العالمية",
        labelEn: "International participation",
      },
      {
        key: "intern",
        value: stats.mentorshipAvailable.toLocaleString(),
        labelAr: "الخريجون المتاحون للإرشاد والتوجيه",
        labelEn: "Alumni available for mentoring",
      },
    ];
  }, [stats]);

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
              <p className="text-3xl font-black tabular-nums leading-none text-primary sm:text-[2rem]">{s.value}</p>
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
