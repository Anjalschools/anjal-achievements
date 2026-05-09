"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

type Row = {
  id: string;
  mentorId: string;
  category: string;
  message: string;
  status: string;
  updatedAt: string | null;
};

export default function MentorshipRequestsPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let m = true;
    void (async () => {
      try {
        const res = await fetch("/api/alumni/mentorship-requests", { credentials: "include" });
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

  const patch = async (id: string, status: string) => {
    await fetch(`/api/alumni/mentorship-requests/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const res = await fetch("/api/alumni/mentorship-requests", { credentials: "include" });
    const json = (await res.json()) as { ok?: boolean; items?: Row[] };
    if (json.ok && json.items) setItems(json.items);
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      </div>
    );
  }

  return (
    <div dir="rtl" className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-black text-slate-900">طلبات الإرشاد</h1>
      <ul className="mt-6 space-y-3">
        {items.map((row) => (
          <li key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">{row.updatedAt}</p>
            <p className="mt-1 font-bold text-slate-900">{row.category}</p>
            <p className="mt-2 text-sm text-slate-700">{row.message}</p>
            <p className="mt-2 text-xs font-bold text-primary">الحالة: {row.status}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void patch(row.id, "accepted")}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white"
              >
                قبول (مرشد)
              </button>
              <button
                type="button"
                onClick={() => void patch(row.id, "rejected")}
                className="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-bold text-slate-800"
              >
                رفض (مرشد)
              </button>
              <button
                type="button"
                onClick={() => void patch(row.id, "cancelled")}
                className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-900"
              >
                إلغاء (مقدّم الطلب)
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
