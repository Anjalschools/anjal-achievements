"use client";

import { useCallback, useEffect, useMemo, useState, memo } from "react";
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
  Compass,
  MessageSquare,
  Search,
  Images,
  ArrowRight,
  BadgeCheck,
  BookOpen,
} from "lucide-react";
import { useAppSession } from "@/contexts/AppSessionContext";
import { getLocale } from "@/lib/i18n";
import { isEligibleForAcademicAdvisor } from "@/lib/alumni/isEligibleForAcademicAdvisor";
import { canAccessAlumniCommunity } from "@/lib/alumni/canAccessAlumniCommunity";
import AlumniMemoriesIllustration from "@/components/alumni/AlumniMemoriesIllustration";
import { AlumniCommunityActivityFeed } from "@/components/alumni/AlumniCommunityActivityFeed";
import { AlumniCommunityInsightsPanel } from "@/components/alumni/AlumniCommunityInsightsPanel";
import { AlumniMemoriesDashboardWidget } from "@/components/alumni/AlumniMemoriesDashboardWidget";
import type { CommunityFeedItem, CommunityInsights } from "@/lib/alumni/community-activation-types";

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

type MeProfile = {
  profilePhoto?: string | null;
  alumniProfile?: {
    major?: string;
    currentPosition?: string;
    isVerifiedAlumni?: boolean;
    universityName?: string;
    graduationYear?: number;
    currentCompany?: string;
    bio?: string;
    interests?: string[];
  };
};

type RecMentor = { id: string; fullName: string; universityName?: string | null; matchScore: number };
type RecOpp = { id: string; title: string; type: string; matchScore: number };
type RecPeer = { id: string; fullName: string; universityName?: string | null; matchScore: number };

type QuickAction = {
  href: string;
  title: string;
  desc: string;
  cta: string;
  icon: typeof Compass;
  gradient: string;
  ring: string;
};

const QuickActionCard = memo(({ action, isAr }: { action: QuickAction; isAr: boolean }) => {
  const Icon = action.icon;
  return (
    <Link
      href={action.href}
      className={`group relative flex h-full min-h-[148px] flex-col overflow-hidden rounded-3xl border bg-white p-5 shadow-[0_16px_44px_-28px_rgba(15,23,42,0.45)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_50px_-22px_rgba(30,58,138,0.35)] ${action.ring}`}
    >
      <div
        className={`pointer-events-none absolute inset-0 opacity-90 transition group-hover:opacity-100 ${action.gradient}`}
        aria-hidden
      />
      <div className="pointer-events-none absolute -end-6 -top-8 h-24 w-24 rounded-full bg-white/10 blur-2xl" aria-hidden />
      <div className="relative flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-white shadow-inner ring-1 ring-white/30 backdrop-blur-sm transition group-hover:scale-105">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-black text-white drop-shadow-sm">{action.title}</h3>
          <p className="mt-1 text-xs font-medium leading-relaxed text-white/85">{action.desc}</p>
        </div>
      </div>
      <span className="relative mt-auto flex items-center gap-1 pt-4 text-xs font-black text-white/95">
        {action.cta}
        <ArrowRight className={`h-3.5 w-3.5 transition group-hover:translate-x-0.5 ${isAr ? "rotate-180 group-hover:-translate-x-0.5" : ""}`} />
      </span>
    </Link>
  );
});
QuickActionCard.displayName = "QuickActionCard";

