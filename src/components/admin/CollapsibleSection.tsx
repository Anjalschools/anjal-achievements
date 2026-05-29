"use client";

import React, { memo, useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

export const CollapsibleSection = memo(
  ({
    sectionId,
    title,
    subtitle,
    defaultOpen = true,
    persistKey,
    children,
    className = "",
  }: {
    sectionId: string;
    title: string;
    subtitle?: string;
    defaultOpen?: boolean;
    /** Base key in localStorage; full key = `${persistKey}:${sectionId}` */
    persistKey?: string;
    children: React.ReactNode;
    className?: string;
  }) => {
    const storageFullKey = persistKey ? `${persistKey}:${sectionId}` : null;
    const [open, setOpen] = useState(() => {
      if (typeof window === "undefined" || !storageFullKey) return defaultOpen;
      try {
        const v = localStorage.getItem(storageFullKey);
        if (v === "0") return false;
        if (v === "1") return true;
      } catch {
        /* ignore */
      }
      return defaultOpen;
    });

    useEffect(() => {
      if (!storageFullKey) return;
      try {
        localStorage.setItem(storageFullKey, open ? "1" : "0");
      } catch {
        /* ignore */
      }
    }, [storageFullKey, open]);

    return (
      <section
        className={`overflow-hidden rounded-2xl border border-slate-200/90 bg-white ${className}`}
        aria-labelledby={`ci-h-${sectionId}`}
      >
        <div className="flex items-stretch gap-0">
          <button
            type="button"
            id={`ci-h-${sectionId}`}
            aria-expanded={open}
            className="flex flex-1 items-center justify-between gap-2 px-4 py-3 text-start print:hidden"
            onClick={() => setOpen((o) => !o)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setOpen((o) => !o);
              }
            }}
          >
            <div className="min-w-0">
              <h2 className="text-sm font-black text-slate-900">{title}</h2>
              {subtitle ? <p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p> : null}
            </div>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>
        </div>
        <div
          className={`overflow-hidden px-4 pb-4 transition-[opacity,max-height] duration-300 ease-out print:!max-h-none print:!opacity-100 ${
            open ? "max-h-[8000px] opacity-100" : "max-h-0 opacity-0 print:!max-h-none print:!opacity-100"
          }`}
        >
          {children}
        </div>
      </section>
    );
  }
);
CollapsibleSection.displayName = "CollapsibleSection";
