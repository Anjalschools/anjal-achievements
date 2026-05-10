"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Briefcase, GraduationCap, MapPin, Settings, Sparkles } from "lucide-react";
import { getLocale } from "@/lib/i18n";
import { AlumniBadge } from "@/components/alumni/AlumniBadge";
import { AlumniServicesDisplay } from "@/components/alumni/AlumniServicesDisplay";
import AlumniPageHeader from "@/components/alumni/AlumniPageHeader";

type MeProfile = {
  id: string;
  fullName: string;
  accountType: "student" | "alumni";
  profilePhoto?: string | null;
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

  const dir = isAr ? "rtl" : "ltr";
  const gradYear = ap.graduationYear;

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:py-12" dir={dir}>
      <AlumniPageHeader
        title={isAr ? "ملفي المهني" : "My professional profile"}
        description={
          isAr
            ? "عرض احترافي لمسارك بعد الأنجال — حدّث التفاصيل من الإعدادات."
            : "A professional view of your path after Al-Anjal — update details in settings."
        }
        backHref="/alumni"
        backLabel={isAr ? "رجوع" : "Back"}
        icon={<Sparkles className="h-6 w-6 text-white" aria-hidden />}
        breadcrumb={[
          { label: isAr ? "مجتمع الخريجين" : "Alumni", href: "/alumni" },
          { label: isAr ? "الملف" : "Profile" },
        ]}
        dir={dir}
        actions={
          <Link
            href="/settings"
            className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/15"
          >
            <Settings className="h-4 w-4 shrink-0" aria-hidden />
            {isAr ? "الإعدادات" : "Settings"}
          </Link>
        }
      />

      <section className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-[0_24px_60px_-28px_rgba(15,23,42,0.35)]">
        <div className="relative h-36 bg-gradient-to-br from-slate-900 via-primary to-slate-800 sm:h-44">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(212,175,55,0.12),_transparent_55%)]" aria-hidden />
        </div>
        <div className="relative -mt-16 flex flex-col gap-6 px-5 pb-8 pt-2 sm:flex-row sm:items-end sm:px-8">
          <div className="relative mx-auto h-28 w-28 shrink-0 overflow-hidden rounded-3xl border-4 border-white bg-slate-100 shadow-lg sm:mx-0 sm:h-32 sm:w-32">
            {profile.profilePhoto ? (
              <Image
                src={profile.profilePhoto}
                alt={profile.fullName}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-3xl font-black text-slate-400">
                {profile.fullName.trim().charAt(0) || "—"}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 text-center sm:pb-2 sm:text-start">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h1 className="text-2xl font-black text-slate-900 sm:text-3xl">{profile.fullName}</h1>
              <AlumniBadge
                locale={locale}
                user={{ accountType: profile.accountType, alumniProfile: { isVerifiedAlumni: ap.isVerifiedAlumni } }}
              />
            </div>
            <p className="mt-2 flex flex-wrap items-center justify-center gap-2 text-sm font-semibold text-slate-600 sm:justify-start">
              {ap.currentPosition ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1">
                  <Briefcase className="h-3.5 w-3.5 text-primary" aria-hidden />
                  {ap.currentPosition}
                </span>
              ) : null}
              {ap.currentCompany ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1">{ap.currentCompany}</span>
              ) : null}
              {gradYear ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-primary">
                  <GraduationCap className="h-3.5 w-3.5" aria-hidden />
                  {isAr ? `تخرج ${gradYear}` : `Class of ${gradYear}`}
                </span>
              ) : null}
              {ap.country ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                  <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {ap.country}
                </span>
              ) : null}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
              <Link
                href="/settings"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-primary/30"
              >
                {isAr ? "تعديل الملف" : "Edit profile"}
              </Link>
              {ap.linkedinUrl ? (
                <a
                  href={ap.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-800"
                >
                  LinkedIn
                </a>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-6 border-t border-slate-100 px-5 py-6 sm:px-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
              <p className="text-xs font-bold uppercase text-slate-500">{isAr ? "الجامعة" : "University"}</p>
              <p className="mt-1 text-sm font-bold text-slate-900">{ap.universityName || "—"}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
              <p className="text-xs font-bold uppercase text-slate-500">{isAr ? "التخصص" : "Major"}</p>
              <p className="mt-1 text-sm font-bold text-slate-900">{ap.major || "—"}</p>
            </div>
          </div>

          <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-700 shadow-inner">
            {ap.bio || (isAr ? "لا توجد نبذة حالياً." : "No bio yet.")}
          </p>

          <div>
            <p className="text-sm font-black text-slate-900">{isAr ? "الخدمات المقدمة" : "Services offered"}</p>
            <div className="mt-2">
              <AlumniServicesDisplay locale={locale} services={ap.alumniServices} />
            </div>
          </div>

          <div>
            <p className="text-sm font-black text-slate-900">{isAr ? "المسار" : "Journey timeline"}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              {timeline.map((step, index) => (
                <div key={`${step}-${index}`} className="inline-flex items-center gap-2">
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 shadow-sm">
                    {step}
                  </span>
                  {index < timeline.length - 1 ? <span className="text-slate-300">→</span> : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default AlumniProfilePage;
