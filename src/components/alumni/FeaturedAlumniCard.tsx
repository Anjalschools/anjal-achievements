"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { FeaturedAlumniItem } from "@/lib/alumni/alumni-public-types";
import { AlumniBadge } from "@/components/alumni/AlumniBadge";

type FeaturedAlumniCardProps = {
  item: FeaturedAlumniItem;
  locale: "ar" | "en";
  href?: string;
};

export const FeaturedAlumniCard = ({ item, locale, href }: FeaturedAlumniCardProps) => {
  const isAr = locale === "ar";
  const card = (
    <article className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-primary/30 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-lg font-black text-slate-900">{item.fullName}</h3>
        <AlumniBadge locale={locale} user={{ accountType: "alumni", alumniProfile: { isVerifiedAlumni: true } }} />
      </div>
      <p className="mt-1 text-sm text-slate-500">
        {[item.currentPosition, item.currentCompany].filter(Boolean).join(" — ") || "—"}
      </p>
      <p className="mt-2 text-sm text-slate-600">{item.universityName || "—"}</p>
      {item.bio ? <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate-600">{item.bio}</p> : null}
      {href ? (
        <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-primary">
          {isAr ? "الملف التعريفي" : "Profile"}
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </span>
      ) : null}
    </article>
  );
  if (!href) return card;
  return <Link href={href}>{card}</Link>;
};
