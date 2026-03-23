"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import AchievementStatusBadge from "@/components/achievements/AchievementStatusBadge";
import type { WorkflowDisplayStatus } from "@/lib/achievementWorkflow";
import { workflowStatusSortRank } from "@/lib/admin-achievement-list-sort";
import { buildAchievementWorkflowRowClassName } from "@/lib/admin-achievement-row-tone";
import {
  achievementApiRowToAiAlertInput,
  buildAiAlertRowViewModel,
  compareAiAlertRowsClient,
  sortAiAlertViewModels,
  toneToBadgeClass,
  type AdminAiAlertTableSortKey,
  type UiTone,
} from "@/lib/admin-ai-alert-review-view-model";

type AdminAchievementAiAlertTableProps = {
  rows: Record<string, unknown>[];
  locale: "ar" | "en";
  renderActions: (rowId: string) => ReactNode;
  getDetailHref: (rowId: string) => string;
  sortKey: AdminAiAlertTableSortKey;
  sortAsc: boolean;
  onSortKeyChange: (key: AdminAiAlertTableSortKey) => void;
  onSortAscToggle: () => void;
};

const colHead = (ar: string, en: string, locale: "ar" | "en") => (
  <span className="whitespace-nowrap">{locale === "ar" ? ar : en}</span>
);

const CellBadge = ({ label, tone }: { label: string; tone: UiTone }) => (
  <span
    className={`inline-flex max-w-[140px] items-center rounded-full px-2 py-0.5 text-[10px] font-bold leading-tight ${toneToBadgeClass(tone)}`}
  >
    <span className="line-clamp-2">{label}</span>
  </span>
);

