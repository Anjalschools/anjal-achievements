"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import SurveyRatingControl from "@/components/survey/SurveyRatingControl";
import { getLocale } from "@/lib/i18n";
import { TRAINING_COMPLETION_STATUS_LABELS } from "@/lib/partnerships/training-completion-constants";
import { INSTITUTION_REPORT_UPLOAD_ACCEPT } from "@/lib/partnerships/institution-final-report-constants";
import {
  attachmentDisplayUrl,
  uploadInstitutionReportFile,
  uploadTrainingReportFile,
  type UploadedTrainingAttachment,
} from "@/lib/partnerships/training-completion-upload";
import StudentRevisionBanner from "@/components/partnerships/StudentRevisionBanner";
import { Download, FileText, Loader2, Paperclip, Save, Send, Upload, Video } from "lucide-react";

type AttachmentRow = {
  id: string;
  type: string;
  fileName: string;
  storageKey: string;
};

type ReportForm = {
  organizationName: string;
  supervisorName: string;
  supervisorPhone: string;
  trainingStartDate: string;
  trainingEndDate: string;
  volunteerHours: string;
  hasAllowance: boolean;
  studentBenefitRating: string;
  positionTitle: string;
  numberOfTrainees: string;
  assignedTasks: string;
  studentReflection: string;
  supervisorCooperationRating: string;
  practicalBenefitRating: string;
  workEnvironmentRating: string;
  recommendInstitutionToPeers: "" | "yes" | "no";
  biggestChallenge: string;
  challengeResponse: string;
  wishedToLearn: string;
  futureImpact: string;
  videoUrl: string;
};

const emptyForm = (): ReportForm => ({
  organizationName: "",
  supervisorName: "",
  supervisorPhone: "",
  trainingStartDate: "",
  trainingEndDate: "",
  volunteerHours: "",
  hasAllowance: false,
  studentBenefitRating: "5",
  positionTitle: "",
  numberOfTrainees: "",
  assignedTasks: "",
  studentReflection: "",
  supervisorCooperationRating: "",
  practicalBenefitRating: "",
  workEnvironmentRating: "",
  recommendInstitutionToPeers: "",
  biggestChallenge: "",
  challengeResponse: "",
  wishedToLearn: "",
  futureImpact: "",
  videoUrl: "",
});

const toInputDate = (value: string | null) => (value ? value.slice(0, 10) : "");

const fieldLabelClass = "mb-1 block text-xs font-bold text-slate-600";
const inputClass =
  "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-700";

