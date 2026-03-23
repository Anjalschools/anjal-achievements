"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Award, ChevronLeft, ChevronRight, Crown, Sparkles, Trophy, User } from "lucide-react";
import type { HallOfFameStudentRow } from "@/lib/hall-of-fame-service";
import {
  hallTierBadgeClass,
  hallTierPhotoBorderClass,
  hallTierTopAccentBarClass,
} from "@/lib/hall-of-fame-level";

type Props = {
  row: HallOfFameStudentRow;
  isAr: boolean;
  /** 0-based index in current list; first three get subtle spotlight */
  rankIndex: number;
};

/** Shorter portrait — better density at xl:6 columns */
const PORTRAIT_ASPECT = "aspect-[5/6]";

/** Decorative stars — physical right edge; pointer-events none */
const CornerStars = () => (
  <>
    <div
      className="pointer-events-none absolute right-1 top-11 z-[5] flex flex-col items-center gap-1 opacity-[0.52]"
      aria-hidden
    >
      <svg className="h-3 w-3 text-amber-300 drop-shadow-[0_0_5px_rgba(251,191,36,0.6)]" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 1.5l2.8 7.2 7.7.6-5.9 4.9 1.9 7.5L12 18.2 6.5 21.7l1.9-7.5-5.9-4.9 7.7-.6L12 1.5z" />
      </svg>
      <svg className="h-2 w-2 text-white/95 drop-shadow-[0_0_3px_rgba(255,255,255,0.45)]" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 1.5l2.8 7.2 7.7.6-5.9 4.9 1.9 7.5L12 18.2 6.5 21.7l1.9-7.5-5.9-4.9 7.7-.6L12 1.5z" />
      </svg>
    </div>
    <div
      className="pointer-events-none absolute bottom-[4.5rem] right-1 z-[5] flex flex-col items-center gap-0.5 opacity-[0.42]"
      aria-hidden
    >
      <svg
        className="h-2 w-2 animate-pulse text-amber-200/95"
        style={{ animationDuration: "2.8s" }}
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M12 1.5l2.8 7.2 7.7.6-5.9 4.9 1.9 7.5L12 18.2 6.5 21.7l1.9-7.5-5.9-4.9 7.7-.6L12 1.5z" />
      </svg>
    </div>
  </>
);

