"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

type YearRow = { year: number; count: number };

export default function AlumniCohortsIndexPage() {
  const [years, setYears] = useState<YearRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let m = true;
    void (async () => {
      try {
        const res = await fetch("/api/public/alumni-cohorts");
        const json = (await res.json()) as { ok?: boolean; years?: YearRow[] };
        if (m && json.ok && json.years) setYears(json.years);
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
      <h1 className="text-3xl font-black text-slate-900">دفعات التخرج</h1>
      <ul className="mt-8 space-y-2">
        {years.map((y) => (
          <li key={y.year}>
            <Link
              href={`/alumni/cohorts/${y.year}`}
              className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm hover:border-primary/40"
            >
              <span className="font-bold text-slate-900">{y.year}</span>
              <span className="text-sm text-slate-500">{y.count} خريج</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
