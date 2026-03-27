"use client";

import { useEffect, useState } from "react";
import { getBaseUrl } from "@/lib/get-base-url";

export type AppreciationCertificateContent = {
  studentNameAr: string;
  studentNameEn: string;
  gradeAr: string;
  gradeEn: string;
  achievementTitleAr: string;
  achievementTitleEn: string;
  resultAr: string;
  resultEn: string;
  levelAr: string;
  levelEn: string;
  dateAr: string;
  dateEn: string;
  certificateVersion: number;
  issuedAtIso: string;
};

/**
 * Props may come from `snapshotToCertificateProps` OR a raw frozen `certificateSnapshot`
 * (v2/v3) with `resultSummaryAr` / `levelLabelAr` / `dateLabelAr` style keys.
 */
export type AppreciationCertificateContentInput = AppreciationCertificateContent &
  Partial<{
    resultSummaryAr: string;
    resultSummaryEn: string;
    levelLabelAr: string;
    levelLabelEn: string;
    dateLabelAr: string;
    dateLabelEn: string;
    gradeLabelAr: string;
    gradeLabelEn: string;
    studentName: string;
  }>;

const asTrimmed = (v: unknown): string =>
  v === undefined || v === null ? "" : String(v).trim();

/** First non-empty string wins — supports both display keys and snapshot keys. */
export const normalizeCertificateDisplayContent = (
  raw: AppreciationCertificateContentInput | Record<string, unknown>
): AppreciationCertificateContent => {
  const r = raw as Record<string, unknown>;
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const s = asTrimmed(r[k]);
      if (s !== "") return s;
    }
    return "";
  };
  const cv = r.certificateVersion;
  const certificateVersion =
    typeof cv === "number" && Number.isFinite(cv)
      ? cv
      : Number.isFinite(Number(cv))
        ? Number(cv)
        : 1;

  return {
    studentNameAr: pick("studentNameAr", "studentName"),
    studentNameEn: pick("studentNameEn", "studentName"),
    /* Prefer v3 snapshot keys when API passes raw `certificateSnapshot` without mapping */
    gradeAr: pick("gradeLabelAr", "gradeAr"),
    gradeEn: pick("gradeLabelEn", "gradeEn"),
    achievementTitleAr: pick("achievementTitleAr", "achievement_title_ar"),
    achievementTitleEn: pick("achievementTitleEn", "achievement_title_en"),
    resultAr: pick("resultSummaryAr", "resultAr", "result_summary_ar"),
    resultEn: pick("resultSummaryEn", "resultEn", "result_summary_en"),
    levelAr: pick("levelLabelAr", "levelAr", "level_label_ar"),
    levelEn: pick("levelLabelEn", "levelEn", "level_label_en"),
    dateAr: pick("dateLabelAr", "dateAr", "date_label_ar"),
    dateEn: pick("dateLabelEn", "dateEn", "date_label_en"),
    certificateVersion,
    issuedAtIso: pick("issuedAtIso"),
  };
};

type AppreciationCertificateProps = {
  content: AppreciationCertificateContentInput;
  verifyPath: string;
  certificateId?: string | null;
};

const DYNAMIC = "font-bold text-[#c80000]";
const STATIC = "text-neutral-900";

/** Display-only friendly ID; UUID remains in props/API for verification. */
const formatCertificateId = (id?: string | null): string => {
  if (!id || !String(id).trim()) return "CERT-2026-000000";
  return `CERT-2026-${String(id).trim().slice(0, 6).toUpperCase()}`;
};

/**
 * Fixed A4 landscape canvas. Outer wrapper is dir="ltr" so column 1 is always physical left (EN)
 * and column 2 physical right (AR), regardless of app locale RTL.
 */
