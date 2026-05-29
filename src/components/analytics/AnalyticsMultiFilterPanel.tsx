"use client";

import type { Dispatch, SetStateAction } from "react";
import { useMemo } from "react";
import type { ExecutiveFilterSnapshot } from "@/lib/competition-intelligence-persistence";
import { buildParticipationFilterSearchParams } from "@/lib/analytics/participation-filter-params";
import MultiSelect from "@/components/ui/multi-select";
import CanonicalActivityCombobox from "@/components/reports/CanonicalActivityCombobox";
import ActivityYearCombobox from "@/components/reports/ActivityYearCombobox";

export type AnalyticsMultiFilterPanelProps = {
  isAr: boolean;
  f: ExecutiveFilterSnapshot;
  setF: Dispatch<SetStateAction<ExecutiveFilterSnapshot>>;
  onPageReset?: () => void;
  categoryOptions: Array<{ value: string; label: string }>;
  levelOptions: Array<{ value: string; label: string }>;
  resultOptions: Array<{ value: string; label: string }>;
  genderOptions: Array<{ value: string; label: string }>;
  mawhibaOptions: Array<{ value: string; label: string }>;
  stageOptions: Array<{ value: string; label: string }>;
  gradeOptions: Array<{ value: string; label: string }>;
  statusOptions: Array<{ value: string; label: string }>;
  certificateOptions: Array<{ value: string; label: string }>;
  stdTestOptions: Array<{ value: string; label: string }>;
  sectionOptions: Array<{ value: string; label: string }>;
  subtitle?: string;
};

