"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Award,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Crown,
  Loader2,
  Medal,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Star,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { getLocale } from "@/lib/i18n";
import { getGradeLabel, getSectionLabel } from "@/lib/achievement-display-labels";
import { GRADE_OPTIONS } from "@/constants/grades";
import HallOfFameHeroBackground from "@/components/hall-of-fame/HallOfFameHeroBackground";
import HallOfFameHeroSparkles from "@/components/hall-of-fame/HallOfFameHeroSparkles";
import {
  HallOfFameHeroParticleLayer,
  useHallOfFameHeroParticles,
} from "@/components/hall-of-fame/HallOfFameHeroInteractiveParticles";
import PlatformLogo from "@/components/branding/PlatformLogo";

export type LeaderboardRow = {
  userId: string;
  rank: number;
  totalPoints: number;
  achievementsCount: number;
  fullName: string;
  fullNameAr: string;
  fullNameEn: string;
  profilePhoto: string | null;
  grade: string;
  gender: "male" | "female";
  section: "arabic" | "international";
};

const photoSrc = (url: string | null) => {
  const u = (url || "").trim();
  if (!u) return null;
  if (u.startsWith("http://") || u.startsWith("https://") || u.startsWith("data:")) return u;
  if (u.startsWith("/")) return u;
  return `/${u}`;
};

type StageFilter = "all" | "primary" | "middle" | "secondary";

const STAGE_GRADE_VALUES: Record<Exclude<StageFilter, "all">, string[]> = {
  primary: ["g1", "g2", "g3", "g4", "g5", "g6"],
  middle: ["g7", "g8", "g9"],
  secondary: ["g10", "g11", "g12"],
};

const gradeOptionsForStage = (stage: StageFilter) => {
  if (stage === "all") return GRADE_OPTIONS;
  const allow = new Set(STAGE_GRADE_VALUES[stage]);
  return GRADE_OPTIONS.filter((g) => allow.has(g.value));
};

