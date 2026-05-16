"use client";

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, TrendingDown, TrendingUp, GitCompare, Loader2 } from "lucide-react";
import type { FocusedActivityOptionRow, FocusedActivityReportPayload } from "@/types/focused-activity-report";
import { CompetitionDecisionSections } from "@/components/admin/CompetitionDecisionSections";
import { CollapsibleSection } from "@/components/admin/CollapsibleSection";
import { LazyChartMount } from "@/components/admin/LazyChartMount";
import { ANJAL_CHART } from "@/lib/anjal-chart-theme";
import {
  CI_DELTA_HEAT,
  CI_RADIUS,
  CI_SHADOW,
  CI_SPACING,
  CI_STORAGE_KEYS,
  CI_SURFACE,
  CI_TYPOGRAPHY,
} from "@/lib/competition-intelligence-theme";
import { describeFocusedEmptyContext } from "@/lib/competition-intelligence-consistency";
import { ciRedactLine, logEmptyDatasetIntel, logVirtualizationIntel } from "@/lib/competition-intelligence-debug";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const RECENT_KEY = "anjal-focused-activity-recent-v1";

const stripDiacritics = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

const normalizeSearch = (s: string) => stripDiacritics(s.trim());

const readRecent = (): string[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const j = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(j) ? j.filter((x) => typeof x === "string").slice(0, 12) : [];
  } catch {
    return [];
  }
};

const writeRecent = (pick: string) => {
  if (typeof window === "undefined" || !pick) return;
  const cur = readRecent().filter((x) => x !== pick);
  cur.unshift(pick);
  localStorage.setItem(RECENT_KEY, JSON.stringify(cur.slice(0, 12)));
};

type Tone = FocusedActivityReportPayload["executive"]["kpiCards"][number]["tone"];

const toneRing: Record<Tone, string> = {
  amber: "ring-amber-200/80 bg-amber-50/90 border-amber-100",
  slate: "ring-slate-200/80 bg-slate-50/90 border-slate-100",
  violet: "ring-violet-200/80 bg-violet-50/90 border-violet-100",
  emerald: "ring-emerald-200/80 bg-emerald-50/90 border-emerald-100",
  sky: "ring-sky-200/80 bg-sky-50/90 border-sky-100",
};

const RESULT_SLICE_FILL: Record<string, string> = {
  gold: ANJAL_CHART.gold,
  silver: ANJAL_CHART.silver,
  bronze: ANJAL_CHART.bronze,
  nomination: ANJAL_CHART.nominationViolet,
  rank: ANJAL_CHART.rankTeal,
  participation: ANJAL_CHART.participationBlue,
};

const KpiExecutiveCard = memo(
  ({
    isAr,
    icon,
    label,
    value,
    hint,
    trendPct,
    trendDir,
    tone,
  }: {
    isAr: boolean;
    icon: string;
    label: string;
    value: string;
    hint: string;
    trendPct: number | null;
    trendDir: "up" | "down" | "flat";
    tone: Tone;
  }) => {
    const TrendIc = trendDir === "down" ? TrendingDown : trendDir === "up" ? TrendingUp : null;
    const trendColor =
      trendDir === "up" ? "text-emerald-700" : trendDir === "down" ? "text-red-600" : "text-slate-400";
    return (
      <div
        className={`rounded-2xl border p-4 shadow-sm ring-1 transition hover:shadow-md ${toneRing[tone]}`}
        dir={isAr ? "rtl" : "ltr"}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-2xl" aria-hidden>
            {icon}
          </span>
          {trendPct != null && TrendIc ? (
            <span className={`inline-flex items-center gap-0.5 text-xs font-black tabular-nums ${trendColor}`}>
              <TrendIc className="h-3.5 w-3.5" />
              {trendDir === "up" ? "↑" : trendDir === "down" ? "↓" : "—"}{" "}
              {trendPct > 0 ? "+" : ""}
              {trendPct}%
            </span>
          ) : (
            <span className="text-[10px] font-semibold text-slate-400">—</span>
          )}
        </div>
        <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-black tabular-nums text-slate-900">{value}</p>
        <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-slate-600">{hint}</p>
      </div>
    );
  }
);
KpiExecutiveCard.displayName = "KpiExecutiveCard";

