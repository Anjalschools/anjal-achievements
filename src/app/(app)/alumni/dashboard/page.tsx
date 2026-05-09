"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { GraduationCap, Loader2, Mail, Sparkles, Users, Briefcase, UserPlus } from "lucide-react";
import { useAppSession } from "@/contexts/AppSessionContext";

type Summary = {
  profile: {
    fullName: string;
    graduationYear: number | null;
    universityName: string;
    currentCompany: string;
    profilePhoto: string | null;
  };
  stats: {
    contributionsCount: number;
    mentorshipPendingIncoming: number;
    inboxUnread: number;
    upcomingEvents: number;
  };
};

type RecMentor = { id: string; fullName: string; universityName?: string | null; matchScore: number };
type RecOpp = { id: string; title: string; type: string; matchScore: number };
type RecPeer = { id: string; fullName: string; universityName?: string | null; matchScore: number };

export default function AlumniDashboardPage() {
  const { profile, loading: sessionLoading } = useAppSession();
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [recMentors, setRecMentors] = useState<RecMentor[]>([]);
  const [recOpps, setRecOpps] = useState<RecOpp[]>([]);
  const [recPeers, setRecPeers] = useState<RecPeer[]>([]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const res = await fetch("/api/alumni/dashboard-summary", { credentials: "include" });
        const json = (await res.json()) as { ok?: boolean } & Partial<Summary>;
        if (!mounted) return;
        if (res.ok && json.ok && json.profile && json.stats) {
          setData({ profile: json.profile, stats: json.stats });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void run();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (profile?.accountType !== "alumni") return;
    let m = true;
    void (async () => {
      try {
        const [rm, ro, rn] = await Promise.all([
          fetch("/api/alumni/recommendations/mentors", { credentials: "include" }),
          fetch("/api/alumni/recommendations/opportunities", { credentials: "include" }),
          fetch("/api/alumni/recommendations/network", { credentials: "include" }),
        ]);
        const [jm, jo, jn] = await Promise.all([rm.json(), ro.json(), rn.json()]);
        if (!m) return;
        if (jm.ok && jm.items) setRecMentors(jm.items);
        if (jo.ok && jo.items) setRecOpps(jo.items);
        if (jn.ok && jn.items) setRecPeers(jn.items);
      } catch {
        /* optional block */
      }
    })();
    return () => {
      m = false;
    };
  }, [profile?.accountType]);

  if (sessionLoading || loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      </div>
    );
  }

  if (profile?.accountType !== "alumni") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-slate-700">هذه اللوحة مخصّصة لحسابات الخريجين المعتمدة.</p>
        <Link href="/dashboard" className="mt-4 inline-block text-primary underline">
          العودة إلى لوحة التحكم
        </Link>
      </div>
    );
  }

  const p = data?.profile;
  const s = data?.stats;

  return (
    <div dir="rtl" className="alumni-mobile-shell mx-auto max-w-5xl px-4 py-8">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-[#071a3d] via-primary to-slate-900 p-6 text-white shadow-xl sm:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-white/10 ring-2 ring-white/20">
              {p?.profilePhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.profilePhoto} alt="" className="h-full w-full object-cover" />
              ) : (
                <Image src="/logow.png" alt="" fill className="object-contain p-2" sizes="80px" />
              )}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-sky-200/90">لوحة الخريج</p>
              <h1 className="mt-1 text-2xl font-black sm:text-3xl">{p?.fullName || profile?.fullName || ""}</h1>
              <div className="mt-2 flex flex-wrap gap-2 text-sm text-sky-100/95">
                {p?.graduationYear ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1">
                    <GraduationCap className="h-4 w-4" aria-hidden />
                    {p.graduationYear}
                  </span>
                ) : null}
                {p?.universityName ? <span className="rounded-full bg-white/10 px-3 py-1">{p.universityName}</span> : null}
                {p?.currentCompany ? <span className="rounded-full bg-white/10 px-3 py-1">{p.currentCompany}</span> : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      {profile?.accountType === "alumni" && (recMentors.length > 0 || recOpps.length > 0 || recPeers.length > 0) ? (
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-primary">
              <Users className="h-5 w-5" aria-hidden />
              <h2 className="text-sm font-black">مرشدون مقترحون</h2>
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              {recMentors.slice(0, 4).map((x) => (
                <li key={x.id}>
                  <Link href={`/alumni/mentorship?mentor=${encodeURIComponent(x.id)}`} className="font-bold text-slate-900 hover:text-primary">
                    {x.fullName}
                  </Link>
                  {x.universityName ? <p className="text-xs text-slate-500">{x.universityName}</p> : null}
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-primary">
              <Briefcase className="h-5 w-5" aria-hidden />
              <h2 className="text-sm font-black">فرص مقترحة</h2>
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              {recOpps.slice(0, 4).map((x) => (
                <li key={x.id}>
                  <Link href="/alumni/opportunities" className="font-bold text-primary hover:underline">
                    {x.title}
                  </Link>
                  <p className="text-xs text-slate-500">{x.type}</p>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-primary">
              <UserPlus className="h-5 w-5" aria-hidden />
              <h2 className="text-sm font-black">خريجون قد تعرفهم</h2>
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              {recPeers.slice(0, 4).map((x) => (
                <li key={x.id}>
                  <Link href={`/alumni/${x.id}`} className="font-bold text-slate-900 hover:text-primary">
                    {x.fullName}
                  </Link>
                  {x.universityName ? <p className="text-xs text-slate-500">{x.universityName}</p> : null}
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "المساهمات", value: s?.contributionsCount ?? 0, icon: Sparkles },
          { label: "طلبات الإرشاد الواردة", value: s?.mentorshipPendingIncoming ?? 0, icon: Users },
          { label: "رسائل غير مقروءة", value: s?.inboxUnread ?? 0, icon: Mail },
          { label: "فعاليات قادمة", value: s?.upcomingEvents ?? 0, icon: GraduationCap },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-primary/30"
          >
            <div className="flex items-center gap-2 text-primary">
              <card.icon className="h-5 w-5" aria-hidden />
              <span className="text-xs font-bold text-slate-500">{card.label}</span>
            </div>
            <p className="mt-2 text-3xl font-black tabular-nums text-slate-900">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/profile"
          className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-center font-bold text-primary shadow-sm hover:bg-slate-50"
        >
          تعديل الملف الشخصي
        </Link>
        <Link
          href="/alumni/stories"
          className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-center font-bold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          قصص النجاح
        </Link>
        <Link href="/alumni/inbox" className="rounded-2xl border border-primary bg-primary px-4 py-4 text-center font-bold text-white shadow-sm hover:bg-primary-dark">
          صندوق الرسائل
        </Link>
        <Link href="/alumni/mentorship" className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-center font-bold text-slate-800 shadow-sm hover:bg-slate-50">
          الإرشاد والطلبات
        </Link>
        <Link href="/alumni/events" className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-center font-bold text-slate-800 shadow-sm hover:bg-slate-50">
          فعاليات الدفعات
        </Link>
        <Link href="/alumni/announcements" className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-center font-bold text-slate-800 shadow-sm hover:bg-slate-50">
          الإعلانات الرسمية
        </Link>
        <Link
          href="/alumni/assistant"
          className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-4 text-center font-bold text-amber-950 shadow-sm hover:bg-amber-100"
        >
          المرشد الأكاديمي الذكي
        </Link>
      </div>
    </div>
  );
}
