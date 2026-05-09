"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

type Item = { title: string; slug: string; summary: string; category: string; featured: boolean };

export default function AlumniAnnouncementsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let m = true;
    void (async () => {
      try {
        const res = await fetch("/api/public/alumni-announcements");
        const json = (await res.json()) as { ok?: boolean; items?: Item[] };
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
    <div dir="rtl" className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-black text-slate-900">إعلانات الخريجين</h1>
      <ul className="mt-8 space-y-4">
        {items.map((a) => (
          <li key={a.slug} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <Link href={`/alumni/announcements/${a.slug}`} className="text-lg font-bold text-primary hover:underline">
              {a.title}
            </Link>
            <p className="mt-2 text-sm text-slate-600">{a.summary}</p>
            <p className="mt-2 text-xs font-semibold text-slate-400">{a.category}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
