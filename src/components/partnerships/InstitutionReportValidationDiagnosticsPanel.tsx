"use client";

import { useState } from "react";
import SectionCard from "@/components/layout/SectionCard";
import type { InstitutionReportValidationDiagnostics } from "@/lib/partnerships/institution-final-report-validation-diagnostics";
import {
  diagnosticsSummaryLabel,
  diagnosticsSummaryTone,
  getDiagnosticsSummaryStatus,
  humanizeValidationFailure,
  SEVERITY_TONES,
} from "@/lib/partnerships/final-report-review-ux-constants";
import { pickInstitutionReportValidationView } from "@/lib/partnerships/institution-final-report-validation-ui";
import { ChevronDown } from "lucide-react";

type InstitutionReportValidationDiagnosticsPanelProps = {
  diagnostics: InstitutionReportValidationDiagnostics | null | undefined;
  extraction?: Record<string, unknown> | null;
  locale: "ar" | "en";
};

const InstitutionReportValidationDiagnosticsPanel = ({
  diagnostics,
  extraction = null,
  locale,
}: InstitutionReportValidationDiagnosticsPanelProps) => {
  const isAr = locale === "ar";
  const [technicalOpen, setTechnicalOpen] = useState(false);

  if (!diagnostics) return null;

  const validationView = pickInstitutionReportValidationView(extraction);
  const summaryStatus = getDiagnosticsSummaryStatus(validationView, diagnostics);
  const summaryLabel = diagnosticsSummaryLabel(summaryStatus, locale);
  const summaryTone = diagnosticsSummaryTone(summaryStatus);

  const ocrMessage = humanizeValidationFailure(
    diagnostics.ocrError,
    locale,
    diagnostics.failureReasonAr,
    diagnostics.failureReasonEn
  );
  const visionMessage = humanizeValidationFailure(
    diagnostics.visionError,
    locale,
    diagnostics.failureReasonAr,
    diagnostics.failureReasonEn
  );

  const technicalRows = [
    {
      label: isAr ? "OCR نُفّذ" : "OCR executed",
      value: diagnostics.ocrExecuted ? (isAr ? "نعم" : "Yes") : isAr ? "لا" : "No",
    },
    {
      label: isAr ? "Vision نُفّذ" : "Vision executed",
      value: diagnostics.visionExecuted ? (isAr ? "نعم" : "Yes") : isAr ? "لا" : "No",
    },
    {
      label: isAr ? "نوع الملف" : "File type",
      value: diagnostics.fileType || (isAr ? "غير معروف" : "Unknown"),
    },
    {
      label: isAr ? "حجم الملف" : "File size",
      value:
        diagnostics.fileSize != null
          ? `${diagnostics.fileSize} ${isAr ? "بايت" : "bytes"}`
          : isAr
            ? "غير متوفر"
            : "Unavailable",
    },
    {
      label: isAr ? "الصفحات المكتشفة" : "Pages detected",
      value:
        diagnostics.pagesDetected != null
          ? String(diagnostics.pagesDetected)
          : isAr
            ? "غير متوفر"
            : "Unavailable",
    },
  ];

  return (
    <SectionCard className="!p-4">
      <h4 className="mb-3 text-sm font-black text-slate-900">
        {isAr ? "تشخيصات التحقق" : "Validation diagnostics"}
      </h4>

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <div className={`rounded-xl border px-3 py-2 text-xs font-bold ${summaryTone}`}>
          <p>{isAr ? "الملخص" : "Summary"}</p>
          <p className="mt-1 text-sm font-black">{summaryLabel}</p>
        </div>
        {ocrMessage ? (
          <div className={`rounded-xl border px-3 py-2 text-xs font-semibold sm:col-span-2 ${SEVERITY_TONES.critical}`}>
            <p className="font-bold">{isAr ? "OCR" : "OCR"}</p>
            <p className="mt-1">{ocrMessage}</p>
          </div>
        ) : null}
        {visionMessage ? (
          <div className={`rounded-xl border px-3 py-2 text-xs font-semibold sm:col-span-3 ${SEVERITY_TONES.warning}`}>
            <p className="font-bold">{isAr ? "Vision" : "Vision"}</p>
            <p className="mt-1">{visionMessage}</p>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => setTechnicalOpen((open) => !open)}
        aria-expanded={technicalOpen}
        aria-controls="validation-technical-details"
        className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {isAr ? "عرض التفاصيل التقنية" : "Show technical details"}
        <ChevronDown
          className={`h-4 w-4 transition ${technicalOpen ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {technicalOpen ? (
        <div id="validation-technical-details" className="mt-3">
          <dl className="grid gap-2 text-xs sm:grid-cols-2">
            {technicalRows.map((row) => (
              <div key={row.label} className="rounded-lg bg-slate-50 px-3 py-2">
                <dt className="font-bold text-slate-600">{row.label}</dt>
                <dd className="mt-1 font-black text-slate-900">{row.value}</dd>
              </div>
            ))}
            {ocrMessage ? (
              <div className={`rounded-lg border px-3 py-2 sm:col-span-2 ${SEVERITY_TONES.critical}`}>
                <dt className="font-bold">{isAr ? "خطأ OCR" : "OCR error"}</dt>
                <dd className="mt-1">{ocrMessage}</dd>
              </div>
            ) : null}
            {visionMessage ? (
              <div className={`rounded-lg border px-3 py-2 sm:col-span-2 ${SEVERITY_TONES.warning}`}>
                <dt className="font-bold">{isAr ? "خطأ Vision" : "Vision error"}</dt>
                <dd className="mt-1">{visionMessage}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}
    </SectionCard>
  );
};

export default InstitutionReportValidationDiagnosticsPanel;
