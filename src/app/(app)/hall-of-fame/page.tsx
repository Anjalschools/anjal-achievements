"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getLocale } from "@/lib/i18n";
import { getTranslation } from "@/locales";
import { GRADE_OPTIONS } from "@/constants/grades";
import { PUBLIC_IMG } from "@/lib/publicImages";
import HallOfFameHeroBackground from "@/components/hall-of-fame/HallOfFameHeroBackground";
import {
  HallOfFamePageCursorSparkleLayer,
  useHallOfFamePageCursorSparkles,
} from "@/components/hall-of-fame/HallOfFamePageCursorSparkles";
import HallOfFameHeroSparkles from "@/components/hall-of-fame/HallOfFameHeroSparkles";
import HallOfFameStudentCard from "@/components/hall-of-fame/HallOfFameStudentCard";
import type { HallOfFameStudentRow } from "@/lib/hall-of-fame-service";
import type { HallTier } from "@/lib/hall-of-fame-level";
import {
  getStrongestTierLabelAmongRows,
  sumApprovedAchievementsInRows,
} from "@/lib/hall-of-fame-showcase-stats";
import {
  Award,
  CalendarDays,
  Gauge,
  Loader2,
  Medal,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";

const HallOfFamePage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const t = getTranslation(locale).hallOfFamePage;

  const [year, setYear] = useState("all");
  const [gender, setGender] = useState<"all" | "male" | "female">("all");
  const [stage, setStage] = useState<"all" | "primary" | "middle" | "secondary">("all");
  const [grade, setGrade] = useState("all");
  const [minTier, setMinTier] = useState<"all" | HallTier>("all");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [page, setPage] = useState(1);
  const [items, setItems] = useState<HallOfFameStudentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 320);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  const yearOptions = useMemo(() => {
    const y = new Date().getFullYear();
    return ["all", ...Array.from({ length: 10 }, (_, i) => String(y - i))];
  }, []);

  const fetchPage = useCallback(
    async (nextPage: number, append: boolean): Promise<boolean> => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("locale", locale);
        params.set("page", String(nextPage));
        params.set("pageSize", "24");
        if (year !== "all") params.set("year", year);
        if (gender !== "all") params.set("gender", gender);
        if (stage !== "all") params.set("stage", stage);
        if (grade !== "all") params.set("grade", grade);
        if (minTier !== "all") params.set("minTier", minTier);
        if (debouncedSearch) params.set("q", debouncedSearch);

        const res = await fetch(`/api/hall-of-fame?${params.toString()}`, { cache: "no-store" });
        if (!res.ok) {
          if (!append) setItems([]);
          return false;
        }
        const data = (await res.json()) as {
          items: HallOfFameStudentRow[];
          total: number;
        };
        setTotal(data.total);
        if (append) setItems((prev) => [...prev, ...data.items]);
        else setItems(data.items);
        return true;
      } finally {
        setLoading(false);
      }
    },
    [locale, year, gender, stage, grade, minTier, debouncedSearch]
  );

  useEffect(() => {
    setPage(1);
  }, [year, gender, stage, grade, minTier, debouncedSearch]);

  useEffect(() => {
    void fetchPage(1, false);
  }, [fetchPage]);

  const handleLoadMore = () => {
    void (async () => {
      const next = page + 1;
      const ok = await fetchPage(next, true);
      if (ok) setPage(next);
    })();
  };

  const handleReset = () => {
    setYear("all");
    setGender("all");
    setStage("all");
    setGrade("all");
    setMinTier("all");
    setSearchInput("");
    setDebouncedSearch("");
    setPage(1);
  };

  const hasMore = items.length < total;

  const achievementsLoaded = useMemo(() => sumApprovedAchievementsInRows(items), [items]);
  const strongestInView = useMemo(() => getStrongestTierLabelAmongRows(items), [items]);
  const yearStatLabel = year === "all" ? t.statsYearAll : year;

  const heroLogoAlt = isAr ? "شعار مدارس الأنجال الأهلية" : "Al-Anjal Private Schools logo";

  const { onPagePointerMove, onPagePointerDown, moveSparks, burstSparks } =
    useHallOfFamePageCursorSparkles();

  const selectClass =
    "h-8 w-full min-w-0 rounded-md border border-gray-200/90 bg-white px-2 text-xs text-text shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";
  const filterLabelClass =
    "flex min-w-0 flex-col gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-light";

  return (
    <div
      className="relative w-full pb-16 pt-2"
      onMouseMove={onPagePointerMove}
      onPointerDown={onPagePointerDown}
    >
      <HallOfFamePageCursorSparkleLayer moveSparks={moveSparks} burstSparks={burstSparks} />
      <div className="relative z-10">
      {/* Hero — text | [trophy, medal, award → logo]; page-wide pointer sparkles */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 shadow-2xl ring-1 ring-white/5">
        <HallOfFameHeroBackground />
        <HallOfFameHeroSparkles />

        <div className="relative z-30 px-6 py-12 sm:px-10 sm:py-14 lg:px-16 lg:py-16">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl space-y-5">
              <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-amber-200/95 drop-shadow-[0_1px_12px_rgba(251,191,36,0.25)]">
                <Sparkles className="h-4 w-4 shrink-0 text-amber-300" aria-hidden />
                {t.heroKicker}
              </p>
              <h1 className="text-balance text-4xl font-black tracking-tight text-white [text-shadow:0_2px_28px_rgba(0,0,0,0.45)] sm:text-5xl lg:text-6xl lg:leading-[1.08]">
                {t.title}
              </h1>
              <p className="max-w-2xl text-base leading-relaxed text-amber-200/95 [text-shadow:0_1px_18px_rgba(0,0,0,0.35)] sm:text-lg">
                {t.subtitle}
              </p>
            </div>

            <div className="flex w-full flex-col items-stretch gap-8 sm:flex-row sm:items-center sm:justify-center lg:w-auto lg:max-w-2xl lg:flex-row lg:items-center lg:justify-end lg:gap-10 xl:max-w-none">
              <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 lg:justify-end">
                <div className="flex shrink-0 flex-wrap items-center justify-center gap-4 sm:gap-5">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 shadow-inner ring-1 ring-white/20 backdrop-blur-sm">
                    <Trophy className="h-9 w-9 text-amber-300" aria-hidden />
                  </div>
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 shadow-inner ring-1 ring-white/20 backdrop-blur-sm">
                    <Medal className="h-9 w-9 text-amber-200/95" aria-hidden />
                  </div>
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 shadow-inner ring-1 ring-white/20 backdrop-blur-sm">
                    <Award className="h-9 w-9 text-amber-100" aria-hidden />
                  </div>
                </div>
                <Image
                  src={PUBLIC_IMG.logoWhite}
                  alt={heroLogoAlt}
                  width={400}
                  height={140}
                  priority
                  sizes="(max-width: 640px) 75vw, 280px"
                  className="h-28 w-auto max-h-[140px] object-contain object-center sm:h-32 sm:max-h-[160px] md:h-36 md:max-h-[180px] lg:h-40 lg:max-h-[200px] [filter:drop-shadow(0_6px_32px_rgba(0,0,0,0.45))]"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick stats — one row on lg+ (4 columns), compact height */}
      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex min-h-0 min-w-0 items-center gap-2.5 rounded-xl border border-amber-200/60 bg-gradient-to-br from-amber-50/90 to-white px-3 py-2.5 shadow-sm">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
            <Users className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-wide text-text-light">{t.statsStudents}</p>
            <p className="text-xl font-black tabular-nums leading-none text-text">{loading && items.length === 0 ? "—" : total}</p>
          </div>
        </div>
        <div className="flex min-h-0 min-w-0 items-center gap-2.5 rounded-xl border border-primary/15 bg-white px-3 py-2.5 shadow-sm">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Star className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-wide text-text-light">{t.statsAchievements}</p>
            <p className="text-xl font-black tabular-nums leading-none text-text">{loading && items.length === 0 ? "—" : achievementsLoaded}</p>
          </div>
        </div>
        <div className="flex min-h-0 min-w-0 items-center gap-2.5 rounded-xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50/80 to-white px-3 py-2.5 shadow-sm">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
            <TrendingUp className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-wide text-text-light">{t.statsTopLevel}</p>
            <p className="truncate text-sm font-extrabold leading-tight text-text">{strongestInView ?? "—"}</p>
          </div>
        </div>
        <div className="flex min-h-0 min-w-0 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <CalendarDays className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-wide text-text-light">{t.statsYear}</p>
            <p className="truncate text-sm font-extrabold leading-tight text-text">{yearStatLabel}</p>
          </div>
        </div>
      </div>

      {/* Filters — one compact toolbar row on lg+; 2 columns on sm–md; stacked on xs */}
      <div className="mt-6 rounded-2xl border border-gray-200/80 bg-white/95 p-3 shadow-sm ring-1 ring-gray-100 backdrop-blur-sm sm:p-3.5">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
          <span className="text-xs font-bold text-text sm:text-sm">{t.filters}</span>
          <span className="hidden text-[11px] text-text-light sm:inline">— {t.sectionSubtitle}</span>
        </div>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 sm:gap-2 lg:grid-cols-[repeat(14,minmax(0,1fr))] lg:items-end lg:gap-x-1.5 lg:gap-y-0">
          <label className={`${filterLabelClass} lg:col-span-2`}>
            {t.year}
            <select value={year} onChange={(e) => setYear(e.target.value)} className={selectClass}>
              <option value="all">{t.allYears}</option>
              {yearOptions
                .filter((y) => y !== "all")
                .map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
            </select>
          </label>
          <label className={`${filterLabelClass} lg:col-span-2`}>
            {t.gender}
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as "all" | "male" | "female")}
              className={selectClass}
            >
              <option value="all">{t.allGenders}</option>
              <option value="male">{t.male}</option>
              <option value="female">{t.female}</option>
            </select>
          </label>
          <label className={`${filterLabelClass} lg:col-span-2`}>
            {t.stage}
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value as "all" | "primary" | "middle" | "secondary")}
              className={selectClass}
            >
              <option value="all">{t.allStages}</option>
              <option value="primary">{t.primary}</option>
              <option value="middle">{t.middle}</option>
              <option value="secondary">{t.secondary}</option>
            </select>
          </label>
          <label className={`${filterLabelClass} lg:col-span-2`}>
            {t.grade}
            <select value={grade} onChange={(e) => setGrade(e.target.value)} className={selectClass}>
              <option value="all">{t.allGrades}</option>
              {GRADE_OPTIONS.map((g) => (
                <option key={g.value} value={g.value}>
                  {isAr ? g.ar : g.en}
                </option>
              ))}
            </select>
          </label>
          <label className={`${filterLabelClass} lg:col-span-2`}>
            {t.minLevel}
            <select
              value={minTier}
              onChange={(e) => setMinTier(e.target.value as "all" | HallTier)}
              className={selectClass}
            >
              <option value="all">{t.allLevels}</option>
              <option value="international">{t.international}</option>
              <option value="national">{t.national}</option>
              <option value="regional">{t.regional}</option>
              <option value="school">{t.school}</option>
              <option value="participation">{t.participation}</option>
            </select>
          </label>
          <label className={`${filterLabelClass} min-w-0 lg:col-span-3`}>
            <span className="inline-flex items-center gap-1">
              <Search className="h-3 w-3 opacity-70" aria-hidden />
              {t.search}
            </span>
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t.searchPlaceholder}
              className={`${selectClass} min-w-0`}
              autoComplete="off"
            />
          </label>
          <div className={`${filterLabelClass} sm:col-span-2 lg:col-span-1`}>
            <span className="text-[9px] leading-none text-transparent select-none" aria-hidden>
              &nbsp;
            </span>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex h-8 w-full shrink-0 items-center justify-center gap-1 rounded-md border border-gray-200/90 bg-gray-50/90 px-2 text-[11px] font-semibold text-text-light transition hover:border-primary/30 hover:bg-white hover:text-primary"
            >
              <Gauge className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
              <span className="truncate">{t.reset}</span>
            </button>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-text-light sm:text-xs">
          {t.showing} <span className="font-bold text-text">{items.length}</span> {t.of}{" "}
          <span className="font-bold text-text">{total}</span> {t.students}
        </p>
      </div>

      {/* Grid */}
      <div className="relative mt-10 min-h-[200px]">
        <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-black tracking-tight text-text">{t.sectionTitle}</h2>
            <p className="mt-0.5 text-xs text-text-light">{t.sectionSubtitle}</p>
          </div>
        </div>

        {loading && items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-gray-200 bg-white/60 py-24 text-text-light">
            <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
            <span className="text-sm font-medium">{t.loading}</span>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-300 bg-gradient-to-br from-gray-50 to-white py-20 text-center">
            <Trophy className="mx-auto mb-3 h-12 w-12 text-gray-300" aria-hidden />
            <p className="text-text-light">{t.empty}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 items-stretch gap-2.5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {items.map((row, i) => (
              <HallOfFameStudentCard key={row.studentId} row={row} isAr={isAr} rankIndex={i} />
            ))}
          </div>
        )}

        {loading && items.length > 0 ? (
          <div className="pointer-events-none absolute inset-0 flex items-start justify-center rounded-3xl bg-white/50 pt-16 backdrop-blur-[1px]">
            <Loader2 className="h-9 w-9 animate-spin text-primary" aria-hidden />
          </div>
        ) : null}
      </div>

      {hasMore && !loading ? (
        <div className="mt-12 flex justify-center">
          <button
            type="button"
            onClick={handleLoadMore}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-primary/90 px-8 py-3.5 text-sm font-bold text-white shadow-lg transition hover:brightness-105"
          >
            <Medal className="h-4 w-4 opacity-90" aria-hidden />
            {t.loadMore}
          </button>
        </div>
      ) : null}

      <div className="mt-14 text-center text-sm text-text-light">
        <Link href="/" className="font-semibold text-primary underline-offset-4 hover:text-primary/80 hover:underline">
          {isAr ? "الصفحة الرئيسية" : "Home"}
        </Link>
      </div>
      </div>
    </div>
  );
};

export default HallOfFamePage;
