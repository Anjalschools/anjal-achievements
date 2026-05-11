"use client";

import Link from "next/link";
import { memo, useMemo } from "react";
import { BadgeCheck, BookOpen, MessageCircle, User } from "lucide-react";
import type { SearchHit } from "@/lib/search/global-search";
import { escapeRegExp } from "@/lib/search/query-normalizer";
import { AlumniBadgeStrip } from "@/components/alumni/AlumniBadgeStrip";

const avatarGradient = (seed: string) => {
  const hues = [210, 225, 200, 260, 190];
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h + seed.charCodeAt(i) * (i + 1)) % hues.length;
  return hues[h] ?? 210;
};

const initialsFromName = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const Highlight = ({ text, query }: { text: string; query: string }) => {
  const tokens = useMemo(
    () =>
      query
        .split(/[\s,،؛]+/u)
        .map((x) => x.trim())
        .filter((x) => x.length >= 2),
    [query]
  );
  if (!tokens.length) return <>{text}</>;
  const re = new RegExp(`(${tokens.map((t) => escapeRegExp(t)).join("|")})`, "ig");
  const parts = text.split(re);
  return (
    <>
      {parts.map((part, i) => {
        const hit = tokens.some((t) => part.toLowerCase() === t.toLowerCase());
        return hit ? (
          <mark key={`${i}-${part}`} className="rounded bg-amber-100/90 px-0.5 text-inherit">
            {part}
          </mark>
        ) : (
          <span key={`${i}-${part}`}>{part}</span>
        );
      })}
    </>
  );
};

export type AlumniNetworkDiscoveryCardProps = {
  hit: SearchHit;
  query: string;
  profileHref: string;
  isAr: boolean;
};

const AlumniNetworkDiscoveryCardInner = ({
  hit,
  query,
  profileHref,
  isAr,
}: AlumniNetworkDiscoveryCardProps) => {
  const hue = avatarGradient(hit.id + hit.title);
  const subtitleParts = hit.subtitle ? hit.subtitle.split("·").map((s) => s.trim()).filter(Boolean) : [];
  const university = subtitleParts[0] || "";
  const company = subtitleParts[1] || "";
  const fieldLine = hit.meta?.trim() || "";
  const yearFromMeta = /^\d{4}$/.test(fieldLine) ? fieldLine : "";
  const industryOrField = yearFromMeta ? "" : fieldLine;
  const interestChips = (hit.rankHighlights || []).slice(0, 4);
  const major = hit.major?.trim() || "";
  const verified = hit.isVerifiedAlumni === true;

  return (
    <li className="break-words">
      <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-[0_16px_48px_-28px_rgba(15,23,42,0.35)] transition duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-[0_24px_56px_-24px_rgba(30,58,138,0.4)]">
        <div className="relative flex gap-4 p-5">
          <div
            className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-lg font-black text-white shadow-inner ring-2 ring-white/40"
            style={{
              background: `linear-gradient(145deg, hsl(${hue}, 55%, 38%) 0%, hsl(${hue}, 45%, 22%) 100%)`,
            }}
            aria-hidden
          >
            {initialsFromName(hit.title)}
            <span className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-white/25 to-transparent opacity-60" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-black leading-tight text-slate-900">
                <Highlight text={hit.title} query={query} />
              </h3>
              {hit.type === "mentor" ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-800">
                  {isAr ? "مرشد" : "Mentor"}
                </span>
              ) : (
                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-sky-900">
                  {isAr ? "خريج" : "Alumni"}
                </span>
              )}
              {verified ? (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-950 ring-1 ring-amber-200/80">
                  <BadgeCheck className="h-3 w-3" aria-hidden />
                  {isAr ? "موثّق" : "Verified"}
                </span>
              ) : null}
            </div>
            {hit.badges?.length ? (
              <div className="mt-2">
                <AlumniBadgeStrip badges={hit.badges} isAr={isAr} max={4} dense />
              </div>
            ) : null}
            {university ? (
              <p className="mt-1.5 inline-flex max-w-full items-center gap-1 text-sm font-semibold text-slate-700">
                <span className="truncate rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-700 ring-1 ring-slate-200/80">
                  {isAr ? "جامعة" : "University"}
                </span>
                <Highlight text={university} query={query} />
              </p>
            ) : null}
            {company ? (
              <p className="mt-0.5 text-xs font-medium text-slate-500">
                <Highlight text={company} query={query} />
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2">
              {yearFromMeta ? (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
                  {isAr ? `تخرج ${yearFromMeta}` : `Class of ${yearFromMeta}`}
                </span>
              ) : null}
              {major ? (
                <span className="inline-flex items-center gap-0.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[11px] font-bold text-violet-900">
                  <BookOpen className="h-3 w-3 shrink-0" aria-hidden />
                  <span className="max-w-[120px] truncate">{major}</span>
                </span>
              ) : null}
              {industryOrField ? (
                <span className="rounded-full border border-primary/15 bg-primary/5 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                  <Highlight text={industryOrField} query={query} />
                </span>
              ) : null}
            </div>
            {interestChips.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {interestChips.map((x) => (
                  <span
                    key={x}
                    className="rounded-full border border-slate-200/80 bg-gradient-to-r from-slate-50 to-white px-2 py-0.5 text-[10px] font-semibold text-slate-600"
                  >
                    {x}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
          <span className="flex items-center gap-1 text-[11px] font-bold text-slate-400">
            <User className="h-3.5 w-3.5" aria-hidden />
            {isAr ? "ملف مهني" : "Professional profile"}
          </span>
          <Link
            href={profileHref}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-black text-white shadow-md shadow-primary/25 transition group-hover:opacity-95"
          >
            <MessageCircle className="h-3.5 w-3.5" aria-hidden />
            {isAr ? "تواصل / عرض" : "View / connect"}
          </Link>
        </div>
      </article>
    </li>
  );
};

export const AlumniNetworkDiscoveryCard = memo(AlumniNetworkDiscoveryCardInner);
AlumniNetworkDiscoveryCard.displayName = "AlumniNetworkDiscoveryCard";
