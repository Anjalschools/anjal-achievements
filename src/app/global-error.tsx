"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const correlationId = error.digest || `global_${Date.now()}`;

  return (
    <html lang="ar" dir="rtl">
      <body className="bg-slate-50 antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12 text-center">
          <div className="mb-6 text-2xl font-black text-primary">منصة أنجل للإنجازات</div>
          <h1 className="text-xl font-black text-slate-900">خطأ في النظام</h1>
          <p className="mt-3 max-w-md text-sm text-slate-600">
            حدث عطل عام مؤقت. جرّب إعادة تحميل الصفحة.
          </p>
          <p className="mt-4 font-mono text-[11px] text-slate-500" dir="ltr">
            correlationId: {correlationId}
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-white"
          >
            إعادة المحاولة
          </button>
        </div>
      </body>
    </html>
  );
}
