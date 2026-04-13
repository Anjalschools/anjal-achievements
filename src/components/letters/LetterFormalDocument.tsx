"use client";

import { useEffect, useState } from "react";
import { getBaseUrl } from "@/lib/get-base-url";
import { PUBLIC_IMG } from "@/lib/publicImages";
import type {
  LetterRequestLanguage,
  LetterRequestType,
  LetterRequestedAuthorRole,
} from "@/lib/letter-request-types";

export type LetterFormalDocumentProps = {
  language: LetterRequestLanguage;
  requestType: LetterRequestType;
  studentName: string;
  targetOrganization: string;
  bodyText: string;
  issuedDateLabel: string;
  referenceCode: string;
  verifyPath: string;
  requestedAuthorRole: LetterRequestedAuthorRole;
  gradeLine?: string;
  showQr?: boolean;
  className?: string;
};

const docTitle = (t: LetterRequestType, lang: LetterRequestLanguage): string => {
  if (lang === "ar") {
    return t === "testimonial" ? "إفادة رسمية" : "خطاب توصية";
  }
  return t === "testimonial" ? "Official testimonial" : "Letter of recommendation";
};

const signatoryLabel = (r: LetterRequestedAuthorRole, lang: LetterRequestLanguage): string => {
  if (lang === "ar") {
    if (r === "teacher") return "معلم / جهة تعليمية";
    if (r === "supervisor") return "مشرف";
    return "إدارة المدرسة";
  }
  if (r === "teacher") return "Teacher / instructional staff";
  if (r === "supervisor") return "Supervisor";
  return "School administration";
};

const LetterFormalDocument = ({
  language,
  requestType,
  studentName,
  targetOrganization,
  bodyText,
  issuedDateLabel,
  referenceCode,
  verifyPath,
  requestedAuthorRole,
  gradeLine,
  showQr = true,
  className = "",
}: LetterFormalDocumentProps) => {
  const isAr = language === "ar";
  const dir = isAr ? "rtl" : "ltr";
  const [qrSrc, setQrSrc] = useState("");

  useEffect(() => {
    if (!showQr || !verifyPath) return;
    const base = getBaseUrl();
    const full = verifyPath.startsWith("/") ? `${base}${verifyPath}` : verifyPath;
    let cancelled = false;
    import("qrcode")
      .then((QR) => QR.toDataURL(full, { margin: 1, width: 160, errorCorrectionLevel: "M" }))
      .then((url) => {
        if (!cancelled) setQrSrc(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [verifyPath, showQr]);

  return (
    <div
      className={`letter-print-target relative isolate mx-auto w-full max-w-[210mm] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md print:border-0 print:shadow-none ${className}`}
      dir={dir}
      lang={isAr ? "ar" : "en"}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={PUBLIC_IMG.letterBackpage}
        alt=""
        className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover opacity-[0.22]"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
      <div className="relative z-[1] box-border flex min-h-[280mm] flex-col bg-white/90 px-8 py-10 backdrop-blur-[1px] print:bg-white sm:px-12 sm:py-12">
        <header className={`border-b border-slate-200/90 pb-4 ${isAr ? "text-right" : "text-left"}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {isAr ? "مدارس الأنجال الأهلية" : "Al-Anjal Private Schools"}
          </p>
          <h1 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">{docTitle(requestType, language)}</h1>
          <p className="mt-2 text-sm text-slate-600">
            {isAr ? "إلى السادة:" : "To:"}{" "}
            <span className="font-semibold text-slate-900">{targetOrganization}</span>
          </p>
        </header>

        <section className={`mt-6 flex-1 space-y-4 ${isAr ? "text-right" : "text-left"}`}>
          <div>
            <p className="text-xs font-semibold text-slate-500">{isAr ? "اسم الطالب" : "Student name"}</p>
            <p className="text-lg font-bold text-slate-900">{studentName}</p>
            {gradeLine ? <p className="mt-1 text-sm text-slate-600">{gradeLine}</p> : null}
          </div>
          <div
            className={`rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-4 text-sm leading-relaxed text-slate-800 sm:px-5 sm:py-5 ${
              isAr ? "text-right" : "text-left"
            }`}
          >
            <p className="whitespace-pre-wrap break-words">{bodyText}</p>
          </div>
        </section>

        <footer
          className={`mt-8 flex flex-col gap-6 border-t border-slate-200 pt-6 sm:flex-row sm:items-end sm:justify-between ${
            isAr ? "sm:flex-row-reverse" : ""
          }`}
        >
          <div className={`space-y-1 ${isAr ? "text-right" : "text-left"}`}>
            <p className="text-xs text-slate-500">{isAr ? "الجهة الموقّعة" : "Signatory capacity"}</p>
            <p className="text-sm font-semibold text-slate-800">{signatoryLabel(requestedAuthorRole, language)}</p>
            <p className="text-xs text-slate-500">
              {isAr ? "تاريخ الإصدار" : "Issue date"}:{" "}
              <span className="font-medium text-slate-800">{issuedDateLabel}</span>
            </p>
            <p className="text-xs text-slate-500">
              {isAr ? "مرجع التحقق" : "Verification reference"}:{" "}
              <span className="font-mono text-slate-800" dir="ltr">
                {referenceCode}
              </span>
            </p>
          </div>
          {showQr && qrSrc ? (
            <div className={`flex flex-col items-center gap-2 ${isAr ? "sm:items-start" : "sm:items-end"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrSrc} alt="" width={140} height={140} className="rounded-lg bg-white p-1 ring-1 ring-slate-200" />
              <p className="max-w-[12rem] text-center text-[10px] text-slate-500" dir="ltr">
                {isAr ? "امسح للتحقق" : "Scan to verify"}
              </p>
            </div>
          ) : null}
        </footer>
      </div>
    </div>
  );
};

export default LetterFormalDocument;
