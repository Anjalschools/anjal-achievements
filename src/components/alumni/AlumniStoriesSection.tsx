"use client";

import Link from "next/link";
import { memo, useMemo } from "react";
import { ArrowRight } from "lucide-react";
import type { AlumniLocale } from "@/content/alumni-landing";
import { getAlumniStoriesMock, getAlumniSectionTitles } from "@/content/alumni-landing";
import type { AlumniStoryListItem } from "@/lib/alumni/alumni-ecosystem-types";

type AlumniStoriesSectionProps = {
  locale: AlumniLocale;
  stories?: AlumniStoryListItem[];
};

const AlumniStoriesSectionInner = ({ locale, stories }: AlumniStoriesSectionProps) => {
  const titles = getAlumniSectionTitles(locale);
  const storyCards = useMemo(() => {
    if (!stories || stories.length === 0) return getAlumniStoriesMock();
    return stories.map((s) => ({
      id: s.id,
      titleAr: s.title,
      titleEn: s.title,
      summaryAr: s.excerpt || "",
      summaryEn: s.excerpt || "",
      orgAr: [s.universityName, s.currentCompany].filter(Boolean).join(" — ") || "Alumni",
      orgEn: [s.universityName, s.currentCompany].filter(Boolean).join(" — ") || "Alumni",
      slug: s.slug,
    }));
  }, [stories]);
  const isAr = locale === "ar";

  return (
    <section id="success-stories" className="scroll-mt-24 border-b border-slate-200 bg-slate-50 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl font-black text-slate-900 sm:text-3xl">{titles.stories}</h2>
        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          {storyCards.map((s) => (
            <article
              key={s.id}
              className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-primary/25 hover:shadow-md sm:p-8"
            >
              <h3 className="text-xl font-bold text-slate-900">{isAr ? s.titleAr : s.titleEn}</h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600">
                {isAr ? s.summaryAr : s.summaryEn}
              </p>
              <p className="mt-4 text-xs font-bold uppercase tracking-wide text-primary">
                {isAr ? s.orgAr : s.orgEn}
              </p>
              <Link
                href={"slug" in s && s.slug ? `/alumni/stories/${s.slug}` : "/alumni/stories"}
                className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-primary transition hover:text-primary-dark"
              >
                {isAr ? "اعرف المزيد" : "Learn more"}
                <ArrowRight className={`h-4 w-4 ${isAr ? "rotate-180" : ""}`} aria-hidden />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export const AlumniStoriesSection = memo(AlumniStoriesSectionInner);
