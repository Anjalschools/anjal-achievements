"use client";

import Link from "next/link";
import { memo } from "react";
import type { CommunityInsights } from "@/lib/alumni/community-activation-types";
import { Briefcase, Building2, Flame, GraduationCap } from "lucide-react";

type Props = {
  insights: CommunityInsights | null;
  isAr: boolean;
  majorHint?: string;
};

export const AlumniCommunityInsightsPanel = memo(({ insights, isAr, majorHint }: Props) => {
  const dir = isAr ? "rtl" : "ltr";
  if (!insights) return null;

  const chip = (label: string, count: number, tone: string) => (
    <span
      key={label}
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-bold shadow-sm ${tone}`}
    >
      <span className="max-w-[140px] truncate">{label}</span>
      <span className="tabular-nums opacity-80">{count}</span>
    </span>
  );

  return (
    <section
      className="rounded-[2rem] border border-slate-200/90 bg-gradient-to-br from-white via-slate-50/40 to-sky-50/30 p-6 shadow-[0_18px_48px_-32px_rgba(15,23,42,0.35)] sm:p-8"
      dir={dir}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Flame className="h-5 w-5 text-amber-500" aria-hidden />
        <h2 className="text-lg font-black text-slate-900">{isAr ? "نبض المجتمع المهني" : "Community pulse"}</h2>
      </div>
      <p className="mt-1 text-xs text-slate-600">
        {isAr ? "لمحات خفيفة من بيانات الخريجين — بدون تحليلات معقدة." : "Light snapshots from alumni data — no heavy analytics."}
      </p>

      <div className="mt-6 space-y-5">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
            <Building2 className="h-4 w-4 text-primary" aria-hidden />
            {isAr ? "جامعات الأكثر ظهورًا" : "Top universities"}
          </div>
          <div className="flex flex-wrap gap-2">
            {insights.topUniversities.length === 0 ? (
              <span className="text-xs text-slate-500">{isAr ? "لا بيانات بعد" : "No data yet"}</span>
            ) : (
              insights.topUniversities.map((u) =>
                chip(u.name, u.count, "border-sky-200 bg-sky-50 text-sky-900")
              )
            )}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
            <GraduationCap className="h-4 w-4 text-primary" aria-hidden />
            {isAr ? "تخصصات نشطة" : "Active majors"}
          </div>
          <div className="flex flex-wrap gap-2">
            {insights.topMajors.length === 0 ? (
              <span className="text-xs text-slate-500">{isAr ? "لا بيانات بعد" : "No data yet"}</span>
            ) : (
              insights.topMajors.map((m) =>
                chip(
                  m.name,
                  m.count,
                  majorHint && m.name.toLowerCase() === majorHint.toLowerCase()
                    ? "border-amber-300 bg-amber-50 text-amber-950 ring-1 ring-amber-200"
                    : "border-violet-200 bg-violet-50 text-violet-950"
                )
              )
            )}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
            <Briefcase className="h-4 w-4 text-primary" aria-hidden />
            {isAr ? "مجالات مطلوبة" : "In-demand fields"}
          </div>
          <div className="flex flex-wrap gap-2">
            {insights.topIndustries.length === 0 ? (
              <span className="text-xs text-slate-500">{isAr ? "لا بيانات بعد" : "No data yet"}</span>
            ) : (
              insights.topIndustries.map((x) => chip(x.name, x.count, "border-emerald-200 bg-emerald-50 text-emerald-900"))
            )}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-black uppercase tracking-wide text-slate-500">
              {isAr ? "فرص مرتبطة بالمجتمع" : "Community opportunities"}
            </span>
            <Link href="/alumni/opportunities" className="text-xs font-black text-primary underline">
              {isAr ? "عرض الكل" : "View all"}
            </Link>
          </div>
          <ul className="space-y-2">
            {insights.opportunities.length === 0 ? (
              <li className="text-xs text-slate-500">{isAr ? "لا فرص منشورة حاليًا" : "No published opportunities yet"}</li>
            ) : (
              insights.opportunities.map((o) => (
                <li key={o.id}>
                  <Link href="/alumni/opportunities" className="text-sm font-bold text-slate-800 hover:text-primary">
                    {o.title}
                  </Link>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{o.type}</p>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </section>
  );
});
AlumniCommunityInsightsPanel.displayName = "AlumniCommunityInsightsPanel";
