"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Camera, Heart, Sparkles } from "lucide-react";
import type { AlumniLocale } from "@/content/alumni-landing";
import { getAlumniSectionTitles } from "@/content/alumni-landing";
import type { PublicAlumniMemoryShowcaseItem } from "@/lib/alumni/alumni-public-types";

type ApiResponse = { ok?: boolean; items?: PublicAlumniMemoryShowcaseItem[] };

const IMAGE_HEIGHTS = ["min-h-[200px] sm:min-h-[220px]", "min-h-[240px] sm:min-h-[260px]", "min-h-[210px] sm:min-h-[230px]"];

type AlumniMemoriesShowcaseProps = {
  locale: AlumniLocale;
};

export const AlumniMemoriesShowcase = ({ locale }: AlumniMemoriesShowcaseProps) => {
  const isAr = locale === "ar";
  const copy = getAlumniSectionTitles(locale);
  const [items, setItems] = useState<PublicAlumniMemoryShowcaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/public/alumni-memories?limit=8", {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const json = (await res.json()) as ApiResponse;
      if (json.ok && Array.isArray(json.items)) setItems(json.items);
      else setItems([]);
    } catch {
      setError(true);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const batchLabel = (m: PublicAlumniMemoryShowcaseItem) => {
    if (m.graduationYear != null && m.graduationYear > 0) {
      return isAr ? `دفعة ${m.graduationYear}` : `Class of ${m.graduationYear}`;
    }
    if (m.memoryYear != null && m.memoryYear > 0) {
      return isAr ? `سنة الذكرى ${m.memoryYear}` : `Memory year ${m.memoryYear}`;
    }
    return isAr ? "خريج" : "Alumni";
  };

  const memoryKind = (m: PublicAlumniMemoryShowcaseItem) => {
    if (m.memoryYear != null && m.memoryYear > 0) {
      return isAr ? `ذكرى من عام ${m.memoryYear}` : `Memory from ${m.memoryYear}`;
    }
    return copy.memoryKindLabel;
  };

  return (
    <section
      id="alumni-memories-landing"
      className="scroll-mt-24 border-b border-slate-200/80 bg-gradient-to-b from-white via-slate-50/95 to-slate-100/90 py-14 sm:py-20"
      dir={isAr ? "rtl" : "ltr"}
      aria-labelledby="alumni-memories-landing-title"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <h2
              id="alumni-memories-landing-title"
              className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl md:text-[2rem]"
            >
              {copy.memoriesTitle}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">{copy.memoriesSubtitle}</p>
          </div>
          <Link
            href="/login/alumni"
            className="shrink-0 self-start text-sm font-bold text-primary underline-offset-4 transition hover:text-primary-dark hover:underline sm:self-auto"
          >
            {copy.memoriesViewAll}
          </Link>
        </div>

        {loading ? (
          <div
            className="mt-10 columns-1 gap-6 sm:columns-2 lg:columns-3"
            aria-busy="true"
            aria-label={isAr ? "جاري تحميل الذكريات" : "Loading memories"}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="mb-6 break-inside-avoid overflow-hidden rounded-2xl border border-slate-200/80 bg-white/60 shadow-sm"
              >
                <div className={`${IMAGE_HEIGHTS[i % 3]} animate-pulse bg-slate-200/90`} />
                <div className="space-y-2 p-4">
                  <div className="h-4 w-full max-w-[12rem] animate-pulse rounded bg-slate-200" />
                  <div className="h-3 w-full max-w-[8rem] animate-pulse rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <p className="mt-10 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {isAr ? "تعذر تحميل الذكريات. حاول مرة أخرى لاحقًا." : "Could not load memories. Please try again later."}
          </p>
        ) : items.length === 0 ? (
          <div className="mt-12 flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300/90 bg-white/70 px-6 py-16 text-center shadow-inner">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Camera className="h-8 w-8" aria-hidden />
            </div>
            <h3 className="mt-5 text-lg font-black text-slate-900">{copy.memoriesEmptyTitle}</h3>
            <p className="mt-2 max-w-md text-sm text-slate-600">{copy.memoriesEmptyBody}</p>
            <Link
              href="/login/alumni"
              className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-primary px-6 py-3 text-sm font-black text-white shadow-[0_10px_24px_rgba(30,58,138,0.25)] transition hover:bg-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {copy.memoriesShareCta}
            </Link>
          </div>
        ) : (
          <div className="mt-10 columns-1 gap-6 sm:columns-2 lg:columns-3">
            {items.map((m, i) => (
              <article
                key={`${m.ownerUserId}-${m.memoryPostId}`}
                className="group animate-mem-fade-up mb-6 break-inside-avoid overflow-hidden rounded-2xl border border-slate-200/80 bg-white/85 shadow-[0_10px_36px_rgba(15,23,42,0.08)] backdrop-blur-[2px] transition duration-300 will-change-transform hover:-translate-y-1 hover:border-primary/25 hover:shadow-[0_18px_48px_rgba(30,58,138,0.14)] motion-reduce:transform-none motion-reduce:transition-none"
                style={{ animationDelay: `${i * 65}ms` }}
              >
                <div className={`relative overflow-hidden ${IMAGE_HEIGHTS[i % 3]}`}>
                  <Image
                    src={m.imageUrl}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover transition duration-500 ease-out group-hover:scale-[1.045] motion-reduce:group-hover:scale-100"
                    loading="lazy"
                  />
                  <div
                    className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/88 via-slate-950/25 to-transparent transition duration-300 group-hover:from-slate-950/92"
                    aria-hidden
                  />
                  {m.isHighlighted ? (
                    <div className="absolute start-3 top-3 inline-flex items-center gap-1 rounded-full bg-amber-400/95 px-2.5 py-1 text-[10px] font-black text-slate-900 shadow-sm ring-1 ring-white/40">
                      <Sparkles className="h-3.5 w-3.5" aria-hidden />
                      {isAr ? "مميزة" : "Featured"}
                    </div>
                  ) : null}
                  <div className="absolute inset-x-0 bottom-0 p-4 text-start text-white">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-white/90">
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 backdrop-blur-sm">
                        <Camera className="h-3.5 w-3.5" aria-hidden />
                        {memoryKind(m)}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 backdrop-blur-sm">
                        <Heart className="h-3.5 w-3.5" aria-hidden />
                        {m.likeCount} {copy.memoriesLikes}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm font-bold leading-snug text-white drop-shadow-sm">
                      {m.caption || (isAr ? "ذكرى من أيام الأنجال" : "A memory from Al-Anjal days")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 border-t border-slate-100/90 bg-white/95 px-4 py-3">
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-slate-200 ring-2 ring-primary/10">
                    {m.profilePhoto && m.profilePhoto.startsWith("https://") ? (
                      <Image src={m.profilePhoto} alt="" fill sizes="44px" className="object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary to-primary-dark text-xs font-black text-white">
                        {(m.fullName || "?").trim().charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-slate-900">{m.fullName}</p>
                    <p className="truncate text-xs font-semibold text-slate-500">{batchLabel(m)}</p>
                  </div>
                  <Link
                    href={`/alumni/${encodeURIComponent(m.ownerUserId)}`}
                    className="shrink-0 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-black text-primary transition hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    {copy.memoriesViewMemory}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