export default function AlumniDashboardPage() {
  const locale = getLocale();
  const isAr = locale === "ar";
  const dir = isAr ? "rtl" : "ltr";

  const t = useMemo(
    () => ({
      hub: isAr ? "شبكة خريجي الأنجال" : "Al-Anjal alumni network",
      welcome: isAr ? "مرحباً" : "Welcome",
      loading: isAr ? "جاري التحميل…" : "Loading…",
      alumniOnly: isAr ? "هذه اللوحة مخصّصة لحسابات الخريجين المعتمدة." : "This hub is for approved alumni accounts.",
      backDash: isAr ? "العودة إلى لوحة التحكم" : "Back to dashboard",
      editProfile: isAr ? "تعديل الملف" : "Edit profile",
      explore: isAr ? "استكشاف المجتمع" : "Explore community",
      memories: isAr ? "ذكرياتي في الأنجال" : "My school memories",
      memoriesExplore: isAr ? "استكشاف الذكريات" : "Explore memories",
      onboardingTitle: isAr ? "أكمل ملفك المهني" : "Complete your professional profile",
      quick: isAr ? "وصول سريع" : "Quick actions",
      memoriesCardTitle: isAr ? "ذكرياتي في الأنجال" : "My memories at Al-Anjal",
      memoriesCardDesc: isAr
        ? "شارك صورًا وذكريات من أيام الدراسة واسترجع أجمل اللحظات مع زملائك."
        : "Share photos and memories from your school days and revisit highlights with peers.",
      recMentors: isAr ? "مرشدون مقترحون" : "Suggested mentors",
      recOpps: isAr ? "فرص مقترحة" : "Suggested opportunities",
      recPeers: isAr ? "خريجون قد تعرفهم" : "Alumni you may know",
      stats: {
        activity: isAr ? "نشاط الإرشاد والتواصل" : "Mentorship & engagement",
        pendingMentor: isAr ? "طلبات بانتظارك كمرشد" : "Requests as mentor",
        inbox: isAr ? "رسائل غير مقروءة" : "Unread messages",
        events: isAr ? "فعاليات قادمة" : "Upcoming events",
      },
      verified: isAr ? "خريج موثّق" : "Verified alumni",
      activityTitle: isAr ? "آخر نشاطات المجتمع" : "Latest community activity",
    }),
    [isAr]
  );

  const { profile, loading: sessionLoading } = useAppSession();
  const [data, setData] = useState<Summary | null>(null);
  const [me, setMe] = useState<MeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [recMentors, setRecMentors] = useState<RecMentor[]>([]);
  const [recOpps, setRecOpps] = useState<RecOpp[]>([]);
  const [recPeers, setRecPeers] = useState<RecPeer[]>([]);
  const [memoryFlag, setMemoryFlag] = useState(false);
  const [memorySubmitted, setMemorySubmitted] = useState(false);
  const [communityFeed, setCommunityFeed] = useState<CommunityFeedItem[]>([]);
  const [communityInsights, setCommunityInsights] = useState<CommunityInsights | null>(null);
  const [activationLoading, setActivationLoading] = useState(true);

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

  const refreshMemoryFlag = useCallback(() => {
    if (typeof window === "undefined") return;
    setMemoryFlag(sessionStorage.getItem("alumni-memories-explored") === "1");
  }, []);

  useEffect(() => {
    refreshMemoryFlag();
    if (typeof window !== "undefined" && window.location.hash === "#alumni-memories") {
      sessionStorage.setItem("alumni-memories-explored", "1");
      setMemoryFlag(true);
      const el = document.getElementById("alumni-memories");
      if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    }
  }, [refreshMemoryFlag]);

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
      setActivationLoading(true);
      try {
        const [rMe, rm, ro, rn, rAct, rMem] = await Promise.all([
          fetch("/api/alumni/profile/me", { credentials: "include", cache: "no-store" }),
          fetch("/api/alumni/recommendations/mentors", { credentials: "include" }),
          fetch("/api/alumni/recommendations/opportunities", { credentials: "include" }),
          fetch("/api/alumni/recommendations/network", { credentials: "include" }),
          fetch("/api/alumni/community-activation", { credentials: "include", cache: "no-store" }),
          fetch("/api/alumni/memories", { credentials: "include", cache: "no-store" }),
        ]);
        const jMe = (await rMe.json()) as { ok?: boolean; item?: MeProfile };
        const [jm, jo, jn, jAct, jMem] = await Promise.all([rm.json(), ro.json(), rn.json(), rAct.json(), rMem.json()]);
        if (!m) return;
        if (jMe.ok && jMe.item) setMe(jMe.item);
        if (jm.ok && jm.items) setRecMentors(jm.items);
        if (jo.ok && jo.items) setRecOpps(jo.items);
        if (jn.ok && jn.items) setRecPeers(jn.items);
        if (jAct.ok && Array.isArray(jAct.feed)) setCommunityFeed(jAct.feed as CommunityFeedItem[]);
        if (jAct.ok && jAct.insights) setCommunityInsights(jAct.insights as CommunityInsights);
        if (jMem.ok && jMem.counts && typeof jMem.counts.total === "number") {
          setMemorySubmitted(jMem.counts.total > 0);
        }
      } catch {
        /* optional */
      } finally {
        if (m) setActivationLoading(false);
      }
    })();
    return () => {
      m = false;
    };
  }, [profile?.accountType]);

  const handleActivationRefresh = useCallback(() => {
    void (async () => {
      try {
        const rAct = await fetch("/api/alumni/community-activation", { credentials: "include", cache: "no-store" });
        const jAct = (await rAct.json()) as { ok?: boolean; feed?: CommunityFeedItem[]; insights?: CommunityInsights };
        if (jAct.ok && Array.isArray(jAct.feed)) setCommunityFeed(jAct.feed);
        if (jAct.ok && jAct.insights) setCommunityInsights(jAct.insights);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const handleMemoriesExplore = useCallback(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("alumni-memories-explored", "1");
      setMemoryFlag(true);
    }
  }, []);

  const pPreview = data?.profile;
  const apPreview = me?.alumniProfile || {};
  const photoPreview = pPreview?.profilePhoto || me?.profilePhoto || null;
  const universityPreview = (pPreview?.universityName || apPreview.universityName || "").trim();
  const jobPreview = (apPreview.currentPosition || "").trim();
  const companyPreview = (pPreview?.currentCompany || apPreview.currentCompany || "").trim();

  const onboardingSteps = useMemo(() => {
    if (profile?.accountType !== "alumni") return [];
    const interestsOk = Array.isArray(apPreview.interests) && apPreview.interests.length > 0;
    const bioOk = Boolean(apPreview.bio && apPreview.bio.trim().length > 12);
    const skillsOk = interestsOk || bioOk;
    return [
      { done: Boolean(photoPreview), label: isAr ? "أكمل الصورة الشخصية" : "Add a profile photo" },
      { done: Boolean(universityPreview), label: isAr ? "أضف الجامعة" : "Add your university" },
      { done: Boolean(companyPreview || jobPreview), label: isAr ? "أضف الوظيفة الحالية" : "Add your current role" },
      {
        done: memoryFlag || memorySubmitted,
        label: isAr ? "أضف أو استكشف ذكرياتك في الأنجال" : "Add or explore your Al-Anjal memories",
      },
      { done: skillsOk, label: isAr ? "أضف اهتمامات أو نبذة مهنية" : "Add interests or a short bio" },
    ];
  }, [
    profile?.accountType,
    photoPreview,
    universityPreview,
    companyPreview,
    jobPreview,
    memoryFlag,
    memorySubmitted,
    apPreview.bio,
    apPreview.interests,
    isAr,
  ]);

  const onboardingPct =
    onboardingSteps.length === 0
      ? 100
      : Math.round((onboardingSteps.filter((x) => x.done).length / onboardingSteps.length) * 100);

  const networkHref = showCommunitySearch ? "/search" : "/alumni/cohorts";

  const quickActions: QuickAction[] = useMemo(() => {
    if (profile?.accountType !== "alumni") return [];
    const list: QuickAction[] = [
      {
        href: "/alumni/mentorship",
        title: isAr ? "الإرشاد المهني" : "Mentorship",
        desc: isAr ? "اطلب إرشاداً من خريجين ومرشدين في مجالك." : "Request guidance from alumni mentors in your field.",
        cta: isAr ? "ابدأ طلباً" : "Start a request",
        icon: GraduationCap,
        gradient: "bg-gradient-to-br from-indigo-600 via-primary to-slate-900",
        ring: "border-indigo-400/20",
      },
      {
        href: "/alumni/opportunities",
        title: isAr ? "الفرص المهنية" : "Career opportunities",
        desc: isAr ? "وظائف، تدريب، وورش ضمن مجتمع الخريجين." : "Jobs, internships, and workshops in the alumni community.",
        cta: isAr ? "تصفح الفرص" : "Browse roles",
        icon: Briefcase,
        gradient: "bg-gradient-to-br from-amber-700 via-amber-600 to-slate-900",
        ring: "border-amber-400/25",
      },
      {
        href: networkHref,
        title: isAr ? "الشبكة المهنية" : "Professional network",
        desc: isAr ? "اكتشف خريجين، دفعات، وجامعات." : "Discover alumni, cohorts, and universities.",
        cta: isAr ? "استكشاف" : "Discover",
        icon: Compass,
        gradient: "bg-gradient-to-br from-sky-600 to-slate-900",
        ring: "border-sky-300/20",
      },
      {
        href: "/alumni/inbox",
        title: isAr ? "الرسائل" : "Messages",
        desc: isAr ? "تواصل آمن مع إدارة مجتمع الخريجين." : "Secure messaging with the alumni team.",
        cta: isAr ? "فتح الصندوق" : "Open inbox",
        icon: MessageSquare,
        gradient: "bg-gradient-to-br from-emerald-600 to-slate-900",
        ring: "border-emerald-400/20",
      },
      {
        href: "/alumni/dashboard#alumni-memories",
        title: isAr ? "ذكرياتي في الأنجال" : "My school memories",
        desc: isAr ? "صور ولحظات من رحلتك في الأنجال." : "Photos and moments from your journey at Al-Anjal.",
        cta: isAr ? "استكشاف الذكريات" : "Explore memories",
        icon: Images,
        gradient: "bg-gradient-to-br from-violet-600 via-primary to-slate-950",
        ring: "border-violet-300/20",
      },
    ];
    if (showAdvisor) {
      list.push({
        href: "/alumni/assistant",
        title: isAr ? "المرشد الذكي" : "Smart advisor",
        desc: isAr ? "اقتراحات مبنية على بيانات المجتمع المهني." : "Suggestions powered by community data.",
        cta: isAr ? "فتح المرشد" : "Open advisor",
        icon: Bot,
        gradient: "bg-gradient-to-br from-fuchsia-700 via-primary to-slate-950",
        ring: "border-fuchsia-300/20",
      });
    }
    return list;
  }, [profile?.accountType, networkHref, showAdvisor, isAr]);

  if (sessionLoading || loading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3" dir={dir}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
        <div className="grid w-full max-w-6xl grid-cols-2 gap-3 px-4 opacity-40 sm:grid-cols-4" aria-hidden>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </div>
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
  const ap = me?.alumniProfile || {};

  const displayName = p?.fullName || profile?.fullName || "";
  const photo = p?.profilePhoto || me?.profilePhoto || null;
  const gradYear = p?.graduationYear ?? ap.graduationYear ?? null;
  const university = (p?.universityName || ap.universityName || "").trim();
  const major = (ap.major || "").trim();
  const jobTitle = (ap.currentPosition || "").trim();
  const company = (p?.currentCompany || ap.currentCompany || "").trim();
  const verified = ap.isVerifiedAlumni === true;

  const firstName = (displayName.split(/\s+/).filter(Boolean)[0] || displayName).trim();
  const hour = new Date().getHours();
  const dynamicWelcomeLine1 = isAr
    ? `يسعدنا عودتك${firstName ? ` يا ${firstName}` : ""} 👋${university ? ` — ${university}` : ""}${major ? ` — ${major}` : ""}${gradYear ? ` — دفعة ${gradYear}` : ""}.`
    : `Great to see you again${firstName ? `, ${firstName}` : ""} 👋${university ? ` — ${university}` : ""}${major ? ` — ${major}` : ""}${gradYear ? ` — Class of ${gradYear}` : ""}.`;
  const dynamicWelcomeLine2 =
    isAr
      ? hour < 12
        ? "شبكة خريجي الأنجال تنمو بوجودك — ابدأ يومك بتواصل خفيف مع المجتمع المهني."
        : hour < 18
          ? "المجتمع المهني يتحرك كل يوم — استكشف الفرص والرسائل عندما يسمح وقتك."
          : "مساء الخير — تابع زملاءك وذكرياتك في الأنجال في أي وقت."
      : hour < 12
        ? "The alumni network grows with you — start the day with a light touch of community."
        : hour < 18
          ? "The community moves daily — explore opportunities and messages when you have a moment."
          : "Good evening — reconnect with peers and memories at your pace.";

  return (
    <div dir={dir} className="alumni-mobile-shell mx-auto max-w-6xl space-y-10 px-4 py-6 sm:py-10">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#070d18] via-[#0f172a] to-primary shadow-[0_28px_80px_-32px_rgba(15,23,42,0.85)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_80%_0%,rgba(212,175,55,0.12),transparent_50%)]" aria-hidden />
        <div className="pointer-events-none absolute -bottom-20 start-0 h-56 w-56 rounded-full bg-sky-500/10 blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-8 p-6 sm:p-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="relative mx-auto h-28 w-28 shrink-0 overflow-hidden rounded-3xl bg-white/10 ring-4 ring-white/10 sm:mx-0 sm:h-32 sm:w-32">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt="" className="h-full w-full object-cover" />
              ) : (
                <Image src="/logow.png" alt="" fill className="object-contain p-3" sizes="128px" />
              )}
            </div>
            <div className="min-w-0 text-center sm:text-start">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-sky-200/80">{t.hub}</p>
              <h1 className="mt-1 text-2xl font-black text-white sm:text-4xl">
                {t.welcome}، {firstName || displayName}
              </h1>
              <p className="mt-2 max-w-xl text-sm font-semibold leading-relaxed text-slate-100">{dynamicWelcomeLine1}</p>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-200/90">{dynamicWelcomeLine2}</p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                {verified ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-black text-emerald-100 ring-1 ring-emerald-400/30">
                    <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                    {t.verified}
                  </span>
                ) : null}
                {gradYear ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white">
                    <GraduationCap className="h-3.5 w-3.5" aria-hidden />
                    {isAr ? `تخرج ${gradYear}` : `Class of ${gradYear}`}
                  </span>
                ) : null}
                {university ? (
                  <span className="max-w-[220px] truncate rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-sky-50">
                    {university}
                  </span>
                ) : null}
                {major ? (
                  <span className="max-w-[200px] truncate rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-slate-200">
                    {major}
                  </span>
                ) : null}
                {(jobTitle || company) ? (
                  <span className="max-w-[240px] truncate rounded-full bg-secondary/15 px-3 py-1 text-xs font-bold text-amber-100">
                    {[jobTitle, company].filter(Boolean).join(" · ")}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
            <Link
              href="/settings"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-primary shadow-lg transition hover:bg-sky-50"
            >
              {t.editProfile}
            </Link>
            <Link
              href={showCommunitySearch ? "/search" : "/alumni"}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/15"
            >
              <Search className="h-4 w-4" aria-hidden />
              {t.explore}
            </Link>
            <Link
              href="/alumni/dashboard#alumni-memories"
              onClick={handleMemoriesExplore}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-5 py-3 text-sm font-bold text-amber-50 transition hover:bg-amber-500/20"
            >
              <Images className="h-4 w-4" aria-hidden />
              {t.memories}
            </Link>
          </div>
        </div>
      </section>

      {/* Onboarding progress */}
      {onboardingPct < 100 ? (
        <section
          className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-[0_12px_40px_-28px_rgba(15,23,42,0.2)] sm:p-6"
          aria-label={t.onboardingTitle}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" aria-hidden />
              <h2 className="text-sm font-black text-slate-900">{t.onboardingTitle}</h2>
            </div>
            <span className="text-xs font-black tabular-nums text-primary">{onboardingPct}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-sky-500 transition-all duration-500 ease-out motion-safe:transition-[width]"
              style={{ width: `${onboardingPct}%` }}
            />
          </div>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {onboardingSteps.map((step) => (
              <li
                key={step.label}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${
                  step.done ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-slate-100 bg-slate-50 text-slate-600"
                }`}
              >
                <span className={step.done ? "text-emerald-600" : "text-slate-400"}>{step.done ? "✓" : "○"}</span>
                {step.label}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div>
        <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">{t.quick}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((action) => (
            <QuickActionCard key={action.href} action={action} isAr={isAr} />
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-3 xl:col-span-2">
          <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">{t.activityTitle}</h2>
          <AlumniCommunityActivityFeed items={communityFeed} loading={activationLoading} isAr={isAr} />
        </div>
        <AlumniCommunityInsightsPanel insights={communityInsights} isAr={isAr} majorHint={major} />
      </div>

      {/* Memories spotlight */}
      <section
        id="alumni-memories"
        className="scroll-mt-24 space-y-6 overflow-hidden rounded-[2rem] border border-slate-200/80 bg-gradient-to-br from-slate-50 via-white to-sky-50/50 p-6 shadow-[0_20px_50px_-30px_rgba(30,58,138,0.35)] sm:p-8"
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
          <div className="flex-1 space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-primary">
              <Images className="h-3.5 w-3.5" aria-hidden />
              {t.memoriesCardTitle}
            </div>
            <h3 className="text-xl font-black text-slate-900 sm:text-2xl">{t.memoriesCardTitle}</h3>
            <p className="max-w-prose text-sm leading-relaxed text-slate-600">{t.memoriesCardDesc}</p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/alumni/stories"
                onClick={handleMemoriesExplore}
                className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white shadow-lg shadow-primary/30 transition hover:opacity-95"
              >
                {t.memoriesExplore}
                <ArrowRight className={`h-4 w-4 ${isAr ? "rotate-180" : ""}`} aria-hidden />
              </Link>
              <Link
                href="/alumni/events"
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-slate-50"
              >
                {isAr ? "فعاليات الخريجين" : "Alumni events"}
              </Link>
            </div>
          </div>
          <div className="flex shrink-0 justify-center lg:w-72">
            <AlumniMemoriesIllustration className="h-32 w-full max-w-[240px] sm:h-36" />
          </div>
        </div>
        <AlumniMemoriesDashboardWidget
          isAr={isAr}
          onMemorySubmitted={() => {
            setMemorySubmitted(true);
            handleActivationRefresh();
          }}
        />
      </section>

      {recMentors.length > 0 || recOpps.length > 0 || recPeers.length > 0 ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-md">
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
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-md">
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
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-md">
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: t.stats.activity, value: s?.contributionsCount ?? 0, icon: Sparkles },
          { label: t.stats.pendingMentor, value: s?.mentorshipPendingIncoming ?? 0, icon: Users },
          { label: t.stats.inbox, value: s?.inboxUnread ?? 0, icon: Mail },
          { label: t.stats.events, value: s?.upcomingEvents ?? 0, icon: GraduationCap },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-[0_12px_36px_-24px_rgba(15,23,42,0.25)] transition hover:border-primary/20"
          >
            <div className="flex items-center gap-2 text-primary">
              <card.icon className="h-5 w-5 shrink-0" aria-hidden />
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{card.label}</span>
            </div>
            <p className="mt-3 text-3xl font-black tabular-nums text-slate-900">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 border-t border-slate-200/80 pt-8">
        <Link
          href="/alumni/profile"
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-slate-50"
        >
          {isAr ? "ملفي العام كخريج" : "Public alumni profile"}
        </Link>
        <Link
          href="/alumni/stories"
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-slate-50"
        >
          {isAr ? "قصص النجاح" : "Success stories"}
        </Link>
        <Link
          href="/alumni/events"
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-slate-50"
        >
          {isAr ? "الفعاليات" : "Events"}
        </Link>
        <Link
          href="/alumni/announcements"
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-slate-50"
        >
          {isAr ? "الإعلانات" : "Announcements"}
        </Link>
      </div>
    </div>
  );
}
