"use client";

import type { ReactNode } from "react";
import {
  Award,
  Building2,
  GraduationCap,
  ShieldCheck,
  Star,
  Target,
  Trophy,
  Medal,
  Globe,
} from "lucide-react";
import type { HomeHighlightIconKey } from "@/lib/home-highlights";

type Props = {
  iconKey: HomeHighlightIconKey;
  title: string;
  description: string;
  badge?: string;
};

export const getInstitutionalAchievementIcon = (iconKey: HomeHighlightIconKey): ReactNode => {
  const icons: Record<HomeHighlightIconKey, ReactNode> = {
    trophy: <Trophy className="h-5 w-5" aria-hidden />,
    medal: <Medal className="h-5 w-5" aria-hidden />,
    "shield-check": <ShieldCheck className="h-5 w-5" aria-hidden />,
    globe: <Globe className="h-5 w-5" aria-hidden />,
    building: <Building2 className="h-5 w-5" aria-hidden />,
    "graduation-cap": <GraduationCap className="h-5 w-5" aria-hidden />,
    star: <Star className="h-5 w-5" aria-hidden />,
    target: <Target className="h-5 w-5" aria-hidden />,
  };
  return icons[iconKey] ?? <Award className="h-5 w-5" aria-hidden />;
};

export default function InstitutionalAchievementCard({ iconKey, title, description, badge }: Props) {
  return (
    <article className="relative overflow-hidden rounded-2xl border-2 border-[#0f234e]/20 bg-gradient-to-br from-white via-[#f8fafd] to-[#f2f6ff] p-5 shadow-[0_8px_24px_rgba(7,26,61,0.08)] ring-1 ring-[#d4af37]/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(7,26,61,0.14)]">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#0f234e] via-[#1f3f84] to-[#d4af37]" />
      <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#d4af37]/45 bg-[#0f234e]/95 text-[#f7e4a4] shadow-sm">
        {getInstitutionalAchievementIcon(iconKey)}
      </div>
      <h4 className="text-base font-bold leading-snug tracking-tight text-slate-900">{title}</h4>
      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{description}</p>
      {badge ? (
        <div className="mt-3 inline-flex rounded-full border border-[#0f234e]/35 bg-[#fff7dc] px-2.5 py-1 text-xs font-semibold text-[#7a6112]">
          {badge}
        </div>
      ) : null}
    </article>
  );
}
