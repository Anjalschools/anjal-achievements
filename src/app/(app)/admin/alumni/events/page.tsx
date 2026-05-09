"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

type Row = {
  id: string;
  title: string;
  slug: string;
  published: boolean;
  startsAt: string | null;
};

export default function AdminAlumniEventsPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let m = true;
    void (async () => {
      try {
        const res = await fetch("/api/admin/alumni/events", { credentials: "include" });
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

  const togglePub = async (id: string, published: boolean) => {
    await fetch(`/api/admin/alumni/events/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published }),
    });
    const res = await fetch("/api/admin/alumni/events", { credentials: "include" });
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
      <h1 className="text-2xl font-black text-slate-900">فعاليات الخريجين</h1>
      <ul className="mt-6 space-y-3">
        {items.map((row) => (
          <li key={row.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="font-bold">{row.title}</p>
            <p className="text-xs text-slate-500">{row.slug}</p>
            <button
              type="button"
              onClick={() => void togglePub(row.id, !row.published)}
              className="mt-2 rounded-lg bg-slate-100 px-3 py-1 text-xs font-bold"
            >
              {row.published ? "إخفاء" : "نشر"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
