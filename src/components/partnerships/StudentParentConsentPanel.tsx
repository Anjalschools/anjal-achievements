"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SectionCard from "@/components/layout/SectionCard";
import {
  PARENT_CONSENT_ALLOWED_EXTENSIONS,
  PARENT_CONSENT_DEFAULT_DESCRIPTION,
  PARENT_CONSENT_DEFAULT_TITLE,
  PARENT_CONSENT_REQUIREMENT_TYPE,
} from "@/lib/partnerships/parent-consent-constants";
import {
  PARENT_CONSENT_STUDENT_CHECK_STATUS_LABELS,
  type ParentConsentStudentCheckStatus,
} from "@/lib/partnerships/parent-consent-template-constants";
import { PARENT_CONSENT_STALE_TEMPLATE_MESSAGE } from "@/lib/partnerships/parent-consent-template-version";
import type { ParentConsentAiVerification } from "@/lib/partnerships/parent-consent-verification-constants";
import { uploadParentConsentEvidenceFile } from "@/lib/partnerships/training-completion-upload";
import { Download, FileUp, Loader2 } from "lucide-react";

type StudentAiVerification = Pick<
  ParentConsentAiVerification,
  | "verificationScore"
  | "studentCheckStatus"
  | "verificationSummary"
  | "summaryAr"
  | "summaryEn"
  | "fieldChecks"
  | "runStatus"
> & {
  staleTemplateDetected?: boolean;
  staleTemplateMessageAr?: string;
  staleTemplateMessageEn?: string;
};

type RequirementRow = {
  id: string;
  requirementType: string;
  title: string;
  description: string;
  status: string;
  generatedTemplate?: {
    hasTemplate?: boolean;
    fileName?: string;
    templateVersion?: number;
    templateStaleForOpportunity?: boolean;
  } | null;
  aiVerification?: StudentAiVerification | null;
};

type StudentParentConsentPanelProps = {
  applicationId: string;
  isAr: boolean;
};

