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
      <style jsx global>{`
        @page {
          size: A4 landscape;
          margin: 0;
        }

        @media print {
          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            height: auto !important;
          }
          body * {
            visibility: hidden;
          }
          .certificate-print-target,
          .certificate-print-target * {
            visibility: visible;
          }
          .certificate-print-target {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 297mm !important;
            height: 210mm !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          /* Always two columns + footer columns when printing */
          .certificate-body-two-col {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            direction: ltr !important;
            overflow: visible !important;
            max-height: none !important;
          }
          .certificate-body-stack {
            display: none !important;
          }
          .certificate-qr-bottom-center {
            position: fixed !important;
            left: 50% !important;
            bottom: 10mm !important;
            transform: translateX(-50%) !important;
            z-index: 3 !important;
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
        }

        .certificate-print-target {
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
        }

        /* Screen: fit viewport without changing inner mm logic */
        @media screen {
          .certificate-root-wrapper {
            width: 100%;
            max-width: 297mm;
            margin-left: auto;
            margin-right: auto;
          }
        }
      `}</style>

      <div
        className="certificate-print-target certificate-shell relative isolate box-border aspect-[297/210] w-full max-w-[297mm] overflow-hidden rounded-xl shadow-lg print:aspect-auto print:h-[210mm] print:w-[297mm] print:max-w-none print:rounded-none print:shadow-none"
      >
        {/* Background layer — full bleed */}
        <div
          className="certificate-background pointer-events-none absolute inset-0 z-0 bg-neutral-100"
          style={{
            backgroundImage: "url(/background.jpg)",
            backgroundSize: "cover",
            backgroundPosition: "center center",
            backgroundRepeat: "no-repeat",
          }}
          aria-hidden
        />

        {/* Content layer — safe margins inside printable area */}
        <div
          className="certificate-content absolute inset-0 z-[1] box-border flex flex-col"
          style={{
            paddingTop: "16%",
            paddingBottom: "24%",
            paddingLeft: "5%",
            paddingRight: "5%",
          }}
        >
          {/* Titles — centered, neutral direction */}
          <header className="mb-1 shrink-0 text-center" dir="auto">
            <h1
              className={`text-[1.58rem] font-black leading-tight text-black md:text-[1.88rem] ${STATIC}`}
              lang="ar"
            >
              شهادة شكر وتقدير
            </h1>
            <p
              className={`mt-1 text-[0.72rem] font-bold uppercase tracking-[0.12em] text-black md:text-[0.8rem] ${STATIC}`}
              lang="en"
            >
              Appreciation certificate
            </p>
          </header>

          {/* Desktop + print: fixed 2-col grid [ EN left | AR right ]. Mobile: stacked preview. */}
          <div
            className="certificate-body-two-col hidden min-h-0 flex-1 gap-x-5 gap-y-1 overflow-y-auto overflow-x-hidden md:grid"
            style={{ direction: "ltr", gridTemplateColumns: "1fr 1fr" }}
          >
            <div
              dir="ltr"
              lang="en"
              className={`certificate-col-en min-h-0 overflow-visible text-left ${STATIC}`}
              style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: "10.5pt",
                lineHeight: 1.5,
                wordBreak: "break-word",
                overflowWrap: "anywhere",
                hyphens: "auto",
              }}
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
              className={`certificate-col-ar min-h-0 overflow-visible text-right ${STATIC}`}
              style={{
                fontFamily: "Tahoma, 'Segoe UI', system-ui, sans-serif",
                fontSize: "11pt",
                lineHeight: 1.75,
                wordBreak: "break-word",
                overflowWrap: "anywhere",
              }}
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

          <div className="certificate-body-stack flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden md:hidden">
            <div
              dir="ltr"
              lang="en"
              className={`text-left ${STATIC}`}
              style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: "10pt",
                lineHeight: 1.5,
                wordBreak: "break-word",
                overflowWrap: "anywhere",
              }}
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
              className={`text-right ${STATIC}`}
              style={{
                fontFamily: "Tahoma, 'Segoe UI', system-ui, sans-serif",
                fontSize: "10.5pt",
                lineHeight: 1.75,
                wordBreak: "break-word",
                overflowWrap: "anywhere",
              }}
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

        {/* Bottom-center: compact row [ QR + captions | administration + ID ] */}
        <div
          className="certificate-qr-bottom-center pointer-events-none absolute left-1/2 z-[2] flex -translate-x-1/2 justify-center"
          style={{ bottom: "10mm" }}
        >
          <div className="certificate-verification-bottom-center pointer-events-auto flex max-w-[min(100%,18rem)] flex-row items-center gap-3 sm:max-w-[min(100%,22rem)]">
            <div className="certificate-qr-box flex shrink-0 flex-col items-center">
              <div className="rounded-md border border-neutral-200/90 bg-white/95 p-1.5 shadow-sm ring-1 ring-black/5">
                {qrSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrSrc}
                    alt=""
                    width={72}
                    height={72}
                    className="block h-[72px] w-[72px] object-contain"
                  />
                ) : (
                  <div className="h-[72px] w-[72px] rounded bg-white" aria-hidden />
                )}
              </div>
              <p className="mt-0.5 max-w-[6.5rem] text-center text-[0.5rem] leading-snug text-neutral-600" lang="en">
                Official verify
              </p>
              <p className="max-w-[6.5rem] text-center text-[0.5rem] leading-snug text-neutral-600" lang="ar" dir="rtl">
                تحقق رسمي
              </p>
            </div>
            <div
              className="certificate-verification-text min-w-0 shrink leading-tight"
              dir="rtl"
            >
              <p className={`text-[0.65rem] font-semibold ${STATIC}`} lang="ar">
                إدارة مدارس الأنجال الأهلية
              </p>
              <p className="mt-0.5 text-right text-[0.6rem] text-gray-600" lang="en" dir="ltr">
                Al-Anjal Schools Administration
              </p>
              <p className="mt-1 text-right text-[0.55rem] text-gray-500" dir="ltr">
                ID: {certificateDisplayId}
              </p>
              <p className="text-right text-[0.5rem] text-gray-400" dir="ltr">
                v{content.certificateVersion}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppreciationCertificate;
