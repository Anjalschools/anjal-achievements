"use client";

import Link from "next/link";
import { AlumniBadge } from "@/components/alumni/AlumniBadge";
import { AlumniServicesDisplay } from "@/components/alumni/AlumniServicesDisplay";
import type { AlumniMentorItem } from "@/lib/alumni/alumni-ecosystem-types";

type AlumniProfileCardProps = {
  profile: AlumniMentorItem;
  locale: "ar" | "en";
  href?: string;
};

export const AlumniProfileCard = ({ profile, locale, href }: AlumniProfileCardProps) => {
  const isAr = locale === "ar";
  const content = (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-primary/30 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-slate-900">{profile.fullName || (isAr ? "خريج الأنجال" : "Alumni")}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {[profile.expertise, profile.company].filter(Boolean).join(" — ") || "—"}
          </p>
        </div>
        <AlumniBadge
          locale={locale}
          user={{ accountType: "alumni", alumniProfile: { isVerifiedAlumni: true } }}
        />
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