const AdminAchievementAiAlertTable = ({
  rows,
  locale,
  renderActions,
  getDetailHref,
  sortKey,
  sortAsc,
  onSortKeyChange,
  onSortAscToggle,
}: AdminAchievementAiAlertTableProps) => {
  const isAr = locale === "ar";

  const prepared = useMemo(() => {
    const list = rows.map((raw) => {
      const input = achievementApiRowToAiAlertInput(raw);
      const vm = buildAiAlertRowViewModel(input, locale);
      const approvalStatus = (raw.approvalStatus as WorkflowDisplayStatus) || "pending";
      return { raw, vm, approvalStatus };
    });
    return [...list].sort((a, b) => {
      if (sortKey === "review") {
        const c = workflowStatusSortRank(a.approvalStatus) - workflowStatusSortRank(b.approvalStatus);
        if (c !== 0) return sortAsc ? c : -c;
        return sortAiAlertViewModels(a.vm, b.vm);
      }
      return compareAiAlertRowsClient(a.vm, b.vm, sortKey, sortAsc);
    });
  }, [rows, locale, sortKey, sortAsc]);

  const sortDirDisabled = sortKey === "severity" || sortKey === "overall";

  return (
    <div className="w-full space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-slate-50/80 px-3 py-2 text-xs">
        <label htmlFor="ai-alert-sort-key" className="font-semibold text-text">
          {isAr ? "ترتيب حسب" : "Sort by"}
        </label>
        <select
          id="ai-alert-sort-key"
          value={sortKey}
          onChange={(e) => onSortKeyChange(e.target.value as AdminAiAlertTableSortKey)}
          className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 font-medium text-text"
        >
          <option value="severity">{isAr ? "الأشد خطورة (افتراضي)" : "Severity (default)"}</option>
          <option value="overall">{isAr ? "الحالة العامة (مرفقات)" : "Overall (attachment)"}</option>
          <option value="student">{isAr ? "اسم الطالب" : "Student name"}</option>
          <option value="title">{isAr ? "اسم الإنجاز" : "Achievement title"}</option>
          <option value="level">{isAr ? "مستوى الإنجاز" : "Achievement level"}</option>
          <option value="review">{isAr ? "المراجعة" : "Review"}</option>
        </select>
        <button
          type="button"
          disabled={sortDirDisabled}
          onClick={onSortAscToggle}
          className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 font-semibold text-text disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sortDirDisabled
            ? isAr
              ? "اتجاه ثابت"
              : "Fixed order"
            : sortAsc
              ? isAr
                ? "تصاعدي"
                : "Ascending"
              : isAr
                ? "تنازلي"
                : "Descending"}
        </button>
      </div>

      <div className="w-full overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-[1280px] w-full text-sm">
          <thead className="border-b border-gray-200 bg-slate-50/95">
            <tr>
              <th className="sticky start-0 z-[1] bg-slate-50/95 px-2 py-2 text-start font-semibold text-text">
                {colHead("الطالب", "Student", locale)}
              </th>
              <th className="px-2 py-2 text-start font-semibold text-text">
                {colHead("الإنجاز", "Achievement", locale)}
              </th>
              <th className="px-2 py-2 text-start font-semibold text-text">
                {colHead("مستوى الإنجاز", "Achievement level", locale)}
              </th>
              <th className="px-2 py-2 text-start font-semibold text-text">
                {colHead("فحص التكرار", "Duplicate check", locale)}
              </th>
              <th className="px-2 py-2 text-start font-semibold text-text">
                {colHead("مطابقة الاسم", "Name check", locale)}
              </th>
              <th className="px-2 py-2 text-start font-semibold text-text">
                {colHead("السنة", "Year", locale)}
              </th>
              <th className="px-2 py-2 text-start font-semibold text-text">
                {colHead("المستوى (المرفق)", "Level (attachment)", locale)}
              </th>
              <th className="px-2 py-2 text-start font-semibold text-text">
                {colHead("الإنجاز (المرفق)", "Achievement (attachment)", locale)}
              </th>
              <th className="px-2 py-2 text-start font-semibold text-text">
                {colHead("الحالة العامة", "Overall", locale)}
              </th>
              <th className="px-2 py-2 text-start font-semibold text-text">
                {colHead("تفاصيل", "Details", locale)}
              </th>
              <th
                className="px-2 py-2 text-start font-semibold text-text"
                title={
                  isAr
                    ? "حالة الإنجاز والقرار النهائي الذي يظهر للطالب وفق اختيار الأدمن (اعتماد، تعديل، رفض، …)"
                    : "Achievement workflow status — the admin reviewer’s final decision (approve, revision, reject, …)"
                }
              >
                {colHead("المراجعة", "Review", locale)}
              </th>
              <th className="px-2 py-2 text-start font-semibold text-text">
                {colHead("إجراءات", "Actions", locale)}
              </th>
            </tr>
          </thead>
          <tbody>
            {prepared.map(({ raw, vm, approvalStatus }) => {
              const rowTone = buildAchievementWorkflowRowClassName(approvalStatus);
              return (
                <tr key={vm.id} className={`border-b border-gray-100 last:border-0 ${rowTone}`}>
                  <td
                    className={`sticky start-0 z-[1] max-w-[140px] px-2 py-2 align-top text-xs font-medium text-text ${rowTone}`}
                  >
                    <span className="line-clamp-3">{vm.studentName}</span>
                  </td>
                  <td className={`max-w-[200px] px-2 py-2 align-top text-xs font-semibold text-text ${rowTone}`}>
                    <span className="line-clamp-3">{vm.achievementTitle}</span>
                  </td>
                  <td className={`max-w-[100px] px-2 py-2 align-top text-xs text-text-light ${rowTone}`}>
                    <span className="line-clamp-2">{vm.levelLabel}</span>
                  </td>
                  <td className={`px-2 py-2 align-top ${rowTone}`}>
                    <CellBadge label={vm.duplicateStatusLabel} tone={vm.duplicateStatusTone} />
                  </td>
                  <td className={`px-2 py-2 align-top ${rowTone}`}>
                    <CellBadge label={vm.nameCheckLabel} tone={vm.nameCheckTone} />
                  </td>
                  <td className={`px-2 py-2 align-top ${rowTone}`}>
                    <CellBadge label={vm.yearCheckLabel} tone={vm.yearCheckTone} />
                  </td>
                  <td className={`px-2 py-2 align-top ${rowTone}`}>
                    <CellBadge label={vm.levelCheckLabel} tone={vm.levelCheckTone} />
                  </td>
                  <td className={`px-2 py-2 align-top ${rowTone}`}>
                    <CellBadge label={vm.achievementCheckLabel} tone={vm.achievementCheckTone} />
                  </td>
                  <td className={`px-2 py-2 align-top ${rowTone}`}>
                    <CellBadge label={vm.overallStatusLabel} tone={vm.overallStatusTone} />
                  </td>
                  <td className={`px-2 py-2 align-top ${rowTone}`}>
                    <Link
                      href={getDetailHref(vm.id)}
                      className="inline-block rounded-lg border border-primary/50 bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/10"
                    >
                      {isAr ? "تفاصيل" : "Details"}
                    </Link>
                  </td>
                  <td className={`max-w-[130px] px-2 py-2 align-top ${rowTone}`}>
                    <AchievementStatusBadge status={approvalStatus} locale={locale} className="text-[10px]" />
                  </td>
                  <td className={`px-2 py-2 align-top ${rowTone}`}>{renderActions(vm.id)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminAchievementAiAlertTable;