const HallOfFamePointsLeaderboard = () => {
  const [heroRoot, setHeroRoot] = useState<HTMLDivElement | null>(null);
  const { moveSparks, burstSparks } = useHallOfFameHeroParticles(heroRoot);
  const locale = getLocale();
  const isAr = locale === "ar";
  const [gender, setGender] = useState<"all" | "male" | "female">("all");
  const [stage, setStage] = useState<StageFilter>("all");
  const [grade, setGrade] = useState("all");
  const [section, setSection] = useState<"all" | "arabic" | "international">("all");
  const [year, setYear] = useState("all");
  const [searchQ, setSearchQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(24);
  const [items, setItems] = useState<LeaderboardRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setLoading(true);
      try {
        const sp = new URLSearchParams();
        if (gender !== "all") sp.set("gender", gender);
        if (grade !== "all") sp.set("grade", grade);
        else if (stage !== "all") sp.set("stage", stage);
        if (section !== "all") sp.set("section", section);
        if (year !== "all") sp.set("academicYear", year);
        if (appliedQ.trim()) sp.set("q", appliedQ.trim());
        sp.set("page", String(page));
        sp.set("limit", String(limit));
        const res = await fetch(`/api/leaderboard?${sp.toString()}`, {
          cache: "no-store",
          credentials: "include",
        });
        const data = await res.json();
        if (!mounted) return;
        if (!data?.ok) {
          setItems([]);
          setTotal(0);
          setTotalPages(1);
          return;
        }
        setItems((data.items || []) as LeaderboardRow[]);
        setTotal(Number(data.pagination?.total || 0));
        setTotalPages(Number(data.pagination?.totalPages || 1));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void run();
    return () => {
      mounted = false;
    };
  }, [gender, grade, stage, section, year, page, limit, appliedQ]);

  useEffect(() => {
    setPage(1);
  }, [gender, grade, stage, section, year, appliedQ]);

  useEffect(() => {
    const allowed = new Set(gradeOptionsForStage(stage).map((g) => g.value));
    if (grade !== "all" && !allowed.has(grade)) setGrade("all");
  }, [stage, grade]);

  /** Global ranks 1–3 only appear on page 1; other pages list all rows in one grid. */
  const isFirstPage = page === 1;
  const topThree = useMemo(
    () => (isFirstPage ? items.filter((x) => x.rank <= 3).slice(0, 3) : []),
    [items, isFirstPage]
  );
  const rest = useMemo(
    () => (isFirstPage ? items.filter((x) => x.rank > 3) : items),
    [items, isFirstPage]
  );

  const getName = (row: LeaderboardRow) => {
    if (isAr) return row.fullNameAr || row.fullName || row.fullNameEn || "—";
    return row.fullNameEn || row.fullName || row.fullNameAr || "—";
  };

  const yearOptions = useMemo(() => {
    const y = new Date().getFullYear();
    return ["all", ...Array.from({ length: 10 }, (_, i) => String(y - i))];
  }, []);

  const pagePointsSum = useMemo(() => items.reduce((s, r) => s + r.totalPoints, 0), [items]);
  const pageAchSum = useMemo(() => items.reduce((s, r) => s + r.achievementsCount, 0), [items]);

  const sectionLabel =
    section === "international"
      ? isAr
        ? "دولي"
        : "International"
      : section === "arabic"
        ? isAr
          ? "عربي"
          : "Arabic"
        : isAr
          ? "كل المستويات"
          : "All levels";

  const gradeSelectOptions = useMemo(() => gradeOptionsForStage(stage), [stage]);

  const handleResetFilters = () => {
    setGender("all");
    setStage("all");
    setGrade("all");
    setSection("all");
    setYear("all");
    setSearchQ("");
    setAppliedQ("");
    setPage(1);
  };

  const rankBadge = (rank: number) => {
    if (rank === 1)
      return "bg-gradient-to-r from-amber-500 to-amber-700 text-white border border-amber-300/40";
    if (rank === 2) return "bg-gradient-to-r from-slate-500 to-slate-700 text-white border border-slate-300/40";
    if (rank === 3) return "bg-gradient-to-r from-amber-700 to-amber-900 text-white border border-amber-600/30";
    return "bg-primary/12 text-primary border border-primary/20";
  };

  const StudentCard = ({
    row,
    featured,
  }: {
    row: LeaderboardRow;
    featured?: boolean;
  }) => {
    const src = photoSrc(row.profilePhoto);
    const href = `/students/${row.userId}`;
    const unopt =
      src?.startsWith("http://") || src?.startsWith("https://") || src?.startsWith("data:") || false;

    return (
      <article
        className={`group relative flex h-full flex-col overflow-hidden border bg-white shadow-[0_6px_24px_-10px_rgba(15,23,42,0.16)] transition duration-300 ease-out will-change-transform hover:-translate-y-1 hover:scale-[1.02] hover:shadow-[0_18px_44px_-16px_rgba(30,58,138,0.32)] ${
          featured ? "rounded-xl" : "rounded-2xl"
        } ${
          featured
            ? row.rank === 1
              ? "border-amber-400/60 ring-1 ring-amber-400/20"
              : row.rank === 2
                ? "border-slate-300/80 ring-1 ring-slate-300/15"
                : "border-orange-300/70 ring-1 ring-orange-300/15"
            : "border-slate-200/90"
        }`}
      >
        <div
          className={`absolute start-2 top-2 z-10 flex items-center gap-0.5 rounded-full px-2 py-0.5 font-black shadow-md ${
            featured ? "text-[9px]" : "gap-1 px-2.5 py-1 text-[10px]"
          } ${rankBadge(row.rank)}`}
        >
          {row.rank === 1 ? (
            <Crown className={featured ? "h-2.5 w-2.5" : "h-3 w-3"} aria-hidden />
          ) : (
            <Award className={featured ? "h-2.5 w-2.5" : "h-3 w-3"} aria-hidden />
          )}
          {row.rank === 1
            ? isAr
              ? "الأول"
              : "1st"
            : row.rank === 2
              ? isAr
                ? "الثاني"
                : "2nd"
              : row.rank === 3
                ? isAr
                  ? "الثالث"
                  : "3rd"
                : `#${row.rank}`}
        </div>

        <Link href={href} className="flex flex-1 flex-col">
          <div
            className={`relative w-full overflow-hidden bg-gradient-to-br from-slate-100 via-white to-slate-200 ${
              featured ? "aspect-[3/4] max-h-[200px] sm:max-h-[220px]" : "aspect-[4/5]"
            }`}
          >
            {src ? (
              <Image
                src={src}
                alt=""
                fill
                className="object-cover object-[center_22%] transition duration-500 group-hover:scale-[1.04]"
                sizes={featured ? "(max-width:768px) 100vw, 28vw" : "(max-width:768px) 50vw, 20vw"}
                unoptimized={unopt}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/[0.12] to-indigo-50">
                <span className={`font-black text-primary ${featured ? "text-2xl" : "text-3xl"}`}>
                  {getName(row).charAt(0)}
                </span>
              </div>
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
            <div className="absolute bottom-1.5 start-1.5 end-1.5 flex items-end justify-between gap-1.5">
              <span
                className={`rounded-full bg-white/95 font-bold text-primary shadow ${
                  featured ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]"
                }`}
              >
                {row.totalPoints.toLocaleString(isAr ? "ar-SA" : "en-US")}{" "}
                {isAr ? "نقطة" : "pts"}
              </span>
              <Trophy className={`text-amber-200 drop-shadow ${featured ? "h-3.5 w-3.5" : "h-4 w-4"}`} aria-hidden />
            </div>
          </div>

          <div className={`flex flex-1 flex-col ${featured ? "gap-0.5 p-2" : "gap-1 p-3"}`}>
            <h3
              className={`line-clamp-2 font-extrabold leading-snug text-slate-900 ${
                featured ? "text-xs" : "text-sm"
              }`}
            >
              {getName(row)}
            </h3>
            <p className={`font-semibold text-slate-600 ${featured ? "text-[10px]" : "text-[11px]"}`}>
              {getGradeLabel(row.grade, isAr ? "ar" : "en")} · {getSectionLabel(row.section, isAr ? "ar" : "en")}
            </p>
            <div
              className={`mt-auto flex items-center justify-between border-t border-slate-100 font-semibold text-slate-700 ${
                featured ? "pt-1.5 text-[9px]" : "pt-2 text-[10px]"
              }`}
            >
              <span className="inline-flex items-center gap-0.5">
                <Star className={`shrink-0 text-primary ${featured ? "h-3 w-3" : "h-3.5 w-3.5"}`} aria-hidden />
                {isAr ? "إنجازات معتمدة" : "Approved"}:{" "}
                <span className="font-black tabular-nums text-slate-900">{row.achievementsCount}</span>
              </span>
              <span className="text-primary">{isAr ? "التفاصيل" : "Details"}</span>
            </div>
          </div>
        </Link>
      </article>
    );
  };

  const rank1 = topThree.find((r) => r.rank === 1);
  const rank2 = topThree.find((r) => r.rank === 2);
  const rank3 = topThree.find((r) => r.rank === 3);

  const heroBadgeIcons = [
    { Icon: Award, label: isAr ? "تميز" : "Excellence" },
    { Icon: Medal, label: isAr ? "إنجاز" : "Achievement" },
    { Icon: Trophy, label: isAr ? "تفوق" : "Victory" },
  ] as const;

  return (
    <div className="bg-[#f5f7fb]">
      {/* Hero — بطاقة مستديرة، شعار + أيقونات ذهبية، نص «تميز الأنجال»؛ الجسيمات داخل الحاوية فقط */}
      <section className="relative pt-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
          <div
            ref={setHeroRoot}
            className="relative min-h-[240px] overflow-hidden rounded-2xl shadow-[0_24px_56px_-28px_rgba(0,0,0,0.45)] ring-1 ring-white/15 sm:min-h-[270px] lg:min-h-[300px]"
          >
            <HallOfFameHeroBackground />
            <HallOfFameHeroSparkles />
            <HallOfFameHeroParticleLayer moveSparks={moveSparks} burstSparks={burstSparks} />
            <div className="relative z-[4] px-5 py-9 sm:px-8 sm:py-10 lg:px-11 lg:py-11">
              <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
                <div className="max-w-xl text-white lg:max-w-2xl">
                  <p className="mb-2 inline-flex items-center gap-2 text-sm font-bold text-amber-200/95 drop-shadow-sm">
                    <Star className="h-4 w-4 fill-amber-400/85 text-amber-100" strokeWidth={1.25} aria-hidden />
                    {isAr ? "تميز الأنجال" : "Al-Anjal Excellence"}
                  </p>
                  <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-[2.65rem] lg:leading-[1.15]">
                    {isAr ? "لوحة التميز" : "Hall of Fame"}
                  </h1>
                  <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/90 sm:text-base">
                    {isAr
                      ? "عرض أبرز إنجازات الطلاب والطالبات بمدارس الأنجال الأهلية"
                      : "Highlighting our students’ most distinguished achievements at Al-Anjal Private Schools."}
                  </p>
                </div>
                <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-center lg:flex-row lg:items-center lg:gap-6">
                  <PlatformLogo variant="white" size={164} priority className="drop-shadow-md" />
                  <div className="flex items-center justify-center gap-2.5 sm:gap-3" aria-hidden>
                    {heroBadgeIcons.map(({ Icon, label }) => (
                      <div
                        key={label}
                        title={label}
                        className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-amber-300 via-amber-500 to-amber-900 text-white shadow-lg shadow-amber-900/25 ring-1 ring-amber-200/70 sm:h-12 sm:w-12"
                      >
                        <Icon className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.75} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* إحصائيات — خارج الهيدر، تباعد واضح */}
      <section className="relative z-[5] mt-8 px-4 sm:mt-10 sm:px-6 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-3 rounded-xl border border-amber-200/90 bg-gradient-to-br from-amber-50 via-white to-amber-50/40 p-3 shadow-sm sm:p-4">
            <Users className="h-8 w-8 shrink-0 text-amber-600 sm:h-9 sm:w-9" aria-hidden />
            <div>
              <p className="text-xs font-semibold text-amber-900/85">{isAr ? "طلاب متميزون" : "Ranked students"}</p>
              <p className="text-2xl font-black tabular-nums text-amber-950">{total.toLocaleString(isAr ? "ar-SA" : "en-US")}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-violet-200/90 bg-gradient-to-br from-violet-50 via-white to-violet-50/30 p-3 shadow-sm sm:p-4">
            <Star className="h-8 w-8 shrink-0 text-violet-600 sm:h-9 sm:w-9" aria-hidden />
            <div>
              <p className="text-xs font-semibold text-violet-900/85">
                {isAr ? "إنجازات معتمدة (معروضة)" : "Approved achievements (shown)"}
              </p>
              <p className="text-2xl font-black tabular-nums text-violet-950">
                {pageAchSum.toLocaleString(isAr ? "ar-SA" : "en-US")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200/90 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30 p-3 shadow-sm sm:p-4">
            <TrendingUp className="h-8 w-8 shrink-0 text-emerald-600 sm:h-9 sm:w-9" aria-hidden />
            <div>
              <p className="text-xs font-semibold text-emerald-900/85">{isAr ? "أقوى مستوى في العرض" : "Strongest level shown"}</p>
              <p className="text-lg font-bold text-emerald-950">{sectionLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <CalendarDays className="h-8 w-8 shrink-0 text-slate-500 sm:h-9 sm:w-9" aria-hidden />
            <div>
              <p className="text-xs font-semibold text-slate-600">{isAr ? "العام الدراسي" : "Academic year"}</p>
              <p className="text-lg font-bold text-slate-900">
                {year === "all" ? (isAr ? "جميع الأعوام" : "All years") : year}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Filters — ترتيب الصف كما في التصميم: عام، نوع، مرحلة، صف، مستوى، بحث، إعادة تعيين */}
      <section className="mx-auto mt-10 max-w-7xl px-4 sm:px-6 lg:px-10">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex flex-wrap items-start gap-3 border-b border-slate-100 pb-4">
            <SlidersHorizontal className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold text-slate-900">
                {isAr ? (
                  <>
                    تصفية النتائج <span className="font-semibold text-slate-400">—</span> نتائج مختارة حسب الفلاتر الحالية
                  </>
                ) : (
                  <>
                    Filter results <span className="font-semibold text-slate-400">—</span> matching the current filters
                  </>
                )}
              </h2>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(5,minmax(0,1fr))_minmax(0,1.55fr)_auto] lg:items-end">
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              {isAr ? "العام الدراسي" : "Academic year"}
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y === "all" ? (isAr ? "كل الأعوام" : "All years") : y}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              {isAr ? "النوع" : "Type"}
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as "all" | "male" | "female")}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              >
                <option value="all">{isAr ? "الكل" : "All"}</option>
                <option value="male">{isAr ? "بنين" : "Male"}</option>
                <option value="female">{isAr ? "بنات" : "Female"}</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              {isAr ? "المرحلة" : "Stage"}
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as StageFilter)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              >
                <option value="all">{isAr ? "كل المراحل" : "All stages"}</option>
                <option value="primary">{isAr ? "ابتدائي" : "Primary"}</option>
                <option value="middle">{isAr ? "متوسط" : "Middle"}</option>
                <option value="secondary">{isAr ? "ثانوي" : "Secondary"}</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              {isAr ? "الصف" : "Grade"}
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              >
                <option value="all">{isAr ? "كل الصفوف" : "All grades"}</option>
                {gradeSelectOptions.map((g) => (
                  <option key={g.value} value={g.value}>
                    {isAr ? g.ar : g.en}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              {isAr ? "أقل مستوى للعرض" : "Track / level"}
              <select
                value={section}
                onChange={(e) => setSection(e.target.value as "all" | "arabic" | "international")}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              >
                <option value="all">{isAr ? "كل المستويات" : "All levels"}</option>
                <option value="arabic">{isAr ? "عربي" : "Arabic"}</option>
                <option value="international">{isAr ? "دولي" : "International"}</option>
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-slate-600 sm:col-span-2 lg:col-span-1">
              {isAr ? "بحث" : "Search"}
              <span className="relative flex min-w-0 gap-2">
                <span className="relative min-w-0 flex-1">
                  <Search
                    className="pointer-events-none absolute end-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden
                  />
                  <input
                    value={searchQ}
                    onChange={(e) => setSearchQ(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (setAppliedQ(searchQ.trim()), setPage(1))}
                    placeholder={isAr ? "اكتب اسم الطالب…" : "Type student name…"}
                    className="w-full rounded-xl border border-slate-200 py-2 ps-3 pe-9 text-sm outline-none ring-primary/20 focus:ring-2"
                    dir="auto"
                  />
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setAppliedQ(searchQ.trim());
                    setPage(1);
                  }}
                  className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
                >
                  {isAr ? "بحث" : "Go"}
                </button>
              </span>
            </label>
            <div className="flex items-end justify-stretch sm:col-span-2 lg:col-span-1 lg:justify-start">
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 lg:w-auto lg:whitespace-nowrap"
              >
                <RotateCcw className="h-4 w-4 shrink-0" aria-hidden />
                {isAr ? "إعادة تعيين الفلاتر" : "Reset filters"}
              </button>
            </div>
          </div>
          {!loading && total > 0 ? (
            <p className="mt-4 text-end text-xs font-medium text-slate-600 sm:text-sm">
              {isAr
                ? `عرض ${items.length.toLocaleString("ar-SA")} من ${total.toLocaleString("ar-SA")} طلاب`
                : `Showing ${items.length} of ${total} students`}
            </p>
          ) : null}
          <p className="mt-2 text-[11px] text-slate-500">
            {isAr ? "مجموع نقاط هذه الصفحة:" : "Total points on this page:"}{" "}
            <span className="font-bold tabular-nums text-slate-700">
              {pagePointsSum.toLocaleString(isAr ? "ar-SA" : "en-US")}
            </span>
          </p>
        </div>
      </section>

      {/* Top 3 — mobile: rank order; desktop: #2 | #1 | #3 podium */}
      <section className="mx-auto mt-10 max-w-7xl px-4 sm:px-6 lg:px-10">
        <h2 className="mb-5 text-lg font-bold text-slate-900">
          {isFirstPage
            ? isAr
              ? "الطلاب المتميزون"
              : "Outstanding students"
            : isAr
              ? "الترتيب"
              : "Rankings"}
        </h2>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-600">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
            {isAr ? "جاري التحميل…" : "Loading…"}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center text-slate-500">
            {isAr ? "لا يوجد طلاب ضمن الفلتر الحالي." : "No students match the current filters."}
          </div>
        ) : isFirstPage && topThree.length > 0 ? (
          <>
            <div className="flex flex-col gap-3 lg:hidden">
              {rank1 ? <StudentCard key={rank1.userId} row={rank1} featured /> : null}
              {rank2 ? <StudentCard key={rank2.userId} row={rank2} featured /> : null}
              {rank3 ? <StudentCard key={rank3.userId} row={rank3} featured /> : null}
            </div>
            <div className="hidden items-end justify-center gap-3 xl:gap-5 lg:flex">
              {rank2 ? (
                <div className="w-full max-w-[200px] shrink-0 pb-3 xl:max-w-[210px]">
                  <StudentCard row={rank2} featured />
                </div>
              ) : null}
              {rank1 ? (
                <div className="z-[1] w-full max-w-[218px] shrink-0 xl:max-w-[228px]">
                  <div className="origin-bottom scale-[1.04] transition-transform duration-300 ease-out">
                    <StudentCard row={rank1} featured />
                  </div>
                </div>
              ) : null}
              {rank3 ? (
                <div className="w-full max-w-[200px] shrink-0 pb-3 xl:max-w-[210px]">
                  <StudentCard row={rank3} featured />
                </div>
              ) : null}
            </div>
          </>
        ) : !isFirstPage ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {rest.map((row) => (
              <StudentCard key={row.userId} row={row} />
            ))}
          </div>
        ) : null}
      </section>

      {/* Rest grid (page 1 only) */}
      {!loading && isFirstPage && rest.length > 0 ? (
        <section className="mx-auto mt-10 max-w-7xl px-4 pb-6 sm:px-6 lg:px-10">
          <h3 className="mb-4 text-sm font-bold text-slate-800">{isAr ? "بقية الترتيب" : "More ranked students"}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {rest.map((row) => (
              <StudentCard key={row.userId} row={row} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Pagination */}
      {!loading && total > 0 ? (
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-3 px-4 pb-12 pt-4">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4 rtl:hidden" aria-hidden />
            <ChevronLeft className="hidden h-4 w-4 rtl:inline" aria-hidden />
            {isAr ? "السابق" : "Previous"}
          </button>
          <span className="text-sm font-medium text-slate-600">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => (p < totalPages ? p + 1 : p))}
            disabled={page >= totalPages}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm disabled:opacity-40"
          >
            {isAr ? "التالي" : "Next"}
            <ChevronLeft className="h-4 w-4 rtl:hidden" aria-hidden />
            <ChevronRight className="hidden h-4 w-4 rtl:inline" aria-hidden />
          </button>
        </div>
      ) : null}

      <div className="border-t border-slate-200/80 bg-white py-6 text-center">
        <Link href="/" className="text-sm font-semibold text-primary hover:underline">
          {isAr ? "الصفحة الرئيسية" : "Home"}
        </Link>
      </div>
    </div>
  );
};

export default HallOfFamePointsLeaderboard;