const SummerTrainingFinalReportPage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eligible, setEligible] = useState(false);
  const [applicationId, setApplicationId] = useState("");
  const [opportunityTitle, setOpportunityTitle] = useState("");
  const [status, setStatus] = useState("pending");
  const [revisionReason, setRevisionReason] = useState("");
  const [revisionRequestedAt, setRevisionRequestedAt] = useState<string | null>(null);
  const [revisionReviewerName, setRevisionReviewerName] = useState<string | null>(null);
  const [uploadSectionHighlight, setUploadSectionHighlight] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [form, setForm] = useState<ReportForm>(emptyForm());
  const [attachments, setAttachments] = useState<AttachmentRow[]>([]);
  const [pendingUploads, setPendingUploads] = useState<UploadedTrainingAttachment[]>([]);
  const [institutionReportFileKey, setInstitutionReportFileKey] = useState("");
  const [institutionReportFileName, setInstitutionReportFileName] = useState("");
  const [institutionReportExtraction, setInstitutionReportExtraction] = useState<Record<string, unknown> | null>(
    null
  );
  const [pendingInstitutionReport, setPendingInstitutionReport] = useState<UploadedTrainingAttachment | null>(null);
  const [uploadingInstitutionReport, setUploadingInstitutionReport] = useState(false);
  const [exportingTemplate, setExportingTemplate] = useState(false);

  const editable = useMemo(() => ["pending", "rejected", "needs_revision"].includes(status), [status]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/partnerships/final-reports?scope=student", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setEligible(Boolean(json.eligible));
      if (!json.eligible || !json.item) return;
      const item = json.item as Record<string, unknown>;
      setApplicationId(String(item.applicationId || ""));
      setOpportunityTitle(String(json.application?.opportunityTitle || ""));
      setStatus(String(item.status || "pending"));
      setRevisionReason(String(item.revisionReason || ""));
      setRevisionRequestedAt(
        item.revisionRequestedAt ? String(item.revisionRequestedAt) : null
      );
      const revisionAudit = Array.isArray(item.revisionAudit)
        ? (item.revisionAudit as Array<{ action?: string; actorName?: string | null }>)
        : [];
      const latestRevision = [...revisionAudit]
        .reverse()
        .find((entry) => entry.action === "request_changes");
      setRevisionReviewerName(latestRevision?.actorName ? String(latestRevision.actorName) : null);
      setReviewNotes(String(item.revisionReason || item.reviewNotes || ""));
      const recommend =
        item.recommendInstitutionToPeers === true
          ? "yes"
          : item.recommendInstitutionToPeers === false
            ? "no"
            : "";
      setForm({
        organizationName: String(item.organizationLabel || item.organizationName || ""),
        supervisorName: String(item.supervisorName || ""),
        supervisorPhone: String(item.supervisorPhone || ""),
        trainingStartDate: toInputDate(item.trainingStartDate as string | null),
        trainingEndDate: toInputDate(item.trainingEndDate as string | null),
        volunteerHours: item.volunteerHours != null ? String(item.volunteerHours) : "",
        hasAllowance: item.hasAllowance === true,
        studentBenefitRating:
          item.studentBenefitRating != null ? String(item.studentBenefitRating) : "5",
        positionTitle: String(item.positionTitle || ""),
        numberOfTrainees: item.numberOfTrainees != null ? String(item.numberOfTrainees) : "",
        assignedTasks: String(item.assignedTasks || ""),
        studentReflection: String(item.studentReflection || ""),
        supervisorCooperationRating:
          item.supervisorCooperationRating != null ? String(item.supervisorCooperationRating) : "",
        practicalBenefitRating:
          item.practicalBenefitRating != null ? String(item.practicalBenefitRating) : "",
        workEnvironmentRating:
          item.workEnvironmentRating != null ? String(item.workEnvironmentRating) : "",
        recommendInstitutionToPeers: recommend,
        biggestChallenge: String(item.biggestChallenge || ""),
        challengeResponse: String(item.challengeResponse || ""),
        wishedToLearn: String(item.wishedToLearn || ""),
        futureImpact: String(item.futureImpact || ""),
        videoUrl: String(item.videoUrl || ""),
      });
      setAttachments(Array.isArray(item.attachments) ? (item.attachments as AttachmentRow[]) : []);
      setInstitutionReportFileKey(String(item.institutionReportFileKey || ""));
      setInstitutionReportFileName(String(item.institutionReportFileName || ""));
      setInstitutionReportExtraction(
        item.institutionReportExtraction && typeof item.institutionReportExtraction === "object"
          ? (item.institutionReportExtraction as Record<string, unknown>)
          : null
      );
      setPendingInstitutionReport(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const buildPayload = (submit: boolean, institutionReport?: UploadedTrainingAttachment | null) => ({
    applicationId,
    submit,
    supervisorName: form.supervisorName,
    supervisorPhone: form.supervisorPhone,
    trainingStartDate: form.trainingStartDate || undefined,
    trainingEndDate: form.trainingEndDate || undefined,
    volunteerHours: form.volunteerHours ? Number(form.volunteerHours) : undefined,
    hasAllowance: form.hasAllowance,
    studentBenefitRating: form.studentBenefitRating ? Number(form.studentBenefitRating) : undefined,
    positionTitle: form.positionTitle,
    numberOfTrainees: form.numberOfTrainees ? Number(form.numberOfTrainees) : undefined,
    assignedTasks: form.assignedTasks,
    studentReflection: form.studentReflection,
    supervisorCooperationRating: form.supervisorCooperationRating
      ? Number(form.supervisorCooperationRating)
      : undefined,
    practicalBenefitRating: form.practicalBenefitRating
      ? Number(form.practicalBenefitRating)
      : undefined,
    workEnvironmentRating: form.workEnvironmentRating
      ? Number(form.workEnvironmentRating)
      : undefined,
    recommendInstitutionToPeers:
      form.recommendInstitutionToPeers === "yes"
        ? true
        : form.recommendInstitutionToPeers === "no"
          ? false
          : undefined,
    biggestChallenge: form.biggestChallenge,
    challengeResponse: form.challengeResponse,
    wishedToLearn: form.wishedToLearn,
    futureImpact: form.futureImpact,
    videoUrl: form.videoUrl || undefined,
    attachments: pendingUploads,
    institutionReport: institutionReport
      ? {
          fileName: institutionReport.fileName,
          storageKey: institutionReport.storageKey,
          mimeType: institutionReport.mimeType,
        }
      : undefined,
  });

  const handleSave = async (submit: boolean, institutionReport?: UploadedTrainingAttachment | null) => {
    if (!applicationId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/partnerships/final-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(submit, institutionReport)),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setPendingUploads([]);
      setPendingInstitutionReport(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const handleExportInstitutionTemplate = async () => {
    if (!applicationId) return;
    setExportingTemplate(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/partnerships/final-reports/institution-template?applicationId=${encodeURIComponent(applicationId)}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(typeof json.error === "string" ? json.error : "Failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = isAr ? "قالب-التقرير-النهائي-للمؤسسة.pdf" : "institution-final-report-template.pdf";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setExportingTemplate(false);
    }
  };

  const handleInstitutionReportPick = async (files: FileList | null) => {
    if (!files?.length || !editable || !applicationId) return;
    setUploadingInstitutionReport(true);
    setError(null);
    try {
      const uploaded = await uploadInstitutionReportFile(files[0]);
      setPendingInstitutionReport(uploaded);
      await handleSave(false, uploaded);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload error");
    } finally {
      setUploadingInstitutionReport(false);
    }
  };

  const handleFilePick = async (files: FileList | null) => {
    if (!files?.length || !editable) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded: UploadedTrainingAttachment[] = [];
      for (const file of Array.from(files)) {
        uploaded.push(await uploadTrainingReportFile(file));
      }
      setPendingUploads((prev) => [...prev, ...uploaded]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload error");
    } finally {
      setUploading(false);
    }
  };

  const handleScrollToResubmit = () => {
    const target = document.getElementById("institution-report-upload");
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    setUploadSectionHighlight(true);
    window.setTimeout(() => setUploadSectionHighlight(false), 2400);
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
        </div>
      </PageContainer>
    );
  }

  if (!eligible) {
    return (
      <PageContainer>
        <PageHeader
          title={isAr ? "التقرير النهائي للتدريب" : "Final training report"}
          subtitle={
            isAr
              ? "متاح فقط للطلاب المقبولين أو المكملين للتدريب."
              : "Available only for accepted or completed training applicants."
          }
        />
        <SectionCard>
          <p className="py-8 text-center text-slate-600">
            {isAr ? "لا يوجد طلب مقبول حالياً." : "No accepted application found."}
          </p>
          <div className="text-center">
            <Link href="/summer-training" className="text-sm font-bold text-primary underline">
              {isAr ? "العودة للتدريب الصيفي" : "Back to summer training"}
            </Link>
          </div>
        </SectionCard>
      </PageContainer>
    );
  }

  const statusLabel =
    TRAINING_COMPLETION_STATUS_LABELS[status as keyof typeof TRAINING_COMPLETION_STATUS_LABELS]?.[
      isAr ? "ar" : "en"
    ] || status;

  return (
    <PageContainer>
      <PageHeader
        title={isAr ? "التقرير النهائي للتدريب" : "Final training report"}
        subtitle={opportunityTitle}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
          {isAr ? "الحالة:" : "Status:"} {statusLabel}
        </span>
      </div>

      {status === "needs_revision" && revisionReason ? (
        <StudentRevisionBanner
          revisionReason={revisionReason}
          revisionRequestedAt={revisionRequestedAt}
          reviewerName={revisionReviewerName}
          locale={locale}
        />
      ) : null}

      {status === "needs_revision" ? (
        <div className="mb-4">
          <button
            type="button"
            onClick={handleScrollToResubmit}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white shadow-sm hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:w-auto"
            aria-label={isAr ? "إعادة إرسال التقرير" : "Resubmit report"}
          >
            <Upload className="h-4 w-4" aria-hidden />
            {isAr ? "إعادة إرسال التقرير" : "Resubmit report"}
          </button>
        </div>
      ) : null}

      {reviewNotes && status !== "needs_revision" ? (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-bold">
            {status === "resubmitted"
              ? isAr
                ? "ملاحظات المشرف — يرجى التعديل وإعادة الإرسال"
                : "Supervisor notes — please revise and resubmit"
              : isAr
                ? "ملاحظات المراجعة"
                : "Review notes"}
          </p>
          <p className="mt-1">{reviewNotes}</p>
        </div>
      ) : null}

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      <div className="space-y-4">
        <SectionCard>
          <h2 className="mb-4 text-lg font-black text-slate-900">
            {isAr ? "١ — معلومات التدريب" : "1 — Training information"}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={fieldLabelClass}>{isAr ? "اسم المؤسسة" : "Institution name"}</label>
              <input
                value={form.organizationName}
                readOnly
                disabled
                className={`${inputClass} bg-slate-50 font-semibold`}
                aria-readonly="true"
              />
            </div>
            <div>
              <label className={fieldLabelClass}>{isAr ? "اسم المشرف" : "Supervisor name"}</label>
              <input
                value={form.supervisorName}
                onChange={(e) => setForm((p) => ({ ...p, supervisorName: e.target.value }))}
                disabled={!editable}
                className={inputClass}
              />
            </div>
            <div>
              <label className={fieldLabelClass}>{isAr ? "هاتف المشرف" : "Supervisor phone"}</label>
              <input
                value={form.supervisorPhone}
                onChange={(e) => setForm((p) => ({ ...p, supervisorPhone: e.target.value }))}
                disabled={!editable}
                className={inputClass}
              />
            </div>
            <div>
              <label className={fieldLabelClass}>
                {isAr ? "تاريخ بداية التدريب" : "Training start date"}
              </label>
              <input
                type="date"
                value={form.trainingStartDate}
                onChange={(e) => setForm((p) => ({ ...p, trainingStartDate: e.target.value }))}
                disabled={!editable}
                className={inputClass}
              />
            </div>
            <div>
              <label className={fieldLabelClass}>
                {isAr ? "تاريخ نهاية التدريب" : "Training end date"}
              </label>
              <input
                type="date"
                value={form.trainingEndDate}
                onChange={(e) => setForm((p) => ({ ...p, trainingEndDate: e.target.value }))}
                disabled={!editable}
                className={inputClass}
              />
            </div>
            <div>
              <label className={fieldLabelClass}>
                {isAr ? "إجمالي ساعات التدريب" : "Total training hours"}
              </label>
              <input
                type="number"
                min={1}
                value={form.volunteerHours}
                onChange={(e) => setForm((p) => ({ ...p, volunteerHours: e.target.value }))}
                disabled={!editable}
                className={inputClass}
              />
            </div>
            <label className="flex items-center gap-2 self-end text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={form.hasAllowance}
                onChange={(e) => setForm((p) => ({ ...p, hasAllowance: e.target.checked }))}
                disabled={!editable}
              />
              {isAr ? "يوجد بدل مالي" : "Has financial allowance"}
            </label>
          </div>
        </SectionCard>

        <SectionCard>
          <h2 className="mb-4 text-lg font-black text-slate-900">
            {isAr ? "٢ — تقييم التدريب" : "2 — Training evaluation"}
          </h2>
          <SurveyRatingControl
            label={isAr ? "مدى استفادتي من التدريب" : "My training benefit"}
            value={form.studentBenefitRating ? Number(form.studentBenefitRating) : 5}
            onChange={(v) => setForm((p) => ({ ...p, studentBenefitRating: String(v) }))}
            isAr={isAr}
            labelSet="student"
            disabled={!editable}
          />
        </SectionCard>

        <SectionCard>
          <h2 className="mb-4 text-lg font-black text-slate-900">
            {isAr ? "٣ — المنصب والمهام ومخرجات التعلم" : "3 — Position, tasks & outcomes"}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={fieldLabelClass}>
                {isAr
                  ? "المسمى الوظيفي أو المنصب أثناء التدريب"
                  : "Position title during training"}
              </label>
              <input
                value={form.positionTitle}
                onChange={(e) => setForm((p) => ({ ...p, positionTitle: e.target.value }))}
                disabled={!editable}
                className={inputClass}
              />
            </div>
            <div>
              <label className={fieldLabelClass}>
                {isAr ? "عدد زملاء التدريب معك" : "Number of fellow trainees"}
              </label>
              <input
                type="number"
                min={0}
                value={form.numberOfTrainees}
                onChange={(e) => setForm((p) => ({ ...p, numberOfTrainees: e.target.value }))}
                disabled={!editable}
                className={inputClass}
              />
            </div>
          </div>
          <div className="mt-3">
            <label className={fieldLabelClass}>{isAr ? "المهام الموكلة إلي" : "Assigned tasks"}</label>
            <textarea
              value={form.assignedTasks}
              onChange={(e) => setForm((p) => ({ ...p, assignedTasks: e.target.value }))}
              disabled={!editable}
              rows={4}
              className={inputClass}
            />
          </div>
          <div className="mt-3">
            <label className={fieldLabelClass}>
              {isAr ? "أهم ما تعلمته من التدريب" : "Key learning outcomes"}
            </label>
            <textarea
              value={form.studentReflection}
              onChange={(e) => setForm((p) => ({ ...p, studentReflection: e.target.value }))}
              disabled={!editable}
              rows={4}
              className={inputClass}
            />
          </div>
        </SectionCard>

        <SectionCard>
          <h2 className="mb-4 text-lg font-black text-slate-900">
            {isAr ? "٤ — تقييم جهة التدريب" : "4 — Training organization evaluation"}
          </h2>
          <div className="space-y-4">
            <SurveyRatingControl
              label={isAr ? "مدى تعاون المشرف المباشر" : "Supervisor cooperation"}
              value={form.supervisorCooperationRating ? Number(form.supervisorCooperationRating) : 0}
              onChange={(v) => setForm((p) => ({ ...p, supervisorCooperationRating: String(v) }))}
              isAr={isAr}
              labelSet="student"
              disabled={!editable}
            />
            <SurveyRatingControl
              label={isAr ? "مدى الاستفادة العملية" : "Practical benefit"}
              value={form.practicalBenefitRating ? Number(form.practicalBenefitRating) : 0}
              onChange={(v) => setForm((p) => ({ ...p, practicalBenefitRating: String(v) }))}
              isAr={isAr}
              labelSet="student"
              disabled={!editable}
            />
            <SurveyRatingControl
              label={isAr ? "جودة بيئة العمل" : "Work environment quality"}
              value={form.workEnvironmentRating ? Number(form.workEnvironmentRating) : 0}
              onChange={(v) => setForm((p) => ({ ...p, workEnvironmentRating: String(v) }))}
              isAr={isAr}
              labelSet="student"
              disabled={!editable}
            />
            <fieldset className="space-y-2" disabled={!editable}>
              <legend className="text-sm font-semibold text-foreground">
                {isAr ? "هل توصي زملاءك بهذه الجهة؟" : "Would you recommend this organization to peers?"}
              </legend>
              <div className="flex flex-wrap gap-4">
                <label className="inline-flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="radio"
                    name="recommendInstitutionToPeers"
                    checked={form.recommendInstitutionToPeers === "yes"}
                    onChange={() => setForm((p) => ({ ...p, recommendInstitutionToPeers: "yes" }))}
                  />
                  {isAr ? "نعم" : "Yes"}
                </label>
                <label className="inline-flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="radio"
                    name="recommendInstitutionToPeers"
                    checked={form.recommendInstitutionToPeers === "no"}
                    onChange={() => setForm((p) => ({ ...p, recommendInstitutionToPeers: "no" }))}
                  />
                  {isAr ? "لا" : "No"}
                </label>
              </div>
            </fieldset>
          </div>
        </SectionCard>

        <SectionCard>
          <h2 className="mb-4 text-lg font-black text-slate-900">
            {isAr ? "٥ — التأمل والنمو الشخصي" : "5 — Reflection & personal growth"}
          </h2>
          <div className="space-y-3">
            {[
              {
                key: "biggestChallenge" as const,
                labelAr: "ما أكبر تحدٍ واجهته؟",
                labelEn: "What was your biggest challenge?",
              },
              {
                key: "challengeResponse" as const,
                labelAr: "كيف تعاملت مع هذا التحدي؟",
                labelEn: "How did you handle this challenge?",
              },
              {
                key: "wishedToLearn" as const,
                labelAr: "ما الذي كنت تتمنى تعلمه ولم تتح له الفرصة؟",
                labelEn: "What did you wish you could learn but did not get the chance?",
              },
              {
                key: "futureImpact" as const,
                labelAr: "كيف سيساعدك هذا التدريب في مستقبلك الدراسي أو المهني؟",
                labelEn: "How will this training help your academic or professional future?",
              },
            ].map((row) => (
              <div key={row.key}>
                <label className={fieldLabelClass}>{isAr ? row.labelAr : row.labelEn}</label>
                <textarea
                  value={form[row.key]}
                  onChange={(e) => setForm((p) => ({ ...p, [row.key]: e.target.value }))}
                  disabled={!editable}
                  rows={3}
                  className={inputClass}
                />
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          id="institution-report-upload"
          className={`transition ${
            uploadSectionHighlight ? "ring-2 ring-orange-400 ring-offset-2" : ""
          }`}
        >
          <h2 className="mb-2 text-lg font-black text-slate-900">
            {isAr ? "تقرير المؤسسة النهائي" : "Institution final report"}
          </h2>
          <p className="mb-3 text-xs text-slate-500">
            {isAr
              ? "صدّر النموذج الرسمي للمؤسسة، ثم ارفع التقرير الموقّع والمختوم بعد إكماله."
              : "Export the official institution template, then upload the signed and stamped report when complete."}
          </p>
          <button
            type="button"
            onClick={() => void handleExportInstitutionTemplate()}
            disabled={exportingTemplate || !applicationId}
            className="mb-4 inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-bold text-primary disabled:opacity-60"
          >
            <Download className="h-4 w-4" aria-hidden />
            {exportingTemplate
              ? isAr
                ? "جاري التصدير..."
                : "Exporting..."
              : isAr
                ? "تصدير قالب التقرير النهائي للمؤسسة"
                : "Export institution final report template"}
          </button>

          <h3 className="mb-2 text-sm font-bold text-slate-800">
            {isAr ? "التقرير النهائي للمؤسسة" : "Institution final report upload"}
          </h3>
          <p className="mb-3 text-xs text-slate-500">
            {isAr ? "الصيغ المقبولة: PDF، JPG، JPEG، PNG" : "Accepted: PDF, JPG, JPEG, PNG"}
          </p>
          {editable ? (
            <label className="mb-3 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm font-bold text-primary">
              <FileText className="h-4 w-4" aria-hidden />
              {uploadingInstitutionReport
                ? isAr
                  ? "جاري الرفع والتحليل..."
                  : "Uploading & analyzing..."
                : isAr
                  ? "رفع التقرير النهائي للمؤسسة"
                  : "Upload institution final report"}
              <input
                type="file"
                accept={INSTITUTION_REPORT_UPLOAD_ACCEPT}
                className="sr-only"
                onChange={(e) => void handleInstitutionReportPick(e.target.files)}
                disabled={uploadingInstitutionReport}
              />
            </label>
          ) : null}
          <ul className="space-y-2 text-sm">
            {institutionReportFileKey ? (
              <li>
                <a
                  href={attachmentDisplayUrl(institutionReportFileKey)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  {institutionReportFileName || (isAr ? "تقرير المؤسسة" : "Institution report")}
                </a>
              </li>
            ) : null}
            {pendingInstitutionReport ? (
              <li className="text-slate-600">
                {pendingInstitutionReport.fileName} ({isAr ? "جاهز للحفظ" : "ready to save"})
              </li>
            ) : null}
          </ul>
          {institutionReportExtraction ? (
            <p className="mt-2 text-xs text-slate-500">
              {isAr ? "درجة ثقة التحليل:" : "Extraction confidence:"}{" "}
              {String(institutionReportExtraction.confidenceScore ?? "—")}%
              {Array.isArray(institutionReportExtraction.populatedFields) &&
              (institutionReportExtraction.populatedFields as string[]).length > 0
                ? ` · ${isAr ? "تم تعبئة الحقول الفارغة تلقائياً" : "Empty fields auto-filled"}`
                : ""}
            </p>
          ) : null}
        </SectionCard>

        <SectionCard>
          <h2 className="mb-2 flex items-center gap-2 text-lg font-black text-slate-900">
            <Paperclip className="h-5 w-5" aria-hidden />
            {isAr ? "٦ — المرفقات" : "6 — Attachments"}
          </h2>
          <p className="mb-3 text-xs text-slate-500">
            {isAr
              ? "ارفع شهادة التدريب أو صور الأنشطة أو ملفات الإنجاز أو أي مستندات داعمة."
              : "Upload your training certificate, activity photos, achievement files, or any supporting documents."}
          </p>
          {editable ? (
            <label className="mb-3 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm font-bold text-primary">
              <FileText className="h-4 w-4" aria-hidden />
              {uploading
                ? isAr
                  ? "جاري الرفع..."
                  : "Uploading..."
                : isAr
                  ? "رفع PDF / صور / مستندات"
                  : "Upload PDF / images / documents"}
              <input
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                className="sr-only"
                onChange={(e) => void handleFilePick(e.target.files)}
                disabled={uploading}
              />
            </label>
          ) : null}
          <ul className="space-y-2 text-sm">
            {attachments.map((row) => (
              <li key={row.id}>
                <a
                  href={attachmentDisplayUrl(row.storageKey)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  {row.fileName}
                </a>
              </li>
            ))}
            {pendingUploads.map((row, idx) => (
              <li key={`pending-${idx}`} className="text-slate-600">
                {row.fileName} ({isAr ? "جاهز للحفظ" : "ready to save"})
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-slate-900">
            <Video className="h-5 w-5" aria-hidden />
            {isAr ? "٧ — رابط عرض تجربة التدريب (اختياري)" : "7 — Training experience video (optional)"}
          </h2>
          <input
            value={form.videoUrl}
            onChange={(e) => setForm((p) => ({ ...p, videoUrl: e.target.value }))}
            disabled={!editable}
            placeholder="YouTube / Vimeo / Google Drive / OneDrive"
            className={inputClass}
          />
          <p className="mt-2 text-xs text-slate-500">
            {isAr
              ? "يُخزَّن الرابط فقط — لا يتم رفع ملف فيديو."
              : "Link only — video files are not uploaded."}
          </p>
        </SectionCard>

        {editable ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleSave(false)}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold disabled:opacity-60"
            >
              <Save className="h-4 w-4" aria-hidden />
              {saving ? (isAr ? "جاري الحفظ..." : "Saving...") : isAr ? "حفظ مسودة" : "Save draft"}
            </button>
            <button
              type="button"
              onClick={() => void handleSave(true)}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              <Send className="h-4 w-4" aria-hidden />
              {saving ? (isAr ? "جاري الإرسال..." : "Submitting...") : isAr ? "إرسال التقرير" : "Submit report"}
            </button>
          </div>
        ) : null}
      </div>
    </PageContainer>
  );
};

export default SummerTrainingFinalReportPage;