const HallOfFameStudentCard = ({ row, isAr, rankIndex }: Props) => {
  const href = `/students/${row.studentId}`;
  const badge = hallTierBadgeClass(row.highestTier);
  const topBar = hallTierTopAccentBarClass(row.highestTier);
  const photoBorder = hallTierPhotoBorderClass(row.highestTier);

  const [avatarFailed, setAvatarFailed] = useState(false);
  const trimmed = row.studentPhoto?.trim() ?? "";
  const showAvatar =
    Boolean(trimmed) &&
    !avatarFailed &&
    (trimmed.startsWith("/") ||
      trimmed.startsWith("data:") ||
      trimmed.startsWith("http://") ||
      trimmed.startsWith("https://"));
  const unopt =
    trimmed.startsWith("data:") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://");

  const Chevron = isAr ? ChevronLeft : ChevronRight;
  const isTopThree = rankIndex < 3;
  const topLabel =
    rankIndex === 0 ? (isAr ? "الأول" : "1st") : rankIndex === 1 ? (isAr ? "الثاني" : "2nd") : isAr ? "الثالث" : "3rd";

  return (
    <div className="group relative h-full min-h-0">
      <div
        className="relative h-full rounded-[11px] bg-gradient-to-br from-blue-600 via-blue-500 to-amber-400 p-[1.5px] shadow-[0_4px_18px_-8px_rgba(37,99,235,0.38),0_0_0_1px_rgba(251,191,36,0.18)] transition duration-300 [transition-property:transform,box-shadow] group-hover:-translate-y-0.5 group-hover:shadow-[0_10px_26px_-10px_rgba(37,99,235,0.48),0_0_0_1px_rgba(251,191,36,0.32)] active:translate-y-0 active:scale-[0.995] active:shadow-md"
      >
        <CornerStars />
        <Link
          href={href}
          aria-label={`${isAr ? "عرض إنجازات" : "View achievements of"} ${row.studentName}`}
          className={`relative flex h-full min-h-0 flex-col overflow-hidden rounded-[9px] border-0 bg-white shadow-inner ring-0 transition duration-300 group-hover:brightness-[1.01] active:brightness-[0.99] ${
            isTopThree ? "ring-2 ring-amber-400/30 ring-offset-0" : ""
          }`}
        >
          <div className={`relative h-0.5 w-full shrink-0 ${topBar}`} aria-hidden />

          <div
            className={`relative box-border w-full ${PORTRAIT_ASPECT} shrink-0 overflow-hidden border-solid ${photoBorder} ${
              row.highestTier === "international"
                ? "bg-gradient-to-br from-amber-950/20 via-slate-900/5 to-amber-100/40"
                : "bg-gradient-to-br from-slate-100 via-white to-slate-200/90"
            }`}
          >
            {isTopThree ? (
              <div
                className={`pointer-events-none absolute end-1 top-1 z-20 flex items-center gap-0.5 rounded-full border border-white/25 px-1.5 py-px text-[9px] font-black uppercase tracking-wider text-white shadow-lg backdrop-blur-[2px] ${
                  rankIndex === 0
                    ? "bg-gradient-to-r from-amber-500 to-amber-700"
                    : rankIndex === 1
                      ? "bg-gradient-to-r from-slate-600 to-slate-800"
                      : "bg-gradient-to-r from-amber-700 to-amber-900"
                }`}
              >
                {rankIndex === 0 ? <Crown className="h-2.5 w-2.5 shrink-0" aria-hidden /> : <Award className="h-2.5 w-2.5 shrink-0" aria-hidden />}
                {topLabel}
              </div>
            ) : null}

            {showAvatar ? (
              <Image
                src={trimmed}
                alt={row.studentName}
                fill
                sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, (max-width: 1279px) 34vw, 17vw"
                unoptimized={unopt}
                className="object-cover object-[center_22%] transition duration-500 group-hover:scale-[1.03]"
                onError={() => setAvatarFailed(true)}
              />
            ) : (
              <div className="relative flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/[0.12] via-indigo-50/80 to-primary/5">
                <div className="absolute inset-0 opacity-[0.35] bg-[radial-gradient(circle_at_30%_20%,rgba(251,191,36,0.35),transparent_45%),radial-gradient(circle_at_70%_80%,rgba(59,130,246,0.2),transparent_40%)]" />
                <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-white to-primary/10 shadow-inner ring-2 ring-white/80 ring-offset-2 ring-offset-primary/5">
                  <span className="text-xl font-black tracking-tight text-primary" aria-hidden>
                    {row.studentName.slice(0, 1).toUpperCase()}
                  </span>
                  <User
                    className="pointer-events-none absolute -bottom-0.5 -end-0.5 h-5 w-5 rounded-full bg-primary/90 p-0.5 text-white shadow-md"
                    aria-hidden
                  />
                </div>
              </div>
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />
            <div className="absolute bottom-1.5 start-1.5 end-9 flex flex-wrap items-end justify-between gap-1">
              <span
                className={`inline-flex max-w-[min(100%,200px)] items-center gap-0.5 rounded-full border border-white/20 px-1.5 py-px text-[9px] font-bold shadow-md backdrop-blur-md ${badge}`}
              >
                <Sparkles className="h-2.5 w-2.5 shrink-0 opacity-95" aria-hidden />
                <span className="truncate">{row.highestTierLabel}</span>
              </span>
              <Trophy className="h-3.5 w-3.5 shrink-0 text-amber-200 drop-shadow-md" aria-hidden />
            </div>
          </div>

          <div className="flex min-h-[76px] flex-1 flex-col gap-0.5 px-2 pb-2 pt-1.5">
            <h2 className="line-clamp-2 text-sm font-extrabold leading-snug tracking-tight text-text">{row.studentName}</h2>
            <p className="text-[11px] font-semibold leading-tight text-text">{row.gradeLabel}</p>
            <div className="mt-auto flex items-center justify-between gap-1 border-t border-gray-100/90 pt-1.5 text-[10px] font-semibold">
              <span className="inline-flex min-w-0 items-center gap-0.5 text-text/90">
                <Award className="h-3 w-3 shrink-0 text-primary" aria-hidden />
                <span className="truncate">
                  {isAr ? "إنجازات معتمدة" : "Approved"}:{" "}
                  <span className="font-black text-text tabular-nums">{row.totalAchievements}</span>
                </span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-primary/12 px-1.5 py-px text-[9px] font-bold text-primary">
                {isAr ? "التفاصيل" : "Details"}
                <Chevron className="h-2.5 w-2.5 transition group-hover:translate-x-0.5 rtl:rotate-180" aria-hidden />
              </span>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
};

export default HallOfFameStudentCard;
