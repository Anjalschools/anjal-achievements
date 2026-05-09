"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  GraduationCap,
  Loader2,
  Mail,
  Sparkles,
  Users,
  Briefcase,
  UserPlus,
  Bot,
  UserCircle,
  Compass,
  Building2,
} from "lucide-react";
import { useAppSession } from "@/contexts/AppSessionContext";
import { getLocale } from "@/lib/i18n";
import { isEligibleForAcademicAdvisor } from "@/lib/alumni/isEligibleForAcademicAdvisor";
import { canAccessAlumniCommunity } from "@/lib/alumni/canAccessAlumniCommunity";

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
  const locale = getLocale();
  const isAr = locale === "ar";
  const dir = isAr ? "rtl" : "ltr";

  const t = useMemo(
    () => ({
      hub: isAr ? "مركز الخريجين المهني" : "Alumni professional hub",
      welcome: isAr ? "مرحباً" : "Welcome",
      subtitle: isAr
        ? "شبكتك، فرصك، ومسارك — في مكان واحد بصورة احترافية."
        : "Your network, opportunities, and career path — in one professional hub.",
      loading: isAr ? "جاري التحميل…" : "Loading…",
      alumniOnly: isAr ? "هذه اللوحة مخصّصة لحسابات الخريجين المعتمدة." : "This hub is for approved alumni accounts.",
      backDash: isAr ? "العودة إلى لوحة التحكم" : "Back to dashboard",
      sections: {
        advisor: {
          title: isAr ? "المرشد الأكاديمي الذكي" : "Smart academic advisor",
          desc: isAr
            ? "إرشاد مبني على بياناتك لدعم قرارات الجامعة والتخصص."
            : "Guidance tailored to your profile for university and major decisions.",
          cta: isAr ? "فتح المرشد" : "Open advisor",
        },
        network: {
          title: isAr ? "شبكة الخريجين" : "Alumni network",
          desc: isAr ? "استكشف الدفعات والمسارات والجامعات ضمن مجتمع الخريجين." : "Explore cohorts, pathways, and peers across the alumni network.",
          cta: isAr ? "استكشاف الشبكة" : "Explore network",
        },
        opportunities: {
          title: isAr ? "الفرص" : "Opportunities",
          desc: isAr ? "تدريب، وظائف، ورش، وشراكات مهنية موثوقة." : "Internships, jobs, workshops, and trusted partnerships.",
          cta: isAr ? "عرض الفرص" : "View opportunities",
        },
        profile: {
          title: isAr ? "الملف الأكاديمي والمهني" : "Academic & professional profile",
          desc: isAr ? "حدّث خبرتك وظهورك المهني أمام المجتمع." : "Keep your experience and professional presence up to date.",
          cta: isAr ? "تعديل الملف" : "Edit profile",
        },
        community: {
          title: isAr ? "المجتمع والمرشدين" : "Community & mentors",
          desc: isAr ? "تواصل مع المرشدين واطلب الإرشاد عند الحاجة." : "Connect with mentors and request guidance when you need it.",
          ctaMentors: isAr ? "دليل المرشدين" : "Mentor directory",
          ctaRequests: isAr ? "طلبات الإرشاد" : "Mentorship",
        },
        pathway: {
          title: isAr ? "الجامعة والتخصص والمسار" : "University, major & pathway",
          desc: isAr ? "راجع مسارك الدراسي والمهني وحدّث بيانات الدفعة." : "Review your study and career trajectory and cohort details.",
          cta: isAr ? "تحديث البيانات" : "Update details",
        },
      },
      recMentors: isAr ? "مرشدون مقترحون" : "Suggested mentors",
      recOpps: isAr ? "فرص مقترحة" : "Suggested opportunities",
      recPeers: isAr ? "خريجون قد تعرفهم" : "Peers you may know",
      stats: {
        contributions: isAr ? "المساهمات" : "Contributions",
        mentorship: isAr ? "طلبات الإرشاد الواردة" : "Mentorship requests",
        inbox: isAr ? "رسائل غير مقروءة" : "Unread messages",
        events: isAr ? "فعاليات قادمة" : "Upcoming events",
      },
    }),
    [isAr]
  );

  const { profile, loading: sessionLoading } = useAppSession();
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [recMentors, setRecMentors] = useState<RecMentor[]>([]);
  const [recOpps, setRecOpps] = useState<RecOpp[]>([]);
  const [recPeers, setRecPeers] = useState<RecPeer[]>([]);

  const showAdvisor = useMemo(
    () =>
      isEligibleForAcademicAdvisor({
        accountType: profile?.accountType,
        grade: profile?.grade,
        role: profile?.role,
      }),
    [profile?.accountType, profile?.grade, profile?.role]
  );

  const showCommunitySearch = useMemo(
    () =>
      canAccessAlumniCommunity({
        accountType: profile?.accountType,
        grade: profile?.grade,
        role: profile?.role,
        alumniCommunityRemovedAt: profile?.alumniCommunityRemovedAt,
        alumniPermanentlyPurgedAt: profile?.alumniPermanentlyPurgedAt,
      }),
    [
      profile?.accountType,
      profile?.grade,
      profile?.role,
      profile?.alumniCommunityRemovedAt,
      profile?.alumniPermanentlyPurgedAt,
    ]
  );

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
        /* optional */
      }
    })();
    return () => {
      m = false;
    };
  }, [profile?.accountType]);

  if (sessionLoading || loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center" dir={dir}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
        <span className="sr-only">{t.loading}</span>
      </div>
    );
  }

  if (profile?.accountType !== "alumni") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center" dir={dir}>
        <p className="text-slate-700">{t.alumniOnly}</p>
        <Link href="/dashboard" className="mt-4 inline-block font-semibold text-primary underline">
          {t.backDash}
        </Link>
      </div>
    );
  }

  const p = data?.profile;
  const s = data?.stats;

  const networkHref = showCommunitySearch ? "/search" : "/alumni/cohorts";

  const sectionCardClass =
    "group flex h-full flex-col rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md";

  return (
    <div dir={dir} className="alumni-mobile-shell mx-auto max-w-6xl px-4 py-8">
      <section className="overflow-hidden rounded-3xl border border-slate-800/20 bg-gradient-to-br from-[#0b1220] via-slate-900 to-primary p-6 text-white shadow-xl sm:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-white/10 ring-2 ring-white/15">
              {p?.profilePhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.profilePhoto} alt="" className="h-full w-full object-cover" />
              ) : (
                <Image src="/logow.png" alt="" fill className="object-contain p-2" sizes="80px" />
              )}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-sky-200/90">{t.hub}</p>
              <h1 className="mt-1 text-2xl font-black sm:text-3xl">
                {t.welcome}، {p?.fullName || profile?.fullName || ""}
              </h1>
              <p className="mt-2 max-w-xl text-sm text-slate-200/95">{t.subtitle}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-sm text-sky-100/95">
                {p?.graduationYear ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1">
                    <GraduationCap className="h-4 w-4 shrink-0" aria-hidden />
                    {p.graduationYear}
                  </span>
                ) : null}
                {p?.universityName ? (
                  <span className="rounded-full bg-white/10 px-3 py-1">{p.universityName}</span>
                ) : null}
                {p?.currentCompany ? (
                  <span className="rounded-full bg-white/10 px-3 py-1">{p.currentCompany}</span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      <h2 className="mt-10 text-sm font-black uppercase tracking-wide text-slate-500">
        {isAr ? "الوصول السريع" : "Quick access"}
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {showAdvisor ? (
          <Link href="/alumni/assistant" className={sectionCardClass}>
            <div className="flex items-center gap-2 text-amber-700">
              <Bot className="h-6 w-6 shrink-0" aria-hidden />
              <span className="text-base font-black text-slate-900">{t.sections.advisor.title}</span>
            </div>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{t.sections.advisor.desc}</p>
            <span className="mt-4 text-sm font-bold text-primary group-hover:underline">{t.sections.advisor.cta} →</span>
          </Link>
        ) : null}

        <Link href={networkHref} className={sectionCardClass}>
          <div className="flex items-center gap-2 text-primary">
            <Compass className="h-6 w-6 shrink-0" aria-hidden />
            <span className="text-base font-black text-slate-900">{t.sections.network.title}</span>
          </div>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{t.sections.network.desc}</p>
          <span className="mt-4 text-sm font-bold text-primary group-hover:underline">{t.sections.network.cta} →</span>
        </Link>

        <Link href="/alumni/opportunities" className={sectionCardClass}>
          <div className="flex items-center gap-2 text-primary">
            <Briefcase className="h-6 w-6 shrink-0" aria-hidden />
            <span className="text-base font-black text-slate-900">{t.sections.opportunities.title}</span>
          </div>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{t.sections.opportunities.desc}</p>
          <span className="mt-4 text-sm font-bold text-primary group-hover:underline">{t.sections.opportunities.cta} →</span>
        </Link>

        <Link href="/profile" className={sectionCardClass}>
          <div className="flex items-center gap-2 text-slate-800">
            <UserCircle className="h-6 w-6 shrink-0" aria-hidden />
            <span className="text-base font-black text-slate-900">{t.sections.profile.title}</span>
          </div>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{t.sections.profile.desc}</p>
          <span className="mt-4 text-sm font-bold text-primary group-hover:underline">{t.sections.profile.cta} →</span>
        </Link>

        <div className={`${sectionCardClass} border-primary/20 bg-slate-50/50`}>
          <div className="flex items-center gap-2 text-primary">
            <Users className="h-6 w-6 shrink-0" aria-hidden />
            <span className="text-base font-black text-slate-900">{t.sections.community.title}</span>
          </div>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{t.sections.community.desc}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/alumni/mentors"
              className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-800 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
            >
              {t.sections.community.ctaMentors}
            </Link>
            <Link
              href="/alumni/mentorship"
              className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-primary-dark"
            >
              {t.sections.community.ctaRequests}
            </Link>
          </div>
        </div>

        <Link
          href={profile?.needsAlumniOnboarding ? "/alumni/onboarding" : "/profile"}
          className={sectionCardClass}
        >
          <div className="flex items-center gap-2 text-slate-800">
            <Building2 className="h-6 w-6 shrink-0" aria-hidden />
            <span className="text-base font-black text-slate-900">{t.sections.pathway.title}</span>
          </div>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{t.sections.pathway.desc}</p>
          <span className="mt-4 text-sm font-bold text-primary group-hover:underline">{t.sections.pathway.cta} →</span>
        </Link>
      </div>

      {recMentors.length > 0 || recOpps.length > 0 || recPeers.length > 0 ? (
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-primary">
              <Users className="h-5 w-5 shrink-0" aria-hidden />
              <h3 className="text-sm font-black">{t.recMentors}</h3>
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              {recMentors.slice(0, 4).map((x) => (
                <li key={x.id}>
                  <Link
                    href={`/alumni/mentorship?mentor=${encodeURIComponent(x.id)}`}
                    className="font-bold text-slate-900 hover:text-primary"
                  >
                    {x.fullName}
                  </Link>
                  {x.universityName ? <p className="text-xs text-slate-500">{x.universityName}</p> : null}
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-primary">
              <Briefcase className="h-5 w-5 shrink-0" aria-hidden />
              <h3 className="text-sm font-black">{t.recOpps}</h3>
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
              <UserPlus className="h-5 w-5 shrink-0" aria-hidden />
              <h3 className="text-sm font-black">{t.recPeers}</h3>
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

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: t.stats.contributions, value: s?.contributionsCount ?? 0, icon: Sparkles },
          { label: t.stats.mentorship, value: s?.mentorshipPendingIncoming ?? 0, icon: Users },
          { label: t.stats.inbox, value: s?.inboxUnread ?? 0, icon: Mail },
          { label: t.stats.events, value: s?.upcomingEvents ?? 0, icon: GraduationCap },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300"
          >
            <div className="flex items-center gap-2 text-primary">
              <card.icon className="h-5 w-5 shrink-0" aria-hidden />
              <span className="text-xs font-bold text-slate-500">{card.label}</span>
            </div>
            <p className="mt-2 text-3xl font-black tabular-nums text-slate-900">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-3 border-t border-slate-200 pt-8">
        <Link
          href="/alumni/inbox"
          className="rounded-2xl bg-primary px-5 py-3 text-center text-sm font-bold text-white shadow-sm hover:bg-primary-dark"
        >
          {isAr ? "صندوق الرسائل" : "Inbox"}
        </Link>
        <Link
          href="/alumni/stories"
          className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-bold text-slate-800 shadow-sm hover:bg-slate-50"
        >
          {isAr ? "قصص النجاح" : "Success stories"}
        </Link>
        <Link
          href="/alumni/events"
          className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-bold text-slate-800 shadow-sm hover:bg-slate-50"
        >
          {isAr ? "الفعاليات" : "Events"}
        </Link>
        <Link
          href="/alumni/announcements"
          className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-bold text-slate-800 shadow-sm hover:bg-slate-50"
        >
          {isAr ? "الإعلانات" : "Announcements"}
        </Link>
      </div>
    </div>
  );
}
