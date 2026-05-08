"use client";

import { memo, useMemo } from "react";
import type { AlumniLocale } from "@/content/alumni-landing";
import { getAlumniCooperationItems, getAlumniSectionTitles } from "@/content/alumni-landing";

type AlumniCooperationSectionProps = {
  locale: AlumniLocale;
};

const AlumniCooperationSectionInner = ({ locale }: AlumniCooperationSectionProps) => {
  const titles = getAlumniSectionTitles(locale);
  const items = useMemo(() => getAlumniCooperationItems(locale), [locale]);

  return (
    <section className="border-b border-slate-200 bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl font-black text-slate-900 sm:text-3xl">{titles.cooperation}</h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-sm leading-relaxed text-slate-600 sm:text-base">
          {titles.cooperationIntro}
        </p>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, i) => (
            <li
              key={i}
              className="rounded-2xl border border-slate-200 bg-slate-50/80 p-6 shadow-sm ring-1 ring-slate-100"
            >
              <h3 className="text-lg font-bold text-primary">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export const AlumniCooperationSection = memo(AlumniCooperationSectionInner);
