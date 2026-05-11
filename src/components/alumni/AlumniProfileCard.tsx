"use client";

import Link from "next/link";
import { AlumniBadge } from "@/components/alumni/AlumniBadge";
import { AlumniBadgeStrip } from "@/components/alumni/AlumniBadgeStrip";
import { AlumniServicesDisplay } from "@/components/alumni/AlumniServicesDisplay";
import type { AlumniMentorItem } from "@/lib/alumni/alumni-ecosystem-types";
import { formatRelativeTime } from "@/lib/alumni/format-relative-time";

type AlumniProfileCardProps = {
  profile: AlumniMentorItem;
  locale: "ar" | "en";
  href?: string;
};

export const AlumniProfileCard = ({ profile, locale, href }: AlumniProfileCardProps) => {
  const isAr = locale === "ar";
  const sessions = profile.mentorshipSessionCount ?? 0;
  const rate = profile.responseRateApprox;
  const lastAct = profile.lastActivityAt
    ? formatRelativeTime(profile.lastActivityAt, isAr)
    : null;
  const expertiseAreas = profile.expertiseAreas?.length ? profile.expertiseAreas : [];

  const content = (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-primary/30 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-black text-slate-900">{profile.fullName || (isAr ? "خريج الأنجال" : "Alumni")}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {[profile.expertise, profile.company].filter(Boolean).join(" — ") || "—"}
          </p>
        </div>
        <AlumniBadge
          locale={locale}
          user={{
            accountType: "alumni",
            alumniProfile: {
              isVerifiedAlumni: profile.isVerifiedAlumni === true,
              verificationTier: profile.verificationTier,
              trustScore: profile.trustScore ?? null,
              alumniServices: { mentoring: profile.mentoringAvailable },
            },
          }}
        />
      </div>
      {profile.trustBadges?.length ? (
        <div className="mt-3">
          <AlumniBadgeStrip badges={profile.trustBadges} isAr={isAr} max={4} dense />
        </div>
      ) : null}
      {expertiseAreas.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {expertiseAreas.slice(0, 5).map((x) => (
            <span
              key={x}
              className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[11px] font-bold text-violet-900"
            >
              {x}
            </span>
          ))}
        </div>
      ) : null}
      <div className="mt-3 grid gap-1.5 text-xs font-semibold text-slate-600 sm:grid-cols-2">
        <p>
          {isAr ? "جلسات إرشاد (تقريبية): " : "Mentorship sessions (approx.): "}
          <span className="text-slate-900">{sessions}</span>
        </p>
        <p>
          {isAr ? "معدل الاستجابة (تقريبي): " : "Response rate (approx.): "}
          <span className="text-slate-900">{rate != null ? `${rate}%` : "—"}</span>
        </p>
        {lastAct ? (
          <p className="sm:col-span-2">
            {isAr ? "آخر نشاط: " : "Last activity: "}
            <span className="text-slate-900">{lastAct}</span>
          </p>
        ) : null}
      </div>
      <div className="mt-3 grid gap-1 text-sm text-slate-600">
        <p>{isAr ? "الجامعة: " : "University: "}{profile.universityName || "—"}</p>
        <p>{isAr ? "الدولة: " : "Country: "}{[profile.city, profile.country].filter(Boolean).join("، ") || "—"}</p>
      </div>
      <div className="mt-3">
        <AlumniServicesDisplay
          locale={locale}
          services={{ mentoring: profile.mentoringAvailable }}
        />
      </div>
    </article>
  );

  if (!href) return content;
  return <Link href={href}>{content}</Link>;
};
