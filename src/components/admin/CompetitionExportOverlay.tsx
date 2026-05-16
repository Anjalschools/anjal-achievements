"use client";

import React, { memo } from "react";
import { Loader2, X } from "lucide-react";
import type { CompetitionExportState } from "@/lib/competition-export-controller";
import { isCompetitionIntelDebugEnabled } from "@/lib/competition-intelligence-diagnostics";

export const CompetitionExportOverlay = memo(
  ({
    open,
    state,
    isAr,
    onDismiss,
    onRetry,
  }: {
    open: boolean;
    state: CompetitionExportState;
    isAr: boolean;
    onDismiss: () => void;
    onRetry?: () => void;
  }) => {
    if (!open) return null;
    const msg = isAr ? state.messageAr : state.messageEn;
    const busy =
      state.phase !== "idle" && state.phase !== "success" && state.phase !== "error";
    const showCid = isCompetitionIntelDebugEnabled() && state.correlationId;
    return (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 print:hidden"
        role="alertdialog"
        aria-live="polite"
        aria-busy={busy}
        aria-labelledby="ci-export-title"
      >
        <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
          <button
            type="button"
            className="absolute end-3 top-3 rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            onClick={onDismiss}
            aria-label={isAr ? "إغلاق" : "Close"}
          >
            <X className="h-4 w-4" />
          </button>
          <h2 id="ci-export-title" className="pe-8 text-sm font-black text-slate-900">
            {isAr ? "تصدير ذكاء المسابقات" : "Competition intelligence export"}
          </h2>
          <div className="mt-4 flex items-start gap-3">
            {busy ? <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-indigo-600" aria-hidden /> : null}
            <p className="text-sm leading-relaxed text-slate-700">{msg || (isAr ? "…" : "…")}</p>
          </div>
          {state.phase === "error" && state.errorDetail ? (
            <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-800">{state.errorDetail}</p>
          ) : null}
          {showCid ? (
            <p className="mt-2 font-mono text-[10px] text-slate-500" dir="ltr">
              correlation: {state.correlationId}
            </p>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-2">
            {state.phase === "error" && onRetry ? (
              <button
                type="button"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                onClick={onRetry}
              >
                {isAr ? "إعادة المحاولة" : "Retry"}
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              onClick={onDismiss}
            >
              {isAr ? "إغلاق" : "Close"}
            </button>
          </div>
        </div>
      </div>
    );
  }
);
CompetitionExportOverlay.displayName = "CompetitionExportOverlay";
