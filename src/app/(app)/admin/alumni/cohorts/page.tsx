"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

type Row = { id: string; graduationYear: number; label: string; featured: boolean };

export default function AdminAlumniCohortsPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let m = true;
    void (async () => {
      try {
        const res = await fetch("/api/admin/alumni/cohorts", { credentials: "include" });
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
    <div dir="rtl" className="px-4 py-8">
      <h1 className="text-2xl font-black text-slate-900">دفعات الخريجين</h1>
      <ul className="mt-6 space-y-2">
        {items.map((row) => (
          <li key={row.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className="font-bold">{row.graduationYear}</span>
            {row.label ? <span className="mr-2 text-sm text-slate-600">{row.label}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
