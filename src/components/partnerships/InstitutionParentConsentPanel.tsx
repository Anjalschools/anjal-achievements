"use client";

import { useState } from "react";
import SectionCard from "@/components/layout/SectionCard";
import ParentConsentStatusBadge from "@/components/partnerships/ParentConsentStatusBadge";
import ParentConsentVerificationPanel from "@/components/partnerships/ParentConsentVerificationPanel";
import {
  mapRequirementToParentConsentDisplay,
  PARENT_CONSENT_DEFAULT_DESCRIPTION,
  PARENT_CONSENT_DEFAULT_TITLE,
  PARENT_CONSENT_REQUIREMENT_TYPE,
  type ParentConsentDisplayStatus,
} from "@/lib/partnerships/parent-consent-constants";
import type { ParentConsentGeneratedTemplate } from "@/lib/partnerships/parent-consent-template-constants";
import type { ParentConsentAiVerification } from "@/lib/partnerships/parent-consent-verification-constants";
import { attachmentDisplayUrl } from "@/lib/partnerships/training-completion-upload";
import { CheckCircle2, Download, Loader2, RefreshCw, XCircle } from "lucide-react";

type InstitutionConsentStatus = {
  status: string;
  labelAr: string;
  labelEn: string;
};

type RequirementRow = {
  id: string;
  requirementType: string;
  title: string;
  description: string;
  status: string;
  submittedAt: string | null;
  institutionConsentStatus?: InstitutionConsentStatus | null;
  generatedTemplate?: ParentConsentGeneratedTemplate | null;
  uploadedAttachment?: { fileName: string; storageKey: string } | null;
  aiVerification?: ParentConsentAiVerification | null;
};

type InstitutionParentConsentPanelProps = {
  applicationId: string;
  requirements: RequirementRow[];
  isAr: boolean;
  onUpdated: () => void | Promise<void>;
  postAction: (body: Record<string, unknown>) => Promise<void>;
  saving: boolean;
  viewMode?: "institution" | "supervisor";
  templateStaleForOpportunity?: boolean;
};

