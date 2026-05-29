"use client";

import { memo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import AnalyticsFilterBreadcrumb from "@/components/analytics/AnalyticsFilterBreadcrumb";
import type { ExecutiveFilterSnapshot } from "@/lib/competition-intelligence-persistence";

export type GlobalAnalyticsNavigationProps = {
  isAr: boolean;
  f: ExecutiveFilterSnapshot;
  onClear?: () => void;
  backHref?: string;
  backLabel?: string;
  /** inline: compact breadcrumb without sticky offset */
  variant?: "sticky" | "inline";
};

const GlobalAnalyticsNavigation = memo(
  ({ isAr, f, onClear, backHref, backLabel, variant = "inline" }: GlobalAnalyticsNavigationProps) => {
    const router = useRouter();

    const handleBack = useCallback(() => {
      if (backHref) {
        router.push(backHref);
        return;
      }
      router.back();
    }, [backHref, router]);

    const shellClass =
      variant === "sticky"
        ? "sticky top-0 z-40 border-b border-slate-200/90 bg-white/95 backdrop-blur-md"
        : "rounded-xl border border-slate-200/80 bg-slate-50/90";

    return (
      <div className={`${shellClass} print:hidden`} dir={isAr ? "rtl" : "ltr"}>
        <div className="flex flex-wrap items-center gap-2 px-1 py-2">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            aria-label={backLabel ?? (isAr ? "رجوع" : "Back")}
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            {backLabel ?? (isAr ? "رجوع" : "Back")}
          </button>
          {backHref ? (
            <Link
              href={backHref}
              className="sr-only"
              tabIndex={-1}
              aria-hidden
            >
              {backLabel}
            </Link>
          ) : null}
        </div>
        <AnalyticsFilterBreadcrumb isAr={isAr} f={f} onClear={onClear ?? (() => undefined)} />
      </div>
    );
  }
);

GlobalAnalyticsNavigation.displayName = "GlobalAnalyticsNavigation";

export default GlobalAnalyticsNavigation;
