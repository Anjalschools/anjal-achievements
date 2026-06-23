"use client";

import SectionCard from "@/components/layout/SectionCard";
import {
  institutionReportExtractionMethodLabel,
  institutionReportValidationStatusLabel,
  type InstitutionReportValidationView,
} from "@/lib/partnerships/institution-final-report-validation-ui";
import { humanizeValidationFailure, SEVERITY_TONES } from "@/lib/partnerships/final-report-review-ux-constants";
import { Check, X } from "lucide-react";

type InstitutionReportValidationCardProps = {
  extraction: InstitutionReportValidationView | null | undefined;
  locale: "ar" | "en";
  recordId?: string | null;
  onManualVerify?: () => void | Promise<void>;
  manualVerifyLoading?: boolean;
  validationDiagnostics?: {
    ocrError?: string;
    visionError?: string;
    failureReasonAr?: string;
    failureReasonEn?: string;
  } | null;
};

const InstitutionReportValidationCard = ({
  extraction,
  locale,
  recordId,
  onManualVerify,
  manualVerifyLoading = false,
  validationDiagnostics = null,
}: InstitutionReportValidationCardProps) => {
  const isAr = locale === "ar";
  const validation = extraction?.validationResult ?? null;
  const reviewStatus = validation?.reviewStatus ?? extraction?.reviewStatus;

  if (!extraction && !validation) {
    return (
      <SectionCard className="!p-4">
        <h4 className="mb-2 text-sm font-black text-slate-900">
          {isAr ? "نتيجة فحص التقرير المؤسسي" : "Institution report scan result"}
        </h4>
        <p className="text-xs text-slate-500">
          {isAr ? "لم يُرفع تقرير مؤسسة بعد." : "No institution report uploaded yet."}
        </p>
      </SectionCard>
    );
  }

  const ratingsDetected = validation?.ratingsDetected ?? 0;
  const expectedRatings = validation?.expectedRatings ?? 10;
  const stampDetected = validation?.stampDetected ?? extraction?.hasStamp ?? false;
  const signatureDetected = validation?.signatureDetected ?? extraction?.hasSignature ?? false;
  const ocrConfidence = validation?.ocrConfidence ?? extraction?.ocrConfidence ?? 0;
  const visionConfidence = validation?.visionConfidence ?? extraction?.visionConfidence ?? 0;
  const ocrDisplay =
    ocrConfidence > 0
      ? `${ocrConfidence}%`
      : humanizeValidationFailure(
          validationDiagnostics?.ocrError,
          locale,
          validationDiagnostics?.failureReasonAr,
          validationDiagnostics?.failureReasonEn
        ) ||
        (isAr ? "فشل استخراج النص من الملف." : "Text extraction from the file failed.");
  const visionDisplay =
    visionConfidence > 0
      ? `${visionConfidence}%`
      : humanizeValidationFailure(
          validationDiagnostics?.visionError,
          locale,
          validationDiagnostics?.failureReasonAr,
          validationDiagnostics?.failureReasonEn
        ) ||
        (isAr ? "تعذر تحليل الملف بصرياً." : "Visual analysis of the file failed.");
  const overallConfidence =
    validation?.overallConfidence ?? validation?.confidence ?? extraction?.overallConfidence ?? extraction?.confidenceScore ?? 0;
  const statusLabel = institutionReportValidationStatusLabel(validation, locale);
  const warnings = validation?.warnings ?? [];
  const rowDetails = validation?.ratingRowDetails ?? [];
  const extractionMethodLabel = institutionReportExtractionMethodLabel(
    validation?.extractionMethod || extraction?.extractionMethod,
    locale
  );

  const statusTone =
    reviewStatus === "APPROVED"
      ? SEVERITY_TONES.success
      : validation?.riskFlags?.includes("AI_REVIEW_FAILED") ||
          validation?.riskFlags?.includes("OCR_FAILED")
        ? SEVERITY_TONES.warning
        : SEVERITY_TONES.warning;

  return (
    <SectionCard className="!p-4">
      <h4 className="mb-3 text-sm font-black text-slate-900">
        {isAr ? "نتيجة فحص التقرير المؤسسي" : "Institution report scan result"}
      </h4>
      <dl className="grid gap-2 text-xs sm:grid-cols-2">
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <dt className="font-bold text-slate-600">{isAr ? "اكتمال التقييم" : "Evaluation completeness"}</dt>
          <dd className="mt-1 font-black text-slate-900">
            {ratingsDetected} / {expectedRatings}
          </dd>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <dt className="font-bold text-slate-600">{isAr ? "طريقة الاستخراج" : "Extraction method"}</dt>
          <dd className="mt-1 font-black text-slate-900">{extractionMethodLabel}</dd>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <dt className="font-bold text-slate-600">{isAr ? "الختم" : "Stamp"}</dt>
          <dd className="mt-1 font-black text-slate-900">
            {stampDetected ? (isAr ? "موجود" : "Present") : isAr ? "غير موجود" : "Missing"}
            {validation?.stampConfidence != null ? (
              <span className="ms-1 font-normal text-slate-500">({validation.stampConfidence}%)</span>
            ) : null}
          </dd>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <dt className="font-bold text-slate-600">{isAr ? "التوقيع" : "Signature"}</dt>
          <dd className="mt-1 font-black text-slate-900">
            {signatureDetected ? (isAr ? "موجود" : "Present") : isAr ? "غير موجود" : "Missing"}
            {validation?.signatureConfidence != null ? (
              <span className="ms-1 font-normal text-slate-500">({validation.signatureConfidence}%)</span>
            ) : null}
          </dd>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <dt className="font-bold text-slate-600">{isAr ? "ثقة OCR" : "OCR confidence"}</dt>
          <dd className="mt-1 font-black text-slate-900">{ocrDisplay}</dd>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <dt className="font-bold text-slate-600">{isAr ? "ثقة الرؤية" : "Vision confidence"}</dt>
          <dd className="mt-1 font-black text-slate-900">{visionDisplay}</dd>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2 sm:col-span-2">
          <dt className="font-bold text-slate-600">{isAr ? "الثقة الإجمالية" : "Overall confidence"}</dt>
          <dd className="mt-1 font-black text-slate-900">{overallConfidence}%</dd>
        </div>
        <div className={`rounded-lg border px-3 py-2 sm:col-span-2 ${statusTone}`}>
          <dt className="font-bold">{isAr ? "الحالة" : "Status"}</dt>
          <dd className="mt-1 font-black">{statusLabel}</dd>
        </div>
      </dl>

      {rowDetails.length > 0 ? (
        <div className="mt-4">
          <p className="mb-2 text-xs font-black text-slate-800">{isAr ? "تفاصيل الفحص" : "Scan details"}</p>
          <ul className="space-y-1" aria-label={isAr ? "تفاصيل بنود التقييم" : "Rating row details"}>
            {rowDetails.map((row) => {
              const isValid = row.rowStatus === "VALID";
              const isMultiple = row.rowStatus === "MULTIPLE";
              return (
                <li
                  key={row.key}
                  className={`flex items-center gap-2 rounded-lg px-2 py-1 text-xs ${
                    isValid
                      ? "bg-emerald-50 text-emerald-900"
                      : isMultiple
                        ? "bg-red-50 text-red-900"
                        : "bg-orange-50 text-orange-900"
                  }`}
                >
                  {isValid ? (
                    <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  ) : (
                    <X className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  )}
                  <span>
                    {row.labelAr}
                    {isValid && row.selectedRating ? ` (${row.selectedRating})` : ""}
                    {!isValid && !isMultiple ? (isAr ? ": غير مقيم" : ": not rated") : ""}
                    {isMultiple ? (isAr ? ": اختيارات متعددة" : ": multiple selections") : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {extraction?.manualVerification ? (
        <p className="mt-3 rounded-lg bg-sky-50 px-3 py-2 text-xs font-bold text-sky-800">
          {isAr ? "تم التحقق يدوياً" : "Manually verified"}
        </p>
      ) : null}

      {recordId && onManualVerify && !extraction?.manualVerification ? (
        <button
          type="button"
          onClick={() => void onManualVerify()}
          disabled={manualVerifyLoading}
          className="mt-3 rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-800 disabled:opacity-60"
          aria-label={isAr ? "تم التحقق يدوياً" : "Mark manually verified"}
        >
          {manualVerifyLoading
            ? isAr
              ? "جاري الحفظ..."
              : "Saving..."
            : isAr
              ? "تم التحقق يدوياً"
              : "Mark manually verified"}
        </button>
      ) : null}

      {warnings.length > 0 ? (
        <ul className="mt-3 space-y-1 text-xs text-amber-800" aria-label={isAr ? "تحذيرات الفحص" : "Scan warnings"}>
          {warnings.map((warning) => (
            <li key={warning} className="rounded-lg bg-amber-50 px-2 py-1">
              {warning}
            </li>
          ))}
        </ul>
      ) : null}
    </SectionCard>
  );
};

export default InstitutionReportValidationCard;