const AnalyticsMultiFilterPanel = ({
  isAr,
  f,
  setF,
  onPageReset,
  categoryOptions,
  levelOptions,
  resultOptions,
  genderOptions,
  mawhibaOptions,
  stageOptions,
  gradeOptions,
  statusOptions,
  certificateOptions,
  stdTestOptions,
  sectionOptions,
  subtitle,
}: AnalyticsMultiFilterPanelProps) => {
  const patch = (next: Partial<ExecutiveFilterSnapshot>) => {
    onPageReset?.();
    setF((p) => ({ ...p, ...next }));
  };

  const optionFetchBase = useMemo(() => {
    const sp = buildParticipationFilterSearchParams(f);
    const out: Record<string, string> = {};
    sp.forEach((v, k) => {
      out[k] = v;
    });
    return out;
  }, [f]);

  const activityFetchParams = useMemo(() => {
    const base = { ...optionFetchBase };
    delete base.achievementNames;
    return base;
  }, [optionFetchBase]);

  const yearFetchParams = useMemo(() => {
    const base = { ...optionFetchBase };
    delete base.activityYears;
    delete base.filterActivityYear;
    return base;
  }, [optionFetchBase]);

  const clearAll = () => {
    onPageReset?.();
    setF((p) => ({
      ...p,
      activityYears: [],
      achievementNames: [],
      categories: [],
      sections: [],
      genders: [],
      mawhibaValues: [],
      stages: [],
      grades: [],
      levels: [],
      resultTokens: [],
      statuses: [],
      certificateStatuses: [],
      standardizedTestTypes: [],
      fromDate: "",
      toDate: "",
      domain: "",
      classification: "",
      organization: "",
    }));
  };

  return (
    <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:hidden" dir={isAr ? "rtl" : "ltr"}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-black text-slate-900">{isAr ? "فلاتر التحليل" : "Analytics filters"}</h2>
          {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        <button
          type="button"
          onClick={clearAll}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          {isAr ? "مسح الكل" : "Clear all"}
        </button>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col text-xs font-semibold text-slate-600">
          {isAr ? "العام الدراسي" : "Academic year"}
          <select
            value={f.academicYear}
            onChange={(e) => patch({ academicYear: e.target.value })}
            className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="2025-2026م">2025-2026م</option>
            <option value="2024-2025م">2024-2025م</option>
            <option value="2023-2024م">2023-2024م</option>
          </select>
        </label>

        <ActivityYearCombobox
          label={isAr ? "سنة النشاط" : "Activity year"}
          value={f.activityYears}
          onChange={(years) => patch({ activityYears: years })}
          fetchParams={yearFetchParams}
          isAr={isAr}
        />

        <MultiSelect
          label={isAr ? "القسم" : "Section"}
          placeholder={isAr ? "اختر القسم" : "Select section"}
          options={sectionOptions}
          value={f.sections}
          onChange={(next) => patch({ sections: next })}
          isRtl={isAr}
          searchable
          maxVisibleChips={2}
          selectAllLabel={isAr ? "الكل" : "All"}
          clearLabel={isAr ? "مسح" : "Clear"}
        />

        <MultiSelect
          label={isAr ? "النوع" : "Gender"}
          placeholder={isAr ? "اختر النوع" : "Select gender"}
          options={genderOptions}
          value={f.genders}
          onChange={(next) => patch({ genders: next })}
          isRtl={isAr}
          searchable
          maxVisibleChips={2}
          selectAllLabel={isAr ? "الكل" : "All"}
          clearLabel={isAr ? "مسح" : "Clear"}
        />

        <MultiSelect
          label={isAr ? "فصول موهبة" : "Mawhiba"}
          placeholder={isAr ? "اختر" : "Select"}
          options={mawhibaOptions}
          value={f.mawhibaValues}
          onChange={(next) => patch({ mawhibaValues: next })}
          isRtl={isAr}
          searchable
          maxVisibleChips={2}
          selectAllLabel={isAr ? "الكل" : "All"}
          clearLabel={isAr ? "مسح" : "Clear"}
        />

        <MultiSelect
          label={isAr ? "المرحلة" : "Stage"}
          placeholder={isAr ? "اختر المرحلة" : "Select stage"}
          options={stageOptions}
          value={f.stages}
          onChange={(next) => patch({ stages: next })}
          isRtl={isAr}
          searchable
          maxVisibleChips={2}
          selectAllLabel={isAr ? "الكل" : "All"}
          clearLabel={isAr ? "مسح" : "Clear"}
        />

        <MultiSelect
          label={isAr ? "الصف" : "Grade"}
          placeholder={isAr ? "اختر الصف" : "Select grade"}
          options={gradeOptions}
          value={f.grades}
          onChange={(next) => patch({ grades: next })}
          isRtl={isAr}
          searchable
          maxVisibleChips={2}
          selectAllLabel={isAr ? "الكل" : "All"}
          clearLabel={isAr ? "مسح" : "Clear"}
        />

        <MultiSelect
          label={isAr ? "تصنيف الإنجاز" : "Category"}
          placeholder={isAr ? "اختر التصنيف" : "Select category"}
          options={categoryOptions}
          value={f.categories}
          onChange={(next) => patch({ categories: next })}
          isRtl={isAr}
          searchable
          maxVisibleChips={2}
          selectAllLabel={isAr ? "الكل" : "All"}
          clearLabel={isAr ? "مسح" : "Clear"}
        />

        <CanonicalActivityCombobox
          label={isAr ? "اسم النشاط" : "Activity name"}
          value={f.achievementNames}
          onChange={(names) => patch({ achievementNames: names })}
          fetchParams={activityFetchParams}
          isAr={isAr}
        />

        <MultiSelect
          label={isAr ? "المستوى" : "Level"}
          placeholder={isAr ? "اختر المستوى" : "Select level"}
          options={levelOptions}
          value={f.levels}
          onChange={(next) => patch({ levels: next })}
          isRtl={isAr}
          searchable
          maxVisibleChips={2}
          selectAllLabel={isAr ? "الكل" : "All"}
          clearLabel={isAr ? "مسح" : "Clear"}
        />

        <MultiSelect
          label={isAr ? "النتيجة" : "Result"}
          placeholder={isAr ? "اختر النتيجة" : "Select result"}
          options={resultOptions}
          value={f.resultTokens}
          onChange={(next) => patch({ resultTokens: next })}
          isRtl={isAr}
          searchable
          maxVisibleChips={2}
          selectAllLabel={isAr ? "الكل" : "All"}
          clearLabel={isAr ? "مسح" : "Clear"}
        />

        <MultiSelect
          label={isAr ? "نوع الاختبار المعياري" : "Standardized test"}
          placeholder={isAr ? "اختر نوع الاختبار" : "Select test type"}
          options={stdTestOptions}
          value={f.standardizedTestTypes}
          onChange={(next) => patch({ standardizedTestTypes: next })}
          isRtl={isAr}
          searchable
          maxVisibleChips={2}
          selectAllLabel={isAr ? "الكل" : "All"}
          clearLabel={isAr ? "مسح" : "Clear"}
        />

        <MultiSelect
          label={isAr ? "حالة الإنجاز" : "Status"}
          placeholder={isAr ? "اختر الحالة" : "Select status"}
          options={statusOptions}
          value={f.statuses}
          onChange={(next) => patch({ statuses: next })}
          isRtl={isAr}
          searchable
          maxVisibleChips={2}
          selectAllLabel={isAr ? "الكل" : "All"}
          clearLabel={isAr ? "مسح" : "Clear"}
        />

        <MultiSelect
          label={isAr ? "حالة الشهادة" : "Certificate"}
          placeholder={isAr ? "اختر" : "Select"}
          options={certificateOptions}
          value={f.certificateStatuses}
          onChange={(next) => patch({ certificateStatuses: next })}
          isRtl={isAr}
          searchable
          maxVisibleChips={2}
          selectAllLabel={isAr ? "الكل" : "All"}
          clearLabel={isAr ? "مسح" : "Clear"}
        />

        <label className="flex flex-col text-xs font-semibold text-slate-600">
          {isAr ? "من تاريخ" : "From date"}
          <input
            type="date"
            value={f.fromDate}
            onChange={(e) => patch({ fromDate: e.target.value })}
            className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col text-xs font-semibold text-slate-600">
          {isAr ? "إلى تاريخ" : "To date"}
          <input
            type="date"
            value={f.toDate}
            onChange={(e) => patch({ toDate: e.target.value })}
            className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col text-xs font-semibold text-slate-600 md:col-span-2">
          {isAr ? "تصنيف المادة" : "Classification"}
          <input
            value={f.classification}
            onChange={(e) => patch({ classification: e.target.value })}
            className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col text-xs font-semibold text-slate-600 md:col-span-2">
          {isAr ? "جهة / منظمة" : "Organization"}
          <input
            value={f.organization}
            onChange={(e) => patch({ organization: e.target.value })}
            className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col text-xs font-semibold text-slate-600 md:col-span-2">
          {isAr ? "بحث في المجال / الاسم" : "Domain / name search"}
          <input
            value={f.domain}
            onChange={(e) => patch({ domain: e.target.value })}
            className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder={isAr ? "نص جزئي…" : "Partial text…"}
          />
        </label>
      </div>
    </section>
  );
};

export default AnalyticsMultiFilterPanel;
