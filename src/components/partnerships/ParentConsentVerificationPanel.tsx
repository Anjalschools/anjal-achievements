"use client";

import {
  PARENT_CONSENT_CLASSIFICATION_LABELS,
  PARENT_CONSENT_CONFIDENCE_BAND_LABELS,
  type ParentConsentAiVerification,
} from "@/lib/partnerships/parent-consent-verification-constants";
import {
  PARENT_CONSENT_TEMPLATE_VERSION_STATUS_LABELS,
  type ParentConsentTemplateFieldComparison,
} from "@/lib/partnerships/parent-consent-template-version";
import { AlertTriangle, CheckCircle2, FileSearch } from "lucide-react";

const TEMPLATE_FIELD_LABELS: Record<ParentConsentTemplateFieldComparison["field"], { ar: string; en: string }> = {
  organizationName: { ar: "اسم المؤسسة", en: "Organization" },
  opportunityTitle: { ar: "اسم الفرصة", en: "Opportunity" },
  trainingStartDate: { ar: "تاريخ البداية", en: "Start date" },
  trainingEndDate: { ar: "تاريخ النهاية", en: "End date" },
  trainingHours: { ar: "عدد الساعات", en: "Training hours" },
  academicYear: { ar: "العام الدراسي", en: "Academic year" },
};

type ParentConsentVerificationPanelProps = {
  verification: ParentConsentAiVerification | null | undefined;
  isAr: boolean;
  showFieldChecks?: boolean;
};

