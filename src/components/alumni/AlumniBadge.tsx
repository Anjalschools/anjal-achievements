"use client";

import { BadgeCheck, GraduationCap } from "lucide-react";
import type { AlumniBadgeUser } from "@/lib/alumni/alumni-ecosystem-types";

type AlumniBadgeProps = {
  user: AlumniBadgeUser | null | undefined;
  locale: "ar" | "en";
};

const verificationTierLabel = (tier: NonNullable<AlumniBadgeUser["alumniProfile"]>["verificationTier"], isAr: boolean) => {
  const map: Record<string, { ar: string; en: string }> = {
    basic: { ar: "موثّق أساسي", en: "Basic" },
    academic: { ar: "أكاديمي", en: "Academic" },
    career: { ar: "مهني", en: "Career" },
    institution: { ar: "مؤسسي", en: "Institution" },
    global: { ar: "عالمي", en: "Global" },
  };
  if (!tier) return "";
  const row = map[tier];
  return row ? (isAr ? row.ar : row.en) : tier;
};

export const AlumniBadge = ({ user, locale }: AlumniBadgeProps) => {
  if (user?.accountType !== "alumni") return null;
  const verified = user.alumniProfile?.isVerifiedAlumni === true;
  const isAr = locale === "ar";
  const mentor = user.alumniProfile?.alumniServices?.mentoring === true;
  const ambassador = user.alumniProfile?.isAmbassadorAlumni === true;
  const distinguished = user.alumniProfile?.isDistinguishedAlumni === true;
  const tier = user.alumniProfile?.verificationTier;
  const trust = user.alumniProfile?.trustScore;
  const tierText = verified && tier ? verificationTierLabel(tier, isAr) : "";

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ring-1 ${
          verified
            ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
            : "bg-sky-50 text-sky-700 ring-sky-200"
        }`}
      >
        {verified ? <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> : <GraduationCap className="h-3.5 w-3.5" aria-hidden />}
        {verified
          ? isAr
            ? "خريج موثّق"
            : "Verified alumni"
          : isAr
            ? "خريج الأنجال"
            : "Anjal alumni"}
      </span>
      {tierText ? (
        <span className="rounded-full bg-emerald-100/90 px-2 py-0.5 text-[10px] font-bold text-emerald-900 ring-1 ring-emerald-200/80">
          {tierText}
        </span>
      ) : null}
      {verified && typeof trust === "number" && trust > 0 ? (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-700 ring-1 ring-slate-200">
          {isAr ? "ثقة " : "Trust "}
          {Math.min(100, Math.round(trust))}
        </span>
      ) : null}
      {mentor ? (
        <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-800 ring-1 ring-violet-200">
          {isAr ? "مرشد" : "Mentor"}
        </span>
      ) : null}
      {ambassador ? (
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-900 ring-1 ring-amber-200">
          {isAr ? "سفير" : "Ambassador"}
        </span>
      ) : null}
      {distinguished ? (
        <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-amber-100 ring-1 ring-slate-700">
          {isAr ? "خريج متميّز" : "Distinguished"}
        </span>
      ) : null}
    </span>
  );
};
