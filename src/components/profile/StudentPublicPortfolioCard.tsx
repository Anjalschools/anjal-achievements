"use client";

import { memo, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { getLocale } from "@/lib/i18n";
import { tokenPreviewForLogs } from "@/lib/get-base-url";
import type { UserPublicPortfolioPayload } from "@/lib/user-public-portfolio-types";
import { ExternalLink, Copy, Download, Loader2, QrCode, ShieldOff } from "lucide-react";

export type StudentPublicPortfolioCardProps = {
  data: UserPublicPortfolioPayload | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
};

const StudentPublicPortfolioCardInner = ({
  data,
  loading,
  error,
  onRetry,
}: StudentPublicPortfolioCardProps) => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.info("[student-public-portfolio-card] mounted");
      return () => console.info("[student-public-portfolio-card] unmounted");
    }
    return undefined;
  }, []);

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

  return (
    <section
      className="rounded-2xl border border-sky-200/90 bg-gradient-to-br from-sky-50/90 to-white p-5 shadow-sm"
      dir={isAr ? "rtl" : "ltr"}
      aria-labelledby="student-public-portfolio-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="student-public-portfolio-heading" className="text-lg font-bold text-slate-900">
            {isAr ? "ملف الإنجاز العام" : "Public achievement portfolio"}
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-600">
            {isAr
              ? "رابط يعرض إنجازاتك المعتمدة المنشورة للعامة. يُدار التفعيل من إدارة المنصة."
              : "A link that shows your published approved achievements. Activation is managed by the platform administration."}
          </p>
        </div>
        <QrCode className="h-10 w-10 shrink-0 text-sky-800 opacity-90" aria-hidden />
      </div>

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
          {process.env.NODE_ENV !== "production" && data.enabled ? (
            <p
              className="mt-4 max-w-full break-all font-mono text-[10px] leading-relaxed text-slate-400"
              dir="ltr"
            >
              [dev] slug={data.slug ?? "—"} | token=
              {data.token ? tokenPreviewForLogs(data.token) : "—"} | publicUrl={data.publicUrl ?? "—"}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
};

const StudentPublicPortfolioCard = memo(StudentPublicPortfolioCardInner);
StudentPublicPortfolioCard.displayName = "StudentPublicPortfolioCard";

export default StudentPublicPortfolioCard;
