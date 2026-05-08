"use client";

import Link from "next/link";
import { memo } from "react";
import { ArrowRight, GraduationCap } from "lucide-react";
import type { AlumniLocale } from "@/content/alumni-landing";
import { getAlumniHeroCopy } from "@/content/alumni-landing";

type AlumniHeroProps = {
  locale: AlumniLocale;
};

const AlumniHeroInner = ({ locale }: AlumniHeroProps) => {
  const copy = getAlumniHeroCopy(locale);
  const isAr = locale === "ar";

  return (
    <section className="relative overflow-hidden border-b border-slate-200/80 bg-gradient-to-br from-slate-950 via-primary to-slate-900 text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
        aria-hidden
      />
      <div className="relative mx-auto max-w-5xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-sky-100/90 backdrop-blur-sm">
          <GraduationCap className="h-4 w-4" aria-hidden />
          {isAr ? "مجتمع الخريجين" : "Alumni community"}
        </div>
        <h1 className="text-balance text-3xl font-black leading-tight tracking-tight sm:text-5xl sm:leading-[1.1]">
          <span className="me-2 inline-block align-middle text-4xl sm:text-5xl" aria-hidden>
            🎓
          </span>
          {copy.title}
        </h1>
        <p className="mt-5 max-w-2xl text-lg font-medium text-sky-100/95 sm:text-xl">{copy.subtitle}</p>
        <p className="mt-6 max-w-2xl text-sm leading-relaxed text-slate-200/95 sm:text-base">{copy.description}</p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Link
            href="/alumni/join"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-white px-6 text-sm font-bold text-primary shadow-lg shadow-black/20 transition hover:bg-sky-50"
          >
            {copy.ctaJoin}
            <ArrowRight className={`h-4 w-4 shrink-0 ${isAr ? "rotate-180" : ""}`} aria-hidden />
          </Link>
          <a
            href="#success-stories"
            className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/25 bg-white/5 px-6 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/10"
          >
            {copy.ctaStories}
          </a>
          <a
            href="#featured-alumni"
            className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/25 bg-white/5 px-6 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/10"
          >
            {copy.ctaProud}
          </a>
        </div>
      </div>
    </section>
  );
};

export const AlumniHero = memo(AlumniHeroInner);
