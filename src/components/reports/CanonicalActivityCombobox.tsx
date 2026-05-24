"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, Search } from "lucide-react";

export type CanonicalActivityOption = {
  canonicalKey: string;
  displayNameAr: string;
  displayNameEn: string;
  category: string;
  groupLabelAr: string;
  groupLabelEn: string;
  rowCount: number;
  studentCount: number;
};

export type CanonicalActivityComboboxProps = {
  value: string;
  onChange: (canonicalKey: string) => void;
  fetchParams: Record<string, string>;
  isAr: boolean;
  label?: string;
  disabled?: boolean;
  className?: string;
};

const VIRTUAL_WINDOW = 80;

const CanonicalActivityCombobox = ({
  value,
  onChange,
  fetchParams,
  isAr,
  label,
  disabled = false,
  className = "",
}: CanonicalActivityComboboxProps) => {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [options, setOptions] = useState<CanonicalActivityOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const cacheRef = useRef<Map<string, CanonicalActivityOption[]>>(new Map());

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(t);
  }, [query]);

  const paramsKey = useMemo(() => JSON.stringify(fetchParams), [fetchParams]);

  const loadOptions = useCallback(async () => {
    const cacheKey = `${paramsKey}\u001f${debouncedQuery}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setOptions(cached);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams(fetchParams);
      if (debouncedQuery) params.set("q", debouncedQuery);
      params.set("limit", "300");
      const res = await fetch(
        `/api/admin/achievements/reports/activity-options?${params.toString()}`,
        { cache: "no-store" }
      );
      const j = (await res.json().catch(() => ({}))) as {
        options?: CanonicalActivityOption[];
      };
      const list = Array.isArray(j.options) ? j.options : [];
      cacheRef.current.set(cacheKey, list);
      if (cacheRef.current.size > 40) {
        const first = cacheRef.current.keys().next().value;
        if (first) cacheRef.current.delete(first);
      }
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

  const labelByKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of options) {
      m.set(o.canonicalKey, isAr ? o.displayNameAr : o.displayNameEn);
    }
    return m;
  }, [options, isAr]);

  const selectedLabel =
    value === "all"
      ? isAr
        ? "الكل"
        : "All"
      : labelByKey.get(value) || value.replace(/_/g, " ");

  const grouped = useMemo(() => {
    const m = new Map<string, CanonicalActivityOption[]>();
    for (const o of options) {
      const g = isAr ? o.groupLabelAr : o.groupLabelEn;
      const arr = m.get(g) || [];
      arr.push(o);
      m.set(g, arr);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b, isAr ? "ar" : "en"));
  }, [options, isAr]);

  const flatOptions = useMemo(() => grouped.flatMap(([, items]) => items), [grouped]);

  const visibleSlice = useMemo(() => {
    const start = Math.max(0, highlightIndex - Math.floor(VIRTUAL_WINDOW / 2));
    return flatOptions.slice(start, start + VIRTUAL_WINDOW);
  }, [flatOptions, highlightIndex]);

  const handleSelect = (key: string) => {
    onChange(key);
    setOpen(false);
    setQuery("");
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
      setHighlightIndex((i) => Math.min(i + 1, flatOptions.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    }
    if (e.key === "Enter" && flatOptions[highlightIndex]) {
      e.preventDefault();
      handleSelect(flatOptions[highlightIndex].canonicalKey);
    }
  };

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector('[data-active="true"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex, open]);

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
        <span className="min-w-0 flex-1 truncate font-medium">{selectedLabel}</span>
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
              placeholder={isAr ? "ابحث عن نشاط..." : "Search activity..."}
              aria-label={isAr ? "بحث" : "Search"}
              className="min-w-0 flex-1 border-0 bg-transparent text-sm text-text outline-none placeholder:text-text-light"
              autoFocus
            />
            {loading ? <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden /> : null}
          </div>
          <div
            ref={listRef}
            role="listbox"
            className="max-h-72 overflow-auto py-1"
            aria-activedescendant={
              flatOptions[highlightIndex]
                ? `activity-opt-${flatOptions[highlightIndex].canonicalKey}`
                : undefined
            }
          >
            <button
              type="button"
              role="option"
              aria-selected={value === "all"}
              onClick={() => handleSelect("all")}
              className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm font-semibold text-primary hover:bg-primary/5"
            >
              <span className="flex h-4 w-4 items-center justify-center rounded border border-primary/40">
                {value === "all" ? <Check className="h-3 w-3 text-primary" aria-hidden /> : null}
              </span>
              {isAr ? "الكل" : "All"}
            </button>
            {flatOptions.length === 0 && !loading ? (
              <p className="px-3 py-4 text-center text-xs text-text-light">
                {isAr ? "لا توجد أنشطة مطابقة." : "No matching activities."}
              </p>
            ) : (
              grouped.map(([groupLabel, items]) => {
                const visibleKeys = new Set(visibleSlice.map((x) => x.canonicalKey));
                const groupItems = items.filter((x) => visibleKeys.has(x.canonicalKey));
                if (groupItems.length === 0 && debouncedQuery) return null;
                return (
                  <div key={groupLabel}>
                    <p className="sticky top-0 z-[1] bg-gray-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-text-light">
                      {groupLabel}
                    </p>
                    {(debouncedQuery ? items : groupItems).map((opt) => {
                      const flatIdx = flatOptions.findIndex((x) => x.canonicalKey === opt.canonicalKey);
                      const checked = value === opt.canonicalKey;
                      const active = flatIdx === highlightIndex;
                      return (
                        <button
                          key={opt.canonicalKey}
                          id={`activity-opt-${opt.canonicalKey}`}
                          type="button"
                          role="option"
                          aria-selected={checked}
                          data-active={active ? "true" : undefined}
                          onMouseEnter={() => setHighlightIndex(flatIdx)}
                          onClick={() => handleSelect(opt.canonicalKey)}
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
                              {isAr ? opt.displayNameAr : opt.displayNameEn}
                            </span>
                            <span className="mt-0.5 block text-[10px] text-text-light">
                              {isAr
                                ? `${opt.studentCount} طالب · ${opt.rowCount} سجل`
                                : `${opt.studentCount} students · ${opt.rowCount} records`}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default CanonicalActivityCombobox;
