"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";

type Row = { id: string; fullName: string; universityName: string; company: string };

type Insights = {
  similarAlumni: { id: string; fullName: string; universityName?: string | null; similarityScore: number }[];
  mostActive: { id: string; fullName: string; universityName?: string | null; reputationScore?: number | null }[];
  relatedOpportunities: { id: string; title: string; type: string; matchScore: number }[];
};

export default function AlumniCohortYearPage() {
  const params = useParams();
  const year = String(params?.year || "");
  const [items, setItems] = useState<Row[]>([]);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!year) return;
    let m = true;
    void (async () => {
      try {
        const [resList, resIn] = await Promise.all([
          fetch(`/api/public/alumni-cohorts/${year}`),
          fetch(`/api/public/alumni-cohorts/${year}/insights`),
        ]);
        const jsonList = (await resList.json()) as { ok?: boolean; items?: Row[] };
        const jsonIn = (await resIn.json()) as { ok?: boolean } & Partial<Insights>;
        if (!m) return;
        if (jsonList.ok && jsonList.items) setItems(jsonList.items);
        if (jsonIn.ok) {
          setInsights({
            similarAlumni: jsonIn.similarAlumni || [],
            mostActive: jsonIn.mostActive || [],
            relatedOpportunities: jsonIn.relatedOpportunities || [],
          });
        }
      } finally {
        if (m) setLoading(false);
      }
    })();
    return () => {
      m = false;
    };
  }, [year]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      </div>
    );
  }

  return (
    <div dir="rtl" className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/alumni/cohorts" className="text-sm font-bold text-primary hover:underline">
        ← الدفعات
      </Link>
      <h1 className="mt-4 text-3xl font-black text-slate-900">دفعة {year}</h1>

      {insights &&
      (insights.similarAlumni.length > 0 || insights.mostActive.length > 0 || insights.relatedOpportunities.length > 0) ? (
        <div className="mt-8 space-y-6">
          {insights.similarAlumni.length > 0 ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-black text-slate-900">خريجون مشابهون لك</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {insights.similarAlumni.map((u) => (
                  <li key={u.id}>
                    <Link href={`/alumni/${u.id}`} className="font-bold text-primary hover:underline">
                      {u.fullName}
                    </Link>
                    {u.universityName ? <span className="mr-2 text-xs text-slate-500">{u.universityName}</span> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {insights.mostActive.length > 0 ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-black text-slate-900">الأكثر نشاطًا في الدفعة</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {insights.mostActive.map((u) => (
                  <li key={u.id} className="flex justify-between gap-2">
                    <span className="font-bold text-slate-900">{u.fullName}</span>
                    <span className="tabular-nums text-xs text-slate-500">
                      {u.reputationScore != null ? `نقاط ${u.reputationScore}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {insights.relatedOpportunities.length > 0 ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-black text-slate-900">فرص مرتبطة بالدفعة</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {insights.relatedOpportunities.map((o) => (
                  <li key={o.id}>
                    <Link href="/alumni/opportunities" className="font-bold text-primary hover:underline">
                      {o.title}
                    </Link>
                    <span className="mr-2 text-xs text-slate-500">{o.type}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}

      <h2 className="mt-10 text-lg font-black text-slate-900">جميع الخريجين</h2>
      <ul className="mt-4 space-y-3">
        {items.map((u) => (
          <li key={u.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="font-bold text-slate-900">{u.fullName}</p>
            <p className="text-sm text-slate-600">{u.universityName}</p>
            <p className="text-xs text-slate-500">{u.company}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
