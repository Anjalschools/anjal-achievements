"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { getLocale } from "@/lib/i18n";

type FeaturedItem = {
  id: string;
  title: string;
  studentName: string;
  achievementType?: string;
  achievementLevel?: string;
  inferredField?: string;
  image: string | null;
  date: string;
};

const PlatformFeaturedStrip = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [items, setItems] = useState<FeaturedItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/achievements/public-featured?limit=8", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const list = Array.isArray(data.items) ? data.items : [];
        if (!cancelled) setItems(list);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded || items.length === 0) return null;

  return (
    <section
      className="border-t border-slate-200/80 bg-white py-14 md:py-16"
      dir={isAr ? "rtl" : "ltr"}
    >
      <div className="container mx-auto max-w-6xl px-4 md:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 text-primary">
              <Sparkles className="h-5 w-5" aria-hidden />
              <span className="text-sm font-semibold">
                {isAr ? "من المنصة" : "From the platform"}
              </span>
            </div>
            <h2 className="text-2xl font-bold leading-tight tracking-tight text-slate-950 md:text-3xl">
              {isAr ? "إنجازات مميّزة معتمدة" : "Approved featured achievements"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              {isAr
                ? "إنجازات اختارتها الإدارة للظهور في الواجهة بعد الاعتماد."
                : "Achievements staff marked as featured after approval."}
            </p>
          </div>
          <Link
            href="/register"
            className="text-sm font-semibold text-primary hover:underline"
          >
            {isAr ? "انضم إلى المنصة" : "Join the platform"}
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <article
              key={item.id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/80 shadow-[0_8px_20px_rgba(0,0,0,0.08)] ring-1 ring-slate-200/60"
            >
              <div className="relative aspect-[4/3] w-full bg-slate-200">
                {item.image ? (
                  <Image
                    src={item.image}
                    alt={item.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, 25vw"
                    unoptimized={
                      item.image.startsWith("data:") ||
                      item.image.startsWith("http://") ||
                      item.image.startsWith("https://")
                    }
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/15 to-primary/5 text-sm text-slate-500">
                    {isAr ? "بدون صورة" : "No image"}
                  </div>
                )}
              </div>
              <div className="space-y-1 p-4 text-start">
                <h3 className="line-clamp-2 text-sm font-bold text-slate-900">{item.title}</h3>
                {item.studentName ? (
                  <p className="text-xs text-slate-600">{item.studentName}</p>
                ) : null}
                <div className="flex flex-wrap gap-2 text-[10px] text-slate-500">
                  {item.inferredField ? <span>{item.inferredField}</span> : null}
                  {item.achievementLevel ? <span>· {item.achievementLevel}</span> : null}
                  {item.date ? <span>· {item.date}</span> : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PlatformFeaturedStrip;
