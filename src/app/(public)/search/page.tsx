"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { initLocale, getLocale } from "@/lib/i18n";
import type { SearchHit } from "@/lib/search/global-search";
import { escapeRegExp } from "@/lib/search/query-normalizer";
import { smartSearchSuggestions } from "@/lib/search/semantic/semantic-search";

const RECENT_KEY = "alumni-unified-search-recent-v1";

type TabId =
  | "global"
  | "alumni"
  | "universities"
  | "careers"
  | "opportunities"
  | "events"
  | "stories"
  | "mentors"
  | "cohorts";

type GlobalBundle = {
  alumni: SearchHit[];
  opportunities: SearchHit[];
  events: SearchHit[];
  stories: SearchHit[];
  mentors: SearchHit[];
  cohorts: SearchHit[];
  totals: Record<string, number>;
};

const tabToPath: Record<TabId, string> = {
  global: "/api/search/global",
  alumni: "/api/search/alumni",
  universities: "/api/search/universities",
  careers: "/api/search/careers",
  opportunities: "/api/search/opportunities",
  events: "/api/search/events",
  stories: "/api/search/stories",
  mentors: "/api/search/mentors",
  cohorts: "/api/search/cohorts",
};

const readRecent = (): string[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const v = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 8) : [];
  } catch {
    return [];
  }
};

const writeRecent = (q: string) => {
  const t = q.trim();
  if (t.length < 2) return;
  const prev = readRecent().filter((x) => x.toLowerCase() !== t.toLowerCase());
  prev.unshift(t);
  localStorage.setItem(RECENT_KEY, JSON.stringify(prev.slice(0, 8)));
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
          <mark key={`${i}-${part}`} className="rounded bg-amber-100 px-0.5 text-inherit">
            {part}
          </mark>
        ) : (
          <span key={`${i}-${part}`}>{part}</span>
        );
      })}
    </>
  );
};

const hitHref = (h: SearchHit): string => {
  switch (h.type) {
    case "alumni":
    case "mentor":
      return `/alumni/${h.id}`;
    case "university":
      return `/alumni/network/universities?q=${encodeURIComponent(h.title)}`;
    case "career":
      return `/alumni/network/careers?q=${encodeURIComponent(h.title)}`;
    case "opportunity":
      return `/alumni/opportunities`;
    case "event":
      return h.slug ? `/alumni/events/${h.slug}` : `/alumni/events`;
    case "story":
      return h.slug ? `/alumni/stories/${h.slug}` : `/alumni/stories`;
    case "cohort":
      return h.cohortYear ? `/alumni/cohorts/${h.cohortYear}` : `/alumni/cohorts`;
    default:
      return `/alumni`;
  }
};

const SkeletonList = () => (
  <div className="space-y-3" aria-hidden>
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
    ))}
  </div>
);

