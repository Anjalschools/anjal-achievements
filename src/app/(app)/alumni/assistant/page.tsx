"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { Loader2, Search, Sparkles } from "lucide-react";
import { useAppSession } from "@/contexts/AppSessionContext";
import { getLocale } from "@/lib/i18n";
import { isEligibleForAcademicAdvisor } from "@/lib/alumni/isEligibleForAcademicAdvisor";
import AlumniPageHeader from "@/components/alumni/AlumniPageHeader";
import AlumniEmptyState from "@/components/alumni/AlumniEmptyState";

type SearchHit = {
  id: string;
  fullName: string;
  universityName: string | null;
  company: string | null;
  industry: string | null;
  mentoringAvailable: boolean;
};

const AssistantShell = () => {
  const { profile, loading } = useAppSession();
  const locale = getLocale();
  const isAr = locale === "ar";
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [mentors, setMentors] = useState<{ id: string; fullName: string; matchScore: number }[]>([]);
  const [opps, setOpps] = useState<{ id: string; title: string; matchScore: number }[]>([]);
  const [universities, setUniversities] = useState<{ universityName: string; alumniCount: number }[]>([]);
  const [career, setCareer] = useState<{ alumniMatchingFocus: number; focus: string } | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!q.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/alumni/assistant/search", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q }),
      });
      const json = (await res.json()) as { ok?: boolean; items?: SearchHit[] };
      if (json.ok && json.items) setHits(json.items);
      setHasSearched(true);
    } finally {
      setBusy(false);
    }
  };

  const runRec = async (intent: string, focus?: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/alumni/assistant/recommend", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent, focus }),
      });
      const json = (await res.json()) as { ok?: boolean; data?: unknown };
      if (!json.ok) return;
      if (intent === "mentor_suggest") {
        setMentors((json.data as { id: string; fullName: string; matchScore: number }[]) || []);
      }
      if (intent === "opportunity_pick") {
        setOpps((json.data as { id: string; title: string; matchScore: number }[]) || []);
      }
      if (intent === "university_explorer") {
        setUniversities((json.data as { universityName: string; alumniCount: number }[]) || []);
      }
      if (intent === "career_insight") {
        setCareer((json.data as { alumniMatchingFocus: number; focus: string }) || null);
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      </div>
    );
  }

  if (profile?.accountType !== "alumni" && profile?.role !== "student") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center" dir={isAr ? "rtl" : "ltr"}>
        <p className="text-slate-700">
          {isAr
            ? "يتطلّب المرشد الذكي حساب خريج أو طالب نشط في المنصة."
            : "The smart advisor requires an active alumni or student account."}
        </p>
        <Link href="/dashboard" className="mt-4 inline-block text-primary underline">
          {isAr ? "العودة" : "Back"}
        </Link>
      </div>
    );
  }

  if (
    !isEligibleForAcademicAdvisor({
      accountType: profile?.accountType,
      grade: profile?.grade,
      role: profile?.role,
    })
  ) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center" dir={isAr ? "rtl" : "ltr"}>
        <p className="text-slate-700">
          {isAr
            ? "المرشد الذكي متاح لطلاب الثاني والثالث الثانوي ولخريجي المجتمع المهني في المنصة فقط."
            : "The smart advisor is available to secondary-year 2–3 students and registered alumni only."}
        </p>
        <Link href="/dashboard" className="mt-4 inline-block text-primary underline">
          {isAr ? "العودة" : "Back"}
        </Link>
      </div>
    );
  }

  const isAlumniUser = profile?.accountType === "alumni";

  return (
    <div dir={isAr ? "rtl" : "ltr"} className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <AlumniPageHeader
        title={
          isAlumniUser
            ? isAr
              ? "المرشد المهني الذكي"
              : "Smart professional advisor"
            : isAr
              ? "المرشد الأكاديمي الذكي"
              : "Smart academic advisor"
        }
        description={
          isAlumniUser
            ? isAr
              ? "دليل سريع داخل المنصة: ابحث في الشبكة المهنية، اقتراح مرشدين، فرص، وجامعات مرتبطة بمسارك."
              : "Fast in-platform guidance: search the professional network, mentor matches, opportunities, and universities aligned to your path."
            : isAr
              ? "إرشاد داخلي سريع: بحث في بيانات المنصة، مرشدون مقترحون، فرص، وجامعات."
              : "Fast in-platform guidance: search platform data, suggested mentors, opportunities, and universities."
        }
        backHref="/alumni/dashboard"
        backLabel={isAr ? "رجوع" : "Back"}
        icon={<Sparkles className="h-6 w-6 text-amber-200" aria-hidden />}
        breadcrumb={[
          { label: isAr ? "الخريجون" : "Alumni", href: "/alumni" },
          { label: isAr ? "المرشد الذكي" : "Advisor" },
        ]}
        dir={isAr ? "rtl" : "ltr"}
      />

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-md">
        <h2 className="flex items-center gap-2 text-lg font-black text-slate-900">
          <Search className="h-5 w-5 text-primary" aria-hidden />
          {isAr ? "بحث الخريجين" : "Alumni search"}
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          {isAr ? "مثال: «أرامكو»، «KAUST»، «أمن سيبراني»." : "e.g. Aramco, KAUST, cybersecurity."}
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSearch();
            }}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder={isAr ? "اكتب استعلامك…" : "Enter your query…"}
            aria-label={isAr ? "استعلام البحث" : "Search query"}
          />
          <button
            type="button"
            onClick={() => void handleSearch()}
            disabled={busy}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {isAr ? "بحث" : "Search"}
          </button>
        </div>
        {hasSearched && hits.length === 0 && !busy ? (
          <div className="mt-4">
            <AlumniEmptyState
              className="!py-10"
              icon={<Search className="h-8 w-8 text-primary" aria-hidden />}
              title={isAr ? "لا نتائج لهذا الاستعلام" : "No results for this query"}
              description={isAr ? "جرّب كلمات مختلفة أو أوسع." : "Try different or broader keywords."}
              dir={isAr ? "rtl" : "ltr"}
            />
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {hits.map((h) => (
              <li key={h.id} className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm">
                <Link href={`/alumni/${h.id}`} className="font-bold text-primary hover:underline">
                  {h.fullName}
                </Link>
                <p className="text-xs text-slate-600">
                  {[h.universityName, h.company, h.industry].filter(Boolean).join(" · ")}
                  {h.mentoringAvailable ? (
                    <span className="me-2 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      {isAr ? "مرشد" : "Mentor"}
                    </span>
                  ) : null}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-black text-slate-900">
            {isAr ? "اقتراح مرشد مهني" : "Mentor suggestions"}
          </h3>
          <button
            type="button"
            onClick={() => void runRec("mentor_suggest")}
            disabled={busy}
            className="mt-3 w-full rounded-xl border border-primary bg-primary/5 py-2 text-sm font-bold text-primary disabled:opacity-50"
          >
            {isAr ? "تشغيل وفق ملفي المهني" : "Run using my profile"}
          </button>
          <ul className="mt-3 space-y-2 text-sm">
            {mentors.map((m) => (
              <li key={m.id}>
                <Link href={`/alumni/mentorship?mentor=${encodeURIComponent(m.id)}`} className="font-bold text-slate-800 hover:text-primary">
                  {m.fullName}
                </Link>
                <span className="me-2 text-xs text-slate-500">
                  {isAr ? `درجة التطابق ${m.matchScore}` : `Match score ${m.matchScore}`}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-black text-slate-900">{isAr ? "فرص مقترحة" : "Suggested opportunities"}</h3>
          <button
            type="button"
            onClick={() => void runRec("opportunity_pick")}
            disabled={busy}
            className="mt-3 w-full rounded-xl border border-slate-200 py-2 text-sm font-bold text-slate-800 disabled:opacity-50"
          >
            {isAr ? "جلب أفضل المطابقات" : "Fetch best matches"}
          </button>
          <ul className="mt-3 space-y-2 text-sm">
            {opps.map((o) => (
              <li key={o.id}>
                <Link href="/alumni/opportunities" className="font-bold text-primary hover:underline">
                  {o.title}
                </Link>
                <span className="me-2 text-xs text-slate-500">
                  {isAr ? `درجة التطابق ${o.matchScore}` : `Match score ${o.matchScore}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-black text-slate-900">{isAr ? "استكشاف جامعات" : "University explorer"}</h3>
          <button
            type="button"
            onClick={() => void runRec("university_explorer")}
            disabled={busy}
            className="mt-3 w-full rounded-xl border border-slate-200 py-2 text-sm font-bold text-slate-800 disabled:opacity-50"
          >
            {isAr ? "جامعات مرتبطة بمساري في الملف المهني" : "Universities linked to my professional profile"}
          </button>
          <ul className="mt-3 space-y-1 text-sm">
            {universities.map((u) => (
              <li key={u.universityName} className="flex justify-between rounded-lg bg-slate-50 px-2 py-1">
                <span>{u.universityName}</span>
                <span className="tabular-nums text-slate-500">{u.alumniCount}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-black text-slate-900">{isAr ? "لمحة مسار مهني" : "Career pathway snapshot"}</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {(
              [
                { key: "ai", ar: "ذكاء اصطناعي", en: "AI" },
                { key: "medicine", ar: "طب", en: "Medicine" },
                { key: "cybersecurity", ar: "أمن سيبراني", en: "Cybersecurity" },
              ] as const
            ).map((row) => (
              <button
                key={row.key}
                type="button"
                onClick={() => void runRec("career_insight", row.key)}
                disabled={busy}
                className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white disabled:opacity-50"
              >
                {isAr ? row.ar : row.en}
              </button>
            ))}
          </div>
          {career ? (
            <p className="mt-4 text-sm text-slate-700">
              {isAr ? (
                <>
                  تطابق المسار <span className="font-black">{career.focus}</span>:{" "}
                  <span className="tabular-nums font-bold">{career.alumniMatchingFocus}</span> خريجًا في العيّنة.
                </>
              ) : (
                <>
                  Pathway focus <span className="font-black">{career.focus}</span>:{" "}
                  <span className="tabular-nums font-bold">{career.alumniMatchingFocus}</span> alumni in this sample.
                </>
              )}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
};

export default function AlumniAssistantPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
        </div>
      }
    >
      <AssistantShell />
    </Suspense>
  );
}
