"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getLocale } from "@/lib/i18n";
import { AlumniBadge } from "@/components/alumni/AlumniBadge";
import { AlumniServicesDisplay } from "@/components/alumni/AlumniServicesDisplay";

const AlumniPublicProfilePage = () => {
  const params = useParams<{ id: string }>();
  const id = String(params?.id || "");
  const locale = getLocale();
  const isAr = locale === "ar";
  const [item, setItem] = useState<any>(null);
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
        const json = await response.json();
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
  const timeline = [isAr ? "الأنجال" : "Al-Anjal", ap.universityName || "—", ap.currentCompany || "—"];

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:py-14" dir={isAr ? "rtl" : "ltr"}>
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-slate-900">{item.fullName}</h1>
            <p className="mt-1 text-sm text-slate-500">{ap.currentPosition || "—"}</p>
          </div>
          <AlumniBadge locale={locale} user={{ accountType: "alumni", alumniProfile: { isVerifiedAlumni: ap.isVerifiedAlumni } }} />
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 text-sm text-slate-700">
          <p>{isAr ? "الجامعة: " : "University: "}{ap.universityName || "—"}</p>
          <p>{isAr ? "التخصص: " : "Major: "}{ap.major || "—"}</p>
          <p>{isAr ? "الوظيفة: " : "Role: "}{ap.currentPosition || "—"}</p>
          <p>{isAr ? "الشركة: " : "Company: "}{ap.currentCompany || "—"}</p>
          <p>{isAr ? "الدولة: " : "Country: "}{ap.country || "—"}</p>
          <p>
            {isAr ? "LinkedIn: " : "LinkedIn: "}
            {ap.linkedinUrl ? <a href={ap.linkedinUrl} className="text-primary underline">{ap.linkedinUrl}</a> : "—"}
          </p>
        </div>

        <p className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          {ap.bio || (isAr ? "لا توجد نبذة." : "No bio.")}
        </p>
        <div className="mt-4">
          <AlumniServicesDisplay locale={locale} services={ap.alumniServices} />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
          {timeline.map((step: string, index: number) => (
            <div key={`${step}-${index}`} className="inline-flex items-center gap-2">
              <span className="rounded-full border border-slate-200 px-3 py-1 font-semibold text-slate-700">{step}</span>
              {index < timeline.length - 1 ? <span className="text-slate-400">→</span> : null}
            </div>
          ))}
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
