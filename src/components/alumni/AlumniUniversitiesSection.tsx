"use client";

import { memo, useMemo } from "react";
import type { AlumniLocale } from "@/content/alumni-landing";
import { getAlumniUniversitiesMock, getAlumniSectionTitles } from "@/content/alumni-landing";
import type { AlumniUniversityCountItem } from "@/lib/alumni/alumni-public-types";

type AlumniUniversitiesSectionProps = {
  locale: AlumniLocale;
  universities?: AlumniUniversityCountItem[];
};

const AlumniUniversitiesSectionInner = ({ locale, universities }: AlumniUniversitiesSectionProps) => {
  const titles = getAlumniSectionTitles(locale);
  const list = useMemo(() => {
    if (!universities || universities.length === 0) return getAlumniUniversitiesMock();
    return universities.map((u, index) => ({
      id: `${u.name}-${index}`,
      nameAr: u.name,
      nameEn: u.name,
      abbr: String(u.count),
    }));
  }, [universities]);
  const isAr = locale === "ar";

  return (
    <section className="border-b border-slate-200 bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl font-black text-slate-900 sm:text-3xl">{titles.universities}</h2>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((u) => (
            <li
              key={u.id}
              className="flex flex-col rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6 shadow-sm ring-1 ring-slate-100 transition hover:border-primary/20"
            >
              <span className="text-xs font-black uppercase tracking-widest text-primary">{u.abbr}</span>
              <span className="mt-2 text-sm font-bold leading-snug text-slate-900">
                {isAr ? u.nameAr : u.nameEn}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export const AlumniUniversitiesSection = memo(AlumniUniversitiesSectionInner);
