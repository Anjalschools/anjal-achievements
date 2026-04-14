"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { getBaseUrl } from "@/lib/get-base-url";
import { PUBLIC_IMG } from "@/lib/publicImages";
import { parseLetterBodyIntoBlocks } from "@/lib/letters/parse-letter-body-blocks";
import {
  DEFAULT_FOOTER_RESERVE_PX,
  effectiveFooterReservePx,
  paginateBlockIndicesByHeight,
} from "@/lib/letters/paginate-letter-by-layout";
import { splitTextToFitHeight } from "@/lib/letters/split-letter-block-by-height";
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
  signerNameAr?: string;
  signerNameEn?: string;
  signerTitleAr?: string;
  signerTitleEn?: string;
  signerOrganizationLabelAr?: string;
  signerOrganizationLabelEn?: string;
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

const EPS = 2;

const ReportHeader = () => (
  <>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img
      src={PUBLIC_IMG.reportHeader}
      alt=""
      className="letter-report-header block w-full max-w-full select-none"
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = "none";
      }}
    />
  </>
);

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
  signerNameAr,
  signerNameEn,
  signerTitleAr,
  signerTitleEn,
  signerOrganizationLabelAr,
  signerOrganizationLabelEn,
}: LetterFormalDocumentProps) => {
  const isAr = language === "ar";
  const dir = isAr ? "rtl" : "ltr";
  const [qrSrc, setQrSrc] = useState("");
  const [draftBlocks, setDraftBlocks] = useState<string[]>(() => parseLetterBodyIntoBlocks(bodyText));
  /** Per-page body blocks — must match measured block layout (no single-paragraph join). */
  const [layoutPages, setLayoutPages] = useState<string[][] | null>(null);

  const roleFallback = signatoryLabel(requestedAuthorRole, language);

  const displayName = isAr
    ? signerNameAr?.trim() || signerNameEn?.trim() || roleFallback
    : signerNameEn?.trim() || signerNameAr?.trim() || roleFallback;

  const displayTitle = isAr
    ? signerTitleAr?.trim() || signerTitleEn?.trim() || ""
    : signerTitleEn?.trim() || signerTitleAr?.trim() || "";

  const displayOrg = isAr
    ? signerOrganizationLabelAr?.trim() || signerOrganizationLabelEn?.trim() || ""
    : signerOrganizationLabelEn?.trim() || signerOrganizationLabelAr?.trim() || "";

  const measureRootRef = useRef<HTMLDivElement>(null);
  const safeRef = useRef<HTMLDivElement>(null);
  const headerStudentRef = useRef<HTMLDivElement>(null);
  const continuedRef = useRef<HTMLParagraphElement>(null);
  const footerMeasureRef = useRef<HTMLDivElement>(null);
  const blocksColRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraftBlocks(parseLetterBodyIntoBlocks(bodyText));
    setLayoutPages(null);
  }, [bodyText]);

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

  const footerMeasureEl = useMemo(
    () => (
      <div
        ref={footerMeasureRef}
        className={`letter-footer-atomic mt-8 shrink-0 border-t border-slate-200/80 pt-5 ${isAr ? "text-right" : "text-left"}`}
      >
        <div
          className={`letter-footer-inner flex flex-col gap-4 print:flex-row print:items-end print:justify-between sm:flex-row sm:items-end sm:justify-between ${
            isAr ? "print:flex-row-reverse sm:flex-row-reverse" : ""
          }`}
        >
          <div className="min-w-0 shrink space-y-1.5">
            {displayOrg ? <p className="text-xs font-medium text-slate-700">{displayOrg}</p> : null}
            <div>
              <p className="text-xs text-slate-600">{isAr ? "المُوقّع" : "Signed by"}</p>
              <p className="text-base font-bold text-slate-900">{displayName}</p>
              {displayTitle ? <p className="text-sm font-semibold text-slate-800">{displayTitle}</p> : null}
            </div>
            <p className="text-xs text-slate-600">
              {isAr ? "تاريخ الإصدار" : "Issue date"}:{" "}
              <span className="font-medium text-slate-900">{issuedDateLabel}</span>
            </p>
            <p className="text-xs text-slate-600">
              {isAr ? "مرجع التحقق" : "Verification reference"}:{" "}
              <span className="font-mono text-slate-900" dir="ltr">
                {referenceCode}
              </span>
            </p>
          </div>
          {showQr ? (
            <div
              className={`letter-footer-qr flex shrink-0 flex-col items-center gap-2 ${isAr ? "sm:items-start" : "sm:items-end"}`}
            >
              {qrSrc ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrSrc}
                    alt=""
                    width={132}
                    height={132}
                    className="h-[132px] w-[132px] shrink-0 rounded-md bg-white/95 object-contain p-1 shadow-sm ring-1 ring-slate-200/80 print:bg-white"
                  />
                  <p className="max-w-[12rem] text-center text-[10px] text-slate-600" dir="ltr">
                    {isAr ? "امسح للتحقق" : "Scan to verify"}
                  </p>
                </>
              ) : (
                <div
                  className="flex flex-col items-center gap-2"
                  aria-hidden
                >
                  <div className="h-[132px] w-[132px] rounded-md bg-white/95 ring-1 ring-slate-200/80" />
                  <div className="h-3 w-24 rounded bg-slate-200/80" />
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    ),
    [isAr, displayOrg, displayName, displayTitle, issuedDateLabel, referenceCode, showQr, qrSrc],
  );

  useLayoutEffect(() => {
    if (!measureRootRef.current || !safeRef.current || !headerStudentRef.current || !continuedRef.current) return;
    if (!footerMeasureRef.current || !blocksColRef.current || !probeRef.current) return;

    const safe = safeRef.current;
    const cs = getComputedStyle(safe);
    const pt = parseFloat(cs.paddingTop);
    const pb = parseFloat(cs.paddingBottom);
    const innerH = safe.clientHeight - pt - pb;
    /** Uniform document margins below report-header; same inner column on every sheet. */
    const innerHFirst = innerH;

    const headerStudentH = headerStudentRef.current.getBoundingClientRect().height;
    const continuedH = continuedRef.current.getBoundingClientRect().height;
    const footerH = footerMeasureRef.current.getBoundingClientRect().height;
    const effFooterReserve = effectiveFooterReservePx(footerH, DEFAULT_FOOTER_RESERVE_PX);

    const firstBody = Math.max(0, innerHFirst - headerStudentH);
    const middleBody = Math.max(0, innerH - continuedH);
    const lastBody = Math.max(0, innerH - continuedH - footerH - effFooterReserve);
    const maxBlockH = Math.max(48, Math.min(firstBody, middleBody, lastBody));

    const colW = blocksColRef.current.clientWidth;
    if (colW > 0) {
      probeRef.current.style.width = `${colW}px`;
    }

    const measureText = (s: string) => {
      const el = probeRef.current;
      if (!el) return 0;
      el.textContent = s;
      return el.getBoundingClientRect().height;
    };

    const blockEls = blocksColRef.current.querySelectorAll<HTMLElement>("[data-letter-block]");
    const heights = [...blockEls].map((el) => el.getBoundingClientRect().height);

    if (heights.length !== draftBlocks.length) {
      return;
    }

    let changed = false;
    const nextBlocks: string[] = [];
    for (let i = 0; i < draftBlocks.length; i++) {
      if (heights[i] > maxBlockH + EPS) {
        changed = true;
        nextBlocks.push(...splitTextToFitHeight(draftBlocks[i], maxBlockH, measureText));
      } else {
        nextBlocks.push(draftBlocks[i]);
      }
    }

    if (changed) {
      setDraftBlocks(nextBlocks);
      return;
    }

    const dim = {
      innerHeightPx: innerH,
      innerHeightFirstPagePx: innerHFirst,
      headerStudentPx: headerStudentH,
      continuedLabelPx: continuedH,
      footerPx: footerH,
      footerReservePx: effFooterReserve,
    };

    const pages = paginateBlockIndicesByHeight(heights, dim);
    const pageBlocks = pages.map((idxs) => (idxs.length === 0 ? [] : idxs.map((j) => draftBlocks[j])));
    setLayoutPages(pageBlocks);
  }, [
    draftBlocks,
    bodyText,
    language,
    requestType,
    studentName,
    targetOrganization,
    gradeLine,
    issuedDateLabel,
    referenceCode,
    verifyPath,
    requestedAuthorRole,
    showQr,
    qrSrc,
    displayName,
    displayTitle,
    displayOrg,
    footerMeasureEl,
  ]);

  const bodyPages = layoutPages;

  return (
    <div className={`letter-document-stack ${className}`} dir={dir} lang={isAr ? "ar" : "en"}>
      <div ref={measureRootRef} className="letter-layout-measure-root" aria-hidden>
        <div className="letter-page-sheet relative isolate mx-auto w-full max-w-[210mm] bg-white shadow-none print:shadow-none">
          <ReportHeader />
          <div
            ref={safeRef}
            className="letter-doc-content relative z-[1] flex min-h-0 flex-1 flex-col text-slate-900"
          >
            <div ref={headerStudentRef}>
              <header className={`${isAr ? "text-right" : "text-left"}`}>
                <h1 className="text-lg font-bold leading-snug text-slate-900 sm:text-xl">
                  {docTitle(requestType, language)}
                </h1>
                <p className="mt-1.5 text-sm text-slate-800">
                  {isAr ? "إلى السادة:" : "To:"}{" "}
                  <span className="font-semibold text-slate-900">{targetOrganization}</span>
                </p>
              </header>
              <section className={`mt-3 space-y-3 ${isAr ? "text-right" : "text-left"}`}>
                <div>
                  <p className="text-xs font-semibold text-slate-600">{isAr ? "اسم الطالب" : "Student name"}</p>
                  <p className="text-lg font-bold text-slate-900">{studentName}</p>
                  {gradeLine ? <p className="mt-1 text-sm text-slate-700">{gradeLine}</p> : null}
                </div>
              </section>
            </div>

            <p
              ref={continuedRef}
              className={`pointer-events-none absolute left-0 top-0 -z-10 mb-3 shrink-0 text-xs font-medium text-slate-500 opacity-0 ${
                isAr ? "text-right" : "text-left"
              }`}
              aria-hidden
            >
              {isAr ? "— يتبع —" : "— Continued —"}
            </p>

            <div ref={blocksColRef} className="flex min-h-0 w-full flex-col">
              {draftBlocks.map((block, idx) => (
                <div
                  key={`m-${idx}`}
                  data-letter-block=""
                  className={`letter-body-block whitespace-pre-wrap break-words text-slate-900 ${
                    isAr ? "text-right" : "text-left"
                  }`}
                >
                  {block}
                </div>
              ))}
            </div>

            {footerMeasureEl}

            <div
              ref={probeRef}
              className={`letter-body-block invisible absolute left-0 top-0 whitespace-pre-wrap break-words ${
                isAr ? "text-right" : "text-left"
              }`}
              aria-hidden
            />
          </div>
        </div>
      </div>

      {bodyPages === null
        ? null
        : bodyPages.map((pageBlocks, pageIndex) => {
        const isFirst = pageIndex === 0;
        const isLast = pageIndex === bodyPages.length - 1;
        const pageKind = isFirst ? "first-page" : isLast ? "last-page" : "middle-page";
        return (
          <div
            key={`p-${pageIndex}-${pageBlocks.length}-${pageIndex}`}
            className={`letter-page letter-page-sheet letter-print-target ${pageKind} relative isolate mx-auto mb-10 w-full max-w-[210mm] rounded-none border-0 bg-white shadow-none last:mb-0 print:mb-0 print:max-w-none print:shadow-none`}
          >
            <ReportHeader />
            <div className="letter-doc-content relative z-[1] flex min-h-0 flex-1 flex-col text-slate-900">
              {isFirst ? (
                <>
                  <header className={`shrink-0 ${isAr ? "text-right" : "text-left"}`}>
                    <h1 className="text-lg font-bold leading-snug text-slate-900 sm:text-xl">
                      {docTitle(requestType, language)}
                    </h1>
                    <p className="mt-1.5 text-sm text-slate-800">
                      {isAr ? "إلى السادة:" : "To:"}{" "}
                      <span className="font-semibold text-slate-900">{targetOrganization}</span>
                    </p>
                  </header>
                  <section className={`mt-3 shrink-0 space-y-3 ${isAr ? "text-right" : "text-left"}`}>
                    <div>
                      <p className="text-xs font-semibold text-slate-600">{isAr ? "اسم الطالب" : "Student name"}</p>
                      <p className="text-lg font-bold text-slate-900">{studentName}</p>
                      {gradeLine ? <p className="mt-1 text-sm text-slate-700">{gradeLine}</p> : null}
                    </div>
                  </section>
                </>
              ) : (
                <p className={`mb-3 shrink-0 text-xs font-medium text-slate-500 ${isAr ? "text-right" : "text-left"}`}>
                  {isAr ? "— يتبع —" : "— Continued —"}
                </p>
              )}

              <section
                className={`letter-body-section flex min-h-0 min-w-0 flex-none flex-col gap-0 overflow-visible text-sm leading-relaxed text-slate-900 ${isAr ? "text-right" : "text-left"}`}
              >
                {pageBlocks.map((block, bi) => (
                  <div key={`b-${pageIndex}-${bi}`} className="letter-body-block whitespace-pre-wrap break-words">
                    {block}
                  </div>
                ))}
              </section>

              {isLast ? (
                <div
                  className={`letter-footer-atomic mt-8 shrink-0 border-t border-slate-200/80 pt-5 ${isAr ? "text-right" : "text-left"}`}
                >
                  <div
                    className={`letter-footer-inner flex flex-col gap-4 print:flex-row print:items-end print:justify-between sm:flex-row sm:items-end sm:justify-between ${
                      isAr ? "print:flex-row-reverse sm:flex-row-reverse" : ""
                    }`}
                  >
                    <div className="min-w-0 shrink space-y-1.5">
                      {displayOrg ? <p className="text-xs font-medium text-slate-700">{displayOrg}</p> : null}
                      <div>
                        <p className="text-xs text-slate-600">{isAr ? "المُوقّع" : "Signed by"}</p>
                        <p className="text-base font-bold text-slate-900">{displayName}</p>
                        {displayTitle ? <p className="text-sm font-semibold text-slate-800">{displayTitle}</p> : null}
                      </div>
                      <p className="text-xs text-slate-600">
                        {isAr ? "تاريخ الإصدار" : "Issue date"}:{" "}
                        <span className="font-medium text-slate-900">{issuedDateLabel}</span>
                      </p>
                      <p className="text-xs text-slate-600">
                        {isAr ? "مرجع التحقق" : "Verification reference"}:{" "}
                        <span className="font-mono text-slate-900" dir="ltr">
                          {referenceCode}
                        </span>
                      </p>
                    </div>
                    {showQr && qrSrc ? (
                      <div
                        className={`letter-footer-qr flex shrink-0 flex-col items-center gap-2 ${isAr ? "sm:items-start" : "sm:items-end"}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={qrSrc}
                          alt=""
                          width={132}
                          height={132}
                          className="h-[132px] w-[132px] shrink-0 rounded-md bg-white/95 object-contain p-1 shadow-sm ring-1 ring-slate-200/80 print:bg-white"
                        />
                        <p className="max-w-[12rem] text-center text-[10px] text-slate-600" dir="ltr">
                          {isAr ? "امسح للتحقق" : "Scan to verify"}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
};


export default LetterFormalDocument;
