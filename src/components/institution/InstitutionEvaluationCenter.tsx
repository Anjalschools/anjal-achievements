"use client";

import { ClipboardList, Plus } from "lucide-react";

type AssessmentRow = {
  id: string;
  title: string;
  type: string;
  status: string;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type InstitutionEvaluationCenterProps = {
  applicationId: string;
  applicationStatus: string;
  assessments: AssessmentRow[];
  isAr: boolean;
  readOnly?: boolean;
  onCreateAssessment?: (title: string) => void;
  onUpdated?: () => void;
  assessmentTitle?: string;
  onAssessmentTitleChange?: (value: string) => void;
  saving?: boolean;
};

const statusLabel = (status: string, isAr: boolean): string => {
  const map: Record<string, { ar: string; en: string }> = {
    draft: { ar: "مسودة", en: "Draft" },
    pending: { ar: "قيد الانتظار", en: "Pending" },
    submitted: { ar: "مُرسَل", en: "Submitted" },
    approved: { ar: "معتمد", en: "Approved" },
    returned: { ar: "مُعاد", en: "Returned" },
    completed: { ar: "مكتمل", en: "Completed" },
  };
  const row = map[status] || { ar: status, en: status };
  return isAr ? row.ar : row.en;
};

const InstitutionEvaluationCenter = ({
  assessments,
  isAr,
  readOnly = false,
  onCreateAssessment,
  assessmentTitle = "",
  onAssessmentTitleChange,
  saving = false,
}: InstitutionEvaluationCenterProps) => {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-1 flex items-center gap-2 text-base font-bold text-foreground">
          <ClipboardList className="h-4 w-4 text-primary" aria-hidden />
          {isAr ? "التقييمات الدورية" : "Periodic assessments"}
        </h3>
        <p className="text-xs text-text-light">
          {isAr
            ? "التقييمات الاعتيادية أثناء فترة التدريب — منفصلة عن التقرير النهائي."
            : "Regular in-training assessments — separate from the final training report."}
        </p>
      </div>

      <div className="rounded-2xl border border-border/70 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold">{isAr ? "قائمة التقييمات" : "Assessment list"}</p>
          {!readOnly && onCreateAssessment ? (
            <div className="flex flex-1 flex-wrap items-center gap-2 sm:max-w-md sm:flex-none">
              <input
                value={assessmentTitle}
                onChange={(e) => onAssessmentTitleChange?.(e.target.value)}
                placeholder={isAr ? "عنوان التقييم" : "Assessment title"}
                className="min-w-[140px] flex-1 rounded-xl border border-border px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={saving || !assessmentTitle.trim()}
                onClick={() => onCreateAssessment(assessmentTitle.trim())}
                className="inline-flex items-center gap-1 rounded-xl border border-primary bg-primary/10 px-3 py-2 text-xs font-bold text-primary disabled:opacity-60"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                {isAr ? "إنشاء" : "Create"}
              </button>
            </div>
          ) : null}
        </div>

        {assessments.length === 0 ? (
          <p className="text-sm text-text-light">{isAr ? "لا توجد تقييمات بعد." : "No assessments yet."}</p>
        ) : (
          <ul className="space-y-2">
            {assessments.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 px-3 py-3 text-sm"
              >
                <div>
                  <p className="font-semibold">{row.title}</p>
                  <p className="text-xs text-text-light">
                    {isAr ? "الحالة:" : "Status:"} {statusLabel(row.status, isAr)}
                    {row.updatedAt
                      ? ` · ${new Date(row.updatedAt).toLocaleDateString(isAr ? "ar-SA" : "en-US")}`
                      : ""}
                  </p>
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{row.type}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default InstitutionEvaluationCenter;
