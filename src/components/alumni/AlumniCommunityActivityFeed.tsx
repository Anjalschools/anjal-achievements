"use client";

import Link from "next/link";
import { memo, useMemo } from "react";
import type { CommunityFeedItem, CommunityFeedKind } from "@/lib/alumni/community-activation-types";
import { formatRelativeTime } from "@/lib/alumni/format-relative-time";
import {
  ArrowRight,
  Briefcase,
  Camera,
  HeartHandshake,
  Sparkles,
  UserPlus,
  Award,
  Globe,
} from "lucide-react";

const kindIcon = (kind: CommunityFeedKind) => {
  switch (kind) {
    case "member_joined":
      return UserPlus;
    case "job_update":
      return Briefcase;
    case "memory_shared":
      return Camera;
    case "certificate_added":
      return Award;
    case "portfolio_live":
      return Globe;
    case "mentor_live":
      return HeartHandshake;
    default:
      return Sparkles;
  }
};

const kindLabel = (kind: CommunityFeedKind, isAr: boolean, meta?: string): { title: string; cta: string } => {
  if (kind === "pulse") {
    const n = meta || "0";
    return isAr
      ? {
          title: `أكثر من ${n} خريج في الشبكة المهنية`,
          cta: "استكشف الشبكة",
        }
      : {
          title: `Over ${n} alumni in the professional network`,
          cta: "Explore network",
        };
  }
  const map: Record<CommunityFeedKind, { ar: { title: string; cta: string }; en: { title: string; cta: string } }> = {
    member_joined: { ar: { title: "انضم حديثًا إلى المجتمع", cta: "عرض الملف" }, en: { title: "Joined the community", cta: "View profile" } },
    job_update: { ar: { title: "حدّث مساره المهني", cta: "عرض الملف" }, en: { title: "Updated their career path", cta: "View profile" } },
    memory_shared: { ar: { title: "شارك ذكرى من الأنجال", cta: "عرض" }, en: { title: "Shared a school memory", cta: "View" } },
    certificate_added: { ar: { title: "أضاف شهادة إنجاز", cta: "عرض" }, en: { title: "Added an achievement certificate", cta: "View" } },
    portfolio_live: { ar: { title: "فعّل الملف العام للإنجاز", cta: "عرض" }, en: { title: "Activated public portfolio", cta: "View" } },
    mentor_live: { ar: { title: "أصبح مرشدًا مهنيًا", cta: "طلب إرشاد" }, en: { title: "Became a professional mentor", cta: "Request mentoring" } },
    pulse: { ar: { title: "", cta: "" }, en: { title: "", cta: "" } },
  };
  const row = map[kind];
  return isAr ? row.ar : row.en;
};

type Props = {
  items: CommunityFeedItem[];
  isAr: boolean;
  loading?: boolean;
};

export const AlumniCommunityActivityFeed = memo(({ items, isAr, loading }: Props) => {
  const dir = isAr ? "rtl" : "ltr";

  const lines = useMemo(() => {
    return items.map((it) => {
      const Icon = kindIcon(it.kind);
      const { title, cta } = kindLabel(it.kind, isAr, it.meta);
      const rel = formatRelativeTime(it.at, isAr);
      const name = it.actorName || (it.kind === "pulse" ? (isAr ? "المجتمع" : "Community") : "");
      const showAvatar = Boolean(it.actorPhoto) && it.kind !== "pulse";
      return (
        <li key={it.id} className="list-none">
          <Link
            href={it.href}
            className="group relative flex gap-3 overflow-hidden rounded-2xl border border-transparent bg-gradient-to-br from-white to-slate-50/90 p-3 shadow-[0_8px_28px_-18px_rgba(15,23,42,0.45)] ring-1 ring-slate-200/80 transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_36px_-16px_rgba(30,58,138,0.35)] hover:ring-primary/25"
            dir={dir}
          >
            <span
              className="pointer-events-none absolute inset-px rounded-2xl opacity-0 transition group-hover:opacity-100"
              style={{
                background: "linear-gradient(135deg, rgba(59,130,246,0.08), rgba(212,175,55,0.06))",
              }}
              aria-hidden
            />
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-slate-800 to-primary text-white shadow-inner ring-1 ring-white/20">
              {showAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.actorPhoto!} alt="" className="h-full w-full object-cover" />
              ) : (
                <Icon className="h-5 w-5" aria-hidden />
              )}
            </div>
            <div className="relative min-w-0 flex-1">
              <p className="truncate text-sm font-black text-slate-900">{name}</p>
              <p className="mt-0.5 text-xs font-semibold text-slate-600">{title}</p>
              {it.meta && it.kind !== "pulse" ? (
                <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">{it.meta}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{rel}</span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-black text-primary transition group-hover:bg-primary/15">
                  {cta}
                </span>
              </div>
            </div>
            <ArrowRight
              className={`relative mt-1 h-4 w-4 shrink-0 text-slate-300 opacity-0 transition group-hover:opacity-100 ${isAr ? "rotate-180" : ""}`}
              aria-hidden
            />
          </Link>
        </li>
      );
    });
  }, [items, isAr, dir]);

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2" aria-hidden>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <div
        className="rounded-3xl border border-dashed border-slate-200 bg-gradient-to-br from-slate-50 to-white px-6 py-10 text-center"
        dir={dir}
      >
        <Sparkles className="mx-auto mb-3 h-10 w-10 text-primary/40" aria-hidden />
        <p className="text-sm font-bold text-slate-700">
          {isAr ? "ستظهر هنا أحدث حركة في المجتمع قريبًا." : "Community highlights will appear here soon."}
        </p>
        <Link href="/search" className="mt-3 inline-block text-sm font-black text-primary underline">
          {isAr ? "استكشف الخريجين" : "Discover alumni"}
        </Link>
      </div>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" dir={dir}>
      {lines}
    </ul>
  );
});
AlumniCommunityActivityFeed.displayName = "AlumniCommunityActivityFeed";
