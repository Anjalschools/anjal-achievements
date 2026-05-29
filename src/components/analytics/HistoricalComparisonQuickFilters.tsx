"use client";

import { memo, useMemo } from "react";
import type { ComparisonTableMode } from "@/lib/analytics/historical-comparison-table-engine";
import type { HistoricalDimensionSlice } from "@/lib/analytics/historical-comparison-fetch";
import { ACTIVITY_FAMILIES } from "@/lib/analytics/historical-comparison-table-engine";
import HistoricalTimelineYearSelector from "@/components/analytics/HistoricalTimelineYearSelector";
import type { HistoricalTableDisplayMode } from "@/lib/analytics/historical-executive-table-theme";
import { t } from "@/lib/analytics/analytics-semantic-registry";

const TABLE_MODES: ComparisonTableMode[] = [
  "executive",
  "detailed",
  "historical",
  "trend",
];

export type HistoricalComparisonQuickFiltersProps = {
  isAr: boolean;
  mode: ComparisonTableMode;
  displayMode: HistoricalTableDisplayMode;
  dimension: HistoricalDimensionSlice;
  familyKey: string;
  availableYears: number[];
  selectedYears: number[];
  loading: boolean;
  onModeChange: (mode: ComparisonTableMode) => void;
  onDisplayModeChange: (mode: HistoricalTableDisplayMode) => void;
  onDimensionChange: (dimension: HistoricalDimensionSlice) => void;
  onFamilyChange: (key: string) => void;
  onYearsChange: (years: number[]) => void;
  onSelectAllYears: () => void;
  onSelectLast3: () => void;
  onSelectLast5: () => void;
  onReset: () => void;
  onRefresh: () => void;
};

const HistoricalComparisonQuickFilters = ({
  isAr,
  mode,
  displayMode,
  dimension,
  familyKey,
  availableYears,
  selectedYears,
  loading,
  onModeChange,
  onDisplayModeChange,
  onDimensionChange,
  onFamilyChange,
  onYearsChange,
  onSelectAllYears,
  onSelectLast3,
  onSelectLast5,
  onReset,
  onRefresh,
}: HistoricalComparisonQuickFiltersProps) => {
  const loc = isAr ? "ar" : "en";

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (familyKey !== "all") n += 1;
    if (dimension !== "combined") n += 1;
    if (selectedYears.length > 0 && selectedYears.length < availableYears.length) n += 1;
    return n;
  }, [familyKey, dimension, selectedYears.length, availableYears.length]);

  const chips = useMemo(() => {
    const out: Array<{ key: string; label: string }> = [];
    if (familyKey !== "all") {
      const fam = ACTIVITY_FAMILIES.find((f) => f.key === familyKey);
      out.push({
        key: "act",
        label: isAr ? fam?.labelAr ?? familyKey : fam?.labelEn ?? familyKey,
      });
    }
    if (dimension !== "combined") {
      out.push({
        key: "dim",
        label:
          dimension === "girls"
            ? isAr
              ? "بنات"
              : "Girls"
            : isAr
              ? "بنين"
              : "Boys",
      });
    }
    if (selectedYears.length > 0) {
      out.push({
        key: "years",
        label: `${isAr ? "سنوات" : "Years"}: ${selectedYears.join("·")}`,
      });
    }
    return out;
  }, [familyKey, dimension, selectedYears, isAr]);

  return (
    <div
      className="sticky top-0 z-30 space-y-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-md backdrop-blur-md"
      dir={isAr ? "rtl" : "ltr"}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black text-slate-800">
            {t("historical.workspace.title", loc)}
          </span>
          {activeFilterCount > 0 ? (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[9px] font-bold text-indigo-800">
              {activeFilterCount} {isAr ? "فلاتر نشطة" : "active filters"}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => onDisplayModeChange("executive")}
            className={`rounded-lg px-2 py-1 text-[9px] font-bold ${
              displayMode === "executive"
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            {isAr ? "تنفيذي" : "Executive"}
          </button>
          <button
            type="button"
            onClick={() => onDisplayModeChange("analyst")}
            className={`rounded-lg px-2 py-1 text-[9px] font-bold ${
              displayMode === "analyst"
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            {isAr ? "محلل" : "Analyst"}
          </button>
          <button
            type="button"
            onClick={onReset}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[9px] font-bold text-slate-700"
          >
            {isAr ? "إعادة ضبط" : "Reset"}
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading || selectedYears.length === 0}
            className="rounded-lg bg-indigo-600 px-3 py-1 text-[9px] font-bold text-white disabled:opacity-50"
          >
            {isAr ? "تحديث" : "Refresh"}
          </button>
        </div>
      </div>

      {chips.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {chips.map((c) => (
            <span
              key={c.key}
              className="rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[9px] font-bold text-indigo-900"
            >
              {c.label}
            </span>
          ))}
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[1fr_minmax(280px,2fr)]">
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1 text-[10px] font-bold text-slate-600">
            {t("historical.dimension", loc)}
            <select
              value={dimension}
              onChange={(e) => onDimensionChange(e.target.value as HistoricalDimensionSlice)}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
            >
              <option value="combined">{isAr ? "بنين وبنات" : "Boys & girls"}</option>
              <option value="girls">{isAr ? "بنات" : "Girls"}</option>
              <option value="boys">{isAr ? "بنين" : "Boys"}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[10px] font-bold text-slate-600">
            {t("historical.activity", loc)}
            <select
              value={familyKey}
              onChange={(e) => onFamilyChange(e.target.value)}
              className="min-w-[140px] rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
            >
              <option value="all">{isAr ? "كل الأنشطة" : "All activities"}</option>
              {ACTIVITY_FAMILIES.map((fam) => (
                <option key={fam.key} value={fam.key}>
                  {isAr ? fam.labelAr : fam.labelEn}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[10px] font-bold text-slate-600">
            {t("historical.mode", loc)}
            <select
              value={mode}
              onChange={(e) => onModeChange(e.target.value as ComparisonTableMode)}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
            >
              {TABLE_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        </div>
        <HistoricalTimelineYearSelector
          isAr={isAr}
          availableYears={availableYears}
          selectedYears={selectedYears}
          onChange={onYearsChange}
          onSelectAll={onSelectAllYears}
          onSelectLast3={onSelectLast3}
          onSelectLast5={onSelectLast5}
          disabled={loading}
        />
      </div>
    </div>
  );
};

export default memo(HistoricalComparisonQuickFilters);
