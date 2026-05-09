"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

type Row = { name: string; count: number };

export default function AlumniNetworkUniversitiesPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let m = true;
    void (async () => {
      try {
        const res = await fetch("/api/public/alumni-network/universities");
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
    <div dir="rtl" className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-black text-slate-900">شبكة الجامعات</h1>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {items.map((r) => (
          <li key={r.name} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="font-bold text-slate-900">{r.name}</p>
            <p className="text-sm text-slate-500">{r.count} خريج</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
