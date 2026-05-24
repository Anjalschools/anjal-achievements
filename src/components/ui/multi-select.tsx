"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { toggleMultiFilterValue } from "@/lib/analytics/multi-filter-utils";

export type MultiSelectOption = { value: string; label: string };

export type MultiSelectProps = {
  options: MultiSelectOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  label?: string;
  disabled?: boolean;
  className?: string;
  /** Max label chips to show before "+N" */
  maxVisibleChips?: number;
  includeSelectAll?: boolean;
  includeClear?: boolean;
  selectAllLabel: string;
  clearLabel: string;
  isRtl: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Allow removing chips from the trigger button */
  removableChips?: boolean;
  /** Virtual window size for long option lists */
  virtualWindow?: number;
};

const MultiSelect = ({
  options,
  value,
  onChange,
  placeholder,
  label,
  disabled = false,
  className = "",
  maxVisibleChips = 2,
  includeSelectAll = true,
  includeClear = true,
  selectAllLabel,
  clearLabel,
  isRtl,
  searchable = false,
  searchPlaceholder,
  removableChips = true,
  virtualWindow = 120,
}: MultiSelectProps) => {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedSet = useMemo(() => new Set(value), [value]);
  const labelByValue = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of options) m.set(o.value, o.label);
    return m;
  }, [options]);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
    );
  }, [options, query]);

  const visibleOptions = useMemo(() => {
    const start = Math.max(0, highlightIndex - Math.floor(virtualWindow / 2));
    return filteredOptions.slice(start, start + virtualWindow);
  }, [filteredOptions, highlightIndex, virtualWindow]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [query, open]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector('[data-active="true"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex, open]);

  const toggleValue = useCallback(
    (v: string) => {
      onChange(toggleMultiFilterValue(value, v));
    },
    [onChange, value]
  );

  const handleRemoveChip = useCallback(
    (e: React.MouseEvent, v: string) => {
      e.stopPropagation();
      onChange(value.filter((x) => x !== v));
    },
    [onChange, value]
  );

  const handleSelectAll = useCallback(() => {
    onChange([]);
    setOpen(false);
  }, [onChange]);

  const handleClear = useCallback(() => {
    onChange([]);
  }, [onChange]);

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
      setHighlightIndex((i) => Math.min(i + 1, filteredOptions.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    }
    if (e.key === "Enter" && filteredOptions[highlightIndex]) {
      e.preventDefault();
      toggleValue(filteredOptions[highlightIndex].value);
    }
  };

  const renderChip = (v: string, key: string | number) => {
    const text = labelByValue.get(v) || v;
    return (
      <span
        key={key}
        className="inline-flex max-w-[140px] items-center gap-0.5 rounded-lg bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"
      >
        <span className="truncate">{text}</span>
        {removableChips ? (
          <button
            type="button"
            aria-label={isRtl ? `إزالة ${text}` : `Remove ${text}`}
            onClick={(e) => handleRemoveChip(e, v)}
            className="shrink-0 rounded p-0.5 hover:bg-primary/20"
          >
            <X className="h-3 w-3" aria-hidden />
          </button>
        ) : null}
      </span>
    );
  };

  return (
    <div ref={rootRef} className={`relative ${className}`} dir={isRtl ? "rtl" : "ltr"}>
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
            <span className="text-text-light">{placeholder}</span>
          ) : value.length === 1 ? (
            renderChip(value[0], 0)
          ) : value.length <= maxVisibleChips ? (
            <span className="flex flex-wrap gap-1">{value.map((v, i) => renderChip(v, i))}</span>
          ) : (
            <span className="flex flex-wrap items-center gap-1">
              {value.slice(0, maxVisibleChips).map((v, i) => renderChip(v, i))}
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
        <div className="absolute left-0 right-0 z-[80] mt-1 max-h-72 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg ring-1 ring-black/5">
          {searchable ? (
            <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-text-light" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={searchPlaceholder || (isRtl ? "بحث..." : "Search...")}
                aria-label={isRtl ? "بحث" : "Search"}
                className="min-w-0 flex-1 border-0 bg-transparent text-sm text-text outline-none placeholder:text-text-light"
                autoFocus
              />
            </div>
          ) : null}
          <div ref={listRef} className="max-h-60 overflow-auto py-1" role="listbox" aria-multiselectable>
            {includeSelectAll ? (
              <button
                type="button"
                role="option"
                aria-selected={value.length === 0}
                onClick={handleSelectAll}
                className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm font-semibold text-primary hover:bg-primary/5"
              >
                <span className="flex h-4 w-4 items-center justify-center rounded border border-primary/40 bg-primary/10">
                  {value.length === 0 ? <Check className="h-3 w-3 text-primary" aria-hidden /> : null}
                </span>
                {selectAllLabel}
              </button>
            ) : null}
            {includeClear && value.length > 0 ? (
              <button
                type="button"
                onClick={handleClear}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-start text-xs font-semibold text-text-light hover:bg-gray-50"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                {clearLabel}
              </button>
            ) : null}
            {(includeSelectAll || (includeClear && value.length > 0)) ? (
              <div className="border-t border-gray-100" />
            ) : null}
            {filteredOptions.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-text-light">
                {isRtl ? "لا توجد خيارات مطابقة." : "No matching options."}
              </p>
            ) : (
              visibleOptions.map((opt) => {
                const checked = selectedSet.has(opt.value);
                const flatIdx = filteredOptions.findIndex((x) => x.value === opt.value);
                const active = flatIdx === highlightIndex;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={checked}
                    data-active={active ? "true" : undefined}
                    onMouseEnter={() => setHighlightIndex(flatIdx)}
                    onClick={() => toggleValue(opt.value)}
                    className={`flex w-full items-start gap-2 px-3 py-2 text-start text-sm hover:bg-gray-50 ${
                      active ? "bg-primary/5" : ""
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        checked ? "border-primary bg-primary text-white" : "border-gray-300 bg-white"
                      }`}
                    >
                      {checked ? <Check className="h-3 w-3" aria-hidden /> : null}
                    </span>
                    <span className="min-w-0 flex-1 leading-snug text-text">{opt.label}</span>
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

export default MultiSelect;
