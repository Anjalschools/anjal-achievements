"use client";

import { memo, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { getLocale } from "@/lib/i18n";
import type { UserPublicPortfolioPayload } from "@/lib/user-public-portfolio-types";
import { Award, Briefcase, ExternalLink, Copy, Download, Loader2, QrCode, ShieldOff, Sparkles } from "lucide-react";

export type PublicPortfolioHeroSummary = {
  fullName: string;
  avatarUrl?: string;
  initials: string;
  isAlumni: boolean;
  technicalSkills: string[];
  personalSkills: string[];
  bioPreview?: string;
  totalAchievements: number;
  featuredAchievements: number;
  highlightLevelLabel?: string;
};

export type StudentPublicPortfolioCardProps = {
  data: UserPublicPortfolioPayload | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  /** Rich preview when the public portfolio is enabled — data already on the profile payload. */
  heroSummary?: PublicPortfolioHeroSummary | null;
};

const StudentPublicPortfolioCardInner = ({
  data,
  loading,
  error,
  onRetry,
  heroSummary,
}: StudentPublicPortfolioCardProps) => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  useEffect(() => {
    const v = data?.qrValue?.trim();
    if (!v) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const QR = await import("qrcode");
        const url = await QR.toDataURL(v, {
          width: 200,
          margin: 1,
          errorCorrectionLevel: "M",
          color: { dark: "#0a2744", light: "#ffffff" },
        });
        if (!cancelled) setQrDataUrl(url);
      } catch {
        if (!cancelled) setQrDataUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data?.qrValue]);

  const handleCopy = async () => {
    const url = data?.publicUrl;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* parent may show error on next load; optional UX */
    }
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = "portfolio-qr.png";
    a.click();
  };

  const skillChips = heroSummary
    ? [...heroSummary.technicalSkills, ...heroSummary.personalSkills].filter(Boolean).slice(0, 12)
    : [];

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-sky-200/90 bg-gradient-to-br from-sky-50/90 via-white to-indigo-50/40 p-5 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.25)] ring-1 ring-sky-100/80"
      dir={isAr ? "rtl" : "ltr"}
      aria-labelledby="student-public-portfolio-heading"
    >
      <div
        className="pointer-events-none absolute -start-24 -top-24 h-48 w-48 rounded-full bg-sky-300/25 blur-3xl"
        aria-hidden
      />
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="student-public-portfolio-heading" className="text-lg font-bold text-slate-900">
            {isAr ? "الملف العام للإنجاز" : "Public achievement portfolio"}
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-600">
            {isAr
              ? "بوابة احترافية تعرض إنجازاتك المعتمدة للعامة. يُدار التفعيل من إدارة المنصة."
              : "A professional gateway that showcases your approved achievements publicly. Activation is managed by platform administration."}
          </p>
        </div>
        <QrCode className="h-10 w-10 shrink-0 text-sky-800 opacity-90" aria-hidden />
      </div>

      {data?.enabled && heroSummary ? (
        <div className="relative mt-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-[#0a2744] via-slate-900 to-slate-800 p-5 text-white shadow-inner">
          <div
            className="pointer-events-none absolute -bottom-8 end-0 h-32 w-32 rounded-full bg-sky-400/20 blur-2xl"
            aria-hidden
          />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-white/20 bg-white/10 shadow-lg ring-2 ring-sky-400/30">
                {heroSummary.avatarUrl ? (
                  <Image
                    src={heroSummary.avatarUrl}
                    alt=""
                    width={64}
                    height={64}
                    className="h-full w-full object-cover"
                    unoptimized={
                      heroSummary.avatarUrl.startsWith("data:") ||
                      heroSummary.avatarUrl.startsWith("http://") ||
                      heroSummary.avatarUrl.startsWith("https://")
                    }
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg font-black text-white/90">
                    {heroSummary.initials}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-black tracking-tight">{heroSummary.fullName}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-2.5 py-0.5 text-[11px] font-bold text-emerald-100 ring-1 ring-emerald-300/40">
                    <Sparkles className="h-3 w-3" aria-hidden />
                    {isAr ? "منشور للعامة" : "Live portfolio"}
                  </span>
                  {heroSummary.isAlumni ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-100 ring-1 ring-amber-300/35">
                      <Briefcase className="h-3 w-3" aria-hidden />
                      {isAr ? "خريج" : "Alumni"}
                    </span>
                  ) : null}
                  {heroSummary.highlightLevelLabel ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-bold text-sky-100 ring-1 ring-white/20">
                      <Award className="h-3 w-3" aria-hidden />
                      {heroSummary.highlightLevelLabel}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="grid shrink-0 grid-cols-2 gap-3 sm:text-end">
              <div className="rounded-xl bg-white/10 px-3 py-2 ring-1 ring-white/15">
                <p className="text-[10px] font-bold uppercase tracking-wide text-sky-100/90">
                  {isAr ? "إنجازات" : "Achievements"}
                </p>
                <p className="text-xl font-black tabular-nums">{heroSummary.totalAchievements}</p>
              </div>
              <div className="rounded-xl bg-white/10 px-3 py-2 ring-1 ring-white/15">
                <p className="text-[10px] font-bold uppercase tracking-wide text-sky-100/90">
                  {isAr ? "مميزة" : "Featured"}
                </p>
                <p className="text-xl font-black tabular-nums">{heroSummary.featuredAchievements}</p>
              </div>
            </div>
          </div>
          {heroSummary.bioPreview ? (
            <p className="relative mt-4 line-clamp-2 text-sm leading-relaxed text-sky-100/90">
              {heroSummary.bioPreview}
            </p>
          ) : null}
          {skillChips.length > 0 ? (
            <div className="relative mt-4 flex flex-wrap gap-2">
              {skillChips.map((s) => (
                <span
                  key={s}
                  className="rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white ring-1 ring-white/15"
                >
                  {s}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin text-sky-700" aria-hidden />
          {isAr ? "جاري التحميل…" : "Loading…"}
        </div>
      ) : error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
          <button
            type="button"
            onClick={() => onRetry()}
            className="ms-2 font-bold underline"
          >
            {isAr ? "إعادة المحاولة" : "Retry"}
          </button>
        </div>
      ) : !data?.enabled ? (
        <div className="mt-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
          <ShieldOff className="h-5 w-5 shrink-0" aria-hidden />
          <p className="font-medium">
            {isAr
              ? "ملف الإنجاز العام غير مفعّل حاليًا من إدارة المنصة."
              : "Your public achievement portfolio is not enabled by the platform administration."}
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {data.publishedAt ? (
            <p className="text-xs text-slate-500">
              {isAr ? "تاريخ آخر تفعيل للنشر: " : "Last published: "}
              {new Date(data.publishedAt).toLocaleString(isAr ? "ar-SA" : "en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {data.publicUrl ? (
              <Link
                href={data.publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-[#0a2744] px-4 py-2.5 text-sm font-bold text-white hover:opacity-95"
              >
                <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
                {isAr ? "عرض ملف الإنجاز" : "View portfolio"}
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => void handleCopy()}
              disabled={!data.publicUrl}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-900 hover:bg-slate-50 disabled:opacity-40"
            >
              <Copy className="h-4 w-4 shrink-0" aria-hidden />
              {isAr ? "نسخ الرابط" : "Copy link"}
            </button>
            {copyError ? <p className="w-full text-xs text-red-600">{copyError}</p> : null}
          </div>
          {qrDataUrl ? (
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-inner">
                <Image
                  src={qrDataUrl}
                  alt={isAr ? "رمز الاستجابة السريعة لملف الإنجاز" : "QR code for public portfolio"}
                  width={200}
                  height={200}
                  unoptimized
                />
              </div>
              <button
                type="button"
                onClick={handleDownloadQr}
                className="inline-flex items-center gap-2 rounded-xl border border-sky-300 bg-sky-50 px-4 py-2 text-xs font-bold text-sky-950 hover:bg-sky-100"
              >
                <Download className="h-4 w-4 shrink-0" aria-hidden />
                {isAr ? "تحميل QR" : "Download QR"}
              </button>
            </div>
          ) : data.publicUrl ? (
            <p className="text-xs text-slate-500">{isAr ? "جاري تجهيز رمز QR…" : "Preparing QR…"}</p>
          ) : null}
        </div>
      )}
    </section>
  );
};

const StudentPublicPortfolioCard = memo(StudentPublicPortfolioCardInner);
StudentPublicPortfolioCard.displayName = "StudentPublicPortfolioCard";

export default StudentPublicPortfolioCard;
