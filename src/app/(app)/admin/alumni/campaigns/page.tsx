"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, PlusCircle } from "lucide-react";

type Row = {
  id: string;
  title: string;
  kind: string;
  status: string;
  subject: string;
  stats: { delivered: number; opened: number; clicked: number; failed: number };
};

export default function AdminAlumniCampaignsPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let m = true;
    void (async () => {
      try {
        const res = await fetch("/api/admin/alumni/campaigns", { credentials: "include" });
        const json = (await res.json()) as { ok?: boolean; items?: Row[] };
        if (m && json.ok && json.items) setItems(json.items);
      } finally {
        if (m) setLoading(false);
      }
    })();
    return () => {
      m = false;
    };
  }, []);

  if (loading) {
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
          <h1 className="text-2xl font-black text-slate-900">حملات الخريجين</h1>
          <p className="mt-1 text-sm text-slate-600">مسارات بريد وتفعيل داخل نطاق الخريجين — مع طابور توصيل قابل للاستبدال لاحقًا.</p>
        </div>
        <Link
          href="/admin/alumni/campaigns/new"
          className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-primary-dark"
        >
          <PlusCircle className="h-4 w-4" aria-hidden />
          حملة جديدة
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-right font-bold text-slate-700">العنوان</th>
              <th className="px-4 py-3 text-right font-bold text-slate-700">النوع</th>
              <th className="px-4 py-3 text-right font-bold text-slate-700">الحالة</th>
              <th className="px-4 py-3 text-right font-bold text-slate-700">إحصاءات</th>
              <th className="px-4 py-3 text-right font-bold text-slate-700">إجراء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-bold text-slate-900">{c.title}</td>
                <td className="px-4 py-3 text-slate-600">{c.kind}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-800">{c.status}</span>
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
    </div>
  );
}