const StudentParentConsentPanel = ({ applicationId, isAr }: StudentParentConsentPanelProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requirement, setRequirement] = useState<RequirementRow | null>(null);

  const load = useCallback(async () => {
    if (!applicationId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/partnerships/applications/${encodeURIComponent(applicationId)}/institution-tasks`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      const items = Array.isArray(json.requirements) ? (json.requirements as RequirementRow[]) : [];
      const parentConsent = items.find((row) => row.requirementType === PARENT_CONSENT_REQUIREMENT_TYPE) || null;
      setRequirement(parentConsent);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setRequirement(null);
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDownloadTemplate = async () => {
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/partnerships/applications/${encodeURIComponent(applicationId)}/parent-consent/template`,
        { cache: "no-store" }
      );
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Download failed");
      const downloadUrl = typeof json.downloadUrl === "string" ? json.downloadUrl : "";
      const fileName = typeof json.fileName === "string" ? json.fileName : "parent-consent.pdf";
      if (!downloadUrl) throw new Error("Invalid download URL");
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = fileName;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download error");
    } finally {
      setDownloading(false);
    }
  };

  const handleFilePick = async (files: FileList | null) => {
    if (!files?.length || !requirement) return;
    const file = files[0];
    const name = file.name.toLowerCase();
    const extOk = PARENT_CONSENT_ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext));
    if (!extOk) {
      setError(isAr ? "يُسمح فقط بملفات PDF و JPG و PNG." : "Only PDF, JPG, and PNG files are allowed.");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadParentConsentEvidenceFile(file);
      const res = await fetch(`/api/partnerships/applications/${encodeURIComponent(applicationId)}/institution-tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit_requirement",
          requirementId: requirement.id,
          fileName: uploaded.fileName,
          storageKey: uploaded.storageKey,
          mimeType: uploaded.mimeType || file.type,
          storageProvider: uploaded.storageProvider,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Upload failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload error");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (loading) {
    return (
      <SectionCard>
        <div className="flex items-center gap-2 text-sm text-text-light">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          <span>{isAr ? "جاري التحميل…" : "Loading…"}</span>
        </div>
      </SectionCard>
    );
  }

  if (!requirement) return null;

  const canUpload = requirement.status === "pending" || requirement.status === "rejected" || requirement.status === "overdue";
  const isPendingReview = requirement.status === "submitted";
  const isApproved = requirement.status === "accepted" || requirement.status === "waived";
  const verification = requirement.aiVerification;
  const checkStatus: ParentConsentStudentCheckStatus =
    verification?.studentCheckStatus ||
    (isPendingReview ? "checking" : canUpload ? "not_started" : "not_started");
  const checkLabel = PARENT_CONSENT_STUDENT_CHECK_STATUS_LABELS[checkStatus];
  const staleFromUpload = Boolean(verification?.staleTemplateDetected);
  const staleFromOpportunity = Boolean(requirement.generatedTemplate?.templateStaleForOpportunity);
  const staleMessage = staleFromUpload
    ? isAr
      ? verification?.staleTemplateMessageAr || PARENT_CONSENT_STALE_TEMPLATE_MESSAGE.ar
      : verification?.staleTemplateMessageEn || PARENT_CONSENT_STALE_TEMPLATE_MESSAGE.en
    : staleFromOpportunity
      ? isAr
        ? PARENT_CONSENT_STALE_TEMPLATE_MESSAGE.ar
        : PARENT_CONSENT_STALE_TEMPLATE_MESSAGE.en
      : null;

  return (
    <SectionCard>
      <h2 className="mb-2 text-base font-bold text-foreground">
        {isAr ? PARENT_CONSENT_DEFAULT_TITLE.ar : PARENT_CONSENT_DEFAULT_TITLE.en}
      </h2>
      <p className="mb-4 text-sm text-text-light">
        {requirement.description ||
          (isAr ? PARENT_CONSENT_DEFAULT_DESCRIPTION.ar : PARENT_CONSENT_DEFAULT_DESCRIPTION.en)}
      </p>

      <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
        <p className="font-semibold">{isAr ? "خطوات إكمال الموافقة:" : "Steps to complete consent:"}</p>
        <ol className="mt-2 list-decimal space-y-1 ps-5 text-text-light">
          <li>{isAr ? "حمّل النموذج الرسمي من النظام." : "Download the official form from the system."}</li>
          <li>{isAr ? "اطبع النموذج ووقّعه من ولي الأمر." : "Print the form and have your guardian sign it."}</li>
          <li>{isAr ? "أعد رفع النموذج الموقّع (PDF أو JPG أو PNG)." : "Re-upload the signed form (PDF, JPG, or PNG)."}</li>
        </ol>
      </div>

      <button
        type="button"
        disabled={downloading}
        onClick={() => void handleDownloadTemplate()}
        className="mb-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-violet-300 bg-violet-50 px-4 py-3 text-sm font-bold text-violet-900 disabled:opacity-60"
        aria-label={isAr ? "تحميل نموذج موافقة ولي الأمر" : "Download parent consent form"}
      >
        {downloading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
        {isAr ? "تحميل نموذج موافقة ولي الأمر" : "Download parent consent form"}
        {requirement.generatedTemplate?.templateVersion ? (
          <span className="text-xs font-normal opacity-80">
            {isAr ? `الإصدار ${requirement.generatedTemplate.templateVersion}` : `v${requirement.generatedTemplate.templateVersion}`}
          </span>
        ) : null}
      </button>

      {staleMessage ? (
        <p className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 whitespace-pre-wrap" role="status">
          {staleMessage}
        </p>
      ) : null}

      {isApproved ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900" role="status">
          {isAr ? "تم اعتماد موافقة ولي الأمر." : "Parent/guardian consent has been approved."}
        </p>
      ) : null}

      {verification && verification.runStatus !== "skipped" ? (
        <div
          className={`mb-4 rounded-xl border p-4 text-sm ${
            checkStatus === "needs_reupload"
              ? "border-amber-300 bg-amber-50"
              : checkStatus === "verified_pending_review"
                ? "border-emerald-300 bg-emerald-50"
                : "border-border bg-gray-50"
          }`}
          role="status"
          aria-label={isAr ? "حالة الفحص" : "Check status"}
        >
          <p className="font-bold text-foreground">
            {isAr ? "حالة الفحص:" : "Check status:"}{" "}
            {isAr ? checkLabel.ar : checkLabel.en}
          </p>
          {verification.verificationSummary ? (
            <pre className="mt-2 whitespace-pre-wrap font-sans text-xs text-text-light">{verification.verificationSummary}</pre>
          ) : (
            <p className="mt-2 text-xs text-text-light">{isAr ? verification.summaryAr : verification.summaryEn}</p>
          )}
          {checkStatus === "verified_pending_review" ? (
            <p className="mt-2 text-xs font-semibold text-emerald-900">
              {isAr ? "بانتظار المراجعة النهائية." : "Awaiting final review."}
            </p>
          ) : null}
        </div>
      ) : isPendingReview ? (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900" role="status">
          {isAr ? "بانتظار مراجعة موافقة ولي الأمر." : "Parent/guardian consent is pending review."}
        </p>
      ) : null}

      {requirement.status === "rejected" ? (
        <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="status">
          {isAr ? "تم رفض المستند. يرجى إعادة الرفع." : "The document was rejected. Please upload again."}
        </p>
      ) : null}

      {canUpload ? (
        <div className="space-y-3">
          <p className="text-xs text-text-light">
            {isAr ? "الملفات المسموحة: PDF، JPG، PNG" : "Allowed files: PDF, JPG, PNG"}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            className="sr-only"
            aria-hidden
            onChange={(e) => void handleFilePick(e.target.files)}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary bg-primary/10 px-4 py-3 text-sm font-bold text-primary disabled:opacity-60"
            aria-label={isAr ? "رفع موافقة ولي الأمر الموقعة" : "Upload signed parent consent"}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <FileUp className="h-4 w-4" aria-hidden />}
            {isAr ? "رفع موافقة ولي الأمر الموقعة" : "Upload signed parent consent"}
          </button>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </SectionCard>
  );
};

export default StudentParentConsentPanel;