const AppreciationCertificate = ({ content: rawContent, verifyPath, certificateId }: AppreciationCertificateProps) => {
  const content = normalizeCertificateDisplayContent(rawContent);
  const certificateDisplayId = formatCertificateId(certificateId);
  const [qrSrc, setQrSrc] = useState("");

  useEffect(() => {
    const base = getBaseUrl();
    const full = verifyPath.startsWith("/") ? `${base}${verifyPath}` : verifyPath;
    if (!full) return;
    let cancelled = false;
    import("qrcode")
      .then((QR) =>
        QR.toDataURL(full, { margin: 2, width: 240, errorCorrectionLevel: "H" })
      )
      .then((url) => {
        if (!cancelled) setQrSrc(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [verifyPath]);

  return (
    <div className="certificate-root-wrapper" dir="ltr" lang="en">
      <div
        className="certificate-print-target certificate-shell relative isolate box-border aspect-[297/210] w-full max-w-[297mm] overflow-hidden rounded-xl shadow-lg print:aspect-auto print:h-[210mm] print:w-[297mm] print:max-w-none print:rounded-none print:shadow-none"
      >
        {/* Background layer — full bleed */}
        <div
          className="certificate-background certificate-background-image pointer-events-none absolute inset-0 z-0 bg-neutral-100"
          aria-hidden
        />

        {/* Content layer — flex column: scrollable body + fixed footer (screen); print sized in certificate-print.css */}
        <div className="certificate-content absolute inset-0 z-[1] box-border flex min-h-0 flex-col pt-[13%] pl-[5%] pr-[5%] pb-2 md:pt-[15%] md:pb-3">
          <header className="certificate-print-header mb-1 shrink-0 text-center" dir="auto">
            <h1
              className={`text-[1.45rem] font-black leading-snug text-black sm:text-[1.58rem] md:text-[1.88rem] ${STATIC}`}
              lang="ar"
            >
              شهادة شكر وتقدير
            </h1>
            <p
              className={`mt-1 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-black sm:text-[0.72rem] md:text-[0.8rem] ${STATIC}`}
              lang="en"
            >
              Appreciation certificate
            </p>
          </header>

          <div className="certificate-body-host flex min-h-0 flex-1 flex-col">
            {/* Desktop + print: fixed 2-col grid [ EN left | AR right ]. Mobile: stacked preview. */}
            <div className="certificate-body-two-col hidden min-h-0 min-w-0 flex-1 gap-x-5 gap-y-1 overflow-x-hidden overflow-y-auto md:grid">
            <div
              dir="ltr"
              lang="en"
              className={`certificate-col-en min-h-0 min-w-0 overflow-x-hidden overflow-y-auto text-left md:overflow-y-auto print:overflow-y-hidden ${STATIC}`}
            >
              <p className={STATIC}>
                The Administration of Al-Anjal Private Schools is pleased to extend its sincere appreciation and
                gratitude to
              </p>
              <p className="mt-2">
                <span className={STATIC}>Student: </span>
                <span className={DYNAMIC}>{content.studentNameEn}</span>
              </p>
              <p className="mt-1">
                <span className={STATIC}>Grade: </span>
                <span className={DYNAMIC}>{content.gradeEn}</span>
              </p>
              <p className="mt-2">
                <span className={STATIC}>In recognition of his/her active participation in:</span>
                <br />
                <span className={DYNAMIC}>{content.achievementTitleEn}</span>
              </p>
              <p className="mt-2">
                <span className={STATIC}>and achieving:</span>
                <br />
                <span className={DYNAMIC}>{content.resultEn}</span>
              </p>
              <p className="mt-2">
                <span className={STATIC}>At the level of: </span>
                <span className={DYNAMIC}>{content.levelEn}</span>
              </p>
              <p className="mt-2">
                <span className={STATIC}>Date: </span>
                <span className={DYNAMIC}>{content.dateEn}</span>
              </p>
              <p className="mt-3 font-medium text-neutral-900">We wish him/her continued success and excellence.</p>
            </div>
            <div
              dir="rtl"
              lang="ar"
              className={`certificate-col-ar min-h-0 min-w-0 overflow-x-hidden overflow-y-auto text-right md:overflow-y-auto print:overflow-y-hidden ${STATIC}`}
            >
              <p className={STATIC}>يسر إدارة مدارس الأنجال الأهلية أن تتقدم بخالص الشكر والتقدير</p>
              <p className="mt-2">
                <span className={STATIC}>للطالب/ة: </span>
                <span className={DYNAMIC}>{content.studentNameAr}</span>
              </p>
              <p className="mt-1">
                <span className={STATIC}>بالصف: </span>
                <span className={DYNAMIC}>{content.gradeAr}</span>
              </p>
              <p className="mt-2">
                <span className={STATIC}>وذلك نظير مشاركته/ها الفعالة في:</span>
                <br />
                <span className={DYNAMIC}>{content.achievementTitleAr}</span>
              </p>
              <p className="mt-2">
                <span className={STATIC}>وتحقيقه/ها:</span>
                <br />
                <span className={DYNAMIC}>{content.resultAr}</span>
              </p>
              <p className="mt-2">
                <span className={STATIC}>على مستوى: </span>
                <span className={DYNAMIC}>{content.levelAr}</span>
              </p>
              <p className="mt-2">
                <span className={STATIC}>بتاريخ: </span>
                <span className={DYNAMIC}>{content.dateAr}</span>
              </p>
              <p className="mt-3 font-medium text-neutral-900">سائلين الله له/ها دوام التوفيق والتميز.</p>
            </div>
            </div>

            <div className="certificate-body-stack flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden md:hidden">
            <div
              dir="ltr"
              lang="en"
              className={`certificate-stack-en min-h-0 min-w-0 overflow-x-hidden text-left ${STATIC}`}
            >
              <p className={STATIC}>
                The Administration of Al-Anjal Private Schools is pleased to extend its sincere appreciation and
                gratitude to
              </p>
              <p className="mt-2">
                <span className={STATIC}>Student: </span>
                <span className={DYNAMIC}>{content.studentNameEn}</span>
              </p>
              <p className="mt-1">
                <span className={STATIC}>Grade: </span>
                <span className={DYNAMIC}>{content.gradeEn}</span>
              </p>
              <p className="mt-2">
                <span className={STATIC}>In recognition of his/her active participation in:</span>
                <br />
                <span className={DYNAMIC}>{content.achievementTitleEn}</span>
              </p>
              <p className="mt-2">
                <span className={STATIC}>and achieving:</span>
                <br />
                <span className={DYNAMIC}>{content.resultEn}</span>
              </p>
              <p className="mt-2">
                <span className={STATIC}>At the level of: </span>
                <span className={DYNAMIC}>{content.levelEn}</span>
              </p>
              <p className="mt-2">
                <span className={STATIC}>Date: </span>
                <span className={DYNAMIC}>{content.dateEn}</span>
              </p>
              <p className="mt-3 font-medium text-neutral-900">We wish him/her continued success and excellence.</p>
            </div>
            <div
              dir="rtl"
              lang="ar"
              className={`certificate-stack-ar min-h-0 min-w-0 overflow-x-hidden text-right ${STATIC}`}
            >
              <p className={STATIC}>يسر إدارة مدارس الأنجال الأهلية أن تتقدم بخالص الشكر والتقدير</p>
              <p className="mt-2">
                <span className={STATIC}>للطالب/ة: </span>
                <span className={DYNAMIC}>{content.studentNameAr}</span>
              </p>
              <p className="mt-1">
                <span className={STATIC}>بالصف: </span>
                <span className={DYNAMIC}>{content.gradeAr}</span>
              </p>
              <p className="mt-2">
                <span className={STATIC}>وذلك نظير مشاركته/ها الفعالة في:</span>
                <br />
                <span className={DYNAMIC}>{content.achievementTitleAr}</span>
              </p>
              <p className="mt-2">
                <span className={STATIC}>وتحقيقه/ها:</span>
                <br />
                <span className={DYNAMIC}>{content.resultAr}</span>
              </p>
              <p className="mt-2">
                <span className={STATIC}>على مستوى: </span>
                <span className={DYNAMIC}>{content.levelAr}</span>
              </p>
              <p className="mt-2">
                <span className={STATIC}>بتاريخ: </span>
                <span className={DYNAMIC}>{content.dateAr}</span>
              </p>
              <p className="mt-3 font-medium text-neutral-900">سائلين الله له/ها دوام التوفيق والتميز.</p>
            </div>
          </div>
          </div>

          {/* Footer: in document flow so QR never overlaps title/body on small screens or print */}
          <div className="certificate-footer-row pointer-events-none shrink-0 pt-1 md:pt-2">
            <div className="certificate-footer-inner pointer-events-auto mx-auto flex w-full max-w-[min(100%,22rem)] flex-row items-center justify-center gap-2 sm:max-w-[min(100%,24rem)] sm:gap-3">
              <div className="certificate-qr-box flex shrink-0 flex-col items-center">
                <div className="rounded-md border border-neutral-200/90 bg-white/95 p-1 shadow-sm ring-1 ring-black/5 sm:p-1.5">
                  {qrSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={qrSrc}
                      alt=""
                      width={72}
                      height={72}
                      className="certificate-qr-img block h-[64px] w-[64px] object-contain sm:h-[72px] sm:w-[72px]"
                    />
                  ) : (
                    <div className="h-[64px] w-[64px] rounded bg-white sm:h-[72px] sm:w-[72px]" aria-hidden />
                  )}
                </div>
                <p
                  className="mt-0.5 max-w-[7rem] text-center text-[0.5rem] leading-snug text-neutral-600"
                  lang="en"
                  dir="ltr"
                >
                  Official verify
                </p>
                <p
                  className="max-w-[7rem] text-center text-[0.5rem] leading-snug text-neutral-600"
                  lang="ar"
                  dir="rtl"
                >
                  تحقق رسمي
                </p>
              </div>
              <div className="certificate-verification-text min-w-0 shrink leading-tight" dir="rtl">
                <p className={`text-[0.62rem] font-semibold sm:text-[0.65rem] ${STATIC}`} lang="ar">
                  إدارة مدارس الأنجال الأهلية
                </p>
                <p className="mt-0.5 text-right text-[0.58rem] text-gray-600 sm:text-[0.6rem]" lang="en" dir="ltr">
                  Al-Anjal Schools Administration
                </p>
                <p className="mt-1 text-right text-[0.52rem] text-gray-500 sm:text-[0.55rem]" dir="ltr">
                  ID: {certificateDisplayId}
                </p>
                <p className="text-right text-[0.48rem] text-gray-400 sm:text-[0.5rem]" dir="ltr">
                  v{content.certificateVersion}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppreciationCertificate;
