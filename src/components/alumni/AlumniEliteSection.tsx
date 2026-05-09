"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Crown } from "lucide-react";
import type { AlumniLocale } from "@/content/alumni-landing";
import { AlumniBadge } from "@/components/alumni/AlumniBadge";

type EliteItem = {
  id: string;
  fullName: string;
  profilePhoto: string | null;
  universityName: string | null;
  company: string | null;
  position: string | null;
  reputationScore: number;
  isVerifiedAlumni: boolean;
  verificationTier?: "basic" | "academic" | "career" | "institution" | "global";
  trustScore?: number | null;
  isFeaturedAlumni: boolean;
  isAmbassadorAlumni: boolean;
  isDistinguishedAlumni: boolean;
  mentoringAvailable: boolean;
};

export const AlumniEliteSection = ({ locale }: { locale: AlumniLocale }) => {
  const isAr = locale === "ar";
  const [items, setItems] = useState<EliteItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let m = true;
    void (async () => {
      try {
        const res = await fetch("/api/public/alumni/elite?limit=8", { cache: "no-store" });
        const json = (await res.json()) as { ok?: boolean; items?: EliteItem[] };
        if (m && json.ok && json.items) setItems(json.items);
      } finally {
        if (m) setLoading(false);
      }
    })();
    return () => {
      m = false;
    };
  }, []);

  if (loading) {
    return (
      <section className="mx-auto flex max-w-6xl justify-center px-4 py-12" dir={isAr ? "rtl" : "ltr"}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      </section>
    );
  }

  if (!items.length) return null;

  return (
    <section
      className="mx-auto max-w-6xl px-4 py-14"
      dir={isAr ? "rtl" : "ltr"}
      aria-labelledby="alumni-elite-heading"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-amber-700/90">
            {isAr ? "النخبة" : "Elite network"}
          </p>
          <h2 id="alumni-elite-heading" className="mt-2 flex items-center gap-2 text-2xl font-black text-slate-900">
            <Crown className="h-7 w-7 text-amber-500" aria-hidden />
            {isAr ? "خريجو الأنجال المتميّزون" : "Distinguished Anjal alumni"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            {isAr
              ? "يُعرض الخريجون الأكثر تأثيرًا وفق نشاطهم ومساهماتهم واعتمادهم في المنصة."
              : "Highlighting high-impact alumni based on platform signals, contributions, and verification."}
          </p>
        </div>
      </div>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((a) => (
          <li key={a.id}>
            <Link
              href={`/alumni/${a.id}`}
              className="block h-full rounded-2xl border border-amber-200/80 bg-gradient-to-br from-white via-amber-50/40 to-white p-4 shadow-sm transition hover:border-amber-300 hover:shadow-md"
            >
              <p className="truncate text-base font-black text-slate-900">{a.fullName}</p>
              <p className="mt-1 truncate text-xs font-semibold text-slate-500">{a.position || "—"}</p>
              <p className="mt-2 text-xs text-slate-600">
                <span className="font-bold text-slate-700">{isAr ? "الجامعة" : "University"}: </span>
                {a.universityName || "—"}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                <span className="font-bold text-slate-700">{isAr ? "الجهة" : "Organization"}: </span>
                {a.company || "—"}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-1">
                <AlumniBadge
                  locale={locale}
                  user={{
                    accountType: "alumni",
                    alumniProfile: {
                      isVerifiedAlumni: a.isVerifiedAlumni,
                      verificationTier: a.verificationTier,
                      trustScore: a.trustScore ?? null,
                      isAmbassadorAlumni: a.isAmbassadorAlumni,
                      isDistinguishedAlumni: a.isDistinguishedAlumni,
                      alumniServices: { mentoring: a.mentoringAvailable },
                    },
                  }}
                />
                {a.isFeaturedAlumni ? (
                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-900 ring-1 ring-sky-200">
                    {isAr ? "مُبرَز" : "Featured"}
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-[11px] font-bold tabular-nums text-amber-800/90">
                {isAr ? "نقاط السمعة" : "Reputation"}: {a.reputationScore}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};
