"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, Images, X } from "lucide-react";
import { getLocale } from "@/lib/i18n";
import SafeLocalImage from "@/components/media/SafeLocalImage";
import type { GalleryImageRow } from "@/lib/home-gallery";

const CeremonyGallery = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [items, setItems] = useState<GalleryImageRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const thumbRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/public/home-gallery", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { ok?: boolean; items?: GalleryImageRow[] };
        const list = Array.isArray(data.items) ? data.items : [];
        if (cancelled) return;
        setItems(list);
        const featuredIdx = list.findIndex((i) => i.isCover);
        setActiveIdx(featuredIdx >= 0 ? featuredIdx : 0);
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

  const active = items[activeIdx];

  const pick = useCallback(
    (ar: string, en: string) => (isAr ? ar || en : en || ar),
    [isAr]
  );

  const goTo = useCallback(
    (idx: number) => {
      if (items.length === 0) return;
      const next = ((idx % items.length) + items.length) % items.length;
      setActiveIdx(next);
      thumbRefs.current[next]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    },
    [items.length]
  );

  const goPrev = useCallback(() => goTo(activeIdx - 1), [activeIdx, goTo]);
  const goNext = useCallback(() => goTo(activeIdx + 1), [activeIdx, goTo]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
      else if (e.key === "ArrowRight") (isAr ? goPrev : goNext)();
      else if (e.key === "ArrowLeft") (isAr ? goNext : goPrev)();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen, isAr, goPrev, goNext]);

  const dir = isAr ? "rtl" : "ltr";

  const title = useMemo(
    () => (isAr ? "معرض حفل تكريم الطلاب والطالبات" : "Student Recognition Ceremony Gallery"),
    [isAr]
  );

  if (!loaded || items.length === 0 || !active) return null;

  return (
    <section className="bg-white pb-16" dir={dir} aria-label={title}>
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex items-center justify-center gap-2 text-center">
            <Images className="h-5 w-5 text-primary" aria-hidden />
            <h3 className="text-xl font-bold leading-snug tracking-tight text-slate-900 md:text-2xl">
              {title}
            </h3>
          </div>

          <div className="relative isolate mb-4 aspect-[16/9] w-full overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200">
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="absolute inset-0 h-full w-full cursor-zoom-in"
              aria-label={isAr ? "تكبير الصورة" : "Enlarge image"}
            >
              <SafeLocalImage
                src={active.imageUrl}
                alt={pick(active.altAr, active.altEn) || title}
                fill
                priority={activeIdx === 0}
                sizes="(max-width: 768px) 100vw, 896px"
                objectFit="cover"
                className="transition-opacity duration-300"
                fallback={<div className="absolute inset-0 bg-slate-200" aria-hidden />}
              />
            </button>

            {items.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={goPrev}
                  aria-label={isAr ? "الصورة السابقة" : "Previous image"}
                  className="absolute start-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur transition hover:bg-black/60"
                >
                  {isAr ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  aria-label={isAr ? "الصورة التالية" : "Next image"}
                  className="absolute end-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur transition hover:bg-black/60"
                >
                  {isAr ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </button>
              </>
            ) : null}

            <div className="absolute bottom-3 end-3 rounded-full bg-black/50 px-3 py-1 text-xs font-semibold text-white">
              {activeIdx + 1} / {items.length}
            </div>
          </div>

          {items.length > 1 ? (
            <div
              className="flex gap-2 overflow-x-auto pb-1"
              role="tablist"
              aria-label={isAr ? "الصور المصغرة" : "Thumbnails"}
            >
              {items.map((img, idx) => {
                const isActive = idx === activeIdx;
                return (
                  <button
                    key={img.id}
                    ref={(el) => {
                      thumbRefs.current[idx] = el;
                    }}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-label={pick(img.altAr, img.altEn) || `${isAr ? "صورة" : "Image"} ${idx + 1}`}
                    onClick={() => goTo(idx)}
                    className={`relative aspect-[4/3] w-20 shrink-0 overflow-hidden rounded-lg ring-2 transition sm:w-24 ${
                      isActive ? "ring-primary" : "ring-transparent hover:ring-slate-300"
                    }`}
                  >
                    <SafeLocalImage
                      src={img.imageUrl}
                      alt={pick(img.altAr, img.altEn) || `${isAr ? "صورة" : "Image"} ${idx + 1}`}
                      fill
                      sizes="96px"
                      objectFit="cover"
                      fallback={<div className="absolute inset-0 bg-slate-200" aria-hidden />}
                    />
                    {!isActive ? <span className="absolute inset-0 bg-black/10" aria-hidden /> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      {lightboxOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            aria-label={isAr ? "إغلاق" : "Close"}
            className="absolute end-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <X className="h-6 w-6" aria-hidden />
          </button>
          <div
            className="relative h-[80vh] w-full max-w-5xl"
            onClick={(e) => e.stopPropagation()}
          >
            <SafeLocalImage
              src={active.imageUrl}
              alt={pick(active.altAr, active.altEn) || title}
              fill
              sizes="100vw"
              objectFit="contain"
              fallback={<div className="absolute inset-0 bg-slate-800" aria-hidden />}
            />
            {items.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    goPrev();
                  }}
                  aria-label={isAr ? "الصورة السابقة" : "Previous image"}
                  className="absolute start-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
                >
                  {isAr ? <ChevronRight className="h-6 w-6" /> : <ChevronLeft className="h-6 w-6" />}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    goNext();
                  }}
                  aria-label={isAr ? "الصورة التالية" : "Next image"}
                  className="absolute end-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
                >
                  {isAr ? <ChevronLeft className="h-6 w-6" /> : <ChevronRight className="h-6 w-6" />}
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default CeremonyGallery;
