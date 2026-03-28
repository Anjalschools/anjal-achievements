"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import { getLocale } from "@/lib/i18n";
import { getGenderLabel, getGradeLabel, getSectionLabel } from "@/lib/achievement-display-labels";
import { ListOrdered, Loader2, Users, Sigma, TrendingUp, Award, ChevronRight, ChevronLeft } from "lucide-react";

type LeaderboardRow = {
  userId: string;
  rank: number;
  totalPoints: number;
  achievementsCount: number;
  latestAchievementDate: string | null;
  fullName: string;
  fullNameAr: string;
  fullNameEn: string;
  studentId: string;
  grade: string;
  gender: "male" | "female";
  section: "arabic" | "international";
  profilePhoto: string | null;
};

type Summary = {
  rankedStudentCount: number;
  sumTotalPoints: number;
  avgPoints: number;
  maxTotalPoints: number;
};

const displayName = (row: LeaderboardRow, isAr: boolean) => {
  const ar = row.fullNameAr?.trim();
  const en = row.fullNameEn?.trim();
  const legacy = row.fullName?.trim();
  if (isAr) return ar || legacy || en || "—";
  return en || legacy || ar || "—";
};

const rankBadgeClass = (rank: number) => {
  if (rank === 1) return "bg-amber-100 text-amber-900 ring-1 ring-amber-300";
  if (rank === 2) return "bg-slate-200 text-slate-800 ring-1 ring-slate-300";
  if (rank === 3) return "bg-orange-100 text-orange-900 ring-1 ring-orange-300";
  return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
};

const rowHighlight = (rank: number) => {
  if (rank <= 3) return "bg-primary/[0.04]";
  return "";
};

type FilterFields = {
  q: string;
  gender: string;
  grade: string;
  section: string;
  academicYear: string;
};

const emptyFilterFields: FilterFields = {
  q: "",
  gender: "",
  grade: "",
  section: "",
  academicYear: "",
};

