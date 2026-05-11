"use client";

import { useEffect, useState } from "react";
import { GraduationCap, Loader2 } from "lucide-react";
import { getLocale } from "@/lib/i18n";
import AlumniPageHeader from "@/components/alumni/AlumniPageHeader";

type Row = { name: string; count: number };

export default function AlumniNetworkUniversitiesPage() {
  const isAr = getLocale() === "ar";
  const dir = isAr ? "rtl" : "ltr";
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
      <div dir={dir} className="flex min-h-[40vh] items-center justify-center px-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      </div>
    );
  }

  return (
    <div dir={dir} className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:py-12">
      <AlumniPageHeader
        title={isAr ? "شبكة الجامعات" : "University network"}
        description={
          isAr ? "أكثر الجامعات التي يدرس بها خريجو الأنجال وفق البيانات المتاحة." : "Universities where Al-Anjal alumni study, based on available data."
        }
        smartBack
        backLabel={isAr ? "رجوع" : "Back"}
        icon={<GraduationCap className="h-6 w-6 text-white" aria-hidden />}
        breadcrumb={[
          { label: isAr ? "الخريجون" : "Alumni", href: "/alumni" },
          { label: isAr ? "الشبكة" : "Network" },
          { label: isAr ? "الجامعات" : "Universities" },
        ]}
        dir={dir}
      />
      <h1 className="sr-only">{isAr ? "شبكة الجامعات" : "University network"}</h1>
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
