"use client";

import { useCallback, useEffect, useState } from "react";
import { GraduationCap, Loader2, RefreshCw } from "lucide-react";

type Row = { id: string; graduationYear: number; label: string; featured: boolean };

export default function AdminAlumniCohortsPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/alumni/cohorts", { credentials: "include", cache: "no-store" });
      const json = (await res.json()) as { ok?: boolean; items?: Row[] };
      if (json.ok && json.items) setItems(json.items);
      else setItems([]);
    } catch {
      setError("تعذر تحميل الدفعات.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && items.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">دفعات الخريجين</h1>
          <p className="mt-1 text-xs font-bold text-slate-500">عدد الدفعات: {items.length}</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
          تحديث
        </button>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      {!loading && items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
          <GraduationCap className="h-12 w-12 text-slate-300" aria-hidden />
          <p className="mt-4 text-lg font-black text-slate-900">لا توجد دفعات مسجّلة</p>
          <p className="mt-2 max-w-md text-sm text-slate-600">ستظهر الدفعات هنا عند إضافتها في النظام.</p>
        </div>
      ) : null}

      {items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((row) => (
            <li key={row.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <span className="font-bold">{row.graduationYear}</span>
              {row.label ? <span className="mr-2 text-sm text-slate-600">{row.label}</span> : null}
              {row.featured ? (
                <span className="mr-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">مميز</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
