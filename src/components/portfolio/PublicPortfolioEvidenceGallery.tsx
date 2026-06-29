"use client";

import { useMemo, useState } from "react";
import { FileText, ImageIcon } from "lucide-react";

import type { PublicPortfolioEvidenceItem } from "@/lib/portfolio/portfolio-evidence-types";
import {
  filterPublicPortfolioEvidenceItems,
  type PortfolioEvidenceFilter,
} from "@/lib/portfolio/portfolio-evidence-policy";
import { buildPortfolioEvidenceUrl } from "@/lib/portfolio/portfolio-evidence-url";
import PublicPortfolioEvidenceViewer from "@/components/portfolio/PublicPortfolioEvidenceViewer";

type PublicPortfolioEvidenceGalleryProps = {
  items: PublicPortfolioEvidenceItem[];
  slug: string;
  token: string;
  isAr: boolean;
};

const filterOptions: Array<{ id: PortfolioEvidenceFilter; ar: string; en: string }> = [
  { id: "all", ar: "الكل", en: "All" },
  { id: "certificate", ar: "الشهادات", en: "Certificates" },
  { id: "photo", ar: "الصور", en: "Photos" },
  { id: "pdf", ar: "PDF", en: "PDF" },
];

const PublicPortfolioEvidenceGallery = ({
  items,
  slug,
  token,
  isAr,
}: PublicPortfolioEvidenceGalleryProps) => {
  const [filter, setFilter] = useState<PortfolioEvidenceFilter>("all");
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const filtered = useMemo(
    () => filterPublicPortfolioEvidenceItems(items, filter),
    [items, filter]
  );

  if (items.length === 0) return null;

  return (
    <section className="mt-5 border-t border-slate-200/80 pt-4" aria-label={isAr ? "معرض الأدلة" : "Evidence gallery"}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-bold text-slate-800">
          {isAr ? "معرض الأدلة" : "Evidence Gallery"}
        </h4>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={isAr ? "تصفية الأدلة" : "Filter evidence"}>
          {filterOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={filter === option.id}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                filter === option.id
                  ? "bg-[#0a2744] text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
              onClick={() => setFilter(option.id)}
            >
              {isAr ? option.ar : option.en}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-xs text-slate-500">
          {isAr ? "لا توجد أدلة في هذا التصنيف." : "No evidence in this category."}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((item, index) => (
            <button
              key={item.ref}
              type="button"
              className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white text-start shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
              onClick={() => setViewerIndex(index)}
              aria-label={item.name}
            >
              <div className="flex aspect-[4/3] items-center justify-center bg-slate-50">
                {item.kind === "pdf" ? (
                  <FileText className="h-10 w-10 text-rose-600/80" aria-hidden />
                ) : item.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={buildPortfolioEvidenceUrl({
                      slug,
                      token,
                      ref: item.ref,
                      disposition: "inline",
                    })}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                  />
                ) : (
                  <ImageIcon className="h-10 w-10 text-sky-700/80" aria-hidden />
                )}
              </div>
              <div className="border-t border-slate-100 px-2 py-2">
                <p className="line-clamp-2 text-[11px] font-semibold text-slate-800">{item.name}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {viewerIndex !== null ? (
        <PublicPortfolioEvidenceViewer
          items={filtered}
          initialIndex={viewerIndex}
          slug={slug}
          token={token}
          isAr={isAr}
          onClose={() => setViewerIndex(null)}
        />
      ) : null}
    </section>
  );
};

export default PublicPortfolioEvidenceGallery;
