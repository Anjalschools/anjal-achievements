"use client";

import { useEffect } from "react";
import { SEVERITY_TONES } from "@/lib/partnerships/final-report-review-ux-constants";
import type { TrainingReportIntelligence } from "@/lib/partnerships/training-intelligence-types";
import { X } from "lucide-react";

type FinalReportApprovalOverrideDialogProps = {
  open: boolean;
  locale: "ar" | "en";
  acting: boolean;
  validationConfidence?: number | null;
  consistencyScore?: number | null;
  issuesSummary: string[];
  onConfirm: () => void;
  onCancel: () => void;
};

const FinalReportApprovalOverrideDialog = ({
  open,
  locale,
  acting,
  validationConfidence,
  consistencyScore,
  issuesSummary,
  onConfirm,
  onCancel,
}: FinalReportApprovalOverrideDialogProps) => {
  const isAr = locale === "ar";

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[210] flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="approval-override-title"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-orange-200 bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
        dir={isAr ? "rtl" : "ltr"}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <h2 id="approval-override-title" className="text-lg font-black text-slate-900">
            {isAr ? "تأكيد الاعتماد" : "Confirm approval"}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            aria-label={isAr ? "إلغاء" : "Cancel"}
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <p className={`rounded-xl border px-3 py-2 text-sm font-semibold ${SEVERITY_TONES.warning}`}>
          {isAr
            ? "هذا التقرير يحتوي على مشاكل تحقق. هل تريد الاعتماد رغم ذلك؟"
            : "This report has validation issues. Approve anyway?"}
        </p>

        <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <dt className="font-bold text-slate-600">
              {isAr ? "درجة التحقق الحالية" : "Validation confidence"}
            </dt>
            <dd className="mt-1 font-black text-slate-900">
              {validationConfidence != null ? `${validationConfidence}%` : isAr ? "غير متوفر" : "Unavailable"}
            </dd>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <dt className="font-bold text-slate-600">
              {isAr ? "درجة الاتساق" : "Consistency score"}
            </dt>
            <dd className="mt-1 font-black text-slate-900">
              {consistencyScore != null ? `${consistencyScore}%` : isAr ? "غير متوفر" : "Unavailable"}
            </dd>
          </div>
        </dl>

        {issuesSummary.length > 0 ? (
          <div className="mt-4">
            <p className="mb-2 text-xs font-bold text-slate-700">
              {isAr ? "ملخص المشاكل المكتشفة" : "Detected issues summary"}
            </p>
            <ul className="space-y-1 text-xs" aria-label={isAr ? "المشاكل المكتشفة" : "Detected issues"}>
              {issuesSummary.map((issue) => (
                <li key={issue} className={`rounded-lg border px-2 py-1 ${SEVERITY_TONES.critical}`}>
                  {issue}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={acting}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-60"
          >
            {isAr ? "اعتماد رغم ذلك" : "Approve anyway"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={acting}
            className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {isAr ? "إلغاء" : "Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FinalReportApprovalOverrideDialog;
