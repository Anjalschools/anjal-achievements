"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import type { FeaturedAlumniItem } from "@/lib/alumni/alumni-public-types";
import { AlumniBadge } from "@/components/alumni/AlumniBadge";

type FeaturedAlumniCardProps = {
  item: FeaturedAlumniItem;
  locale: "ar" | "en";
  href?: string;
};

export const FeaturedAlumniCard = ({ item, locale, href }: FeaturedAlumniCardProps) => {
  const isAr = locale === "ar";
  const initials = item.fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
  const hasLocalAvatar = Boolean(item.avatar && item.avatar.startsWith("/"));
  const card = (
    <article className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.08)] transition duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_10px_24px_rgba(15,23,42,0.12)]">
      <div className="pointer-events-none absolute end-2 top-2 opacity-[0.06]" aria-hidden>
        <Image src="/logow.png" alt="" width={48} height={48} className="object-contain" />
      </div>

      <div className="relative flex items-start gap-3">
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary to-primary-dark text-sm font-extrabold text-white ring-2 ring-primary/15">
          {hasLocalAvatar ? (
            <Image
              src={item.avatar as string}
              alt={item.fullName}
              fill
              sizes="48px"
              className="object-cover"
            />
          ) : (
            <span aria-hidden>{initials || "A"}</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-black text-slate-900">{item.fullName}</h3>
          <p className="mt-0.5 text-xs font-semibold text-slate-500">
            {item.currentPosition || (isAr ? "المسمى الوظيفي غير متاح" : "Role unavailable")}
          </p>
        </div>
        <AlumniBadge
          locale={locale}
          user={{
            accountType: "alumni",
            alumniProfile: {
              isVerifiedAlumni: item.isVerifiedAlumni === true,
              verificationTier: item.verificationTier,
              trustScore: item.trustScore ?? null,
            },
          }}
        />
      </div>

      <div className="relative mt-4 grid gap-1.5 text-sm text-slate-600">
        <p>
          <span className="font-semibold text-slate-700">{isAr ? "الجامعة: " : "University: "}</span>
          {item.universityName || "—"}
        </p>
        <p>
          <span className="font-semibold text-slate-700">{isAr ? "الجهة الحالية: " : "Company: "}</span>
          {item.currentCompany || "—"}
        </p>
      </div>
      {item.bio ? <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate-600">{item.bio}</p> : null}
      {href ? (
        <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-primary">
          {isAr ? "الملف التعريفي" : "Profile"}
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </span>
      ) : null}
    </article>
  );
  if (!href) return card;
  return <Link href={href}>{card}</Link>;
};
