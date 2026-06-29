"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Maximize2, Minimize2, X, ZoomIn, ZoomOut } from "lucide-react";

import type { PublicPortfolioEvidenceItem } from "@/lib/portfolio/portfolio-evidence-types";
import { buildPortfolioEvidenceUrl } from "@/lib/portfolio/portfolio-evidence-url";

type PublicPortfolioEvidenceViewerProps = {
  items: PublicPortfolioEvidenceItem[];
  initialIndex: number;
  slug: string;
  token: string;
  isAr: boolean;
  onClose: () => void;
};

const PublicPortfolioEvidenceViewer = ({
  items,
  initialIndex,
  slug,
  token,
  isAr,
  onClose,
}: PublicPortfolioEvidenceViewerProps) => {
  const [index, setIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);

  const current = items[index];
  const inlineUrl = current
    ? buildPortfolioEvidenceUrl({ slug, token, ref: current.ref, disposition: "inline" })
    : "";
  const downloadUrl = current
    ? buildPortfolioEvidenceUrl({ slug, token, ref: current.ref, disposition: "attachment" })
    : "";

  const goPrev = useCallback(() => {
    setZoom(1);
    setIndex((value) => (value <= 0 ? items.length - 1 : value - 1));
  }, [items.length]);

  const goNext = useCallback(() => {
    setZoom(1);
    setIndex((value) => (value >= items.length - 1 ? 0 : value + 1));
  }, [items.length]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") goPrev();
      if (event.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goNext, goPrev, onClose]);

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={current.name}
      onClick={onClose}
    >
      <div
        className={`relative flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ${
          fullscreen ? "h-[96vh]" : "max-h-[90vh]"
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">{current.name}</p>
            <p className="text-xs text-slate-500">
              {index + 1} / {items.length}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {current.kind === "image" ? (
              <>
                <button
                  type="button"
                  className="rounded-lg p-2 text-slate-700 hover:bg-slate-100"
                  onClick={() => setZoom((value) => Math.max(1, value - 0.25))}
                  aria-label={isAr ? "تصغير" : "Zoom out"}
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="rounded-lg p-2 text-slate-700 hover:bg-slate-100"
                  onClick={() => setZoom((value) => Math.min(3, value + 0.25))}
                  aria-label={isAr ? "تكبير" : "Zoom in"}
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
              </>
            ) : null}
            <button
              type="button"
              className="rounded-lg p-2 text-slate-700 hover:bg-slate-100"
              onClick={() => setFullscreen((value) => !value)}
              aria-label={isAr ? "ملء الشاشة" : "Fullscreen"}
            >
              {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <a
              href={downloadUrl}
              className="rounded-lg p-2 text-slate-700 hover:bg-slate-100"
              aria-label={isAr ? "تنزيل" : "Download"}
            >
              <Download className="h-4 w-4" />
            </a>
            <button
              type="button"
              className="rounded-lg p-2 text-slate-700 hover:bg-slate-100"
              onClick={onClose}
              aria-label={isAr ? "إغلاق" : "Close"}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="relative flex min-h-[50vh] flex-1 items-center justify-center bg-slate-100 p-3">
          {items.length > 1 ? (
            <button
              type="button"
              className="absolute start-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow"
              onClick={goPrev}
              aria-label={isAr ? "السابق" : "Previous"}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : null}

          {current.kind === "pdf" ? (
            <iframe
              title={current.name}
              src={inlineUrl}
              className="h-full min-h-[50vh] w-full rounded-lg border border-slate-200 bg-white"
            />
          ) : current.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={inlineUrl}
              alt={current.name}
              loading="lazy"
              className="max-h-[70vh] max-w-full object-contain transition-transform duration-200"
              style={{ transform: `scale(${zoom})` }}
            />
          ) : (
            <iframe title={current.name} src={inlineUrl} className="h-full min-h-[50vh] w-full rounded-lg bg-white" />
          )}

          {items.length > 1 ? (
            <button
              type="button"
              className="absolute end-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow"
              onClick={goNext}
              aria-label={isAr ? "التالي" : "Next"}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default PublicPortfolioEvidenceViewer;