export default function UnifiedSearchPage() {
  const [locale, setLocale] = useState<"ar" | "en">("ar");
  const [tab, setTab] = useState<TabId>("global");
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [globalData, setGlobalData] = useState<GlobalBundle | null>(null);
  const [totalEstimate, setTotalEstimate] = useState(0);

  useEffect(() => {
    initLocale();
    setLocale(getLocale() === "en" ? "en" : "ar");
    setRecent(readRecent());
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 320);
    return () => clearTimeout(t);
  }, [q]);

  const suggestions = useMemo(() => smartSearchSuggestions(), []);

  const labels: Record<TabId, { ar: string; en: string }> = {
    global: { ar: "الكل", en: "All" },
    alumni: { ar: "الخريجون", en: "Alumni" },
    universities: { ar: "الجامعات", en: "Universities" },
    careers: { ar: "المسارات", en: "Careers" },
    opportunities: { ar: "الفرص", en: "Opportunities" },
    events: { ar: "الفعاليات", en: "Events" },
    stories: { ar: "القصص", en: "Stories" },
    mentors: { ar: "المرشدون", en: "Mentors" },
    cohorts: { ar: "الدفعات", en: "Cohorts" },
  };

  const runSearch = useCallback(async () => {
    const query = debounced.trim();
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      params.set("page", "1");
      params.set("pageSize", tab === "global" ? "12" : "16");
      if ((tab === "alumni" || tab === "mentors") && verifiedOnly) params.set("verified", "1");

      const path = tabToPath[tab];
      const res = await fetch(`${path}?${params.toString()}`, { cache: "no-store" });
      const j = await res.json();
      if (!j.ok) {
        setHits([]);
        setGlobalData(null);
        setTotalEstimate(0);
        return;
      }
      if (tab === "global") {
        setGlobalData(j.data as GlobalBundle);
        setHits([]);
        setTotalEstimate(0);
      } else {
        setGlobalData(null);
        const items = (j.data?.items || []) as SearchHit[];
        setHits(items);
        setTotalEstimate(Number(j.data?.totalEstimate || items.length));
      }
      if (query.length >= 2) {
        writeRecent(query);
        setRecent(readRecent());
      }
    } finally {
      setLoading(false);
    }
  }, [debounced, tab, verifiedOnly]);

  useEffect(() => {
    void runSearch();
  }, [runSearch]);

  const t = (row: { ar: string; en: string }) => (locale === "en" ? row.en : row.ar);

  const renderHit = (h: SearchHit) => (
    <li key={`${h.type}-${h.id}`}>
      <Link
        href={hitHref(h)}
        className="flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase text-primary/80">{h.type}</span>
          {h.rankHighlights?.length ? (
            <span className="flex flex-wrap gap-1">
              {h.rankHighlights.slice(0, 4).map((x) => (
                <span key={x} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                  {x}
                </span>
              ))}
            </span>
          ) : null}
        </div>
        <p className="text-base font-black text-slate-900">
          <Highlight text={h.title} query={debounced} />
        </p>
        {h.subtitle ? (
          <p className="text-sm text-slate-600">
            <Highlight text={h.subtitle} query={debounced} />
          </p>
        ) : null}
        {h.meta ? <p className="text-xs text-slate-400">{h.meta}</p> : null}
      </Link>
    </li>
  );

  const emptyTitle = locale === "ar" ? "ابدأ بالبحث في مجتمع الخريجين" : "Start searching the alumni network";
  const emptyHint =
    locale === "ar"
      ? "جرّب الاسم، الجامعة، الشركة، السنة، أو مجال العمل."
      : "Try a name, university, company, graduation year, or industry.";

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10" dir={locale === "ar" ? "rtl" : "ltr"}>
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-primary">{locale === "ar" ? "استكشاف" : "Discover"}</p>
          <h1 className="text-3xl font-black text-slate-900">
            {locale === "ar" ? "بحث موحّد في منصة الخريجين" : "Unified alumni intelligence search"}
          </h1>
          <p className="text-sm text-slate-600">
            {locale === "ar"
              ? "جمع النتائج من الملفات، الفعاليات، الفرص، القصص، والإرشاد — مع ترتيب ذكي وخصوصية محترمة."
              : "Search profiles, events, opportunities, stories, and mentorship with ranked results and privacy-aware visibility."}
          </p>
        </header>

        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <label className="block text-xs font-bold text-slate-500" htmlFor="unified-search-input">
            {locale === "ar" ? "كلمة البحث" : "Search query"}
          </label>
          <input
            id="unified-search-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={locale === "ar" ? "مثال: هندسة كهربائية، بوسطن، أرامكو…" : "e.g. electrical engineering, Boston, Aramco…"}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none ring-primary/30 focus:ring-2"
            autoComplete="off"
            aria-label={locale === "ar" ? "حقل البحث الموحد" : "Unified search field"}
          />

          <div className="mt-4 flex flex-wrap gap-2 overflow-x-auto pb-1" role="tablist" aria-label={locale === "ar" ? "أنواع البحث" : "Search scopes"}>
            {(Object.keys(tabToPath) as TabId[]).map((id) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(id)}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition ${
                    active ? "bg-primary text-white shadow" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {t(labels[id])}
                </button>
              );
            })}
          </div>

          {(tab === "alumni" || tab === "mentors") && (
            <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm font-bold text-slate-700">
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(e) => setVerifiedOnly(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary"
              />
              {locale === "ar" ? "خريجون موثّقون فقط" : "Verified alumni only"}
            </label>
          )}
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-black text-slate-900">{locale === "ar" ? "النتائج" : "Results"}</h2>
            {tab !== "global" && totalEstimate > 0 ? (
              <span className="text-xs font-bold text-slate-500 tabular-nums">
                {locale === "ar" ? `تقدير: ${totalEstimate}` : `Estimate: ${totalEstimate}`}
              </span>
            ) : null}
          </div>

          {loading ? (
            <div className="mt-6">
              <SkeletonList />
            </div>
          ) : tab === "global" && !globalData ? (
            <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-600">
              {locale === "ar" ? "تعذر تحميل نتائج البحث الشامل." : "Could not load blended search results."}
            </div>
          ) : tab === "global" && globalData ? (
            <div className="mt-6 space-y-8">
              {(
                [
                  ["alumni", globalData.alumni],
                  ["mentors", globalData.mentors],
                  ["opportunities", globalData.opportunities],
                  ["events", globalData.events],
                  ["stories", globalData.stories],
                  ["cohorts", globalData.cohorts],
                ] as const
              ).map(([key, list]) => (
                <div key={key}>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-black uppercase text-slate-700">{key}</h3>
                    <span className="text-xs text-slate-400 tabular-nums">
                      {globalData.totals?.[key as keyof typeof globalData.totals] ?? list.length}
                    </span>
                  </div>
                  {list.length === 0 ? (
                    <p className="text-sm text-slate-500">{locale === "ar" ? "لا نتائج في هذا القسم" : "No matches in this bucket"}</p>
                  ) : (
                    <ul className="grid gap-3 sm:grid-cols-2">{list.map((h) => renderHit(h))}</ul>
                  )}
                </div>
              ))}
            </div>
          ) : tab !== "global" && hits.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
              <p className="text-base font-bold text-slate-800">{emptyTitle}</p>
              <p className="mt-2 text-sm text-slate-600">{emptyHint}</p>
            </div>
          ) : (
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">{hits.map((h) => renderHit(h))}</ul>
          )}
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-black text-slate-900">{locale === "ar" ? "اقتراحات ذكية" : "Smart suggestions"}</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-primary/10"
                  onClick={() => setQ(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-black text-slate-900">{locale === "ar" ? "عمليات بحث حديثة" : "Recent searches"}</h3>
            {recent.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">{locale === "ar" ? "ستظهر هنا بعد أول بحث." : "Appear here after your first query."}</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {recent.map((r) => (
                  <li key={r}>
                    <button type="button" className="text-sm font-bold text-primary hover:underline" onClick={() => setQ(r)}>
                      {r}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
