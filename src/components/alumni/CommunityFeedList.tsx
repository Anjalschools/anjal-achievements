"use client";

import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import type { CommunityFeedItem } from "@/lib/alumni/community-feed-service";
import { formatRelativeTime } from "@/lib/alumni/format-relative-time";

const kindLabel = (kind: string, isAr: boolean) => {
  const map: Record<string, { ar: string; en: string }> = {
    memory: { ar: "ذكرى", en: "Memory" },
    opportunity: { ar: "فرصة", en: "Opportunity" },
    story: { ar: "قصة", en: "Story" },
    mentor: { ar: "مرشد", en: "Mentor" },
  };
  const row = map[kind] || { ar: kind, en: kind };
  return isAr ? row.ar : row.en;
};

const kindBadgeClass: Record<string, string> = {
  memory: "bg-violet-100 text-violet-900",
  opportunity: "bg-amber-100 text-amber-950",
  story: "bg-sky-100 text-sky-950",
  mentor: "bg-emerald-100 text-emerald-900",
};

export type CommunityFeedListProps = {
  items: CommunityFeedItem[];
  loading: boolean;
  isAr: boolean;
  emptyLabelAr: string;
  emptyLabelEn: string;
};

const CommunityFeedList = ({ items, loading, isAr, emptyLabelAr, emptyLabelEn }: CommunityFeedListProps) => {
  if (loading) {
    return (
      <div className="flex min-h-32 items-center justify-center text-sm text-slate-500" role="status">
        {isAr ? "جاري تحميل التغذية…" : "Loading feed…"}
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
        {isAr ? emptyLabelAr : emptyLabelEn}
      </div>
    );
  }

  return (
    <ul className="space-y-3" aria-label={isAr ? "تغذية المجتمع" : "Community feed"}>
      {items.map((row) => {
        const rel = row.at ? formatRelativeTime(row.at, isAr) : "";
        const badge = kindBadgeClass[row.kind] || "bg-slate-100 text-slate-800";
        const inner = (
          <div className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-teal-200 hover:shadow-md">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <LayoutGrid className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${badge}`}>
                  {kindLabel(row.kind, isAr)}
                </span>
                {row.rank > 0 ? (
                  <span className="text-[10px] font-semibold text-slate-500">
                    {isAr ? `تفاعل ${row.rank}` : `Engagement ${row.rank}`}
                  </span>
                ) : null}
              </div>
              <p className="truncate font-bold text-slate-900">{row.title}</p>
              {row.subtitle ? <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{row.subtitle}</p> : null}
              <p className="mt-1 text-[10px] font-bold text-slate-500 tabular-nums">
                {isAr ? "إعجاب" : "Like"} {row.likes ?? 0} · {isAr ? "حفظ" : "Save"} {row.saves ?? 0} ·{" "}
                {isAr ? "مشاركة" : "Share"} {row.shares ?? 0}
              </p>
              {rel ? <p className="mt-1 text-[11px] font-semibold text-slate-400">{rel}</p> : null}
            </div>
          </div>
        );
        return (
          <li key={`${row.kind}-${row.id}`}>
            {row.href ? (
              <Link href={row.href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded-xl">
                {inner}
              </Link>
            ) : (
              inner
            )}
          </li>
        );
      })}
    </ul>
  );
};

export default CommunityFeedList;
