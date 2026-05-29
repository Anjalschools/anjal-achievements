"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

export type ExecutiveErrorCardProps = {
  isAr: boolean;
  title?: string;
  message?: string;
  correlationId?: string | null;
  degraded?: boolean;
  onRetry?: () => void;
};

export const ExecutiveErrorCard = ({
  isAr,
  title,
  message,
  correlationId,
  degraded,
  onRetry,
}: ExecutiveErrorCardProps) => {
  const displayTitle =
    title ??
    (isAr ? "تعذر تحميل التحليل التنفيذي" : "Executive analytics could not be loaded");
  const displayMessage =
    message ??
    (isAr
      ? "حدثت مشكلة مؤقتة أثناء تجميع البيانات. جرّب التحديث أو تخفيف الفلاتر."
      : "A temporary issue occurred while aggregating data. Try refresh or relax filters.");

  return (
    <section
      className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/90 to-white p-5 sm:p-6"
      role="alert"
      aria-live="polite"
      dir={isAr ? "rtl" : "ltr"}
    >
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-black text-amber-950">{displayTitle}</h3>
          <p className="mt-2 text-sm leading-relaxed text-amber-900/90">{displayMessage}</p>
          {degraded ? (
            <p className="mt-2 text-xs font-bold text-amber-800">
              {isAr
                ? "تم تفعيل وضع مخفّف — قد لا تظهر كل التفاصيل."
                : "Degraded mode is active — some details may be hidden."}
            </p>
          ) : null}
          {correlationId ? (
            <p className="mt-2 font-mono text-[10px] text-amber-800/80" dir="ltr">
              {isAr ? "معرّف التتبع:" : "Correlation:"} {correlationId}
            </p>
          ) : null}
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-700 px-4 py-2 text-xs font-bold text-white hover:bg-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              {isAr ? "إعادة المحاولة" : "Retry"}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
};