const ParentConsentVerificationPanel = ({ verification, isAr, showFieldChecks = false }: ParentConsentVerificationPanelProps) => {
  if (!verification || verification.runStatus === "skipped") return null;

  const bandLabel = PARENT_CONSENT_CONFIDENCE_BAND_LABELS[verification.confidenceBand];
  const classLabel = PARENT_CONSENT_CLASSIFICATION_LABELS[verification.classification];
  const templateValidation = verification.templateVersionValidation;
  const templateStatusLabel = templateValidation
    ? PARENT_CONSENT_TEMPLATE_VERSION_STATUS_LABELS[templateValidation.status]
    : null;
  const isTrusted = verification.verificationScore >= 90;
  const needsAlert =
    verification.verificationScore < 70 ||
    verification.duplicateDetected ||
    templateValidation?.status === "outdated";

  return (
    <div
      className={`mt-3 rounded-xl border p-4 text-sm ${
        needsAlert
          ? "border-amber-300 bg-amber-50"
          : isTrusted
            ? "border-emerald-300 bg-emerald-50"
            : "border-border bg-gray-50"
      }`}
      role="status"
      aria-label={isAr ? "نتائج التحقق الآلي" : "Automated verification results"}
    >
      <div className="mb-2 flex items-start gap-2">
        {needsAlert ? (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
        ) : isTrusted ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
        ) : (
          <FileSearch className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        )}
        <div>
          <p className="font-bold text-foreground">
            {isAr ? classLabel.ar : classLabel.en}
          </p>
          <p className="text-xs text-text-light">
            {isAr ? "درجة الثقة:" : "Confidence:"}{" "}
            <span className="font-bold text-foreground">{verification.verificationScore}%</span>
            {templateValidation?.scoreAdjusted ? (
              <>
                {" "}
                <span className="text-amber-800">
                  ({isAr ? "قبل التعديل:" : "Before adjustment:"} {templateValidation.originalScore}%)
                </span>
              </>
            ) : null}
            {" · "}
            {isAr ? bandLabel.ar : bandLabel.en}
          </p>
        </div>
      </div>

      <p className="mb-2 text-text-light">{isAr ? verification.summaryAr : verification.summaryEn}</p>

      {showFieldChecks && templateValidation && templateStatusLabel ? (
        <div className="mb-3 rounded-lg border border-border/70 bg-white/80 p-3 text-xs">
          <p className="mb-2 font-bold text-foreground">
            {isAr ? "حالة النموذج:" : "Template status:"}{" "}
            {templateStatusLabel.icon} {isAr ? templateStatusLabel.ar : templateStatusLabel.en}
          </p>
          {templateValidation.comparisons.length > 0 ? (
            <div className="space-y-2">
              {templateValidation.comparisons.map((row) => {
                const label = TEMPLATE_FIELD_LABELS[row.field];
                return (
                  <div key={row.field} className="rounded-md border border-border/50 bg-gray-50 p-2">
                    <p className="font-semibold text-foreground">{isAr ? label.ar : label.en}</p>
                    <p className="text-text-light">
                      {isAr ? "النموذج:" : "Template:"} {row.templateValue}
                    </p>
                    <p className="text-text-light">
                      {isAr ? "الحالي:" : "Current:"} {row.currentValue}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-text-light">
              {isAr ? "لا توجد اختلافات في بيانات الفرصة." : "No opportunity data differences."}
            </p>
          )}
        </div>
      ) : null}

      {showFieldChecks && verification.verificationSummary ? (
        <pre className="mb-2 whitespace-pre-wrap rounded-lg border border-border/60 bg-white/70 p-2 font-sans text-xs text-text-light">
          {verification.verificationSummary}
        </pre>
      ) : null}

      {showFieldChecks && verification.fieldChecks ? (
        <ul className="mb-2 grid gap-1 text-xs sm:grid-cols-2">
          {(
            [
              ["studentName", isAr ? "اسم الطالب" : "Student name"],
              ["organizationName", isAr ? "اسم المؤسسة" : "Organization"],
              ["opportunityTitle", isAr ? "اسم الفرصة" : "Opportunity"],
              ["guardianDetails", isAr ? "بيانات ولي الأمر" : "Guardian details"],
              ["signature", isAr ? "التوقيع" : "Signature"],
              ["date", isAr ? "التاريخ" : "Date"],
            ] as const
          ).map(([key, label]) => (
            <li key={key} className={verification.fieldChecks?.[key] ? "text-emerald-800" : "text-amber-800"}>
              {verification.fieldChecks?.[key] ? "✓" : "✗"} {label}
            </li>
          ))}
        </ul>
      ) : null}

      {verification.duplicateDetected ? (
        <p className="mb-2 text-xs font-semibold text-amber-900">
          {isAr ? "تنبيه: تم رصد ملف مكرر سابقاً." : "Alert: duplicate file detected."}
        </p>
      ) : null}

      <dl className="grid gap-2 text-xs sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-foreground">{isAr ? "النص المستخرج" : "Extracted text"}</dt>
          <dd className="mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap text-text-light">
            {verification.ocr.rawText
              ? verification.ocr.rawText.slice(0, 600)
              : isAr
                ? "لم يُستخرج نص كافٍ"
                : "Insufficient extracted text"}
          </dd>
        </div>
        <div className="space-y-2">
          {verification.ocr.extractedName ? (
            <div>
              <dt className="font-semibold text-foreground">{isAr ? "الاسم" : "Name"}</dt>
              <dd className="text-text-light">{verification.ocr.extractedName}</dd>
            </div>
          ) : null}
          {verification.ocr.extractedDate ? (
            <div>
              <dt className="font-semibold text-foreground">{isAr ? "التاريخ" : "Date"}</dt>
              <dd className="text-text-light">{verification.ocr.extractedDate}</dd>
            </div>
          ) : null}
          {verification.ocr.extractedIdNumber ? (
            <div>
              <dt className="font-semibold text-foreground">{isAr ? "رقم الهوية" : "ID number"}</dt>
              <dd className="text-text-light">{verification.ocr.extractedIdNumber}</dd>
            </div>
          ) : null}
          {verification.ocr.signatureHint ? (
            <div>
              <dt className="font-semibold text-foreground">{isAr ? "التوقيع" : "Signature"}</dt>
              <dd className="text-text-light">
                {isAr ? "تم التعرف على إشارة توقيع" : "Signature signal detected"}
              </dd>
            </div>
          ) : null}
        </div>
      </dl>

      {verification.positiveSignals.length > 0 ? (
        <p className="mt-2 text-[11px] text-text-light">
          {isAr ? "إشارات إيجابية:" : "Positive signals:"}{" "}
          {verification.positiveSignals.slice(0, 6).join(isAr ? "، " : ", ")}
        </p>
      ) : null}
    </div>
  );
};

export default ParentConsentVerificationPanel;
