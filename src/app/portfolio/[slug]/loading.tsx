export default function PortfolioLoading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center bg-gradient-to-b from-slate-100 to-slate-50" dir="rtl">
      <div
        className="h-12 w-12 animate-spin rounded-full border-2 border-sky-700 border-t-transparent"
        aria-hidden
      />
      <p className="mt-4 text-sm font-medium text-slate-600">جاري تحميل ملف الإنجاز…</p>
    </div>
  );
}
