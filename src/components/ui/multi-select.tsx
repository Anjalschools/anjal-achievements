"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";

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
}: MultiSelectProps) => {
  const id = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selectedSet = useMemo(() => new Set(value), [value]);
  const labelByValue = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of options) m.set(o.value, o.label);
    return m;
  }, [options]);

  const summary = useMemo(() => {
    if (value.length === 0) return { mode: "empty" as const };
    if (value.length === 1) return { mode: "one" as const, text: labelByValue.get(value[0]) || value[0] };
    if (value.length <= maxVisibleChips) {
      return {
        mode: "few" as const,
        parts: value.map((v) => labelByValue.get(v) || v),
      };
    }
    const shown = value.slice(0, maxVisibleChips).map((v) => labelByValue.get(v) || v);
    const rest = value.length - maxVisibleChips;
    return { mode: "many" as const, shown, rest };
  }, [value, labelByValue, maxVisibleChips]);

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

  const toggleValue = useCallback(
    (v: string) => {
      const next = new Set(value);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      onChange([...next]);
    },
    [onChange, value]
  );

  const handleSelectAll = useCallback(() => {
    onChange([]);
  }, [onChange]);

  const handleClear = useCallback(() => {
    onChange([]);
  }, [onChange]);

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
        className="flex min-h-[42px] w-full items-center justify-between gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2 text-start text-sm text-text shadow-sm transition hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="min-w-0 flex-1">
          {summary.mode === "empty" ? (
            <span className="text-text-light">{placeholder}</span>
          ) : summary.mode === "one" ? (
            <span className="font-medium text-text">{summary.text}</span>
          ) : summary.mode === "few" ? (
            <span className="flex flex-wrap gap-1">
              {summary.parts.map((p, i) => (
                <span
                  key={i}
                  className="max-w-[140px] truncate rounded-lg bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"
                >
                  {p}
                </span>
              ))}
            </span>
          ) : (
            <span className="flex flex-wrap items-center gap-1">
              {summary.shown.map((p, i) => (
                <span
                  key={i}
                  className="max-w-[120px] truncate rounded-lg bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"
                >
                  {p}
                </span>
              ))}
              <span className="rounded-lg bg-gray-100 px-2 py-0.5 text-xs font-bold text-text">
                +{summary.rest}
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
        <div
          role="listbox"
          aria-multiselectable
          className="absolute left-0 right-0 z-[80] mt-1 max-h-64 overflow-auto rounded-xl border border-gray-200 bg-white py-2 shadow-lg ring-1 ring-black/5"
        >
          {includeSelectAll ? (
            <button
              type="button"
              role="option"
              aria-selected={value.length === 0}
              onClick={() => {
                handleSelectAll();
                setOpen(false);
              }}
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
              onClick={() => {
                handleClear();
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-start text-xs font-semibold text-text-light hover:bg-gray-50"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              {clearLabel}
            </button>
          ) : null}
          <div className="border-t border-gray-100" />
          {options.map((opt) => {
            const checked = selectedSet.has(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={checked}
                onClick={() => toggleValue(opt.value)}
                className="flex w-full items-start gap-2 px-3 py-2 text-start text-sm hover:bg-gray-50"
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
          })}
        </div>
      ) : null}
    </div>
  );
};

export default MultiSelect;
