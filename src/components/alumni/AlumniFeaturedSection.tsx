"use client";

import { memo, useMemo } from "react";
import type { AlumniLocale } from "@/content/alumni-landing";
import { getAlumniFeaturedMock, getAlumniSectionTitles } from "@/content/alumni-landing";
import type { FeaturedAlumniItem } from "@/lib/alumni/alumni-public-types";
import { FeaturedAlumniCard } from "@/components/alumni/FeaturedAlumniCard";

type AlumniFeaturedSectionProps = {
  locale: AlumniLocale;
  featured?: FeaturedAlumniItem[];
};

const ACCENTS = [
  "from-amber-500 to-orange-600",
  "from-sky-500 to-indigo-600",
  "from-emerald-500 to-teal-600",
  "from-violet-500 to-fuchsia-600",
];

const AlumniFeaturedSectionInner = ({ locale, featured }: AlumniFeaturedSectionProps) => {
  const titles = getAlumniSectionTitles(locale);
  const cards = useMemo(() => {
    if (!featured || featured.length === 0) return getAlumniFeaturedMock();
    return featured.map((item, index) => {
      const firstChar = item.fullName.trim().charAt(0) || "A";
      return {
        id: item.id,
        initials: firstChar,
        nameAr: item.fullName,
        nameEn: item.fullName,
        year: item.graduationYear ?? 0,
        universityAr: item.universityName || "—",
        universityEn: item.universityName || "—",
        roleAr: [item.currentPosition, item.currentCompany].filter(Boolean).join(" — ") || "—",
        roleEn: [item.currentPosition, item.currentCompany].filter(Boolean).join(" — ") || "—",
        accent: ACCENTS[index % ACCENTS.length],
      };
    });
  }, [featured]);
  const isAr = locale === "ar";

  return (
    <section id="featured-alumni" className="scroll-mt-24 border-b border-slate-200 bg-white py-12 sm:py-14">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl font-black text-slate-900 sm:text-3xl">{titles.featured}</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {cards.map((a) => (
            <FeaturedAlumniCard
              key={a.id}
              locale={locale}
              item={{
                id: a.id,
                fullName: isAr ? a.nameAr : a.nameEn,
                graduationYear: a.year || null,
                universityName: isAr ? a.universityAr : a.universityEn,
                currentPosition: isAr ? a.roleAr : a.roleEn,
                currentCompany: null,
                bio: null,
                avatar: null,
              }}
              href={`/alumni/${a.id}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export const AlumniFeaturedSection = memo(AlumniFeaturedSectionInner);
