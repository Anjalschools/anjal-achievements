"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, Search, X } from "lucide-react";
import { toggleMultiFilterValue } from "@/lib/analytics/multi-filter-utils";

export type ActivityYearOption = {
  year: number;
  labelAr: string;
  labelEn: string;
  rowCount: number;
  studentCount: number;
};

export type ActivityYearComboboxProps = {
  value: string[];
  onChange: (years: string[]) => void;
  fetchParams: Record<string, string>;
  isAr: boolean;
  label?: string;
  disabled?: boolean;
  className?: string;
  maxVisibleChips?: number;
};

const ActivityYearCombobox = ({
  value,
  onChange,
  fetchParams,
  isAr,
  label,
  disabled = false,
  className = "",
  maxVisibleChips = 2,
}: ActivityYearComboboxProps) => {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [options, setOptions] = useState<ActivityYearOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const cacheRef = useRef<Map<string, { at: number; list: ActivityYearOption[] }>>(new Map());
  const CACHE_TTL_MS = 10 * 60_000;

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query.trim()), 400);
    return () => window.clearTimeout(t);
  }, [query]);

  const paramsKey = useMemo(() => JSON.stringify(fetchParams), [fetchParams]);
  const selectedSet = useMemo(() => new Set(value), [value]);

  const loadOptions = useCallback(async () => {
    const cacheKey = `${paramsKey}\u001f${debouncedQuery}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      setOptions(cached.list);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams(fetchParams);
      if (debouncedQuery) params.set("q", debouncedQuery);
      const res = await fetch(
        `/api/admin/achievements/reports/activity-years?${params.toString()}`,
        { cache: "no-store" }
      );
      const j = (await res.json().catch(() => ({}))) as { options?: ActivityYearOption[] };
      const list = Array.isArray(j.options) ? j.options : [];
      cacheRef.current.set(cacheKey, { at: Date.now(), list });
      setOptions(list);
    } catch {
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, fetchParams, paramsKey]);

  useEffect(() => {
    if (!open) return;
    void loadOptions();
  }, [open, loadOptions]);

  useEffect(() => {
    cacheRef.current.clear();
    if (open) void loadOptions();
  }, [paramsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const labelByYear = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of options) {
      m.set(String(o.year), isAr ? o.labelAr : o.labelEn);
    }
    for (const y of value) {
      if (!m.has(y)) m.set(y, isAr ? `${y}م` : y);
    }
    return m;
  }, [options, value, isAr]);

  const filtered = useMemo(() => {
    if (!debouncedQuery) return options;
    return options.filter((o) => String(o.year).includes(debouncedQuery));
  }, [options, debouncedQuery]);

  const handleToggle = (year: string) => {
    onChange(toggleMultiFilterValue(value, year));
  };

  const handleRemoveChip = (e: React.MouseEvent, year: string) => {
    e.stopPropagation();
    onChange(value.filter((x) => x !== year));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    }
    if (e.key === "Enter" && filtered[highlightIndex]) {
      e.preventDefault();
      handleToggle(String(filtered[highlightIndex].year));
    }
  };

  const renderChip = (year: string, idx: number) => {
    const text = labelByYear.get(year) || year;
    return (
      <span
        key={idx}
        className="inline-flex max-w-[120px] items-center gap-0.5 rounded-lg bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"
      >
        <span className="truncate">{text}</span>
        <button
          type="button"
          aria-label={isAr ? `إزالة ${text}` : `Remove ${text}`}
          onClick={(e) => handleRemoveChip(e, year)}
          className="shrink-0 rounded p-0.5 hover:bg-primary/20"
        >
          <X className="h-3 w-3" aria-hidden />
        </button>
      </span>
    );
  };

  return (
    <div ref={rootRef} className={`relative ${className}`} dir={isAr ? "rtl" : "ltr"}>
      {label ? (
        <span id={`${id}-label`} className="mb-1 block text-xs font-semibold text-text-light">
          {label}
        </span>
      ) : null}
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-labelledby={label ? `${id}-label` : undefined}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={handleKeyDown}
        className="flex min-h-[42px] w-full items-center justify-between gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2 text-start text-sm text-text shadow-sm transition hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="min-w-0 flex-1">
          {value.length === 0 ? (
            <span className="text-text-light">{isAr ? "اختر سنة" : "Select year"}</span>
          ) : value.length <= maxVisibleChips ? (
            <span className="flex flex-wrap gap-1">{value.map((y, i) => renderChip(y, i))}</span>
          ) : (
            <span className="flex flex-wrap items-center gap-1">
              {value.slice(0, maxVisibleChips).map((y, i) => renderChip(y, i))}
              <span className="rounded-lg bg-gray-100 px-2 py-0.5 text-xs font-bold text-text">
                +{value.length - maxVisibleChips}
              </span>
            </span>
          )}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-text-light transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 z-[80] mt-1 rounded-xl border border-gray-200 bg-white shadow-lg ring-1 ring-black/5">
          <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-text-light" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlightIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder={isAr ? "ابحث عن سنة..." : "Search year..."}
              aria-label={isAr ? "بحث" : "Search"}
              className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none"
              autoFocus
            />
            {loading ? <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden /> : null}
          </div>
          <div role="listbox" aria-multiselectable className="max-h-60 overflow-auto py-1">
            <button
              type="button"
              role="option"
              aria-selected={value.length === 0}
              onClick={() => onChange([])}
              className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm font-semibold text-primary hover:bg-primary/5"
            >
              <span className="flex h-4 w-4 items-center justify-center rounded border border-primary/40">
                {value.length === 0 ? <Check className="h-3 w-3 text-primary" aria-hidden /> : null}
              </span>
              {isAr ? "الكل" : "All"}
            </button>
            {value.length > 0 ? (
              <button
                type="button"
                onClick={() => onChange([])}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-start text-xs font-semibold text-text-light hover:bg-gray-50"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                {isAr ? "مسح الكل" : "Clear all"}
              </button>
            ) : null}
            <div className="border-t border-gray-100" />
            {filtered.length === 0 && !loading ? (
              <p className="px-3 py-4 text-center text-xs text-text-light">
                {isAr ? "لا توجد سنوات مطابقة." : "No matching years."}
              </p>
            ) : (
              filtered.map((opt, idx) => {
                const key = String(opt.year);
                const checked = selectedSet.has(key);
                const active = idx === highlightIndex;
                return (
                  <button
                    key={key}
                    type="button"
                    role="option"
                    aria-selected={checked}
                    data-active={active ? "true" : undefined}
                    onMouseEnter={() => setHighlightIndex(idx)}
                    onClick={() => handleToggle(key)}
                    className={`flex w-full items-start gap-2 px-3 py-2 text-start text-sm hover:bg-gray-50 ${
                      active ? "bg-primary/5" : ""
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        checked ? "border-primary bg-primary text-white" : "border-gray-300"
                      }`}
                    >
                      {checked ? <Check className="h-3 w-3" aria-hidden /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-text">
                        {isAr ? opt.labelAr : opt.labelEn}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-text-light">
                        {isAr
                          ? `${opt.studentCount} طالب · ${opt.rowCount} سجل`
                          : `${opt.studentCount} students · ${opt.rowCount} records`}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ActivityYearCombobox;
