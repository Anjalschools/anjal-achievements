"use client";

import { useMemo, type Ref } from "react";
import type { ParticipationActivityRow } from "@/lib/achievement-participation-analytics";
import {
  useAnalyticsFilters,
  type AnalyticsTableSortKey,
  type AnalyticsTableViewMode,
} from "@/contexts/AnalyticsFilterContext";
import VirtualizedTableBody from "@/components/analytics/VirtualizedTableBody";
import { useAnalyticsPerspective } from "@/lib/analytics/analytics-perspective-context";
import { t, type AnalyticsLocale } from "@/lib/analytics/analytics-semantic-registry";

export type TableViewMode = AnalyticsTableViewMode;

export type ParticipationAnalyticsTableProps = {
  isAr: boolean;
  rows: ParticipationActivityRow[];
  page: number;
  totalPages: number;
  loading: boolean;
  onPageChange: (next: number) => void;
};

const ParticipationAnalyticsTable = ({
  isAr,
  rows,
  page,
  totalPages,
  loading,
  onPageChange,
}: ParticipationAnalyticsTableProps) => {
  const {
    tableMode: view,
    setTableMode: setView,
    tableSortKey: sortKey,
    setTableSortKey: setSortKey,
    tableSortAsc: sortAsc,
    setTableSortAsc: setSortAsc,
  } = useAnalyticsFilters();

  const {
    perspective: countPerspective,
    metricForRow,
    totalColumnLabel: totalHeader,
    totalColumnTooltip: totalTip,
    loc,
  } = useAnalyticsPerspective();

  const sorted = useMemo(() => {
    const copy = [...rows];
    const dir = sortAsc ? 1 : -1;
    copy.sort((a, b) => {
      switch (sortKey) {
        case "activity":
          return (
            dir *
            (isAr ? a.activityLabelAr : a.activityLabelEn).localeCompare(
              isAr ? b.activityLabelAr : b.activityLabelEn
            )
          );
        case "participants":
          return dir * (a.distinctParticipants - b.distinctParticipants);
        case "gold":
          return dir * (a.goldMedalCount - b.goldMedalCount);
        case "silver":
          return dir * (a.silverMedalCount - b.silverMedalCount);
        case "bronze":
          return dir * (a.bronzeMedalCount - b.bronzeMedalCount);
        case "excellence":
          return dir * (a.excellenceRatePct - b.excellenceRatePct);
        default:
          return (
            dir *
            (metricForRow(a) - metricForRow(b))
          );
      }
    });
    return copy;
  }, [rows, sortKey, sortAsc, isAr, countPerspective, metricForRow]);

  const handleSort = (key: AnalyticsTableSortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const sortBtn = (key: AnalyticsTableSortKey, label: string, title?: string) => (
    <button
      type="button"
      onClick={() => handleSort(key)}
      className="inline-flex items-center gap-1 font-bold hover:text-slate-900"
      aria-label={label}
      title={title}
    >
      {label}
      {sortKey === key ? <span className="text-[10px]">{sortAsc ? "↑" : "↓"}</span> : null}
    </button>
  );

  const viewTabs: Array<{ id: TableViewMode; ar: string; en: string }> = [
    { id: "summary", ar: "ملخص", en: "Summary" },
    { id: "activity", ar: "النشاط", en: "Activity" },
    { id: "detailed", ar: "تفصيلي", en: "Detailed" },
    { id: "student", ar: "الطلاب", en: "Students" },
  ];

  const colSpan = view === "summary" ? 8 : view === "activity" ? 7 : 14;
  const emptyMsg = isAr ? "لا توجد بيانات ضمن الفلاتر الحالية." : "No data for the current filters.";

  const renderTotalCell = (r: ParticipationActivityRow) => (
    <td className="px-2 py-2 tabular-nums font-semibold" title={totalTip}>
      {metricForRow(r)}
    </td>
  );

  const renderSummaryRow = (r: ParticipationActivityRow, opts?: { measureRef?: (el: Element | null) => void }) => (
    <tr
      ref={opts?.measureRef as Ref<HTMLTableRowElement> | undefined}
      className="border-b border-slate-100 hover:bg-slate-50/80"
    >
      <td className="max-w-[200px] px-2 py-2 font-semibold text-slate-900">
        {isAr ? r.activityLabelAr : r.activityLabelEn}
      </td>
      <td className="px-2 py-2 tabular-nums" title={t("tooltip.column.student", loc)}>
        {r.distinctParticipants}
      </td>
      <td className="px-2 py-2 tabular-nums text-amber-800">{r.goldMedalCount}</td>
      <td className="hidden px-2 py-2 tabular-nums text-slate-600 md:table-cell">{r.silverMedalCount}</td>
      <td className="hidden px-2 py-2 tabular-nums text-amber-950/80 md:table-cell">{r.bronzeMedalCount}</td>
      <td className="hidden px-2 py-2 tabular-nums lg:table-cell">{r.rankCount}</td>
      <td className="hidden px-2 py-2 tabular-nums sm:table-cell">{r.excellenceRatePct}%</td>
      {renderTotalCell(r)}
    </tr>
  );

  const renderActivityRow = (r: ParticipationActivityRow, opts?: { measureRef?: (el: Element | null) => void }) => {
    const medals = r.goldMedalCount + r.silverMedalCount + r.bronzeMedalCount;
    return (
      <tr
        ref={opts?.measureRef as Ref<HTMLTableRowElement> | undefined}
        className="border-b border-slate-100 hover:bg-slate-50/80"
      >
        <td className="max-w-[200px] px-2 py-2 font-semibold">{isAr ? r.activityLabelAr : r.activityLabelEn}</td>
        <td className="px-2 py-2">{isAr ? r.typeLabelAr : r.typeLabelEn}</td>
        <td className="px-2 py-2">{isAr ? r.levelLabelAr : r.levelLabelEn}</td>
        <td className="px-2 py-2 tabular-nums">{r.distinctParticipants}</td>
        <td className="px-2 py-2 tabular-nums">
          {medals} ({r.goldMedalCount}/{r.silverMedalCount}/{r.bronzeMedalCount})
        </td>
        <td className="px-2 py-2 tabular-nums">{r.excellenceRatePct}%</td>
        {renderTotalCell(r)}
      </tr>
    );
  };

  const renderDetailedRow = (r: ParticipationActivityRow, opts?: { measureRef?: (el: Element | null) => void }) => (
    <tr
      ref={opts?.measureRef as Ref<HTMLTableRowElement> | undefined}
      className="border-b border-slate-100 hover:bg-slate-50/80"
    >
      <td className="max-w-[180px] px-2 py-2 font-semibold">{isAr ? r.activityLabelAr : r.activityLabelEn}</td>
      <td className="px-2 py-2">{isAr ? r.typeLabelAr : r.typeLabelEn}</td>
      <td className="max-w-[100px] px-2 py-2">{isAr ? r.classificationLabelAr : r.classificationLabelEn}</td>
      <td className="px-2 py-2">{isAr ? r.levelLabelAr : r.levelLabelEn}</td>
      <td className="max-w-[120px] px-2 py-2">{isAr ? r.participationResultAr : r.participationResultEn}</td>
      <td className="px-2 py-2 tabular-nums">{r.distinctParticipants}</td>
      <td className="px-2 py-2 tabular-nums">{r.arabicParticipants}</td>
      <td className="px-2 py-2 tabular-nums">{r.internationalParticipants}</td>
      <td className="px-2 py-2 tabular-nums text-amber-800">{r.goldMedalCount}</td>
      <td className="px-2 py-2 tabular-nums">{r.silverMedalCount}</td>
      <td className="px-2 py-2 tabular-nums">{r.bronzeMedalCount}</td>
      <td className="px-2 py-2 tabular-nums">{r.rankCount}</td>
      <td className="px-2 py-2 tabular-nums">{r.excellenceRatePct}%</td>
      {renderTotalCell(r)}
    </tr>
  );

  const renderRow =
    view === "summary"
      ? renderSummaryRow
      : view === "activity"
        ? renderActivityRow
        : renderDetailedRow;

  return (
    <div className="space-y-3" dir={isAr ? "rtl" : "ltr"} id="analytics-data-table">
      <p className="text-[10px] font-semibold text-indigo-700 print:hidden">
        {isAr ? `عمود الإجمالي: ${totalHeader}` : `Total column: ${totalHeader}`}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 print:hidden"
          role="tablist"
          aria-label={isAr ? "وضع الجدول" : "Table mode"}
        >
          {viewTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={view === tab.id}
              onClick={() => setView(tab.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                view === tab.id ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:bg-white/80"
              }`}
            >
              {isAr ? tab.ar : tab.en}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500" aria-live="polite">
          {isAr ? `صفحة ${page} من ${totalPages}` : `Page ${page} of ${totalPages}`}
        </p>
      </div>

      {view === "student" ? (
        <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-4 text-sm text-teal-950">
          <p className="font-bold">{isAr ? "عرض الطلاب" : "Student view"}</p>
          <p className="mt-1 text-xs text-teal-900/80">
            {isAr
              ? "للتفصيل على مستوى الطالب استخدم تبويب «تميّز الطلاب» — الجدول هنا يعرض تجميعًا حسب النشاط."
              : "For student-level drill-down use the Student distinction tab — this table aggregates by activity."}
          </p>
          <div className="mt-3 overflow-x-auto" data-virtual-scroll>
            <table className="w-full min-w-[480px] text-left text-xs">
              <thead className="sticky top-0 z-10 bg-teal-50">
                <tr className="border-b border-teal-200 text-teal-900">
                  <th className="px-2 py-2">{isAr ? "النشاط" : "Activity"}</th>
                  <th className="px-2 py-2">
                    {sortBtn("participants", t("column.participatingStudents", loc), t("tooltip.column.student", loc))}
                  </th>
                  <th className="px-2 py-2">{isAr ? "بنين / بنات" : "Boys / Girls"}</th>
                </tr>
              </thead>
              <VirtualizedTableBody
                rows={sorted.slice(0, 200)}
                rowKey={(r) => r.activityKey}
                colSpan={3}
                emptyMessage={emptyMsg}
                threshold={25}
                renderRow={(r, _i, opts) => (
                  <tr
                    ref={opts?.measureRef as Ref<HTMLTableRowElement> | undefined}
                    className="border-b border-teal-100/80"
                  >
                    <td className="max-w-[200px] px-2 py-2 font-semibold">{isAr ? r.activityLabelAr : r.activityLabelEn}</td>
                    <td className="px-2 py-2 tabular-nums">{r.distinctParticipants}</td>
                    <td className="px-2 py-2 tabular-nums">
                      {r.maleParticipants} / {r.femaleParticipants}
                    </td>
                  </tr>
                )}
              />
            </table>
          </div>
        </div>
      ) : (
        <div
          data-virtual-scroll
          className="max-h-[min(520px,70vh)] overflow-auto rounded-xl border border-slate-200 md:max-h-[520px]"
        >
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
              {view === "summary" ? (
                <tr className="border-b border-slate-200 text-slate-700">
                  <th className="whitespace-nowrap px-2 py-2">{sortBtn("activity", isAr ? "النشاط" : "Activity")}</th>
                  <th className="whitespace-nowrap px-2 py-2">
                    {sortBtn("participants", t("column.participatingStudents", loc), t("tooltip.column.student", loc))}
                  </th>
                  <th className="whitespace-nowrap px-2 py-2">{sortBtn("gold", "🥇")}</th>
                  <th className="hidden whitespace-nowrap px-2 py-2 md:table-cell">{sortBtn("silver", "🥈")}</th>
                  <th className="hidden whitespace-nowrap px-2 py-2 md:table-cell">{sortBtn("bronze", "🥉")}</th>
                  <th className="hidden whitespace-nowrap px-2 py-2 lg:table-cell">{isAr ? "مراكز" : "Ranks"}</th>
                  <th className="hidden whitespace-nowrap px-2 py-2 sm:table-cell">{sortBtn("excellence", isAr ? "تميز %" : "Excellence %")}</th>
                  <th className="whitespace-nowrap px-2 py-2">{sortBtn("total", totalHeader, totalTip)}</th>
                </tr>
              ) : view === "activity" ? (
                <tr className="border-b border-slate-200 text-slate-700">
                  <th className="whitespace-nowrap px-2 py-2">{sortBtn("activity", isAr ? "النشاط" : "Activity")}</th>
                  <th className="whitespace-nowrap px-2 py-2">{isAr ? "النوع" : "Type"}</th>
                  <th className="whitespace-nowrap px-2 py-2">{isAr ? "المستوى" : "Level"}</th>
                  <th className="whitespace-nowrap px-2 py-2">
                    {sortBtn("participants", t("column.participatingStudents", loc))}
                  </th>
                  <th className="whitespace-nowrap px-2 py-2">{isAr ? "ميداليات" : "Medals"}</th>
                  <th className="whitespace-nowrap px-2 py-2">{sortBtn("excellence", isAr ? "تميز %" : "Excellence %")}</th>
                  <th className="whitespace-nowrap px-2 py-2">{sortBtn("total", totalHeader, totalTip)}</th>
                </tr>
              ) : (
                <tr className="border-b border-slate-200 text-slate-700">
                  <th className="whitespace-nowrap px-2 py-2">{isAr ? "النشاط" : "Activity"}</th>
                  <th className="whitespace-nowrap px-2 py-2">{isAr ? "النوع" : "Type"}</th>
                  <th className="whitespace-nowrap px-2 py-2">{isAr ? "التصنيف" : "Class."}</th>
                  <th className="whitespace-nowrap px-2 py-2">{isAr ? "المستوى" : "Level"}</th>
                  <th className="whitespace-nowrap px-2 py-2">{isAr ? "النتيجة" : "Result"}</th>
                  <th className="whitespace-nowrap px-2 py-2">{t("column.participatingStudents", loc)}</th>
                  <th className="whitespace-nowrap px-2 py-2">{isAr ? "عربي" : "Ar."}</th>
                  <th className="whitespace-nowrap px-2 py-2">{isAr ? "دولي" : "Intl."}</th>
                  <th className="whitespace-nowrap px-2 py-2">🥇</th>
                  <th className="whitespace-nowrap px-2 py-2">🥈</th>
                  <th className="whitespace-nowrap px-2 py-2">🥉</th>
                  <th className="whitespace-nowrap px-2 py-2">{isAr ? "مراكز" : "Ranks"}</th>
                  <th className="whitespace-nowrap px-2 py-2">{isAr ? "تميز %" : "Exc. %"}</th>
                  <th className="whitespace-nowrap px-2 py-2">{sortBtn("total", totalHeader, totalTip)}</th>
                </tr>
              )}
            </thead>
            <VirtualizedTableBody
              rows={sorted}
              rowKey={(r) => r.activityKey}
              colSpan={colSpan}
              emptyMessage={emptyMsg}
              threshold={40}
              renderRow={(r, _i, opts) => renderRow(r, opts)}
            />
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <button
          type="button"
          disabled={page <= 1 || loading}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold disabled:opacity-40"
          aria-label={isAr ? "الصفحة السابقة" : "Previous page"}
        >
          {isAr ? "السابق" : "Prev"}
        </button>
        <button
          type="button"
          disabled={page >= totalPages || loading}
          onClick={() => onPageChange(page + 1)}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold disabled:opacity-40"
          aria-label={isAr ? "الصفحة التالية" : "Next page"}
        >
          {isAr ? "التالي" : "Next"}
        </button>
      </div>
    </div>
  );
};

export default ParticipationAnalyticsTable;