export default function AdminLeaderboardPage() {
  const locale = getLocale();
  const isAr = locale === "ar";
  const loc = isAr ? "ar" : "en";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<LeaderboardRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [draftFilters, setDraftFilters] = useState<FilterFields>({ ...emptyFilterFields });
  const [appliedFilters, setAppliedFilters] = useState<FilterFields>({ ...emptyFilterFields });
  const [limit, setLimit] = useState(25);
  const [sortBy, setSortBy] = useState<"totalPoints" | "achievementsCount" | "latestAchievementDate">(
    "totalPoints"
  );
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      const f = appliedFilters;
      if (f.q.trim()) params.set("q", f.q.trim());
      if (f.gender === "male" || f.gender === "female") params.set("gender", f.gender);
      if (f.grade.trim()) params.set("grade", f.grade.trim());
      if (f.section === "arabic" || f.section === "international") params.set("section", f.section);
      if (f.academicYear.trim()) params.set("academicYear", f.academicYear.trim());
      params.set("page", String(page));
      params.set("limit", String(limit));
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);

      const res = await fetch(`/api/admin/leaderboard?${params.toString()}`, { cache: "no-store" });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        items?: LeaderboardRow[];
        summary?: Summary | null;
        pagination?: { page: number; limit: number; total: number; totalPages: number };
      };
      if (!res.ok || data.ok === false) {
        setError(data.error || (isAr ? "تعذر تحميل الترتيب." : "Failed to load leaderboard."));
        setItems([]);
        setSummary(null);
        return;
      }
      setItems(data.items || []);
      setSummary(data.summary ?? null);
      setTotal(data.pagination?.total ?? 0);
      setTotalPages(data.pagination?.totalPages ?? 1);
    } catch {
      setError(isAr ? "حدث خطأ أثناء التحميل." : "Load error.");
      setItems([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, isAr, limit, page, sortBy, sortOrder]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const stats = useMemo(() => {
    const s = summary;
    return [
      {
        id: "count",
        label: isAr ? "عدد الطلاب المصنفين" : "Ranked students",
        value: s ? String(s.rankedStudentCount) : "—",
        icon: Users,
      },
      {
        id: "sum",
        label: isAr ? "مجموع النقاط (الفلتر)" : "Total points (filtered)",
        value: s ? Math.round(s.sumTotalPoints).toLocaleString(isAr ? "ar-SA" : "en-US") : "—",
        icon: Sigma,
      },
      {
        id: "avg",
        label: isAr ? "متوسط النقاط" : "Average points",
        value: s ? s.avgPoints.toFixed(1) : "—",
        icon: TrendingUp,
      },
      {
        id: "max",
        label: isAr ? "أعلى رصيد نقاط" : "Highest points",
        value: s ? Math.round(s.maxTotalPoints).toLocaleString(isAr ? "ar-SA" : "en-US") : "—",
        icon: Award,
      },
    ];
  }, [isAr, summary]);

  const handleApplyFilters = () => {
    setAppliedFilters({ ...draftFilters });
    setPage(1);
  };

  const photoSrc = (url: string | null) => {
    const u = (url || "").trim();
    if (!u) return null;
    if (u.startsWith("http://") || u.startsWith("https://") || u.startsWith("data:")) return u;
    if (u.startsWith("/")) return u;
    return `/${u}`;
  };

  return (
    <PageContainer>
      <PageHeader
        title={isAr ? "ترتيب الطلاب بالنقاط" : "Student points leaderboard"}
        subtitle={
          isAr
            ? "طلاب نشطون لديهم إنجازات معتمدة — ترتيب حسب مجموع نقاط الإنجازات المعتمدة"
            : "Active students with approved achievements — ranked by sum of stored achievement scores"
        }
        actions={
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ListOrdered className="h-6 w-6" aria-hidden />
          </span>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100"
            >
              <div className="flex items-center gap-2 text-slate-500">
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="text-xs font-medium">{card.label}</span>
              </div>
              <div className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{card.value}</div>
            </div>
          );
        })}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-400"
          title={isAr ? "قريباً" : "Coming soon"}
        >
          {isAr ? "تصدير Excel" : "Export Excel"}
        </button>
        <button
          type="button"
          disabled
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-400"
          title={isAr ? "قريباً" : "Coming soon"}
        >
          {isAr ? "تصدير PDF" : "Export PDF"}
        </button>
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            {isAr ? "بحث (الاسم / رقم الطالب)" : "Search (name / student ID)"}
            <input
              value={draftFilters.q}
              onChange={(e) => setDraftFilters((s) => ({ ...s, q: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && handleApplyFilters()}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              dir="auto"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            {isAr ? "الجنس" : "Gender"}
            <select
              value={draftFilters.gender}
              onChange={(e) => setDraftFilters((s) => ({ ...s, gender: e.target.value }))}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">{isAr ? "الكل" : "All"}</option>
              <option value="male">{isAr ? "ذكر" : "Male"}</option>
              <option value="female">{isAr ? "أنثى" : "Female"}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            {isAr ? "الصف" : "Grade"}
            <input
              value={draftFilters.grade}
              onChange={(e) => setDraftFilters((s) => ({ ...s, grade: e.target.value }))}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              dir="auto"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            {isAr ? "المسار" : "Section"}
            <select
              value={draftFilters.section}
              onChange={(e) => setDraftFilters((s) => ({ ...s, section: e.target.value }))}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">{isAr ? "الكل" : "All"}</option>
              <option value="arabic">{isAr ? "عربي" : "Arabic"}</option>
              <option value="international">{isAr ? "دولي" : "International"}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            {isAr ? "العام الدراسي (إن وُجد)" : "Academic year (if set)"}
            <input
              value={draftFilters.academicYear}
              onChange={(e) => setDraftFilters((s) => ({ ...s, academicYear: e.target.value }))}
              placeholder="2025"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              inputMode="numeric"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            {isAr ? "عدد الصفوف" : "Page size"}
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            {isAr ? "ترتيب حسب" : "Sort by"}
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as typeof sortBy);
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="totalPoints">{isAr ? "مجموع النقاط" : "Total points"}</option>
              <option value="achievementsCount">{isAr ? "عدد الإنجازات" : "Achievements count"}</option>
              <option value="latestAchievementDate">{isAr ? "أحدث إنجاز" : "Latest achievement"}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            {isAr ? "الاتجاه" : "Order"}
            <select
              value={sortOrder}
              onChange={(e) => {
                setSortOrder(e.target.value as "desc" | "asc");
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="desc">{isAr ? "تنازلي" : "Descending"}</option>
              <option value="asc">{isAr ? "تصاعدي" : "Ascending"}</option>
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleApplyFilters}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
          >
            {isAr ? "تطبيق" : "Apply"}
          </button>
          <button
            type="button"
            onClick={() => {
              setDraftFilters({ ...emptyFilterFields });
              setAppliedFilters({ ...emptyFilterFields });
              setSortBy("totalPoints");
              setSortOrder("desc");
              setPage(1);
            }}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {isAr ? "إعادة ضبط" : "Reset"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-600">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
          <span>{isAr ? "جاري التحميل…" : "Loading…"}</span>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm lg:block">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-3 text-start font-semibold text-slate-700">{isAr ? "الترتيب" : "Rank"}</th>
                  <th className="px-3 py-3 text-start font-semibold text-slate-700">{isAr ? "الطالب" : "Student"}</th>
                  <th className="px-3 py-3 text-start font-semibold text-slate-700">
                    {isAr ? "رقم الطالب" : "Student ID"}
                  </th>
                  <th className="px-3 py-3 text-start font-semibold text-slate-700">{isAr ? "الصف" : "Grade"}</th>
                  <th className="px-3 py-3 text-start font-semibold text-slate-700">{isAr ? "الجنس" : "Gender"}</th>
                  <th className="px-3 py-3 text-start font-semibold text-slate-700">{isAr ? "المسار" : "Section"}</th>
                  <th className="px-3 py-3 text-start font-semibold text-slate-700">
                    {isAr ? "إنجازات معتمدة" : "Approved count"}
                  </th>
                  <th className="px-3 py-3 text-start font-semibold text-slate-700">
                    {isAr ? "مجموع النقاط" : "Total points"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-10 text-center text-slate-500">
                      {isAr ? "لا توجد بيانات ضمن الفلتر الحالي." : "No rows for the current filters."}
                    </td>
                  </tr>
                ) : (
                  items.map((row) => {
                    const src = photoSrc(row.profilePhoto);
                    return (
                      <tr key={row.userId} className={rowHighlight(row.rank)}>
                        <td className="px-3 py-3 align-middle">
                          <span
                            className={`inline-flex min-w-[2rem] items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold ${rankBadgeClass(row.rank)}`}
                          >
                            {row.rank}
                          </span>
                        </td>
                        <td className="px-3 py-3 align-middle">
                          <div className="flex items-center gap-3">
                            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200">
                              {src ? (
                                <Image
                                  src={src}
                                  alt=""
                                  fill
                                  className="object-cover"
                                  unoptimized={
                                    src.startsWith("http://") ||
                                    src.startsWith("https://") ||
                                    src.startsWith("data:")
                                  }
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-400">
                                  {displayName(row, isAr).slice(0, 1) || "?"}
                                </div>
                              )}
                            </div>
                            <Link
                              href={`/admin/users/${row.userId}`}
                              className="font-semibold text-primary hover:underline"
                            >
                              {displayName(row, isAr)}
                            </Link>
                          </div>
                        </td>
                        <td className="px-3 py-3 align-middle font-mono text-xs text-slate-800">{row.studentId}</td>
                        <td className="px-3 py-3 align-middle">{getGradeLabel(row.grade, loc)}</td>
                        <td className="px-3 py-3 align-middle">{getGenderLabel(row.gender, loc)}</td>
                        <td className="px-3 py-3 align-middle">{getSectionLabel(row.section, loc)}</td>
                        <td className="px-3 py-3 align-middle tabular-nums font-medium">{row.achievementsCount}</td>
                        <td className="px-3 py-3 align-middle tabular-nums font-bold text-primary">
                          {row.totalPoints.toLocaleString(isAr ? "ar-SA" : "en-US")}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 lg:hidden">
            {items.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-500">
                {isAr ? "لا توجد بيانات ضمن الفلتر الحالي." : "No rows for the current filters."}
              </div>
            ) : (
              items.map((row) => {
                const src = photoSrc(row.profilePhoto);
                return (
                  <div
                    key={row.userId}
                    className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${rowHighlight(row.rank)}`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`inline-flex min-w-[2rem] items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold ${rankBadgeClass(row.rank)}`}
                      >
                        {row.rank}
                      </span>
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200">
                        {src ? (
                          <Image
                            src={src}
                            alt=""
                            fill
                            className="object-cover"
                            unoptimized={
                              src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:")
                            }
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm font-bold text-slate-400">
                            {displayName(row, isAr).slice(0, 1) || "?"}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link href={`/admin/users/${row.userId}`} className="font-bold text-primary hover:underline">
                          {displayName(row, isAr)}
                        </Link>
                        <div className="mt-1 text-xs text-slate-600">
                          {row.studentId} · {getGradeLabel(row.grade, loc)} · {getGenderLabel(row.gender, loc)} ·{" "}
                          {getSectionLabel(row.section, loc)}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-3 text-sm">
                          <span className="font-medium text-slate-700">
                            {isAr ? "الإنجازات:" : "Achievements:"}{" "}
                            <span className="tabular-nums">{row.achievementsCount}</span>
                          </span>
                          <span className="font-bold text-primary">
                            {isAr ? "النقاط:" : "Points:"}{" "}
                            <span className="tabular-nums">
                              {row.totalPoints.toLocaleString(isAr ? "ar-SA" : "en-US")}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {total > 0 ? (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
              <p className="text-sm text-slate-600">
                {isAr ? "الصفحة" : "Page"} {page} / {totalPages} — {total}{" "}
                {isAr ? "طالباً ضمن الفلتر" : "students (filtered)"}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4 rtl:hidden" aria-hidden />
                  <ChevronLeft className="hidden h-4 w-4 rtl:inline" aria-hidden />
                  {isAr ? "السابق" : "Previous"}
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-40"
                >
                  {isAr ? "التالي" : "Next"}
                  <ChevronLeft className="h-4 w-4 rtl:hidden" aria-hidden />
                  <ChevronRight className="hidden h-4 w-4 rtl:inline" aria-hidden />
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </PageContainer>
  );
}
