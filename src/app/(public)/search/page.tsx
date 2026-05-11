"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { initLocale, getLocale } from "@/lib/i18n";
import type { SearchHit } from "@/lib/search/global-search";
import { escapeRegExp } from "@/lib/search/query-normalizer";
import { smartSearchSuggestions } from "@/lib/search/semantic/semantic-search";
import { AlumniCommunityAccessGate } from "@/components/alumni/AlumniCommunityAccessGate";
import AlumniPageHeader from "@/components/alumni/AlumniPageHeader";
import AlumniEmptyState from "@/components/alumni/AlumniEmptyState";
import { Compass, Search as SearchIcon } from "lucide-react";
import { AlumniNetworkDiscoveryCard } from "@/components/alumni/AlumniNetworkDiscoveryCard";

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
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
    {Array.from({ length: 9 }).map((_, i) => (
      <div key={i} className="h-36 animate-pulse rounded-3xl bg-gradient-to-br from-slate-100 to-slate-50" />
    ))}
  </div>
);

function UnifiedSearchPageInner() {
  const [locale, setLocale] = useState<"ar" | "en">("ar");
  const [tab, setTab] = useState<TabId>("global");
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const searchAbortRef = useRef<AbortController | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [globalData, setGlobalData] = useState<GlobalBundle | null>(null);
  const [searchHints, setSearchHints] = useState<{
    trendingMajors: { name: string; count: number }[];
    trendingUniversities: { name: string; count: number }[];
  } | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    initLocale();
    setLocale(getLocale() === "en" ? "en" : "ar");
    setRecent(readRecent());
  }, []);

  useEffect(() => {
    let m = true;
    void (async () => {
      try {
        const res = await fetch("/api/alumni/search-hints", { credentials: "include", cache: "no-store" });
        if (!res.ok) return;
        const j = (await res.json()) as {
          ok?: boolean;
          trendingMajors?: { name: string; count: number }[];
          trendingUniversities?: { name: string; count: number }[];
        };
        if (m && j.ok) {
          setSearchHints({
            trendingMajors: Array.isArray(j.trendingMajors) ? j.trendingMajors : [],
            trendingUniversities: Array.isArray(j.trendingUniversities) ? j.trendingUniversities : [],
          });
        }
      } catch {
        /* optional — hints require alumni session */
      }
    })();
    return () => {
      m = false;
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 420);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    return () => {
      searchAbortRef.current?.abort();
    };
  }, []);

  const suggestions = useMemo(() => smartSearchSuggestions(), []);

  const datalistOptions = useMemo(() => {
    const majors = searchHints?.trendingMajors?.map((x) => x.name).filter(Boolean) ?? [];
    const unis = searchHints?.trendingUniversities?.map((x) => x.name).filter(Boolean) ?? [];
    const merged = [...suggestions, ...majors, ...unis];
    return [...new Set(merged)].slice(0, 48);
  }, [searchHints, suggestions]);

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
    searchAbortRef.current?.abort();
    const ac = new AbortController();
    searchAbortRef.current = ac;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      params.set("page", "1");
      params.set("pageSize", tab === "global" ? "12" : "16");
      if ((tab === "alumni" || tab === "mentors") && verifiedOnly) params.set("verified", "1");

      const path = tabToPath[tab];
      const res = await fetch(`${path}?${params.toString()}`, {
        cache: "no-store",
        credentials: "include",
        signal: ac.signal,
      });
      const j = await res.json();
      if (ac.signal.aborted) return;
      if (!res.ok || !j.ok) {
        setSearchError(locale === "ar" ? "تعذر تنفيذ البحث. تحقق من الجلسة أو حاول لاحقًا." : "Search could not run. Check your session or try again.");
        setHits([]);
        setGlobalData(null);
        return;
      }
      setSearchError(null);
      if (tab === "global") {
        setGlobalData(j.data as GlobalBundle);
        setHits([]);
      } else {
        setGlobalData(null);
        const items = (j.data?.items || []) as SearchHit[];
        setHits(items);
      }
      if (query.length >= 2) {
        writeRecent(query);
        setRecent(readRecent());
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setSearchError(locale === "ar" ? "تعذر تنفيذ البحث." : "Search was cancelled or failed.");
      setHits([]);
      setGlobalData(null);
    } finally {
      if (searchAbortRef.current === ac) setLoading(false);
    }
  }, [debounced, locale, tab, verifiedOnly]);

  useEffect(() => {
    void runSearch();
  }, [runSearch]);

  const t = (row: { ar: string; en: string }) => (locale === "en" ? row.en : row.ar);

  const renderHit = (h: SearchHit) => {
    if (h.type === "alumni" || h.type === "mentor") {
      return (
        <AlumniNetworkDiscoveryCard
          key={`${h.type}-${h.id}`}
          hit={h}
          query={debounced}
          profileHref={hitHref(h)}
          isAr={locale === "ar"}
        />
      );
    }
    return (
      <li key={`${h.type}-${h.id}`} className="break-words">
        <Link
          href={hitHref(h)}
          className="group flex h-full flex-col gap-2 rounded-3xl border border-slate-200/90 bg-white p-5 shadow-[0_12px_40px_-28px_rgba(15,23,42,0.35)] transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_20px_50px_-24px_rgba(30,58,138,0.35)]"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-primary">
              {h.type}
            </span>
            {h.rankHighlights?.length ? (
              <span className="flex flex-wrap gap-1">
                {h.rankHighlights.slice(0, 3).map((x) => (
                  <span
                    key={x}
                    className="rounded-full border border-slate-200/80 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600"
                  >
                    {x}
                  </span>
                ))}
              </span>
            ) : null}
          </div>
          <p className="text-base font-black leading-snug text-slate-900">
            <Highlight text={h.title} query={debounced} />
          </p>
          {h.subtitle ? (
            <p className="line-clamp-3 text-sm leading-relaxed text-slate-600">
              <Highlight text={h.subtitle} query={debounced} />
            </p>
          ) : null}
          {h.meta ? (
            <p className="mt-auto pt-2 text-xs font-medium text-slate-400">{h.meta}</p>
          ) : null}
        </Link>
      </li>
    );
  };

  const emptyTitle = locale === "ar" ? "ابدأ بالبحث في مجتمع الخريجين" : "Start searching the alumni network";
  const emptyHint =
    locale === "ar"
      ? "جرّب الاسم، الجامعة، الشركة، السنة، أو مجال العمل."
      : "Try a name, university, company, graduation year, or industry.";
  const noMatchTitle = locale === "ar" ? "لا توجد نتائج مطابقة" : "No matching results";
  const noMatchHint =
    locale === "ar"
      ? "جرّب كلمات أخرى، أو غيّر نطاق البحث (الكل، الخريجون، الدفعات…)."
      : "Try different words or change the search scope (All, Alumni, Cohorts…).";
  const hasQuery = debounced.trim().length >= 1;

  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:py-10" dir={dir}>
      <div className="mx-auto max-w-6xl space-y-8">
        <AlumniPageHeader
          title={locale === "ar" ? "بحث مجتمع الخريجين" : "Alumni network search"}
          description={
            locale === "ar"
              ? "جمع النتائج من الملفات، الفعاليات، الفرص، القصص، والإرشاد — مع ترتيب ذكي وخصوصية محترمة."
              : "Search profiles, events, opportunities, stories, and mentorship with ranked results and privacy-aware visibility."
          }
          smartBack
          backLabel={locale === "ar" ? "رجوع" : "Back"}
          icon={<Compass className="h-6 w-6 text-white" aria-hidden />}
          breadcrumb={[
            { label: locale === "ar" ? "الخريجون" : "Alumni", href: "/alumni" },
            { label: locale === "ar" ? "البحث" : "Search" },
          ]}
          dir={dir}
        />

        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_16px_50px_-28px_rgba(15,23,42,0.25)] sm:p-6">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-500" htmlFor="unified-search-input">
            <SearchIcon className="h-4 w-4 text-primary" aria-hidden />
            {locale === "ar" ? "كلمة البحث" : "Search query"}
          </label>
          <input
            id="unified-search-input"
            list="alumni-unified-search-hints"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={locale === "ar" ? "مثال: هندسة كهربائية، بوسطن، أرامكو…" : "e.g. electrical engineering, Boston, Aramco…"}
            className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3.5 text-sm font-medium text-slate-900 outline-none ring-primary/25 focus:ring-2"
            autoComplete="off"
            aria-label={locale === "ar" ? "حقل البحث الموحد" : "Unified search field"}
          />
          <datalist id="alumni-unified-search-hints">
            {datalistOptions.map((opt) => (
              <option key={opt} value={opt} />
            ))}
          </datalist>

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

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_16px_50px_-28px_rgba(15,23,42,0.2)] sm:p-6">
          <h2 className="text-lg font-black text-slate-900">{locale === "ar" ? "النتائج" : "Results"}</h2>

          {loading ? (
            <div className="mt-6">
              <SkeletonList />
            </div>
          ) : tab === "global" && !globalData ? (
            <div className="mt-6">
              <AlumniEmptyState
                title={locale === "ar" ? "تعذر تحميل البحث الشامل" : "Could not load blended results"}
                description={
                  locale === "ar" ? "أعد المحاولة بعد قليل أو غيّر نطاق البحث." : "Retry shortly or change the search scope."
                }
                dir={dir}
              />
            </div>
          ) : tab === "global" && globalData ? (
            <div className="mt-6 space-y-10">
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
                  <h3 className="mb-4 border-b border-slate-100 pb-2 text-sm font-black uppercase tracking-wide text-slate-800">
                    {key}
                  </h3>
                  {list.length === 0 ? (
                    <p className="text-sm text-slate-500">{locale === "ar" ? "لا نتائج في هذا القسم" : "No matches in this bucket"}</p>
                  ) : (
                    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{list.map((h) => renderHit(h))}</ul>
                  )}
                </div>
              ))}
            </div>
          ) : searchError ? (
            <div className="mt-6">
              <AlumniEmptyState
                title={locale === "ar" ? "حدث خطأ في البحث" : "Search error"}
                description={searchError}
                dir={dir}
              />
            </div>
          ) : tab !== "global" && hits.length === 0 ? (
            <div className="mt-6">
              <AlumniEmptyState
                icon={<SearchIcon className="h-8 w-8 text-primary" aria-hidden />}
                title={hasQuery ? noMatchTitle : emptyTitle}
                description={hasQuery ? noMatchHint : emptyHint}
                dir={dir}
              >
                <div className="mt-4 flex flex-col gap-2 text-sm text-slate-600">
                  <p className="font-bold text-slate-800">
                    {locale === "ar" ? "جرّب أحد الخيارات:" : "Try one of these:"}
                  </p>
                  <ul className="list-inside list-disc space-y-1 text-start">
                    <li>
                      {locale === "ar"
                        ? "غيّر سنة التخرج أو الجامعة في استعلامك."
                        : "Try another graduation year or university in your query."}
                    </li>
                    <li>
                      {locale === "ar"
                        ? "أزل التبويب الضيق أو فلتر «موثّقون فقط» إن كان مفعّلًا."
                        : "Broaden the tab scope or turn off “verified only” if it is on."}
                    </li>
                    <li>
                      {locale === "ar" ? (
                        <>
                          استكشف الخريجين المميزين من{" "}
                          <Link href="/alumni" className="font-bold text-primary underline-offset-2 hover:underline">
                            الصفحة الرئيسية للخريجين
                          </Link>
                          .
                        </>
                      ) : (
                        <>
                          Explore featured paths from the{" "}
                          <Link href="/alumni" className="font-bold text-primary underline-offset-2 hover:underline">
                            alumni home
                          </Link>
                          .
                        </>
                      )}
                    </li>
                  </ul>
                </div>
              </AlumniEmptyState>
            </div>
          ) : (
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{hits.map((h) => renderHit(h))}</ul>
          )}
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
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
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-black text-slate-900">
              {locale === "ar" ? "تخصصات رائجة · جامعات شائعة" : "Trending majors · Popular universities"}
            </h3>
            {!searchHints ? (
              <p className="mt-3 text-sm text-slate-500">
                {locale === "ar" ? "سجّل دخولك كخريج لعرض اقتراحات المجتمع." : "Sign in as alumni to load community hints."}
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    {locale === "ar" ? "تخصصات" : "Majors"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {searchHints.trendingMajors.slice(0, 8).map((x) => (
                      <button
                        key={x.name}
                        type="button"
                        className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-900 ring-1 ring-violet-100 hover:bg-violet-100"
                        onClick={() => setQ(x.name)}
                      >
                        {x.name}
                        <span className="ms-1 tabular-nums text-violet-600">({x.count})</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    {locale === "ar" ? "جامعات" : "Universities"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {searchHints.trendingUniversities.slice(0, 8).map((x) => (
                      <button
                        key={x.name}
                        type="button"
                        className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-900 ring-1 ring-sky-100 hover:bg-sky-100"
                        onClick={() => setQ(x.name)}
                      >
                        {x.name}
                        <span className="ms-1 tabular-nums text-sky-600">({x.count})</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default function UnifiedSearchPage() {
  return (
    <AlumniCommunityAccessGate>
      <UnifiedSearchPageInner />
    </AlumniCommunityAccessGate>
  );
}