const InstitutionParentConsentPanel = ({
  applicationId,
  requirements,
  isAr,
  onUpdated,
  postAction,
  saving,
  viewMode = "institution",
  templateStaleForOpportunity = false,
}: InstitutionParentConsentPanelProps) => {
  const [reviewNote, setReviewNote] = useState("");
  const parentConsent = requirements.find((row) => row.requirementType === PARENT_CONSENT_REQUIREMENT_TYPE) || null;
  const displayStatus: ParentConsentDisplayStatus = mapRequirementToParentConsentDisplay(parentConsent);
  const isSupervisor = viewMode === "supervisor";
  const institutionStatus = parentConsent?.institutionConsentStatus;

  const handleCreate = async () => {
    await postAction({ action: "create_parent_consent" });
    await onUpdated();
  };

  const handleReview = async (decision: "approve" | "reject" | "request_reupload") => {
    if (!parentConsent) return;
    await postAction({
      action: "review_requirement",
      requirementId: parentConsent.id,
      decision,
      note: reviewNote.trim() || undefined,
    });
    setReviewNote("");
    await onUpdated();
  };

  const handleRegenerateTemplate = async () => {
    await postAction({ action: "regenerate_template" });
    await onUpdated();
  };

  if (viewMode === "institution") {
    if (!parentConsent) {
      return (
        <SectionCard>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-bold text-foreground">
              {isAr ? PARENT_CONSENT_DEFAULT_TITLE.ar : PARENT_CONSENT_DEFAULT_TITLE.en}
            </h3>
            <ParentConsentStatusBadge status={displayStatus} isAr={isAr} />
          </div>
          <p className="mb-3 text-sm text-text-light">
            {isAr ? PARENT_CONSENT_DEFAULT_DESCRIPTION.ar : PARENT_CONSENT_DEFAULT_DESCRIPTION.en}
          </p>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleCreate()}
            className="inline-flex items-center gap-2 rounded-xl border border-violet-300 bg-violet-50 px-3 py-2 text-sm font-bold text-violet-900 disabled:opacity-60"
            aria-label={isAr ? "طلب موافقة ولي الأمر" : "Request parent consent"}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {isAr ? "طلب موافقة ولي الأمر" : "Request parent consent"}
          </button>
          <input type="hidden" value={applicationId} readOnly aria-hidden />
        </SectionCard>
      );
    }

    const statusLabel = institutionStatus
      ? isAr
        ? institutionStatus.labelAr
        : institutionStatus.labelEn
      : displayStatus === "approved"
        ? isAr
          ? "✓ معتمدة"
          : "✓ Approved"
        : isAr
          ? "بانتظار الاعتماد"
          : "Pending approval";

    return (
      <SectionCard>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-bold text-foreground">
            {isAr ? PARENT_CONSENT_DEFAULT_TITLE.ar : PARENT_CONSENT_DEFAULT_TITLE.en}
          </h3>
          <ParentConsentStatusBadge status={displayStatus} isAr={isAr} />
        </div>
        <p className="rounded-xl border border-border/70 bg-gray-50 px-4 py-3 text-sm font-semibold text-foreground" role="status">
          {isAr ? "موافقة ولي الأمر" : "Parent consent"} — {statusLabel}
        </p>
        <input type="hidden" value={applicationId} readOnly aria-hidden />
      </SectionCard>
    );
  }

  return (
    <SectionCard>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold text-foreground">
          {isAr ? PARENT_CONSENT_DEFAULT_TITLE.ar : PARENT_CONSENT_DEFAULT_TITLE.en}
        </h3>
        <ParentConsentStatusBadge status={displayStatus} isAr={isAr} />
      </div>

      {!parentConsent ? (
        <div className="space-y-3">
          <p className="text-sm text-text-light">
            {isAr ? PARENT_CONSENT_DEFAULT_DESCRIPTION.ar : PARENT_CONSENT_DEFAULT_DESCRIPTION.en}
          </p>
          {isSupervisor ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleCreate()}
              className="inline-flex items-center gap-2 rounded-xl border border-violet-300 bg-violet-50 px-3 py-2 text-sm font-bold text-violet-900 disabled:opacity-60"
              aria-label={isAr ? "طلب موافقة ولي الأمر" : "Request parent consent"}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {isAr ? "طلب موافقة ولي الأمر" : "Request parent consent"}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-text-light">
            {parentConsent.description ||
              (isAr ? PARENT_CONSENT_DEFAULT_DESCRIPTION.ar : PARENT_CONSENT_DEFAULT_DESCRIPTION.en)}
          </p>

          {isSupervisor && parentConsent.generatedTemplate?.storageKey ? (
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={attachmentDisplayUrl(parentConsent.generatedTemplate.storageKey)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-xs font-bold text-primary"
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                {isAr ? "تحميل النموذج المولّد" : "Download generated template"}
                {parentConsent.generatedTemplate.templateVersion ? (
                  <span className="font-normal opacity-80">
                    v{parentConsent.generatedTemplate.templateVersion}
                  </span>
                ) : null}
              </a>
              {templateStaleForOpportunity ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleRegenerateTemplate()}
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 disabled:opacity-60"
                  aria-label={isAr ? "إعادة إنشاء نموذج موافقة ولي الأمر" : "Regenerate parent consent template"}
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  {isAr ? "إعادة إنشاء نموذج موافقة ولي الأمر" : "Regenerate parent consent form"}
                </button>
              ) : null}
            </div>
          ) : null}

          {isSupervisor && parentConsent.uploadedAttachment?.storageKey ? (
            <a
              href={attachmentDisplayUrl(parentConsent.uploadedAttachment.storageKey)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-xs font-bold text-primary"
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              {isAr ? "تحميل المستند المرفوع" : "Download uploaded document"}
            </a>
          ) : null}

          {parentConsent.status === "submitted" ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
              {isAr ? "بانتظار مراجعة موافقة ولي الأمر." : "Parent consent is pending review."}
            </p>
          ) : null}

          {isSupervisor ? (
            <ParentConsentVerificationPanel verification={parentConsent.aiVerification} isAr={isAr} showFieldChecks />
          ) : null}

          {parentConsent.status === "accepted" || parentConsent.status === "waived" ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
              {isAr ? "تم اعتماد موافقة ولي الأمر." : "Parent consent approved."}
            </p>
          ) : null}

          {parentConsent.status === "rejected" ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
              {isAr ? "تم رفض المستند. بانتظار إعادة الرفع من الطالب." : "Document rejected. Awaiting student re-upload."}
            </p>
          ) : null}

          {(parentConsent.status === "submitted" || parentConsent.status === "accepted") && parentConsent.submittedAt ? (
            <p className="text-xs text-text-light">
              {isAr ? "تاريخ الرفع:" : "Uploaded:"}{" "}
              {new Date(parentConsent.submittedAt).toLocaleString(isAr ? "ar-SA" : "en-GB")}
            </p>
          ) : null}

          {isSupervisor && parentConsent.status === "submitted" ? (
            <div className="space-y-2 rounded-xl border border-border/70 p-3">
              <textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder={isAr ? "ملاحظات المراجعة (اختياري)" : "Review notes (optional)"}
                className="min-h-16 w-full rounded-lg border border-border px-3 py-2 text-sm"
                aria-label={isAr ? "ملاحظات المراجعة" : "Review notes"}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleReview("approve")}
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900 disabled:opacity-60"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  {isAr ? "اعتماد المستند" : "Approve"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleReview("reject")}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-bold text-red-900 disabled:opacity-60"
                >
                  <XCircle className="h-3.5 w-3.5" aria-hidden />
                  {isAr ? "رفض المستند" : "Reject"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleReview("request_reupload")}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-xs font-bold disabled:opacity-60"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  {isAr ? "طلب إعادة الرفع" : "Request re-upload"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      <input type="hidden" value={applicationId} readOnly aria-hidden />
    </SectionCard>
  );
};

export default InstitutionParentConsentPanel;
