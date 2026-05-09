"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Megaphone, PlusCircle, RefreshCw } from "lucide-react";

type Row = {
  id: string;
  title: string;
  kind: string;
  status: string;
  subject: string;
  stats: { delivered: number; opened: number; clicked: number; failed: number };
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string | null;
};

const statusBadge = (status: string) => {
  const s = String(status || "").toLowerCase();
  if (s === "sent") return "bg-emerald-100 text-emerald-900";
  if (s === "scheduled") return "bg-sky-100 text-sky-900";
  if (s === "draft") return "bg-slate-100 text-slate-800";
  return "bg-amber-100 text-amber-900";
};

export default function AdminAlumniCampaignsPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/alumni/campaigns", { credentials: "include", cache: "no-store" });
      const json = (await res.json()) as { ok?: boolean; items?: Row[]; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error || "FAILED");
      setItems(Array.isArray(json.items) ? json.items : []);
    } catch {
      setError("تعذر تحميل الحملات.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div dir="rtl" className="space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">حملات الخريجين</h1>
          <p className="mt-1 text-sm text-slate-600">
            مسارات بريد وتفعيل داخل نطاق الخريجين — عرض الحالة، المستلمين، وإحصاءات التسليم.
          </p>
          <p className="mt-2 text-xs font-bold text-slate-500">
            إجمالي الحملات المعروضة: <span className="tabular-nums text-slate-800">{items.length}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
            تحديث
          </button>
          <Link
            href="/admin/alumni/campaigns/new"
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-primary-dark"
          >
            <PlusCircle className="h-4 w-4" aria-hidden />
            حملة جديدة
          </Link>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      {loading && items.length === 0 ? (
        <div className="flex min-h-[30vh] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
        </div>
      ) : null}

      {!loading && items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
          <Megaphone className="h-12 w-12 text-slate-300" aria-hidden />
          <p className="mt-4 text-lg font-black text-slate-900">لا توجد حملات بعد</p>
          <p className="mt-2 max-w-md text-sm text-slate-600">أنشئ حملة بريد جديدة لربط الخريجين بالفعاليات والفرص.</p>
          <Link
            href="/admin/alumni/campaigns/new"
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-white"
          >
            <PlusCircle className="h-4 w-4" aria-hidden />
            إنشاء أول حملة
          </Link>
        </div>
      ) : null}

      {items.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-right font-bold text-slate-700">العنوان</th>
                <th className="px-4 py-3 text-right font-bold text-slate-700">النوع</th>
                <th className="px-4 py-3 text-right font-bold text-slate-700">الحالة</th>
                <th className="px-4 py-3 text-right font-bold text-slate-700">الجدولة / الإرسال</th>
                <th className="px-4 py-3 text-right font-bold text-slate-700">إحصاءات التسليم</th>
                <th className="px-4 py-3 text-right font-bold text-slate-700">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-900">{c.title}</p>
                    <p className="line-clamp-1 text-xs text-slate-500">{c.subject}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.kind}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${statusBadge(c.status)}`}>{c.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    <p>جدولة: {c.scheduledAt ? new Date(c.scheduledAt).toLocaleString("ar-SA") : "—"}</p>
                    <p>إرسال: {c.sentAt ? new Date(c.sentAt).toLocaleString("ar-SA") : "—"}</p>
                    <p className="text-[10px] text-slate-400">أُنشئت: {c.createdAt ? new Date(c.createdAt).toLocaleDateString("ar-SA") : "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    وصول {c.stats.delivered} · فتح {c.stats.opened} · نقرة {c.stats.clicked} · فشل {c.stats.failed}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/alumni/campaigns/${c.id}`} className="font-bold text-primary hover:underline">
                      إدارة
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
