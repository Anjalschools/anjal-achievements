"use client";

import Link from "next/link";
import Image from "next/image";
import { CheckCircle2, GraduationCap, Lock, LogIn, UserCircle, Users } from "lucide-react";

export type AlumniJoinSuccessProps = {
  isAr?: boolean;
  /** Normalized signup email (displayed as username). */
  email: string;
  /** When automatic session creation failed after signup. */
  showLoginHint?: boolean;
};

const AlumniJoinSuccess = ({ isAr = true, email, showLoginHint = false }: AlumniJoinSuccessProps) => {
  const copy = isAr
    ? {
        title: "تم إنشاء حسابك بنجاح",
        body1:
          "مرحبًا بك في مجتمع خريجي الأنجال. تم تفعيل حسابك مباشرة ويمكنك الآن الدخول والمشاركة في المنصة.",
        body2: "اسم المستخدم لتسجيل الدخول هو بريدك الإلكتروني المسجّل.",
        passwordHint: "كلمة المرور: استخدم كلمة المرور التي أنشأتها عند التسجيل.",
        loginHint:
          "لم نتمكن من فتح جلسة الدخول تلقائيًا من هذا المتصفح. يمكنك الضغط على «دخول الآن» واستخدام نفس البريد وكلمة المرور.",
        usernameLabel: "اسم المستخدم (البريد الإلكتروني)",
        sectionNext: "الخطوات التالية",
        exploreTitle: "ماذا يتيح لك المجتمع؟",
        services: [
          "فرص الإرشاد",
          "التواصل المهني",
          "الفعاليات واللقاءات",
          "فرص التدريب والعمل",
          "مجتمع خريجي الأنجال",
          "قصص النجاح",
        ],
        btnDashboard: "دخول إلى مجتمع الخريجين",
        btnProfile: "إكمال الملف الشخصي",
        btnCommunity: "استكشاف المجتمع",
        btnLoginNow: "دخول الآن",
        footer: "إدارة مدارس الأنجال الأهلية",
      }
    : {
        title: "Your account is ready",
        body1:
          "Welcome to the Al-Anjal alumni community. Your account is active now — you can sign in and start using the platform.",
        body2: "Your username for sign-in is the email address you registered.",
        passwordHint: "Password: use the password you chose during registration.",
        loginHint:
          "We could not start a session automatically in this browser. Tap “Sign in now” and use the same email and password.",
        usernameLabel: "Username (email)",
        sectionNext: "Suggested next steps",
        exploreTitle: "What you can explore",
        services: [
          "Mentoring opportunities",
          "Professional networking",
          "Events and meetups",
          "Internships and jobs",
          "Al-Anjal alumni community",
          "Success stories",
        ],
        btnDashboard: "Go to alumni hub",
        btnProfile: "Complete your profile",
        btnCommunity: "Explore the community",
        btnLoginNow: "Sign in now",
        footer: "Al-Anjal Private Schools",
      };

  return (
    <main dir={isAr ? "rtl" : "ltr"} className="min-h-screen bg-gradient-to-b from-slate-950 via-primary-dark to-slate-900 py-8 sm:py-12">
      <div className="mx-auto flex max-w-lg flex-col items-center px-4 sm:px-6">
        <div className="w-full rounded-3xl border border-white/10 bg-white p-6 shadow-2xl sm:p-8">
          <div className="flex flex-col items-center text-center">
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 ring-4 ring-emerald-100/80">
              <CheckCircle2 className="h-11 w-11 text-emerald-600" strokeWidth={2.2} aria-hidden />
              <span className="sr-only">{isAr ? "تم التفعيل" : "Activated"}</span>
            </div>
            <div className="relative mt-4 h-12 w-12 shrink-0">
              <Image
                src="/logow.png"
                alt={isAr ? "شعار مدارس الأنجال" : "Al-Anjal logo"}
                fill
                sizes="48px"
                className="object-contain"
              />
            </div>
            <h1 className="mt-4 text-xl font-black leading-snug text-slate-900 sm:text-2xl">{copy.title}</h1>
            <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">{copy.body1}</p>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">{copy.body2}</p>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50/90 p-4 text-start">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{copy.usernameLabel}</p>
            <p dir="ltr" className="mt-1 break-all font-mono text-sm font-semibold text-slate-900">
              {email}
            </p>
            <div className="mt-3 flex items-start gap-2 text-sm text-slate-700">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span>{copy.passwordHint}</span>
            </div>
          </div>

          {showLoginHint ? (
            <div
              className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-start text-sm text-amber-950"
              role="status"
            >
              {copy.loginHint}
            </div>
          ) : null}

          <div className="mt-8 border-t border-slate-100 pt-6">
            <h2 className="flex items-center justify-center gap-2 text-sm font-black text-slate-800">
              <GraduationCap className="h-4 w-4 text-primary" aria-hidden />
              {copy.sectionNext}
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-1">
              <li>
                <Link
                  href="/alumni/dashboard"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-black text-white shadow-[0_8px_18px_rgba(30,64,175,0.25)] transition hover:bg-primary-dark"
                >
                  <LogIn className="h-4 w-4 shrink-0" aria-hidden />
                  {copy.btnDashboard}
                </Link>
              </li>
              <li className="grid gap-3 sm:grid-cols-2">
                <Link
                  href="/alumni/onboarding"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-black text-slate-800 transition hover:bg-slate-50"
                >
                  <UserCircle className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  {copy.btnProfile}
                </Link>
                <Link
                  href="/alumni/community"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-black text-slate-800 transition hover:bg-slate-50"
                >
                  <Users className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  {copy.btnCommunity}
                </Link>
              </li>
              {showLoginHint ? (
                <li>
                  <Link
                    href="/login/alumni"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-primary/30 bg-primary/5 px-5 py-3.5 text-sm font-black text-primary transition hover:bg-primary/10"
                  >
                    <LogIn className="h-4 w-4 shrink-0" aria-hidden />
                    {copy.btnLoginNow}
                  </Link>
                </li>
              ) : null}
            </ul>
          </div>

          <div className="mt-8 rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
            <h3 className="text-center text-sm font-black text-slate-900">{copy.exploreTitle}</h3>
            <ul className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
              {copy.services.map((s) => (
                <li
                  key={s}
                  className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 shadow-sm ring-1 ring-slate-100"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                  {s}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/alumni"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              {isAr ? "صفحة الخريجين العامة" : "Public alumni page"}
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              {isAr ? "الرئيسية" : "Home"}
            </Link>
          </div>

          <p className="mt-6 text-center text-[11px] text-slate-400">{copy.footer}</p>
        </div>
      </div>
    </main>
  );
};

export default AlumniJoinSuccess;
