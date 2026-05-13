"use client";

import { useCallback, useEffect, useState, type KeyboardEvent } from "react";

const clampPage = (n: number, totalPages: number) =>
  Math.min(Math.max(1, n), Math.max(1, totalPages));

const getVisiblePages = (current: number, totalPages: number): Array<number | "ellipsis"> => {
  if (totalPages <= 1) return [1];
  if (totalPages <= 9) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const windowRadius = 2;
  const set = new Set<number>();
  set.add(1);
  set.add(totalPages);
  for (let p = current - windowRadius; p <= current + windowRadius; p++) {
    if (p >= 1 && p <= totalPages) set.add(p);
  }
  const sorted = [...set].sort((a, b) => a - b);
  const out: Array<number | "ellipsis"> = [];
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    if (i > 0 && p - sorted[i - 1]! > 1) out.push("ellipsis");
    out.push(p);
  }
  return out;
};

export type AchievementReviewPaginationProps = {
  locale: "ar" | "en";
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
};

export const AchievementReviewPagination = ({
  locale,
  page,
  total,
  pageSize,
  onPageChange,
  loading = false,
}: AchievementReviewPaginationProps) => {
  const isAr = locale === "ar";
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const [goToDraft, setGoToDraft] = useState(String(page));

  useEffect(() => {
    setGoToDraft(String(page));
  }, [page]);

  const handleGoTo = useCallback(() => {
    const raw = goToDraft.trim();
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) return;
    const next = clampPage(n, totalPages);
    onPageChange(next);
    setGoToDraft(String(next));
  }, [goToDraft, onPageChange, totalPages]);

  const handleGoToKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleGoTo();
      }
    },
    [handleGoTo]
  );

  if (totalPages <= 1) return null;

  const visible = getVisiblePages(page, totalPages);
  const gotoId = "achievement-review-goto-page";

  return (
    <div className="mt-4 flex flex-col gap-3" dir={isAr ? "rtl" : "ltr"}>
      <div className="flex flex-wrap items-center justify-center gap-1">
        {visible.map((item, idx) =>
          item === "ellipsis" ? (
            <span key={`e-${idx}`} className="px-1.5 text-sm font-medium text-text-light select-none" aria-hidden>
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              disabled={loading || item === page}
              onClick={() => onPageChange(item)}
              className={`min-w-[2.25rem] rounded-lg border px-2 py-1.5 text-sm font-semibold transition disabled:cursor-not-allowed ${
                item === page
                  ? "border-primary bg-primary text-white"
                  : "border-gray-300 bg-white text-text hover:bg-gray-50 disabled:opacity-40"
              }`}
              aria-label={isAr ? `الصفحة ${item}` : `Page ${item}`}
              aria-current={item === page ? "page" : undefined}
            >
              {item}
            </button>
          )
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          disabled={loading || page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-text hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isAr ? "السابق" : "Prev"}
        </button>

        <span className="px-2 py-2 text-sm text-text-light whitespace-nowrap">
          {isAr ? (
            <>
              صفحة {page} من {totalPages}
            </>
          ) : (
            <>
              Page {page} of {totalPages}
            </>
          )}
        </span>

        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={gotoId} className="text-sm font-semibold text-text whitespace-nowrap">
            {isAr ? "الانتقال إلى صفحة" : "Go to page"}
          </label>
          <input
            id={gotoId}
            type="number"
            inputMode="numeric"
            min={1}
            max={totalPages}
            value={goToDraft}
            onChange={(e) => setGoToDraft(e.target.value)}
            onKeyDown={handleGoToKeyDown}
            disabled={loading}
            className="w-20 rounded-lg border border-gray-300 bg-white px-2 py-2 text-center text-sm font-medium text-text disabled:opacity-50"
            aria-label={isAr ? "رقم الصفحة" : "Page number"}
          />
          <button
            type="button"
            disabled={loading}
            onClick={handleGoTo}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-text hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isAr ? "انتقال" : "Go"}
          </button>
        </div>

        <button
          type="button"
          disabled={loading || page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-text hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isAr ? "التالي" : "Next"}
        </button>
      </div>
    </div>
  );
};
