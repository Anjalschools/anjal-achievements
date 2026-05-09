"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { Loader2, Search, Sparkles } from "lucide-react";
import { useAppSession } from "@/contexts/AppSessionContext";

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
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [mentors, setMentors] = useState<{ id: string; fullName: string; matchScore: number }[]>([]);
  const [opps, setOpps] = useState<{ id: string; title: string; matchScore: number }[]>([]);
  const [universities, setUniversities] = useState<{ universityName: string; alumniCount: number }[]>([]);
  const [career, setCareer] = useState<{ alumniMatchingFocus: number; focus: string } | null>(null);

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
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-slate-700">يتطلّب المساعد حساب طالب أو خريج نشط.</p>
        <Link href="/dashboard" className="mt-4 inline-block text-primary underline">
          العودة
        </Link>
      </div>
    );
  }

  return (
    <div dir="rtl" className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-primary to-slate-800 p-6 text-white shadow-xl">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-1 h-8 w-8 shrink-0 text-amber-200" aria-hidden />
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-sky-100/90">مساعد الخريجين</p>
            <h1 className="mt-1 text-2xl font-black">إرشاد داخلي سريع دون نماذج خارجية</h1>
            <p className="mt-2 text-sm text-sky-50/95">
              بحث قواعد بيانات المنصة، اقتراح مرشدين، فرص، وجامعات — مع منطق قابل للتوسعة لاحقًا.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-black text-slate-900">
          <Search className="h-5 w-5 text-primary" aria-hidden />
          بحث الخريجين
        </h2>
        <p className="mt-1 text-xs text-slate-500">مثال: «أرامكو»، «KAUST»، «أمن سيبراني».</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSearch();
            }}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="اكتب استعلامك..."
            aria-label="استعلام البحث"
          />
          <button
            type="button"
            onClick={() => void handleSearch()}
            disabled={busy}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            بحث
          </button>
        </div>
        <ul className="mt-4 space-y-2">
          {hits.map((h) => (
            <li key={h.id} className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm">
              <Link href={`/alumni/${h.id}`} className="font-bold text-primary hover:underline">
                {h.fullName}
              </Link>
              <p className="text-xs text-slate-600">
                {[h.universityName, h.company, h.industry].filter(Boolean).join(" · ")}
                {h.mentoringAvailable ? (
                  <span className="mr-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                    مرشد
                  </span>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-black text-slate-900">اقتراح مرشد</h3>
          <button
            type="button"
            onClick={() => void runRec("mentor_suggest")}
            disabled={busy}
            className="mt-3 w-full rounded-xl border border-primary bg-primary/5 py-2 text-sm font-bold text-primary disabled:opacity-50"
          >
            تشغيل وفق ملفي
          </button>
          <ul className="mt-3 space-y-2 text-sm">
            {mentors.map((m) => (
              <li key={m.id}>
                <Link href={`/alumni/mentorship?mentor=${encodeURIComponent(m.id)}`} className="font-bold text-slate-800 hover:text-primary">
                  {m.fullName}
                </Link>
                <span className="mr-2 text-xs text-slate-500">درجة {m.matchScore}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-black text-slate-900">فرص مقترحة</h3>
          <button
            type="button"
            onClick={() => void runRec("opportunity_pick")}
            disabled={busy}
            className="mt-3 w-full rounded-xl border border-slate-200 py-2 text-sm font-bold text-slate-800 disabled:opacity-50"
          >
            جلب أفضل المطابقات
          </button>
          <ul className="mt-3 space-y-2 text-sm">
            {opps.map((o) => (
              <li key={o.id}>
                <Link href="/alumni/opportunities" className="font-bold text-primary hover:underline">
                  {o.title}
                </Link>
                <span className="mr-2 text-xs text-slate-500">درجة {o.matchScore}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-black text-slate-900">استكشاف جامعات</h3>
          <button
            type="button"
            onClick={() => void runRec("university_explorer")}
            disabled={busy}
            className="mt-3 w-full rounded-xl border border-slate-200 py-2 text-sm font-bold text-slate-800 disabled:opacity-50"
          >
            جامعات بارتباط قوي بالتخصص في ملفي
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
          <h3 className="font-black text-slate-900">لمحة مسار مهني</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {["ai", "medicine", "cybersecurity"].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => void runRec("career_insight", f)}
                disabled={busy}
                className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white disabled:opacity-50"
              >
                {f}
              </button>
            ))}
          </div>
          {career ? (
            <p className="mt-4 text-sm text-slate-700">
              تطابق المسار <span className="font-black">{career.focus}</span>:{" "}
              <span className="tabular-nums font-bold">{career.alumniMatchingFocus}</span> خريجًا في العيّنة.
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
