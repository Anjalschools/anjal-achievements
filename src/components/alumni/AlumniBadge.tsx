"use client";

import { BadgeCheck, GraduationCap } from "lucide-react";
import type { AlumniBadgeUser } from "@/lib/alumni/alumni-ecosystem-types";

type AlumniBadgeProps = {
  user: AlumniBadgeUser | null | undefined;
  locale: "ar" | "en";
};

export const AlumniBadge = ({ user, locale }: AlumniBadgeProps) => {
  if (user?.accountType !== "alumni") return null;
  const verified = user.alumniProfile?.isVerifiedAlumni === true;
  const isAr = locale === "ar";

  return (
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
  );
};