const ActivitySearchCombobox = ({
  isAr,
  options,
  primaryType,
  value,
  onChange,
  disabled,
  loading,
  label,
  placeholder,
  recentLabel,
  topLabel,
}: {
  isAr: boolean;
  options: FocusedActivityOptionRow[];
  primaryType: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  loading?: boolean;
  label: string;
  placeholder: string;
  recentLabel: string;
  topLabel: string;
}) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const base = options.filter((o) => primaryType === "all" || o.typeKey === primaryType);
    const nq = normalizeSearch(q);
    if (!nq) return base;
    return base.filter((o) => {
      const blob = normalizeSearch(
        `${o.labelAr} ${o.labelEn} ${o.typeKey} ${o.rawKey} ${o.count}`
      );
      return blob.includes(nq);
    });
  }, [options, primaryType, q]);
  const top = useMemo(
    () =>
      [...options]
        .filter((o) => primaryType === "all" || o.typeKey === primaryType)
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
    [options, primaryType]
  );
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => {
    setRecent(readRecent());
  }, []);
  const displayLabel = useMemo(() => {
    if (!value) return "";
    const sep = value.indexOf("\u001f");
    const tk = sep === -1 ? value : value.slice(0, sep);
    const rk = sep === -1 ? "" : value.slice(sep + 1);
    const hit = options.find((o) => o.typeKey === tk && o.rawKey === rk);
    if (!hit) return value;
    return `${isAr ? hit.labelAr : hit.labelEn} · ${hit.count}`;
  }, [value, options, isAr]);

  const handlePick = useCallback(
    (v: string) => {
      writeRecent(v);
      setRecent(readRecent());
      onChange(v);
      setOpen(false);
      setQ("");
    },
    [onChange]
  );

  return (
    <div className="relative flex flex-col text-xs font-semibold text-indigo-950">
      <span>{label}</span>
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setOpen((o) => !o)}
        className="mt-1 flex w-full items-center justify-between gap-2 rounded-lg border border-indigo-100 bg-white px-3 py-2 text-start text-sm font-medium text-slate-900 shadow-sm disabled:opacity-50"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="truncate">{value ? displayLabel : placeholder}</span>
        {loading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />}
      </button>
      {open ? (
        <div
          className="absolute start-0 top-[calc(100%+4px)] z-50 w-full min-w-[280px] rounded-xl border border-slate-200 bg-white shadow-xl"
          role="listbox"
        >
          <div className="flex items-center gap-2 border-b border-slate-100 px-2 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full border-0 bg-transparent text-sm outline-none"
              placeholder={isAr ? "بحث (عربي / إنجليزي)…" : "Search (AR / EN)…"}
              autoFocus
            />
          </div>
          <div className="max-h-72 overflow-y-auto py-1 text-sm">
            {recent.filter((r) => !!r).length > 0 && !q ? (
              <div className="px-2 pb-1">
                <p className="px-2 py-1 text-[10px] font-black uppercase text-slate-400">{recentLabel}</p>
                {recent
                  .filter((r) => options.some((o) => `${o.typeKey}\u001f${o.rawKey}` === r))
                  .slice(0, 6)
                  .map((r) => {
                    const hit = options.find((o) => `${o.typeKey}\u001f${o.rawKey}` === r);
                    if (!hit) return null;
                    if (primaryType !== "all" && hit.typeKey !== primaryType) return null;
                    return (
                      <button
                        key={r}
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-start hover:bg-indigo-50/80"
                        onClick={() => handlePick(r)}
                      >
                        <span dir="auto" className="truncate font-medium">
                          {isAr ? hit.labelAr : hit.labelEn}
                        </span>
                        <span className="tabular-nums text-xs text-slate-500">{hit.count}</span>
                      </button>
                    );
                  })}
              </div>
            ) : null}
            {!q ? (
              <div className="px-2 pb-1">
                <p className="px-2 py-1 text-[10px] font-black uppercase text-slate-400">{topLabel}</p>
                {top.map((hit) => (
                  <button
                    key={`${hit.typeKey}\u001f${hit.rawKey}`}
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 text-start hover:bg-slate-50"
                    onClick={() => handlePick(`${hit.typeKey}\u001f${hit.rawKey}`)}
                  >
                    <span dir="auto" className="truncate font-medium">
                      {isAr ? hit.labelAr : hit.labelEn}
                    </span>
                    <span className="tabular-nums text-xs text-slate-500">{hit.count}</span>
                  </button>
                ))}
              </div>
            ) : null}
            {filtered.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-slate-500">
                {isAr ? "لا نتائج" : "No matches"}
              </p>
            ) : (
              filtered.slice(0, 80).map((hit) => (
                <button
                  key={`${hit.typeKey}\u001f${hit.rawKey}`}
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-start hover:bg-indigo-50/60"
                  onClick={() => handlePick(`${hit.typeKey}\u001f${hit.rawKey}`)}
                >
                  <span dir="auto" className="truncate">
                    {isAr ? hit.labelAr : hit.labelEn}
                  </span>
                  <span className="tabular-nums text-xs text-slate-500">{hit.count}</span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-40 cursor-default bg-transparent"
          aria-label="close"
          onClick={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
};

export type FocusedExecutiveIntelligencePanelProps = {
  isAr: boolean;
  primaryType: string;
  onPrimaryTypeChange: (v: string) => void;
  categoryOptions: { value: string; label: string }[];
  activityOptions: FocusedActivityOptionRow[];
  optionsLoading: boolean;
  pick: string;
  onPickChange: (v: string) => void;
  compareEnabled: boolean;
  onCompareEnabledChange: (v: boolean) => void;
  comparePick: string;
  onComparePickChange: (v: string) => void;
  compareData: FocusedActivityReportPayload | null;
  compareLoading: boolean;
  outcome: string;
  onOutcomeChange: (v: string) => void;
  outcomeOptions: { value: string; label: string }[];
  data: FocusedActivityReportPayload | null;
  loading: boolean;
  page: number;
  onPageChange: (p: number) => void;
  totalPages: number;
  focusedParticipantHeaders: string[];
  onExportSelectedExcel: (headers: string[], rows: Record<string, string | number>[]) => void;
  onExportSelectedPdf: (headers: string[], rows: Record<string, string | number>[]) => void;
  /** Shown in executive hero (e.g. academic year line). */
  academicYearLine: string;
  /** Outcome filter label for hero / context. */
  outcomeLine: string;
  /** Focused report fetch error (optional). */
  reportLoadError?: string | null;
  /** Clear common restrictive filters when analytics are empty. */
  onRelaxReportFilters?: () => void;
  /** Filter context for empty-state diagnostics (no PII). */
  filterContext?: {
    academicYear: string;
    stage: string;
    outcome: string;
    primaryType: string;
  };
};

export const FocusedExecutiveIntelligencePanel = memo((props: FocusedExecutiveIntelligencePanelProps) => {
  const {
    isAr,
    primaryType,
    onPrimaryTypeChange,
    categoryOptions,
    activityOptions,
    optionsLoading,
    pick,
    onPickChange,
    compareEnabled,
    onCompareEnabledChange,
    comparePick,
    onComparePickChange,
    compareData,
    compareLoading,
    outcome,
    onOutcomeChange,
    outcomeOptions,
    data,
    loading,
    page,
    onPageChange,
    totalPages,
    focusedParticipantHeaders,
    onExportSelectedExcel,
    onExportSelectedPdf,
    academicYearLine,
    outcomeLine,
    reportLoadError,
    onRelaxReportFilters,
    filterContext,
  } = props;

  const [highContrast, setHighContrast] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(CI_STORAGE_KEYS.highContrast) === "1";
    } catch {
      return false;
    }
  });

  const [tableQuery, setTableQuery] = useState("");
  const [debouncedTableQuery, setDebouncedTableQuery] = useState("");
  const [viewDensity, setViewDensity] = useState<"executive" | "detailed">(() => {
    if (typeof window === "undefined") return "detailed";
    try {
      const v = localStorage.getItem(CI_STORAGE_KEYS.detailMode);
      if (v === "executive" || v === "detailed") return v;
    } catch {
      /* ignore */
    }
    return "detailed";
  });
  const [sortKey, setSortKey] = useState<
    "name" | "result" | "level" | "score" | "year" | ""
  >("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [tableDensity, setTableDensity] = useState<"normal" | "compact">("normal");
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const [virtWindow, setVirtWindow] = useState<{ start: number; end: number }>({ start: 0, end: 120 });

  const VROW = 40;
  const VIRT_OVERSCAN = 10;

  useEffect(() => {
    setSelectedIds(new Set());
  }, [pick, outcome, page, data?.generatedAt]);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedTableQuery(tableQuery), 300);
    return () => window.clearTimeout(id);
  }, [tableQuery]);

  const handleHighContrastToggle = useCallback(() => {
    setHighContrast((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(CI_STORAGE_KEYS.highContrast, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const handleViewDensityChange = useCallback((next: "executive" | "detailed") => {
    setViewDensity(next);
    try {
      localStorage.setItem(CI_STORAGE_KEYS.detailMode, next);
    } catch {
      /* ignore */
    }
  }, []);

  const isExecutiveDensity = viewDensity === "executive";

  const resultDonutData = useMemo(() => {
    if (!data?.charts?.resultBars?.length) return [];
    const t = data.charts.resultBars.reduce((s, x) => s + x.count, 0);
    return data.charts.resultBars.map((x) => ({
      key: x.key,
      name: isAr ? x.labelAr : x.labelEn,
      value: x.count,
      fill: RESULT_SLICE_FILL[x.key] ?? x.fill,
      pct: t > 0 ? Math.round((x.count / t) * 1000) / 10 : 0,
    }));
  }, [data, isAr]);

  const yoyChartData = useMemo(() => {
    if (!data?.executive?.yearComparison?.length) return [];
    return data.executive.yearComparison.map((y) => ({
      year: String(y.year),
      participants: y.distinctStudents,
      medals: y.totalMedals,
      excellence: y.excellenceRatePct,
    }));
  }, [data]);

  const stackSection = useMemo(() => {
    if (!data?.executive?.demographicStacks?.sectionGender) return [];
    return data.executive.demographicStacks.sectionGender.map((r) => ({
      name: isAr ? r.labelAr : r.labelEn,
      male: r.male,
      female: r.female,
    }));
  }, [data, isAr]);

  const stackMaw = useMemo(() => {
    if (!data?.executive?.demographicStacks?.mawhibaGender) return [];
    return data.executive.demographicStacks.mawhibaGender.map((r) => ({
      name: isAr ? r.labelAr : r.labelEn,
      male: r.male,
      female: r.female,
    }));
  }, [data, isAr]);

  const stackStage = useMemo(() => {
    if (!data?.executive?.demographicStacks?.stageBreakdown) return [];
    return data.executive.demographicStacks.stageBreakdown.map((r) => ({
      name: isAr ? r.labelAr : r.labelEn,
      n: r.count,
    }));
  }, [data, isAr]);

  const processedParticipants = useMemo(() => {
    let rows = data?.participants ?? [];
    const nq = normalizeSearch(debouncedTableQuery);
    if (nq) {
      rows = rows.filter((r) => {
        const blob = normalizeSearch(
          `${r.studentNameAr} ${r.studentNameEn} ${r.resultLineAr} ${r.resultLineEn} ${r.levelLabelAr} ${r.schoolOrOrganization}`
        );
        return blob.includes(nq);
      });
    }
    const mul = sortDir === "asc" ? 1 : -1;
    const sorted = [...rows];
    if (sortKey === "name") {
      sorted.sort((a, b) => mul * (isAr ? a.studentNameAr : a.studentNameEn).localeCompare(isAr ? b.studentNameAr : b.studentNameEn));
    } else if (sortKey === "year") {
      sorted.sort((a, b) => mul * ((a.year ?? -1) - (b.year ?? -1)));
    } else if (sortKey === "score") {
      sorted.sort((a, b) => mul * ((a.scoreNumeric ?? -1e9) - (b.scoreNumeric ?? -1e9)));
    } else if (sortKey === "level") {
      sorted.sort((a, b) => mul * (isAr ? a.levelLabelAr : a.levelLabelEn).localeCompare(isAr ? b.levelLabelAr : b.levelLabelEn));
    } else if (sortKey === "result") {
      sorted.sort((a, b) => mul * (isAr ? a.resultLineAr : a.resultLineEn).localeCompare(isAr ? b.resultLineAr : b.resultLineEn));
    }
    return sorted;
  }, [data, debouncedTableQuery, sortKey, sortDir, isAr]);

  const virtEnabled = processedParticipants.length > 300;
  const virtPadTop = virtEnabled ? virtWindow.start * VROW : 0;
  const virtPadBottom = virtEnabled ? Math.max(0, (processedParticipants.length - virtWindow.end) * VROW) : 0;
  const visibleParticipants = virtEnabled
    ? processedParticipants.slice(virtWindow.start, virtWindow.end)
    : processedParticipants;

  useEffect(() => {
    const n = processedParticipants.length;
    if (n <= 300) {
      setVirtWindow((w) => (w.start === 0 && w.end === n ? w : { start: 0, end: n }));
      return;
    }
    const el = tableScrollRef.current;
    if (!el) return;
    const sync = () => {
      const top = el.scrollTop;
      const vh = el.clientHeight;
      const start = Math.max(0, Math.floor(top / VROW) - VIRT_OVERSCAN);
      const vis = Math.ceil(vh / VROW) + VIRT_OVERSCAN * 2;
      const end = Math.min(n, start + vis);
      setVirtWindow((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
    };
    sync();
    el.addEventListener("scroll", sync, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(sync) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener("scroll", sync);
      ro?.disconnect();
    };
  }, [processedParticipants.length, pick, page, data?.generatedAt]);

  useEffect(() => {
    if (!data) return;
    logVirtualizationIntel({
      active: virtEnabled,
      rowCount: processedParticipants.length,
      threshold: 300,
    });
  }, [data, virtEnabled, processedParticipants.length]);

  useEffect(() => {
    const el = tableScrollRef.current;
    if (el) el.scrollTop = 0;
  }, [sortKey, sortDir, tableQuery]);

  const compareYoyBars = useMemo(() => {
    if (!compareEnabled || !data || !compareData) return [];
    const ycA = data.executive.yearComparison;
    const ycB = compareData.executive.yearComparison;
    const years = [...new Set([...ycA.map((y) => y.year), ...ycB.map((y) => y.year)])].sort((a, b) => a - b);
    return years.map((year) => ({
      year: String(year),
      aPart: ycA.find((y) => y.year === year)?.distinctStudents ?? 0,
      bPart: ycB.find((y) => y.year === year)?.distinctStudents ?? 0,
      aMed: ycA.find((y) => y.year === year)?.totalMedals ?? 0,
      bMed: ycB.find((y) => y.year === year)?.totalMedals ?? 0,
      aEx: ycA.find((y) => y.year === year)?.excellenceRatePct ?? 0,
      bEx: ycB.find((y) => y.year === year)?.excellenceRatePct ?? 0,
    }));
  }, [compareEnabled, data, compareData]);

  const emptyDatasetInsight = useMemo(() => {
    if (!data || data.kpis.totalRecords !== 0) return null;
    return describeFocusedEmptyContext({
      hasActivityPick: Boolean(pick),
      totalRecords: data.kpis.totalRecords,
      academicYear: filterContext?.academicYear ?? "all",
      stage: filterContext?.stage ?? "all",
      outcome: filterContext?.outcome ?? "all",
      primaryType: filterContext?.primaryType ?? "all",
    });
  }, [data, pick, filterContext]);

  useEffect(() => {
    if (!emptyDatasetInsight?.codes.length) return;
    logEmptyDatasetIntel({
      surface: "focused_executive",
      reasonCodes: emptyDatasetInsight.codes,
      filterSummary: ciRedactLine(
        JSON.stringify({
          ay: filterContext?.academicYear,
          st: filterContext?.stage,
          out: filterContext?.outcome,
        })
      ),
    });
  }, [
    emptyDatasetInsight?.codes.join("|"),
    filterContext?.academicYear,
    filterContext?.stage,
    filterContext?.outcome,
  ]);

  const rb = (d: FocusedActivityReportPayload, k: string) => d.charts.resultBars.find((x) => x.key === k)?.count ?? 0;

  const toggleSort = (k: typeof sortKey) => {
    if (sortKey !== k) {
      setSortKey(k);
      setSortDir("asc");
      return;
    }
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  };

  const buildRowObj = useCallback(
    (r: (typeof processedParticipants)[number]) => {
      const o: Record<string, string | number> = {};
      const h = focusedParticipantHeaders;
      if (isAr) {
        o[h[0]!] = r.studentNameAr;
        o[h[1]!] = r.gender === "female" ? "بنات" : "بنين";
        o[h[2]!] = r.section === "international" ? "دولي" : "عربي";
        o[h[3]!] = r.mawhiba ? "موهبة" : "غير موهبة";
        o[h[4]!] = r.gradeLabelAr;
        o[h[5]!] = r.stageLabelAr;
        o[h[6]!] = r.schoolOrOrganization;
        o[h[7]!] = r.activityLabelAr;
        o[h[8]!] = r.year ?? "—";
        o[h[9]!] = r.resultLineAr;
        o[h[10]!] = r.levelLabelAr;
        o[h[11]!] = r.scoreOrValueDisplay;
        o[h[12]!] = r.approvalLabelAr;
      } else {
        o[h[0]!] = r.studentNameEn;
        o[h[1]!] = r.gender === "female" ? "Female" : "Male";
        o[h[2]!] = r.section === "international" ? "International" : "Arabic";
        o[h[3]!] = r.mawhiba ? "Mawhiba" : "Non‑Mawhiba";
        o[h[4]!] = r.gradeLabelEn;
        o[h[5]!] = r.stageLabelEn;
        o[h[6]!] = r.schoolOrOrganization;
        o[h[7]!] = r.activityLabelEn;
        o[h[8]!] = r.year ?? "—";
        o[h[9]!] = r.resultLineEn;
        o[h[10]!] = r.levelLabelEn;
        o[h[11]!] = r.scoreOrValueDisplay;
        o[h[12]!] = r.approvalLabelEn;
      }
      return o;
    },
    [focusedParticipantHeaders, isAr]
  );

  const handleExportSelection = () => {
    const rows = processedParticipants.filter((r) => selectedIds.has(r.achievementId)).map(buildRowObj);
    if (rows.length === 0) return;
    onExportSelectedExcel(focusedParticipantHeaders, rows);
  };

  const handleExportSelectionPdf = () => {
    const rows = processedParticipants.filter((r) => selectedIds.has(r.achievementId)).map(buildRowObj);
    if (rows.length === 0) return;
    onExportSelectedPdf(focusedParticipantHeaders, rows);
  };

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const toggleAllVisible = () => {
    const ids = processedParticipants.map((r) => r.achievementId);
    const allSel = ids.every((id) => selectedIds.has(id));
    if (allSel) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(ids));
  };

  const rowPad = tableDensity === "compact" ? "px-1.5 py-1 text-[10px]" : "px-2 py-2 text-xs";

  return (
    <div
      className={
        highContrast ?
          "space-y-6 rounded-xl p-1 outline outline-2 outline-offset-2 outline-black"
        : "space-y-6"
      }
      dir={isAr ? "rtl" : "ltr"}
    >
      <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/40 via-white to-slate-50/80 p-4 shadow-sm ring-1 ring-indigo-100/60">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-black text-indigo-950">
            {isAr ? "منصة قرار ذكاء المسابقات" : "Competition intelligence decision platform"}
          </p>
          <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-700">
            <input
              type="checkbox"
              checked={compareEnabled}
              onChange={(e) => {
                onCompareEnabledChange(e.target.checked);
                if (!e.target.checked) onComparePickChange("");
              }}
              className="rounded border-slate-300"
            />
            <GitCompare className="h-4 w-4" />
            {isAr ? "مقارنة بين نشاطين" : "Compare two activities"}
          </label>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col text-xs font-semibold text-indigo-950">
            {isAr ? "النوع الرئيسي" : "Primary type"}
            <select
              value={primaryType}
              onChange={(e) => onPrimaryTypeChange(e.target.value)}
              className="mt-1 rounded-lg border border-indigo-100 bg-white px-2 py-2 text-sm"
            >
              <option value="all">{isAr ? "الكل" : "All"}</option>
              {categoryOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <ActivitySearchCombobox
            isAr={isAr}
            options={activityOptions}
            primaryType={primaryType}
            value={pick}
            onChange={onPickChange}
            disabled={optionsLoading}
            loading={optionsLoading}
            label={isAr ? "النشاط (بحث ذكي)" : "Activity (smart search)"}
            placeholder={isAr ? "— اختر أو ابحث —" : "— Select or search —"}
            recentLabel={isAr ? "آخر الاختيارات" : "Recent"}
            topLabel={isAr ? "الأكثر شيوعاً" : "Top activities"}
          />
          {compareEnabled ? (
            <ActivitySearchCombobox
              isAr={isAr}
              options={activityOptions}
              primaryType={primaryType}
              value={comparePick}
              onChange={onComparePickChange}
              disabled={optionsLoading}
              loading={optionsLoading}
              label={isAr ? "النشاط الثاني للمقارنة" : "Second activity"}
              placeholder={isAr ? "— نشاط للمقارنة —" : "— Compare with —"}
              recentLabel={isAr ? "آخر" : "Recent"}
              topLabel={isAr ? "الأعلى" : "Top"}
            />
          ) : null}
          <label className="flex flex-col text-xs font-semibold text-indigo-950">
            {isAr ? "نوع الإنجاز" : "Outcome"}
            <select
              value={outcome}
              onChange={(e) => onOutcomeChange(e.target.value)}
              className="mt-1 rounded-lg border border-indigo-100 bg-white px-2 py-2 text-sm"
            >
              {outcomeOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {compareEnabled && (compareLoading || compareData) ? (
        <CollapsibleSection
          sectionId="compare"
          persistKey={CI_STORAGE_KEYS.collapse}
          defaultOpen={!isExecutiveDensity}
          title={isAr ? "مقارنة نشاطين" : "Compare two activities"}
          subtitle={
            isAr ? "مرآة، فروق لونية، وتمييز فائزين وفق المؤشرات." : "Mirrored metrics, delta heat, and winner callouts."
          }
          className="print:border-violet-200"
        >
        <div className="rounded-xl border border-violet-100 bg-violet-50/30 p-3 print:break-inside-avoid">
          <p className="text-xs text-violet-900">
            {isAr ? "نفس فلاتر التقرير ونوع الإنجاز." : "Same report filters and outcome type."}
          </p>
          {compareLoading ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-violet-900">
              <Loader2 className="h-4 w-4 animate-spin" />
              {isAr ? "جاري تحميل المقارنة…" : "Loading comparison…"}
            </div>
          ) : compareData && data ? (
            <div className="mt-4 space-y-4">
              {(() => {
                const deltaLine = (a: number, b: number) => {
                  if (a === b) return isAr ? "بدون فرق" : "No change";
                  const base = b !== 0 ? ((a - b) / b) * 100 : a > 0 ? 100 : 0;
                  const pct = Math.round(base * 10) / 10;
                  const arrow = a > b ? "↑" : "↓";
                  return `${arrow} ${pct > 0 ? "+" : ""}${pct}%`;
                };
                const deltaCellClass = (av: number, bv: number) => {
                  if (av === bv) return CI_DELTA_HEAT.neutral;
                  const denom = Math.max(Math.abs(av), Math.abs(bv), 1);
                  const rel = Math.abs(av - bv) / denom;
                  if (av > bv) return rel >= 0.12 ? CI_DELTA_HEAT.strongA : CI_DELTA_HEAT.mildA;
                  return rel >= 0.12 ? CI_DELTA_HEAT.strongB : CI_DELTA_HEAT.mildB;
                };
                const mawCount = (d: FocusedActivityReportPayload) =>
                  d.charts.mawhibaPie.find((s) => {
                    const lab = (isAr ? s.nameAr : s.nameEn).toLowerCase();
                    return lab.includes("موهبة") || lab.includes("mawhiba");
                  })?.value ?? 0;
                const intlCount = (d: FocusedActivityReportPayload) =>
                  d.charts.sectionPie.find((s) => {
                    const lab = (isAr ? s.nameAr : s.nameEn).toLowerCase();
                    return lab.includes("دولي") || lab.includes("international");
                  })?.value ?? 0;
                const medals = (d: FocusedActivityReportPayload) =>
                  rb(d, "gold") + rb(d, "silver") + rb(d, "bronze");
                const ycA = data.executive.yearComparison;
                const ycB = compareData.executive.yearComparison;
                const lastYoY = (yc: typeof ycA) =>
                  yc.length > 1 ? (yc[yc.length - 1]?.excellenceRatePct ?? 0) - (yc[yc.length - 2]?.excellenceRatePct ?? 0) : 0;
                const growA = lastYoY(ycA);
                const growB = lastYoY(ycB);
                const medalWin =
                  medals(data) === medals(compareData) ? "tie" : medals(data) > medals(compareData) ? "A" : "B";
                const growWin = growA === growB ? "tie" : growA > growB ? "A" : "B";
                const rateWin =
                  data.kpis.excellenceRatePct === compareData.kpis.excellenceRatePct
                    ? "tie"
                    : data.kpis.excellenceRatePct > compareData.kpis.excellenceRatePct
                      ? "A"
                      : "B";
                const intlWin =
                  intlCount(data) === intlCount(compareData)
                    ? "tie"
                    : intlCount(data) > intlCount(compareData)
                      ? "A"
                      : "B";
                const rows: [string, number, number][] = [
                  [isAr ? "سجلات" : "Records", data.kpis.totalRecords, compareData.kpis.totalRecords],
                  [isAr ? "طلاب فريدون" : "Distinct students", data.kpis.distinctStudents, compareData.kpis.distinctStudents],
                  [isAr ? "نسبة التميز %" : "Excellence %", data.kpis.excellenceRatePct, compareData.kpis.excellenceRatePct],
                  [isAr ? "🥇 ذهبية" : "🥇 Gold", rb(data, "gold"), rb(compareData, "gold")],
                  [isAr ? "🥈 فضية" : "🥈 Silver", rb(data, "silver"), rb(compareData, "silver")],
                  [isAr ? "🥉 برونزية" : "🥉 Bronze", rb(data, "bronze"), rb(compareData, "bronze")],
                  [isAr ? "ترشيحات" : "Nominations", rb(data, "nomination"), rb(compareData, "nomination")],
                  [isAr ? "مشاركة فقط" : "Participation only", rb(data, "participation"), rb(compareData, "participation")],
                  [isAr ? "موهبة (مخطط)" : "Mawhiba (slice)", mawCount(data), mawCount(compareData)],
                  [isAr ? "قسم دولي (مخطط)" : "International (slice)", intlCount(data), intlCount(compareData)],
                ];
                const winChip = (key: string, w: "A" | "B" | "tie", ar: string, en: string) => (
                  <div
                    key={key}
                    className={`rounded-lg border px-2 py-1.5 text-[10px] font-black ${
                      w === "tie" ? "border-slate-200 bg-slate-50 text-slate-700" : "border-amber-200 bg-amber-50 text-amber-950"
                    }`}
                  >
                    🏆 {isAr ? ar : en}:{" "}
                    {w === "tie" ? (isAr ? "تعادل" : "Tie") : w === "A" ? (isAr ? "النشاط أ" : "Activity A") : isAr ? "النشاط ب" : "Activity B"}
                  </div>
                );
                return (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {winChip("med", medalWin, "الأعلى ميداليات", "Most medals")}
                      {winChip("grow", growWin, "أعلى زخم تميز (سنتان)", "Strongest excellence momentum (2y)")}
                      {winChip("rate", rateWin, "أعلى نسبة تميز", "Highest excellence rate")}
                      {winChip("intl", intlWin, "أعلى حجم دولي", "Stronger international slice")}
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-white bg-white/95 shadow-sm">
                      <table className="w-full min-w-[520px] text-start text-[11px]">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                            <th className="px-2 py-2 font-black">{isAr ? "المؤشر" : "KPI"}</th>
                            <th className="px-2 py-2 font-black" style={{ color: ANJAL_CHART.anjalBlue }} dir="auto">
                              {isAr ? data.activityLabelAr : data.activityLabelEn}
                            </th>
                            <th className="px-2 py-2 font-black text-violet-800">{isAr ? "فرق" : "Δ"}</th>
                            <th className="px-2 py-2 font-black text-violet-950" dir="auto">
                              {isAr ? compareData.activityLabelAr : compareData.activityLabelEn}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map(([label, av, bv]) => (
                            <tr key={label} className="border-b border-slate-100">
                              <td className="px-2 py-2 font-semibold text-slate-800">{label}</td>
                              <td className="px-2 py-2 tabular-nums font-bold text-slate-900">{av}</td>
                              <td className={`px-2 py-2 tabular-nums text-xs font-black ${deltaCellClass(av, bv)}`}>
                                {deltaLine(av, bv)}
                              </td>
                              <td className="px-2 py-2 tabular-nums font-bold text-slate-800">{bv}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                );
              })()}
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-white bg-white/90 p-3 shadow-sm" dir="ltr">
                  <p className="mb-2 text-[10px] font-black uppercase text-slate-500">
                    {isAr ? "السنوات × الطلاب والميداليات" : "Years × students & medals"}
                  </p>
                  <div className="h-56 min-h-[220px] w-full">
                    {compareYoyBars.length > 0 ? (
                      <LazyChartMount minHeight={220} chartId="compare-yoy-participation">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={compareYoyBars} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={ANJAL_CHART.grid} />
                            <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="aPart" fill={ANJAL_CHART.anjalBlue} name={isAr ? "أ نشاط طلاب" : "A students"} radius={[4, 4, 0, 0]} />
                            <Bar dataKey="bPart" fill={ANJAL_CHART.nominationViolet} name={isAr ? "ب نشاط طلاب" : "B students"} radius={[4, 4, 0, 0]} />
                            <Bar dataKey="aMed" fill={ANJAL_CHART.gold} name={isAr ? "أ ميداليات" : "A medals"} radius={[4, 4, 0, 0]} />
                            <Bar dataKey="bMed" fill={ANJAL_CHART.silver} name={isAr ? "ب ميداليات" : "B medals"} radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </LazyChartMount>
                    ) : (
                      <div className="flex h-full min-h-[220px] items-center justify-center text-xs text-slate-400">
                        {isAr ? "لا بيانات سنوات" : "No YoY rows"}
                      </div>
                    )}
                  </div>
                </div>
                <div className="rounded-xl border border-white bg-white/90 p-3 shadow-sm" dir="ltr">
                  <p className="mb-2 text-[10px] font-black uppercase text-slate-500">
                    {isAr ? "نسبة التميز حسب السنة (مرآة)" : "Excellence % by year (mirrored)"}
                  </p>
                  <div className="h-56 min-h-[220px] w-full">
                    {compareYoyBars.length > 0 ? (
                      <LazyChartMount minHeight={220} chartId="compare-yoy-excellence">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={compareYoyBars} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={ANJAL_CHART.grid} />
                            <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="aEx" fill={ANJAL_CHART.successGreen} name={isAr ? "أ تميز٪" : "A exc.%"} radius={[6, 6, 0, 0]} />
                            <Bar dataKey="bEx" fill={ANJAL_CHART.alertRed} name={isAr ? "ب تميز٪" : "B exc.%"} radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </LazyChartMount>
                    ) : (
                      <div className="flex h-full min-h-[220px] items-center justify-center text-xs text-slate-400">
                        {isAr ? "لا بيانات" : "No data"}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {[data, compareData].map((d, i) => (
                  <div key={i} className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm" dir="ltr">
                    <p className="text-xs font-black text-slate-900" dir="auto">
                      {isAr ? d.activityLabelAr : d.activityLabelEn}
                    </p>
                    <p className="mb-1 mt-1 text-[10px] font-bold text-slate-500">{isAr ? "جنس / قسم / موهبة" : "Gender / section / Mawhiba"}</p>
                    <div className="grid grid-cols-3 gap-2 text-[10px]">
                      {d.charts.genderPie.map((s) => (
                        <div key={s.name} className="rounded-lg bg-slate-50 p-2">
                          <span className="text-slate-500">{isAr ? s.nameAr : s.nameEn}</span>
                          <p className="font-black tabular-nums text-slate-900">{s.value}</p>
                        </div>
                      ))}
                      {d.charts.sectionPie.map((s) => (
                        <div key={s.name} className="rounded-lg bg-slate-50 p-2">
                          <span className="text-slate-500">{isAr ? s.nameAr : s.nameEn}</span>
                          <p className="font-black tabular-nums text-slate-900">{s.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs text-violet-800">
              {isAr ? "اختر النشاط الرئيسي أعلاه لإظهار جدول المقارنة." : "Select the primary activity to render the comparison table."}
            </p>
          )}
        </div>
        </CollapsibleSection>
      ) : null}

      {!pick ? (
        <div className="rounded-2xl border border-dashed border-indigo-200 bg-white p-8 text-center text-sm text-slate-600">
          {isAr
            ? "اختر النشاط أعلاه لعرض التقرير التنفيذي والمقارنات والجدول."
            : "Select an activity above for the executive report, charts, and register."}
        </div>
      ) : loading && !data ? (
        <div className="flex min-h-[12rem] items-center justify-center gap-2 py-16 text-slate-600">
          <Loader2 className="h-6 w-6 shrink-0 animate-spin" aria-hidden />
          <span>{isAr ? "جاري بناء التقرير…" : "Building report…"}</span>
        </div>
      ) : reportLoadError ? (
        <div
          className="rounded-2xl border border-red-200 bg-red-50/90 p-5 text-sm text-red-900"
          role="alert"
        >
          <p className="font-black">{isAr ? "تعذر تحميل التقرير" : "Could not load report"}</p>
          <p className="mt-2 leading-relaxed">{reportLoadError}</p>
        </div>
      ) : pick && !loading && !data ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm leading-relaxed text-slate-800">
          <p className="font-black text-slate-900">{isAr ? "لا توجد بيانات مطابقة" : "No matching analytics"}</p>
          <ul className="mt-3 list-disc space-y-2 ps-5 text-slate-700">
            <li>{isAr ? "جرّب إزالة فلاتر النتائج أو المستويات أو الفئات." : "Try clearing result, level, or category filters."}</li>
            <li>{isAr ? "جرّب عامًا دراسيًا مختلفًا إن وُجدت سجلات قديمة." : "Try a different academic year if older records exist."}</li>
            <li>{isAr ? "فعّل المقارنة بين نشاطين لرصد الفجوات." : "Enable two-activity compare to surface gaps."}</li>
          </ul>
          {onRelaxReportFilters ? (
            <button
              type="button"
              onClick={onRelaxReportFilters}
              className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              {isAr ? "تخفيف الفلاتر الشائعة" : "Relax common filters"}
            </button>
          ) : null}
        </div>
      ) : data ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
            <p className={CI_TYPOGRAPHY.micro}>{isAr ? "كثافة العرض" : "View density"}</p>
            <div className="flex flex-wrap items-center gap-2">
              <div
                className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm"
                role="group"
                aria-label={isAr ? "وضع العرض" : "View mode"}
              >
                <button
                  type="button"
                  onClick={() => handleViewDensityChange("executive")}
                  className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                    isExecutiveDensity ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"
                  }`}
                  aria-pressed={isExecutiveDensity}
                >
                  {isAr ? "تنفيذي" : "Executive"}
                </button>
                <button
                  type="button"
                  onClick={() => handleViewDensityChange("detailed")}
                  className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                    !isExecutiveDensity ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"
                  }`}
                  aria-pressed={!isExecutiveDensity}
                >
                  {isAr ? "تفصيلي" : "Detailed"}
                </button>
              </div>
              <button
                type="button"
                onClick={handleHighContrastToggle}
                aria-pressed={highContrast}
                className={`rounded-lg border px-3 py-1.5 text-xs font-bold shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  highContrast ? "border-black bg-black text-white" : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                }`}
              >
                {isAr ? "تباين عالٍ" : "High contrast"}
              </button>
            </div>
          </div>

          {data.kpis.totalRecords === 0 ? (
            <div
              className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-950"
              role="status"
            >
              <p className="font-black">{isAr ? emptyDatasetInsight?.primaryAr : emptyDatasetInsight?.primaryEn}</p>
              <p className="mt-2 text-xs leading-relaxed">
                {isAr
                  ? (emptyDatasetInsight?.hintsAr ?? []).join(" ")
                  : (emptyDatasetInsight?.hintsEn ?? []).join(" ")}
              </p>
              {onRelaxReportFilters ? (
                <button
                  type="button"
                  onClick={onRelaxReportFilters}
                  className="mt-3 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-950 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                >
                  {isAr ? "تخفيف الفلاتر" : "Relax filters"}
                </button>
              ) : null}
            </div>
          ) : null}
          <section
            className={`${CI_RADIUS.card} ${CI_SHADOW.hero} ${CI_SURFACE.hero} ${CI_SPACING.heroPad} print:break-inside-avoid`}
            aria-label={isAr ? "بطاقة تنفيذية" : "Executive hero"}
          >
            <h2 className={CI_TYPOGRAPHY.heroTitle} dir="auto">
              {isAr ? data.activityLabelAr : data.activityLabelEn}
            </h2>
            <p className={`mt-1 ${CI_TYPOGRAPHY.heroMeta}`}>
              {academicYearLine} · {outcomeLine}
            </p>
            {data.decisionPlatform?.alerts?.[0] ? (
              <div className="mt-3 rounded-xl border border-amber-200/90 bg-amber-50/90 p-3 text-xs text-amber-950">
                <span className="font-black">{isAr ? "أهم تنبيه" : "Top alert"}</span>
                <span className="mx-1 font-bold">—</span>
                <span className="font-bold">
                  {isAr ? data.decisionPlatform.alerts[0].titleAr : data.decisionPlatform.alerts[0].titleEn}
                </span>
                <p className="mt-1 line-clamp-2 text-[11px] leading-snug">
                  {isAr ? data.decisionPlatform.alerts[0].detailAr : data.decisionPlatform.alerts[0].detailEn}
                </p>
              </div>
            ) : null}
            {data.decisionPlatform ? (
              <>
                <p className={`mt-3 ${CI_TYPOGRAPHY.sectionHint}`}>
                  {isAr ? "ملخص تنفيذي (مختصر)" : "Executive snapshot"}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-slate-800 line-clamp-3" dir="auto">
                  {(isAr ? data.decisionPlatform.narrativeAr : data.decisionPlatform.narrativeEn).length > 280
                    ? `${(isAr ? data.decisionPlatform.narrativeAr : data.decisionPlatform.narrativeEn).slice(0, 277)}…`
                    : isAr
                      ? data.decisionPlatform.narrativeAr
                      : data.decisionPlatform.narrativeEn}
                </p>
                <details className="mt-2 text-xs text-slate-600">
                  <summary className="cursor-pointer font-bold text-indigo-800 outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-indigo-400">
                    {isAr ? "عرض الملخص الكامل" : "View full narrative"}
                  </summary>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-800" dir="auto">
                    {isAr ? data.decisionPlatform.narrativeAr : data.decisionPlatform.narrativeEn}
                  </p>
                </details>
              </>
            ) : null}
          </section>

          <section className={`grid gap-3 print:grid-cols-2 ${isExecutiveDensity ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-5"}`}>
            {(isExecutiveDensity ? data.executive.kpiCards.slice(0, 4) : data.executive.kpiCards).map((c) => (
              <KpiExecutiveCard
                key={c.id}
                isAr={isAr}
                icon={c.icon}
                label={isAr ? c.labelAr : c.labelEn}
                value={c.value}
                hint={isAr ? c.hintAr : c.hintEn}
                trendPct={c.trendPct}
                trendDir={c.trendDir}
                tone={c.tone}
              />
            ))}
          </section>

          <CollapsibleSection
            sectionId="decision"
            persistKey={CI_STORAGE_KEYS.collapse}
            title={isAr ? "ذكاء القرار والمعايير" : "Decision intelligence & benchmarks"}
            subtitle={isAr ? "تنبيهات، توصيات، ميداليات، مقارنة مرجعية، ترتيب الأنشطة." : "Alerts, recommendations, medals, benchmarks, activity ranking."}
            defaultOpen
          >
            {data.decisionPlatform ? (
              <CompetitionDecisionSections
                isAr={isAr}
                dp={data.decisionPlatform}
                activityLabel={isAr ? data.activityLabelAr : data.activityLabelEn}
                hideNarrative
              />
            ) : (
              <p className="text-xs text-slate-500">
                {isAr ? "لا تتوفر بيانات منصة القرار لهذا النشاط." : "No decision-platform payload for this activity."}
              </p>
            )}
          </CollapsibleSection>

          <CollapsibleSection
            sectionId="analytics"
            persistKey={CI_STORAGE_KEYS.collapse}
            title={isAr ? "التحليلات والرسوم" : "Analytics & charts"}
            subtitle={isAr ? "توزيع النتائج، السنوات، التركيبات الديموغرافية." : "Results mix, years, demographic composition."}
            defaultOpen={!isExecutiveDensity}
          >
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:break-inside-avoid">
              <h3 className="text-sm font-black text-slate-900">
                {isAr ? "توزيع النتائج" : "Result distribution"}
              </h3>
              <p className="text-[11px] text-slate-500">
                {isAr ? "دائري مع النسب المئوية" : "Donut with percentages"}
              </p>
              <div className="mt-2 h-64 min-h-[256px] w-full overflow-hidden" dir="ltr">
                <LazyChartMount
                  minHeight={256}
                  chartId="focused-result-donut"
                  fallback={
                    <div className="flex h-64 w-full items-center justify-center rounded-lg bg-slate-100 text-[11px] text-slate-500">
                      {isAr ? "مرورًا لعرض الرسم…" : "Scroll to load chart…"}
                    </div>
                  }
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={resultDonutData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={58}
                        outerRadius={82}
                        paddingAngle={2}
                        label={({ name, percent }) =>
                          `${String(name ?? "")} ${((percent ?? 0) * 100).toFixed(0)}%`
                        }
                      >
                        {resultDonutData.map((e) => (
                          <Cell key={e.key} fill={e.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value, _name, item) => {
                          const pct =
                            (item as { payload?: { pct?: number } } | undefined)?.payload?.pct ?? 0;
                          return [`${value} (${pct}%)`, isAr ? "العدد" : "Count"];
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </LazyChartMount>
              </div>
              <p className="mt-1 text-center text-xs font-bold text-slate-600">
                {isAr ? "الإجمالي" : "Total"}{" "}
                <span className="tabular-nums text-slate-900">
                  {resultDonutData.reduce((s, x) => s + x.value, 0)}
                </span>
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:break-inside-avoid">
              <h3 className="text-sm font-black text-slate-900">Year-over-year</h3>
              <p className="text-[11px] text-slate-500">
                {isAr ? "مقارنة مباشرة بين السنوات (ضمن النطاق)" : "Direct multi-year comparison (scope)"}
              </p>
              <div className="mt-2 h-64 min-h-[256px] w-full overflow-hidden" dir="ltr">
                <LazyChartMount
                  minHeight={256}
                  chartId="focused-yoy-bars"
                  fallback={
                    <div className="flex h-64 w-full items-center justify-center rounded-lg bg-slate-100 text-[11px] text-slate-500">
                      {isAr ? "مرورًا لعرض الرسم…" : "Scroll to load chart…"}
                    </div>
                  }
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={yoyChartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={ANJAL_CHART.grid} />
                      <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                      <YAxis yAxisId="a" tick={{ fontSize: 10 }} allowDecimals={false} />
                      <YAxis yAxisId="b" orientation="right" tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar
                        yAxisId="a"
                        dataKey="participants"
                        fill={ANJAL_CHART.anjalBlue}
                        name={isAr ? "طلاب" : "Students"}
                        radius={[6, 6, 0, 0]}
                      />
                      <Bar
                        yAxisId="a"
                        dataKey="medals"
                        fill={ANJAL_CHART.gold}
                        name={isAr ? "ميداليات" : "Medals"}
                        radius={[6, 6, 0, 0]}
                      />
                      <Bar
                        yAxisId="b"
                        dataKey="excellence"
                        fill={ANJAL_CHART.successGreen}
                        name={isAr ? "تميز %" : "Excellence %"}
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </LazyChartMount>
              </div>
            </div>
          </section>

          {!isExecutiveDensity ? (
          <section className="grid gap-4 lg:grid-cols-3 print:grid-cols-1">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-black text-slate-900">
                {isAr ? "عربي / دولي × الجنس" : "Section × gender"}
              </h3>
              <div className="mt-2 h-56 min-h-[220px] w-full overflow-hidden" dir="ltr">
                <LazyChartMount
                  minHeight={220}
                  chartId="focused-stack-section-gender"
                  fallback={<div className="h-56 animate-pulse rounded-lg bg-slate-100" aria-hidden />}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stackSection} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={ANJAL_CHART.grid} />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="male" stackId="a" fill={ANJAL_CHART.male} name={isAr ? "بنين" : "Male"} radius={[0, 0, 0, 0]} />
                      <Bar dataKey="female" stackId="a" fill={ANJAL_CHART.female} name={isAr ? "بنات" : "Female"} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </LazyChartMount>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-black text-slate-900">{isAr ? "موهبة × الجنس" : "Mawhiba × gender"}</h3>
              <div className="mt-2 h-56 min-h-[220px] w-full overflow-hidden" dir="ltr">
                <LazyChartMount
                  minHeight={220}
                  chartId="focused-stack-mawhiba-gender"
                  fallback={<div className="h-56 animate-pulse rounded-lg bg-slate-100" aria-hidden />}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stackMaw} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={ANJAL_CHART.grid} />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="male" stackId="m" fill={ANJAL_CHART.successGreen} name={isAr ? "بنين" : "Male"} />
                      <Bar dataKey="female" stackId="m" fill={ANJAL_CHART.nominationViolet} name={isAr ? "بنات" : "Female"} />
                    </BarChart>
                  </ResponsiveContainer>
                </LazyChartMount>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-black text-slate-900">{isAr ? "المراحل" : "Stages"}</h3>
              <div className="mt-2 h-56 min-h-[220px] w-full overflow-hidden" dir="ltr">
                <LazyChartMount
                  minHeight={220}
                  chartId="focused-stage-horizontal"
                  fallback={<div className="h-56 animate-pulse rounded-lg bg-slate-100" aria-hidden />}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stackStage} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={ANJAL_CHART.grid} horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="n" fill={ANJAL_CHART.participationBlue} name={isAr ? "عدد" : "Count"} radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </LazyChartMount>
              </div>
            </div>
          </section>
          ) : null}

          </CollapsibleSection>

          <CollapsibleSection
            sectionId="topPerformers"
            persistKey={CI_STORAGE_KEYS.collapse}
            title={isAr ? "أفضل الأداء" : "Top performers"}
            subtitle={isAr ? "مشاركة، ميداليات، مستوى إنجاز." : "Participation, medals, level profile."}
            defaultOpen={!isExecutiveDensity}
          >
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:break-inside-avoid">
            <div className="grid gap-4 lg:grid-cols-3">
              {(
                [
                  [isAr ? "أكثر مشاركة" : "Most participation", data.executive.topPerformers.byParticipation],
                  [isAr ? "أكثر ميداليات" : "Most medals", data.executive.topPerformers.byMedals],
                  [isAr ? "أعلى مستوى إنجاز" : "Highest level profile", data.executive.topPerformers.byLevel],
                ] as const
              ).map(([ttl, list]) => (
                <div key={ttl} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                  <p className="text-xs font-black text-slate-700">{ttl}</p>
                  <ul className="mt-2 space-y-2">
                    {list.slice(0, 5).map((row) => (
                      <li key={row.participantId} className="flex items-center gap-2 rounded-lg bg-white p-2 shadow-sm">
                        {row.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={row.avatarUrl}
                            alt=""
                            className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
                          />
                        ) : (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">
                            {(isAr ? row.nameAr : row.nameEn).slice(0, 1)}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-slate-900" dir="auto">
                            {isAr ? row.nameAr : row.nameEn}
                          </p>
                          <p className="truncate text-[10px] text-slate-500" dir="auto">
                            {row.school} · {isAr ? row.stageLabelAr : row.stageLabelEn}
                          </p>
                          <p className="text-[10px] font-semibold tabular-nums text-slate-700">
                            {isAr ? "سجلات" : "Rec"} {row.recordCount}
                            {row.medalCount > 0 ? ` · ${isAr ? "ميداليات" : "Med"} ${row.medalCount}` : ""}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
          </CollapsibleSection>

          <CollapsibleSection
            sectionId="participants"
            persistKey={CI_STORAGE_KEYS.collapse}
            title={isAr ? "جدول المشاركين" : "Participant register"}
            subtitle={isAr ? "فرز، بحث، تصدير دفعات." : "Sort, search, and batch export."}
            defaultOpen
          >
          <section
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:border-0"
            aria-label={isAr ? "جدول المشاركين" : "Participant register"}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 print:hidden">
                <button
                  type="button"
                  onClick={() => setTableDensity((d) => (d === "normal" ? "compact" : "normal"))}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold"
                  aria-pressed={tableDensity === "compact"}
                >
                  {tableDensity === "compact"
                    ? isAr
                      ? "كثافة: مدمج"
                      : "Density: compact"
                    : isAr
                      ? "كثافة: عادي"
                      : "Density: comfortable"}
                </button>
                <input
                  value={tableQuery}
                  onChange={(e) => setTableQuery(e.target.value)}
                  placeholder={isAr ? "بحث في الصفحة الحالية…" : "Search current page…"}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
                  aria-label={isAr ? "بحث الجدول" : "Table search"}
                />
                <button
                  type="button"
                  disabled={selectedIds.size === 0}
                  onClick={handleExportSelection}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold disabled:opacity-40"
                >
                  {isAr ? "Excel المحدد" : "Excel selected"}
                </button>
                <button
                  type="button"
                  disabled={selectedIds.size === 0}
                  onClick={handleExportSelectionPdf}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold disabled:opacity-40"
                >
                  {isAr ? "PDF المحدد" : "PDF selected"}
                </button>
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {isAr
                ? `صفحة ${page} من ${totalPages} · الفرز والبحث للصفحة الحالية${virtEnabled ? " · عرض افتراضي للصفوف لتسريع التمرير" : ""}`
                : `Page ${page} of ${totalPages} · Sort/search apply to current page${virtEnabled ? " · virtualized scrolling" : ""}`}
            </p>
            <div
              ref={tableScrollRef}
              className="relative mt-3 max-h-[min(70vh,520px)] min-h-[120px] overflow-auto rounded-lg border border-slate-100"
            >
              <table className="w-full min-w-[1100px] border-collapse text-left text-xs">
                <thead className="sticky top-0 z-20 bg-slate-100 shadow-sm">
                  <tr className="border-b border-slate-200 text-slate-800">
                    <th className={`whitespace-nowrap font-bold print:hidden ${rowPad}`}>
                      <input
                        type="checkbox"
                        aria-label={isAr ? "تحديد الظاهر" : "Select all visible"}
                        checked={
                          processedParticipants.length > 0 &&
                          processedParticipants.every((r) => selectedIds.has(r.achievementId))
                        }
                        onChange={toggleAllVisible}
                      />
                    </th>
                    {(
                      [
                        [isAr ? "الاسم" : "Name", "name" as const],
                        [isAr ? "النتيجة" : "Result", "result" as const],
                        [isAr ? "المستوى" : "Level", "level" as const],
                        [isAr ? "الدرجة" : "Score", "score" as const],
                        [isAr ? "السنة" : "Year", "year" as const],
                      ] as const
                    ).map(([lbl, key]) => (
                      <th key={key} className={`whitespace-nowrap font-bold ${rowPad}`}>
                        <button
                          type="button"
                          className="text-start font-bold hover:text-primary"
                          onClick={() => toggleSort(key)}
                        >
                          {lbl}
                          {sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                        </button>
                      </th>
                    ))}
                    <th className={`whitespace-nowrap font-bold ${rowPad}`}>{isAr ? "القسم" : "Section"}</th>
                    <th className={`whitespace-nowrap font-bold ${rowPad}`}>{isAr ? "موهبة" : "Mawhiba"}</th>
                    <th className={`whitespace-nowrap font-bold ${rowPad}`}>{isAr ? "الصف" : "Grade"}</th>
                    <th className={`whitespace-nowrap font-bold ${rowPad}`}>{isAr ? "المدرسة" : "School"}</th>
                    <th className={`whitespace-nowrap font-bold ${rowPad}`}>{isAr ? "الاعتماد" : "Approval"}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={12} className="px-2 py-8 text-center text-slate-500">
                        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                        {isAr ? "جاري التحميل…" : "Loading…"}
                      </td>
                    </tr>
                  ) : processedParticipants.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="px-2 py-8 text-center text-slate-500">
                        {isAr ? "لا صفوف." : "No rows."}
                      </td>
                    </tr>
                  ) : (
                    <>
                      {virtEnabled ? (
                        <tr aria-hidden>
                          <td colSpan={12} style={{ height: virtPadTop, padding: 0, border: 0 }} />
                        </tr>
                      ) : null}
                      {visibleParticipants.map((r, idx) => {
                        const globalIdx = virtEnabled ? virtWindow.start + idx : idx;
                        const zebra = globalIdx % 2 === 1 ? "bg-slate-50/40" : "";
                        const picked = selectedIds.has(r.achievementId)
                          ? "ring-1 ring-inset ring-indigo-400 bg-indigo-50/60"
                          : "";
                        return (
                          <tr
                            key={r.achievementId}
                            className={`border-b border-slate-100 hover:bg-slate-50/80 ${zebra} ${picked}`}
                          >
                            <td className={`print:hidden ${rowPad}`}>
                              <input
                                type="checkbox"
                                checked={selectedIds.has(r.achievementId)}
                                onChange={() => toggleRow(r.achievementId)}
                                aria-label={isAr ? "تحديد" : "Select"}
                              />
                            </td>
                            <td className={`max-w-[160px] font-semibold text-slate-900 ${rowPad}`} dir="auto">
                              {isAr ? r.studentNameAr : r.studentNameEn}
                            </td>
                            <td className={rowPad}>{isAr ? r.resultLineAr : r.resultLineEn}</td>
                            <td className={rowPad}>{isAr ? r.levelLabelAr : r.levelLabelEn}</td>
                            <td className={`${rowPad} tabular-nums`}>{r.scoreOrValueDisplay}</td>
                            <td className={`${rowPad} tabular-nums`}>{r.year ?? "—"}</td>
                            <td className={rowPad}>{isAr ? (r.section === "international" ? "دولي" : "عربي") : r.section}</td>
                            <td className={rowPad}>{r.mawhiba ? (isAr ? "موهبة" : "Yes") : isAr ? "لا" : "No"}</td>
                            <td className={rowPad}>{isAr ? r.gradeLabelAr : r.gradeLabelEn}</td>
                            <td className={`max-w-[140px] ${rowPad}`} dir="auto">
                              {r.schoolOrOrganization}
                            </td>
                            <td className={rowPad}>{isAr ? r.approvalLabelAr : r.approvalLabelEn}</td>
                          </tr>
                        );
                      })}
                      {virtEnabled ? (
                        <tr aria-hidden>
                          <td colSpan={12} style={{ height: virtPadBottom, padding: 0, border: 0 }} />
                        </tr>
                      ) : null}
                    </>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-wrap justify-between gap-2 print:hidden">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => onPageChange(Math.max(1, page - 1))}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold disabled:opacity-40"
              >
                {isAr ? "السابق" : "Prev"}
              </button>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => onPageChange(page + 1)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold disabled:opacity-40"
              >
                {isAr ? "التالي" : "Next"}
              </button>
            </div>
          </section>
          </CollapsibleSection>
        </>
      ) : null}
    </div>
  );
});

FocusedExecutiveIntelligencePanel.displayName = "FocusedExecutiveIntelligencePanel";