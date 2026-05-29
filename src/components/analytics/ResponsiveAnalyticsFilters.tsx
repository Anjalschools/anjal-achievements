"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Filter, X } from "lucide-react";
import type { AnalyticsMultiFilterPanelProps } from "@/components/analytics/AnalyticsMultiFilterPanel";
import AnalyticsMultiFilterPanel from "@/components/analytics/AnalyticsMultiFilterPanel";

export type ResponsiveAnalyticsFiltersProps = AnalyticsMultiFilterPanelProps;

const ResponsiveAnalyticsFilters = (props: ResponsiveAnalyticsFiltersProps) => {
  const { isAr } = props;
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const drawer = (children: ReactNode) => (
    <>
      <div
        className={`fixed inset-0 z-50 bg-slate-900/40 sm:hidden ${mobileOpen ? "" : "pointer-events-none opacity-0"}`}
        role="presentation"
        onClick={() => setMobileOpen(false)}
        aria-hidden={!mobileOpen}
      />
      <div
        className={`fixed inset-y-0 z-50 flex w-[min(100%,22rem)] flex-col bg-white shadow-xl transition-transform sm:hidden ${
          isAr ? "right-0" : "left-0"
        } ${mobileOpen ? "translate-x-0" : isAr ? "translate-x-full" : "-translate-x-full"}`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!mobileOpen}
        aria-label={isAr ? "فلاتر التحليل" : "Analytics filters"}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <span className="text-sm font-black text-slate-900">{isAr ? "الفلاتر" : "Filters"}</span>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-2 hover:bg-slate-100"
            aria-label={isAr ? "إغلاق" : "Close"}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">{children}</div>
        <div className="sticky bottom-0 border-t border-slate-200 bg-white p-3">
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white"
          >
            {isAr ? "تطبيق" : "Apply"}
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      <div className="hidden sm:block">
        <AnalyticsMultiFilterPanel {...props} />
      </div>
      <div className="sm:hidden print:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 shadow-sm"
          aria-expanded={mobileOpen}
          aria-haspopup="dialog"
        >
          <Filter className="h-4 w-4" aria-hidden />
          {isAr ? "فلاتر التحليل" : "Analytics filters"}
        </button>
        {drawer(<AnalyticsMultiFilterPanel {...props} />)}
      </div>
    </>
  );
};

export default ResponsiveAnalyticsFilters;
