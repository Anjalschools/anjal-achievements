"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

type Row = { label: string; count: number };

export default function AlumniNetworkCareersPage() {
  const [axis, setAxis] = useState("industry");
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let m = true;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/public/alumni-network/careers?axis=${encodeURIComponent(axis)}`);
        const json = (await res.json()) as { ok?: boolean; items?: Row[] };
        if (m && json.ok && json.items) setItems(json.items);
      } finally {
        if (m) setLoading(false);
      }
    })();
    return () => {
      m = false;
    };
  }, [axis]);

  return (
    <div dir="rtl" className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-black text-slate-900">المسارات المهنية</h1>
      <div className="mt-4 flex gap-2">
        {[
          ["industry", "القطاع"],
          ["company", "الشركة"],
          ["role", "المسمى"],
        ].map(([k, lab]) => (
          <button
            key={k}
            type="button"
            onClick={() => setAxis(k)}
            className={`rounded-full px-4 py-2 text-xs font-bold ${
              axis === k ? "bg-primary text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            {lab}
          </button>
        ))}
      </div>
      {loading ? (
        <Loader2 className="mt-8 h-8 w-8 animate-spin text-primary" aria-hidden />
      ) : (
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {items.map((r) => (
            <li key={r.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="font-bold text-slate-900">{r.label}</p>
              <p className="text-sm text-slate-500">{r.count}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
