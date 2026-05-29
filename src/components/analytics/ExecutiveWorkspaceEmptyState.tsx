"use client";

import { RefreshCw } from "lucide-react";
import type { ExecutiveFilterSnapshot } from "@/lib/competition-intelligence-persistence";

export type ExecutiveWorkspaceEmptyStateProps = {
  isAr: boolean;
  f: ExecutiveFilterSnapshot;
  loading?: boolean;
  onRefresh?: () => void;
  onClearFilters?: () => void;
};

const ExecutiveWorkspaceEmptyState = ({
  isAr,
  f,
  loading,
  onRefresh,
  onClearFilters,
}: ExecutiveWorkspaceEmptyStateProps) => {
  const yearLabel = f.academicYear?.trim() || (isAr ? "—" : "—");
  const stageLabel =
    f.stage === "all" || !f.stage
      ? isAr
        ? "كل المراحل"
        : "All stages"
      : f.stage;

  return (
    <section
      className="rounded-2xl border border-dashed border-indigo-200 bg-gradient-to-br from-indigo-50/40 to-white p-6 sm:p-8"
      role="status"
      aria-live="polite"
      dir={isAr ? "rtl" : "ltr"}
    >
      <h2 className="text-base font-black text-slate-900">
        {loading
          ? isAr
            ? "جاري تحميل الذكاء التنفيذي…"
            : "Loading executive intelligence…"
          : isAr
            ? "لا توجد بيانات ضمن النطاق الحالي"
            : "No data in the current scope"}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
        {loading
          ? isAr
            ? "يتم تجميع المؤشرات والجداول والرؤى — سيظهر المحتوى خلال لحظات."
            : "Aggregating KPIs, tables, and insights — content will appear shortly."
          : isAr
            ? "الفلاتر الحالية لا تُرجع سجلاتاً كافية. وسّع النطاق أو أزل قيود النتائج والمستويات."
            : "Current filters return insufficient records. Widen scope or relax result/level constraints."}
      </p>
      <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-100 bg-white/80 px-3 py-2">
          <dt className="font-bold text-slate-500">{isAr ? "العام الدراسي" : "Academic year"}</dt>
          <dd className="mt-0.5 font-black text-slate-900">{yearLabel}</dd>
        </div>
        <div className="rounded-lg border border-slate-100 bg-white/80 px-3 py-2">
          <dt className="font-bold text-slate-500">{isAr ? "المرحلة" : "Stage"}</dt>
          <dd className="mt-0.5 font-black text-slate-900">{stageLabel}</dd>
        </div>
        <div className="rounded-lg border border-slate-100 bg-white/80 px-3 py-2">
          <dt className="font-bold text-slate-500">{isAr ? "فلاتر نشطة" : "Active filters"}</dt>
          <dd className="mt-0.5 font-black text-slate-900 tabular-nums">
            {[
              f.categories.length,
              f.levels.length,
              f.resultTokens.length,
              f.gender ? 1 : 0,
            ].reduce((a, b) => a + b, 0)}
          </dd>
        </div>
      </dl>
      <ul className="mt-4 list-inside list-disc space-y-1 text-xs text-slate-600">
        <li>{isAr ? "جرّب عاماً دراسياً أوسع أو «الكل»." : "Try a broader academic year or «All»."}</li>
        <li>{isAr ? "أزل فلاتر النتائج أو الأقسام مؤقتاً." : "Temporarily clear result or section filters."}</li>
        <li>{isAr ? "استخدم تبويب «قرار المسابقات» لنشاط محدد." : "Use «Competition decision» for a single activity."}</li>
      </ul>
      <div className="mt-5 flex flex-wrap gap-2">
        {onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
            {isAr ? "تحديث" : "Refresh"}
          </button>
        ) : null}
        {onClearFilters ? (
          <button
            type="button"
            onClick={onClearFilters}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            {isAr ? "مسح الفلاتر" : "Clear filters"}
          </button>
        ) : null}
      </div>
    </section>
  );
};

export default ExecutiveWorkspaceEmptyState;
