"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getLocale } from "@/lib/i18n";
import type { AlumniStoryDetail } from "@/lib/alumni/alumni-ecosystem-types";

const AlumniStoryDetailPage = () => {
  const params = useParams<{ slug: string }>();
  const slug = String(params?.slug || "");
  const locale = getLocale();
  const isAr = locale === "ar";
  const [item, setItem] = useState<AlumniStoryDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        const response = await fetch(`/api/public/alumni-story/${slug}`, { cache: "no-store" });
        if (!response.ok) {
          setItem(null);
          return;
        }
        const json = await response.json();
        setItem(json.item || null);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  if (loading) return <main className="mx-auto max-w-4xl px-4 py-20">{isAr ? "جاري التحميل..." : "Loading..."}</main>;
  if (!item) return <main className="mx-auto max-w-4xl px-4 py-20">{isAr ? "القصة غير متاحة." : "Story is unavailable."}</main>;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:py-14" dir={isAr ? "rtl" : "ltr"}>
      <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <p className="text-xs font-bold uppercase tracking-wide text-primary">{item.universityName || "Alumni story"}</p>
        <h1 className="mt-2 text-3xl font-black text-slate-900">{item.title}</h1>
        {item.excerpt ? <p className="mt-3 text-base text-slate-600">{item.excerpt}</p> : null}
        <div className="mt-4 text-sm text-slate-500">
          {[item.currentPosition, item.currentCompany].filter(Boolean).join(" — ") || "—"}
        </div>
        <div className="prose prose-slate mt-8 max-w-none whitespace-pre-wrap text-sm leading-7 text-slate-700">
          {item.content || (isAr ? "سيتم نشر تفاصيل القصة قريباً." : "Story details will be published soon.")}
        </div>
      </article>
      <div className="mt-6">
        <Link href="/alumni/stories" className="text-sm font-bold text-primary hover:underline">
          {isAr ? "العودة إلى القصص" : "Back to stories"}
        </Link>
      </div>
    </main>
  );
};

export default AlumniStoryDetailPage;
