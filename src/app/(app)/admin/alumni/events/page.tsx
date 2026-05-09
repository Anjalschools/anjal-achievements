"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Calendar, Loader2, RefreshCw } from "lucide-react";

type Row = {
  id: string;
  title: string;
  slug: string;
  published: boolean;
  featured: boolean;
  startsAt: string | null;
  rsvpCount: number;
  updatedAt: string | null;
};

export default function AdminAlumniEventsPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quickTitle, setQuickTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/alumni/events", { credentials: "include", cache: "no-store" });
      const json = (await res.json()) as { ok?: boolean; items?: Row[]; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error || "FAILED");
      setItems(Array.isArray(json.items) ? json.items : []);
    } catch {
      setError("تعذر تحميل الفعاليات.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const up: Row[] = [];
    const pa: Row[] = [];
    for (const r of items) {
      const t = r.startsAt ? new Date(r.startsAt).getTime() : 0;
      if (t >= now) up.push(r);
      else pa.push(r);
    }
    up.sort((a, b) => (a.startsAt || "").localeCompare(b.startsAt || ""));
    pa.sort((a, b) => (b.startsAt || "").localeCompare(a.startsAt || ""));
    return { upcoming: up, past: pa };
  }, [items]);

  const togglePub = async (id: string, published: boolean) => {
    await fetch(`/api/admin/alumni/events/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published }),
    });
    await load();
  };

  const handleQuickCreate = async () => {
    const title = quickTitle.trim();
    if (!title) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/alumni/events", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          eventType: "cohort",
          published: false,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || "CREATE_FAILED");
      }
      setQuickTitle("");
      await load();
    } catch {
      setError("تعذر إنشاء الفعالية السريعة — تحقق من عدم تكرار الرابط.");
    } finally {
      setCreating(false);
    }
  };

  const renderList = (rows: Row[], emptyLabel: string) => {
    if (rows.length === 0) {
      return <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center text-sm text-slate-500">{emptyLabel}</p>;
    }
    return (
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-bold text-slate-900">{row.title}</p>
                <p className="text-xs text-slate-500">{row.slug}</p>
                <p className="mt-2 text-xs text-slate-600">
                  {row.startsAt ? new Date(row.startsAt).toLocaleString("ar-SA") : "بدون تاريخ"}
                  {" · "}
                  <span className="font-bold">RSVP: {row.rsvpCount}</span>
                  {row.featured ? (
                    <span className="mr-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">مميز</span>
                  ) : null}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void togglePub(row.id, !row.published)}
                className="shrink-0 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold hover:bg-slate-200"
              >
                {row.published ? "إخفاء عن العامة" : "نشر"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div dir="rtl" className="space-y-8 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">فعاليات الخريجين</h1>
          <p className="mt-1 text-sm text-slate-600">قائمة بالفعاليات القادمة والسابقة مع عدد RSVP.</p>
          <p className="mt-2 text-xs font-bold text-slate-500">
            إجمالي السجلات: <span className="tabular-nums text-slate-800">{items.length}</span>
          </p>
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

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-black text-slate-900">إنشاء سريع (مسودة)</h2>
        <p className="mt-1 text-xs text-slate-500">عنوان فقط — يمكنك تعديل التفاصيل لاحقًا من واجهة المحتوى إن وُجدت.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            placeholder="عنوان الفعالية"
            className="min-w-[200px] flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={creating || !quickTitle.trim()}
            onClick={() => void handleQuickCreate()}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "إنشاء"}
          </button>
        </div>
      </section>

      {loading && items.length === 0 ? (
        <div className="flex min-h-[24vh] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
        </div>
      ) : null}

      {!loading && items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
          <Calendar className="h-12 w-12 text-slate-300" aria-hidden />
          <p className="mt-4 text-lg font-black text-slate-900">لا توجد فعاليات</p>
          <p className="mt-2 max-w-md text-sm text-slate-600">ابدأ بإنشاء فعالية سريعة أعلاه، أو أضف محتوى كاملاً لاحقًا.</p>
        </div>
      ) : null}

      {items.length > 0 ? (
        <div className="grid gap-8 lg:grid-cols-2">
          <section>
            <h2 className="mb-3 text-lg font-black text-slate-900">قادمة</h2>
            {renderList(upcoming, "لا توجد فعاليات قادمة.")}
          </section>
          <section>
            <h2 className="mb-3 text-lg font-black text-slate-900">سابقة</h2>
            {renderList(past, "لا توجد فعاليات سابقة مسجّلة.")}
          </section>
        </div>
      ) : null}
    </div>
  );
}
