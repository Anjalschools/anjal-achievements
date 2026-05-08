"use client";

import Link from "next/link";
import { memo } from "react";
import { ArrowRight } from "lucide-react";
import type { AlumniLocale } from "@/content/alumni-landing";
import { getAlumniSectionTitles } from "@/content/alumni-landing";

type AlumniJoinCtaProps = {
  locale: AlumniLocale;
};

const AlumniJoinCtaInner = ({ locale }: AlumniJoinCtaProps) => {
  const titles = getAlumniSectionTitles(locale);
  const isAr = locale === "ar";

  return (
    <section id="join-alumni" className="scroll-mt-24 bg-gradient-to-br from-slate-100 via-white to-sky-50 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h2 className="text-3xl font-black text-slate-900 sm:text-4xl">{titles.joinTitle}</h2>
        <p className="mt-5 text-sm leading-relaxed text-slate-600 sm:text-base">{titles.joinBody}</p>
        <Link
          href="/alumni/join"
          className="mt-10 inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-primary px-8 text-base font-bold text-white shadow-xl shadow-primary/25 transition hover:bg-primary-dark"
        >
          {titles.joinButton}
          <ArrowRight className={`h-5 w-5 shrink-0 ${isAr ? "rotate-180" : ""}`} aria-hidden />
        </Link>
      </div>
    </section>
  );
};

export const AlumniJoinCta = memo(AlumniJoinCtaInner);
