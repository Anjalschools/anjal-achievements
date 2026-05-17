"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const correlationId = error.digest || `err_${Date.now()}`;

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[client-error]", correlationId, error.message);
  }, [error, correlationId]);

  return (
    <div
      dir="rtl"
      className="flex min-h-[60vh] flex-col items-center justify-center bg-slate-50 px-6 py-12 text-center"
    >
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-2xl font-black text-primary">
        أنجل
      </div>
      <h1 className="text-xl font-black text-slate-900">حدث خطأ مؤقت</h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-600">
        تعذر تحميل هذه الصفحة. قد يكون السبب ضغطًا مؤقتًا على الخادم. جرّب إعادة المحاولة.
      </p>
      <p className="mt-2 max-w-md text-xs text-slate-500" dir="ltr">
        A temporary error prevented this page from loading. Please retry.
      </p>
      <p className="mt-4 font-mono text-[11px] text-slate-500" dir="ltr">
        correlationId: {correlationId}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:opacity-95"
      >
        إعادة المحاولة
      </button>
    </div>
  );
}
