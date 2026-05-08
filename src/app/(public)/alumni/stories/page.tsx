"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getLocale } from "@/lib/i18n";
import type { AlumniStoryListItem } from "@/lib/alumni/alumni-ecosystem-types";

const AlumniStoriesPage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [items, setItems] = useState<AlumniStoryListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/public/alumni-stories?limit=24", { cache: "no-store" });
        const json = await response.json();
        setItems(Array.isArray(json.items) ? json.items : []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:py-14" dir={isAr ? "rtl" : "ltr"}>
      <header className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 to-primary p-6 text-white sm:p-8">
        <h1 className="text-3xl font-black">{isAr ? "قصص خريجي الأنجال" : "Al-Anjal alumni stories"}</h1>
        <p className="mt-2 text-sm text-sky-100">
          {isAr ? "مسارات ملهمة من المدرسة إلى الجامعات والقطاعات المهنية." : "Inspiring journeys from school to universities and professional sectors."}
        </p>
      </header>
      {loading ? (
        <p className="py-10 text-center text-slate-500">{isAr ? "جاري التحميل..." : "Loading..."}</p>
      ) : (
        <section className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((story) => (
            <article key={story.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold text-primary">{story.universityName || "Alumni Story"}</p>
              <h2 className="mt-2 text-lg font-black text-slate-900">{story.title}</h2>
              <p className="mt-2 line-clamp-3 text-sm text-slate-600">{story.excerpt || (isAr ? "تفاصيل القصة متاحة داخل الصفحة." : "Read the full story in detail.")}</p>
              <Link href={`/alumni/stories/${story.slug}`} className="mt-4 inline-flex text-sm font-bold text-primary hover:underline">
                {isAr ? "قراءة القصة" : "Read story"}
              </Link>
            </article>
          ))}
        </section>
      )}
    </main>
  );
};

export default AlumniStoriesPage;
