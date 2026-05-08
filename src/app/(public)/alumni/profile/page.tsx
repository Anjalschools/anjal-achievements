"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getLocale } from "@/lib/i18n";
import { AlumniBadge } from "@/components/alumni/AlumniBadge";
import { AlumniServicesDisplay } from "@/components/alumni/AlumniServicesDisplay";

type MeProfile = {
  id: string;
  fullName: string;
  accountType: "student" | "alumni";
  alumniProfile?: {
    graduationYear?: number;
    universityName?: string;
    major?: string;
    currentCompany?: string;
    currentPosition?: string;
    country?: string;
    linkedinUrl?: string;
    bio?: string;
    isVerifiedAlumni?: boolean;
    alumniServices?: {
      mentoring?: boolean;
      internships?: boolean;
      jobs?: boolean;
      workshops?: boolean;
      judging?: boolean;
      sponsorship?: boolean;
    };
  };
};

const AlumniProfilePage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [profile, setProfile] = useState<MeProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/alumni/profile/me", { cache: "no-store" });
        if (!response.ok) {
          setProfile(null);
          return;
        }
        const json = await response.json();
        setProfile(json.item || null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <main className="mx-auto max-w-5xl px-4 py-20">{isAr ? "جاري التحميل..." : "Loading..."}</main>;
  }

  if (!profile) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-20" dir={isAr ? "rtl" : "ltr"}>
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
          {isAr ? "سجّل الدخول لعرض ملفك كخريج." : "Sign in to view your alumni profile."}
        </p>
      </main>
    );
  }

  const ap = profile.alumniProfile || {};
  const timeline = [
    isAr ? "الأنجال" : "Al-Anjal",
    ap.universityName || (isAr ? "الجامعة" : "University"),
    ap.currentCompany || (isAr ? "المسار المهني" : "Career path"),
  ];

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:py-14" dir={isAr ? "rtl" : "ltr"}>
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900">{profile.fullName}</h1>
            <p className="mt-1 text-sm text-slate-500">{ap.currentPosition || "—"}</p>
          </div>
          <AlumniBadge
            locale={locale}
            user={{ accountType: profile.accountType, alumniProfile: { isVerifiedAlumni: ap.isVerifiedAlumni } }}
          />
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 text-sm text-slate-700">
          <p>{isAr ? "الجامعة: " : "University: "}{ap.universityName || "—"}</p>
          <p>{isAr ? "التخصص: " : "Major: "}{ap.major || "—"}</p>
          <p>{isAr ? "المنصب الحالي: " : "Current role: "}{ap.currentPosition || "—"}</p>
          <p>{isAr ? "جهة العمل: " : "Company: "}{ap.currentCompany || "—"}</p>
          <p>{isAr ? "الدولة: " : "Country: "}{ap.country || "—"}</p>
          <p>
            {isAr ? "LinkedIn: " : "LinkedIn: "}
            {ap.linkedinUrl ? <a className="text-primary underline" href={ap.linkedinUrl} target="_blank">{ap.linkedinUrl}</a> : "—"}
          </p>
        </div>
        <p className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
          {ap.bio || (isAr ? "لا توجد نبذة حالياً." : "No bio yet.")}
        </p>

        <div className="mt-5">
          <p className="text-sm font-black text-slate-900">{isAr ? "الخدمات المقدمة" : "Services offered"}</p>
          <div className="mt-2">
            <AlumniServicesDisplay locale={locale} services={ap.alumniServices} />
          </div>
        </div>

        <div className="mt-6">
          <p className="text-sm font-black text-slate-900">{isAr ? "المسار" : "Journey timeline"}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            {timeline.map((step, index) => (
              <div key={`${step}-${index}`} className="inline-flex items-center gap-2">
                <span className="rounded-full border border-slate-200 px-3 py-1 font-semibold text-slate-700">{step}</span>
                {index < timeline.length - 1 ? <span className="text-slate-400">→</span> : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mt-6">
        <Link href="/alumni" className="text-sm font-bold text-primary hover:underline">
          {isAr ? "العودة لمجتمع الخريجين" : "Back to alumni"}
        </Link>
      </div>
    </main>
  );
};

export default AlumniProfilePage;
