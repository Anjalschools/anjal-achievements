"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { initLocale, getLocale } from "@/lib/i18n";
import { canAccessAlumniCommunity } from "@/lib/alumni/canAccessAlumniCommunity";

type Props = { children: ReactNode };

export const AlumniCommunityAccessGate = ({ children }: Props) => {
  const [locale, setLocale] = useState<"ar" | "en">("ar");
  const [state, setState] = useState<"loading" | "ok" | "denied" | "login">("loading");

  useEffect(() => {
    initLocale();
    setLocale(getLocale() === "en" ? "en" : "ar");
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/user/profile", { credentials: "include", cache: "no-store" });
        if (cancelled) return;
        if (res.status === 401) {
          setState("login");
          return;
        }
        if (!res.ok) {
          setState("denied");
          return;
        }
        const data = (await res.json()) as {
          role?: string;
          grade?: string | null;
          accountType?: string | null;
        };
        const ok = canAccessAlumniCommunity({
          role: data.role,
          grade: data.grade,
          accountType: data.accountType as "student" | "alumni" | null | undefined,
        });
        setState(ok ? "ok" : "denied");
      } catch {
        if (!cancelled) setState("denied");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dir = locale === "ar" ? "rtl" : "ltr";

  if (state === "loading") {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-24" dir={dir}>
        <div className="mx-auto max-w-lg text-center">
          <div className="mx-auto h-12 w-12 animate-pulse rounded-full bg-slate-200" aria-hidden />
          <p className="mt-4 text-sm text-slate-600">{locale === "ar" ? "جاري التحقق من الصلاحية…" : "Checking access…"}</p>
        </div>
      </div>
    );
  }

  if (state === "login") {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-24" dir={dir}>
        <div className="mx-auto max-w-lg space-y-4 text-center">
          <p className="text-lg font-black text-slate-900">
            {locale === "ar" ? "يجب تسجيل الدخول للوصول إلى بحث مجتمع الخريجين." : "Sign in to access the alumni community search."}
          </p>
          <Link href="/login/alumni" className="inline-block font-bold text-primary underline">
            {locale === "ar" ? "تسجيل الدخول" : "Sign in"}
          </Link>
        </div>
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-24" dir={dir}>
        <div className="mx-auto max-w-lg text-center">
          <p className="text-lg font-black text-slate-900">
            {locale === "ar"
              ? "لا يمكن الوصول إلى هذه المنطقة من حسابك الحالي."
              : "This area is not available for your account."}
          </p>
          <Link href="/dashboard" className="mt-6 inline-block font-bold text-primary underline">
            {locale === "ar" ? "العودة إلى لوحة التحكم" : "Back to dashboard"}
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
