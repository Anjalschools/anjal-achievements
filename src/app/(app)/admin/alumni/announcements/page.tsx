"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

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

  useEffect(() => {
    let m = true;
    void (async () => {
      try {
        const res = await fetch("/api/admin/alumni/announcements", { credentials: "include" });
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

  const toggle = async (id: string, field: "published" | "featured", value: boolean) => {
    await fetch(`/api/admin/alumni/announcements/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    const res = await fetch("/api/admin/alumni/announcements", { credentials: "include" });
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
    <div dir="rtl" className="px-4 py-8">
      <h1 className="text-2xl font-black text-slate-900">إعلانات الخريجين</h1>
      <ul className="mt-6 space-y-3">
        {items.map((row) => (
          <li key={row.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="font-bold">{row.title}</p>
            <p className="text-xs text-slate-500">{row.slug}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void toggle(row.id, "published", !row.published)}
                className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-bold"
              >
                {row.published ? "إلغاء النشر" : "نشر"}
              </button>
              <button
                type="button"
                onClick={() => void toggle(row.id, "featured", !row.featured)}
                className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-bold"
              >
                مميز
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
