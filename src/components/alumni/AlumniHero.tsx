"use client";

import Link from "next/link";
import Image from "next/image";
import { memo } from "react";
import { ArrowRight, GraduationCap, Sparkles } from "lucide-react";
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
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(212,175,55,0.22),transparent_38%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,rgba(147,197,253,0.18),transparent_34%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.05)_0%,rgba(2,6,23,0.38)_100%)]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
        aria-hidden
      />
      <div className="relative mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-sky-100/90 backdrop-blur-sm">
          <GraduationCap className="h-4 w-4" aria-hidden />
          {isAr ? "مجتمع الخريجين" : "Alumni community"}
        </div>

        {/* dir=ltr keeps the logo on the physical left; inner copy respects locale direction */}
        <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:items-center lg:gap-10" dir="ltr">
          <div className="flex shrink-0 justify-center lg:justify-center">
            <div className="relative flex h-36 w-full max-w-[200px] items-center justify-center sm:h-44 sm:max-w-[240px] lg:h-52 lg:max-w-[260px]">
              <div
                className="pointer-events-none absolute inset-[-8%] rounded-full bg-[radial-gradient(circle,rgba(212,175,55,0.2),transparent_62%)] opacity-90 blur-[1px]"
                aria-hidden
              />
              <Image
                src="/logow.png"
                alt={isAr ? "شعار مدارس الأنجال" : "Al-Anjal logo"}
                fill
                sizes="(max-width: 640px) 200px, (max-width: 1024px) 240px, 260px"
                className="object-contain drop-shadow-[0_6px_28px_rgba(0,0,0,0.35)]"
                priority
              />
            </div>
          </div>

          <div className="min-w-0" dir={isAr ? "rtl" : "ltr"}>
            <div className="flex flex-col gap-5 sm:gap-6">
              <h1 className="text-balance text-3xl font-black leading-[1.18] tracking-tight sm:text-5xl sm:leading-[1.08] lg:text-[3.25rem]">
                {copy.title}
              </h1>
              <p className="max-w-3xl text-base font-semibold leading-relaxed text-sky-100/95 sm:text-xl">{copy.subtitle}</p>
              <p className="max-w-3xl text-sm leading-relaxed text-slate-200/95 sm:text-base">{copy.description}</p>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                href="/alumni/join"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-white px-6 text-sm font-bold text-primary shadow-lg shadow-black/20 transition duration-200 hover:-translate-y-0.5 hover:bg-sky-50 hover:shadow-xl"
              >
                {copy.ctaJoin}
                <ArrowRight className={`h-4 w-4 shrink-0 ${isAr ? "rotate-180" : ""}`} aria-hidden />
              </Link>
              <a
                href="#success-stories"
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/25 bg-white/5 px-6 text-sm font-semibold text-white backdrop-blur-sm transition duration-200 hover:-translate-y-0.5 hover:bg-white/10"
              >
                {copy.ctaStories}
              </a>
              <a
                href="#featured-alumni"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/5 px-6 text-sm font-semibold text-white backdrop-blur-sm transition duration-200 hover:-translate-y-0.5 hover:bg-white/10"
              >
                <Sparkles className="h-4 w-4" aria-hidden />
                {copy.ctaProud}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export const AlumniHero = memo(AlumniHeroInner);
