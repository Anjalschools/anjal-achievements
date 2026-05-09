"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Megaphone, RefreshCw } from "lucide-react";

type Row = {
  id: string;
  title: string;
  slug: string;
  published: boolean;
  featured: boolean;
};

export default function AdminAlumniAnnouncementsPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/alumni/announcements", { credentials: "include", cache: "no-store" });
      const json = (await res.json()) as { ok?: boolean; items?: Row[] };
      if (json.ok && json.items) setItems(json.items);
      else setItems([]);
    } catch {
      setError("تعذر تحميل الإعلانات.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (id: string, field: "published" | "featured", value: boolean) => {
    await fetch(`/api/admin/alumni/announcements/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    await load();
  };

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
          <h1 className="text-2xl font-black text-slate-900">إعلانات الخريجين</h1>
          <p className="mt-1 text-xs font-bold text-slate-500">إجمالي السجلات: {items.length}</p>
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
          <Megaphone className="h-12 w-12 text-slate-300" aria-hidden />
          <p className="mt-4 text-lg font-black text-slate-900">لا توجد إعلانات</p>
          <p className="mt-2 max-w-md text-sm text-slate-600">أنشئ إعلانات من مسار المحتوى أو الـ API عند توفره.</p>
        </div>
      ) : null}

      {items.length > 0 ? (
        <ul className="space-y-3">
          {items.map((row) => (
            <li key={row.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="font-bold">{row.title}</p>
              <p className="text-xs text-slate-500">{row.slug}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void toggle(row.id, "published", !row.published)}
                  className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-bold hover:bg-slate-200"
                >
                  {row.published ? "إلغاء النشر" : "نشر"}
                </button>
                <button
                  type="button"
                  onClick={() => void toggle(row.id, "featured", !row.featured)}
                  className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-bold hover:bg-slate-200"
                >
                  {row.featured ? "إلغاء التمييز" : "مميز"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
