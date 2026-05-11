"use client";

import { useEffect, useState } from "react";
import { Loader2, Share2 } from "lucide-react";
import { getLocale } from "@/lib/i18n";
import AlumniPageHeader from "@/components/alumni/AlumniPageHeader";

type Row = { label: string; count: number };

export default function AlumniNetworkCareersPage() {
  const isAr = getLocale() === "ar";
  const dir = isAr ? "rtl" : "ltr";
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
    <div dir={dir} className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:py-12">
      <AlumniPageHeader
        title={isAr ? "المسارات المهنية" : "Career paths"}
        description={
          isAr
            ? "عرض تجميعي لمسارات الخريجين حسب القطاع أو الشركة أو المسمى."
            : "Aggregated alumni career paths by industry, company, or role."
        }
        smartBack
        backLabel={isAr ? "رجوع" : "Back"}
        icon={<Share2 className="h-6 w-6 text-white" aria-hidden />}
        breadcrumb={[
          { label: isAr ? "الخريجون" : "Alumni", href: "/alumni" },
          { label: isAr ? "الشبكة" : "Network" },
          { label: isAr ? "المسارات" : "Careers" },
        ]}
        dir={dir}
      />
      <h1 className="sr-only">{isAr ? "المسارات المهنية" : "Career paths"}</h1>
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
