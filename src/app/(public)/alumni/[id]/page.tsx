"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getLocale } from "@/lib/i18n";
import { AlumniBadge } from "@/components/alumni/AlumniBadge";
import { AlumniBadgeStrip } from "@/components/alumni/AlumniBadgeStrip";
import { AlumniServicesDisplay } from "@/components/alumni/AlumniServicesDisplay";

type PublicAlumniItem = {
  fullName: string;
  profilePhoto: string | null;
  alumniProfile: Record<string, unknown>;
  alumniTrustBadges?: string[];
  featuredMemory?: { memoryPostId: string; imageUrl: string; caption: string } | null;
  topExpertise?: string[];
  professionalSummary?: string | null;
};

const AlumniPublicProfilePage = () => {
  const params = useParams<{ id: string }>();
  const id = String(params?.id || "");
  const locale = getLocale();
  const isAr = locale === "ar";
  const [item, setItem] = useState<PublicAlumniItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const response = await fetch(`/api/public/alumni-profile/${id}`, { cache: "no-store" });
        if (!response.ok) {
          setItem(null);
          return;
        }
        const json = (await response.json()) as { item?: PublicAlumniItem };
        setItem(json.item || null);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <main className="mx-auto max-w-5xl px-4 py-20">{isAr ? "جاري التحميل..." : "Loading..."}</main>;
  if (!item) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-20" dir={isAr ? "rtl" : "ltr"}>
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-slate-700">
          {isAr ? "الملف غير متاح حالياً." : "Profile is currently unavailable."}
        </p>
      </main>
    );
  }

  const ap = item.alumniProfile || {};
  const interests = Array.isArray(ap.interests) ? (ap.interests as string[]) : [];
  const timelineSteps = [
    { label: isAr ? "الأنجال" : "Al-Anjal", detail: isAr ? "بداية الرحلة" : "School journey" },
    {
      label: typeof ap.universityName === "string" && ap.universityName ? ap.universityName : "—",
      detail: isAr ? "الجامعة" : "University",
    },
    {
      label:
        typeof ap.currentPosition === "string" && ap.currentPosition
          ? ap.currentPosition
          : typeof ap.currentCompany === "string" && ap.currentCompany
            ? ap.currentCompany
            : "—",
      detail: isAr ? "المسار المهني" : "Career",
    },
  ];

  const summary =
    item.professionalSummary ||
    (typeof ap.bio === "string" ? ap.bio : "") ||
    (isAr ? "لا توجد نبذة مهنية بعد." : "No professional summary yet.");

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:py-14" dir={isAr ? "rtl" : "ltr"}>
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            {item.profilePhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.profilePhoto}
                alt=""
                className="h-24 w-24 shrink-0 rounded-3xl object-cover ring-2 ring-slate-100"
              />
            ) : null}
            <div className="min-w-0">
              <h1 className="text-2xl font-black text-slate-900">{item.fullName}</h1>
              <p className="mt-1 text-sm text-slate-500">
                {typeof ap.currentPosition === "string" ? ap.currentPosition : "—"}
              </p>
              {item.alumniTrustBadges?.length ? (
                <AlumniBadgeStrip badges={item.alumniTrustBadges} isAr={isAr} max={7} className="mt-3" />
              ) : null}
            </div>
          </div>
          <AlumniBadge
            locale={locale}
            user={{
              accountType: "alumni",
              alumniProfile: {
                isVerifiedAlumni: ap.isVerifiedAlumni === true,
                verificationTier: ap.verificationTier as "basic" | "academic" | "career" | "institution" | "global" | undefined,
                trustScore: typeof ap.trustScore === "number" ? ap.trustScore : null,
                alumniServices: ap.alumniServices as { mentoring?: boolean } | undefined,
                isAmbassadorAlumni: ap.isAmbassadorAlumni === true,
                isDistinguishedAlumni: ap.isDistinguishedAlumni === true,
              },
            }}
          />
        </div>

        <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
          <h2 className="text-xs font-black uppercase tracking-wide text-slate-500">
            {isAr ? "ملخص مهني" : "Professional summary"}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-800">{summary}</p>
        </div>

        {item.topExpertise?.length ? (
          <div className="mt-5">
            <h2 className="text-xs font-black uppercase tracking-wide text-slate-500">
              {isAr ? "أبرز الخبرات" : "Top expertise"}
            </h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {item.topExpertise.map((x) => (
                <span
                  key={x}
                  className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-bold text-primary"
                >
                  {x}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {interests.length > 0 ? (
          <div className="mt-5">
            <h2 className="text-xs font-black uppercase tracking-wide text-slate-500">
              {isAr ? "اهتمامات ومهارات" : "Interests & skills"}
            </h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {interests.slice(0, 14).map((x) => (
                <span
                  key={x}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                >
                  {x}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-6 grid gap-3 sm:grid-cols-2 text-sm text-slate-700">
          <p>
            {isAr ? "الجامعة: " : "University: "}
            {typeof ap.universityName === "string" ? ap.universityName : "—"}
          </p>
          <p>{isAr ? "التخصص: " : "Major: "}{typeof ap.major === "string" ? ap.major : "—"}</p>
          <p>{isAr ? "الوظيفة: " : "Role: "}{typeof ap.currentPosition === "string" ? ap.currentPosition : "—"}</p>
          <p>{isAr ? "الشركة: " : "Company: "}{typeof ap.currentCompany === "string" ? ap.currentCompany : "—"}</p>
          <p>{isAr ? "الدولة: " : "Country: "}{typeof ap.country === "string" ? ap.country : "—"}</p>
          <p>
            {isAr ? "LinkedIn: " : "LinkedIn: "}
            {typeof ap.linkedinUrl === "string" && ap.linkedinUrl ? (
              <a href={ap.linkedinUrl} className="text-primary underline">
                {ap.linkedinUrl}
              </a>
            ) : (
              "—"
            )}
          </p>
        </div>

        {item.featuredMemory?.imageUrl ? (
          <div className="mt-8 overflow-hidden rounded-3xl border border-violet-100 bg-violet-50/30">
            <h2 className="border-b border-violet-100 px-4 py-3 text-sm font-black text-violet-950">
              {isAr ? "ذكرى مميزة من الأنجال" : "Featured school memory"}
            </h2>
            <div className="grid gap-4 p-4 sm:grid-cols-2 sm:items-center">
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-black/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.featuredMemory.imageUrl} alt="" className="h-full w-full object-cover" />
              </div>
              {item.featuredMemory.caption ? (
                <p className="text-sm leading-relaxed text-slate-700">{item.featuredMemory.caption}</p>
              ) : (
                <p className="text-sm text-slate-500">{isAr ? "ذكرى معتمدة من المجتمع." : "A community-approved memory."}</p>
              )}
            </div>
          </div>
        ) : null}

        <div className="mt-8">
          <h2 className="text-xs font-black uppercase tracking-wide text-slate-500">
            {isAr ? "مسار مهني مبسّط" : "Light professional timeline"}
          </h2>
          <ol className="relative mt-4 space-y-4 border-s-2 border-primary/20 ps-6">
            {timelineSteps.map((step, index) => (
              <li key={`${step.label}-${index}`} className="relative">
                <span className="absolute -start-[31px] mt-1.5 h-3 w-3 rounded-full bg-primary ring-4 ring-white" />
                <p className="font-black text-slate-900">{step.label}</p>
                <p className="text-xs font-semibold text-slate-500">{step.detail}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-6">
          <AlumniServicesDisplay locale={locale} services={ap.alumniServices as { mentoring?: boolean } | undefined} />
        </div>
      </section>

      <div className="mt-6">
        <Link href="/alumni" className="text-sm font-bold text-primary hover:underline">
          {isAr ? "العودة لصفحة الخريجين" : "Back to alumni"}
        </Link>
      </div>
    </main>
  );
};

export default AlumniPublicProfilePage;
