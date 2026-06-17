"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import { getLocale } from "@/lib/i18n";
import { TRAINING_COMPLETION_STATUS_LABELS } from "@/lib/partnerships/training-completion-constants";
import {
  attachmentDisplayUrl,
  uploadTrainingReportFile,
  type UploadedTrainingAttachment,
} from "@/lib/partnerships/training-completion-upload";
import SurveyRatingControl from "@/components/survey/SurveyRatingControl";
import { FileText, Loader2, Paperclip, Save, Send, Video } from "lucide-react";

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
  numberOfTrainees: string;
  assignedTasks: string;
  studentReflection: string;
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
  studentBenefitRating: "",
  numberOfTrainees: "",
  assignedTasks: "",
  studentReflection: "",
  videoUrl: "",
});

const toInputDate = (value: string | null) => (value ? value.slice(0, 10) : "");

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
  const [reviewNotes, setReviewNotes] = useState("");
  const [form, setForm] = useState<ReportForm>(emptyForm());
  const [attachments, setAttachments] = useState<AttachmentRow[]>([]);
  const [pendingUploads, setPendingUploads] = useState<UploadedTrainingAttachment[]>([]);

  const editable = useMemo(() => ["pending", "rejected"].includes(status), [status]);

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
      setReviewNotes(String(item.reviewNotes || ""));
      setForm({
        organizationName: String(item.organizationName || ""),
        supervisorName: String(item.supervisorName || ""),
        supervisorPhone: String(item.supervisorPhone || ""),
        trainingStartDate: toInputDate(item.trainingStartDate as string | null),
        trainingEndDate: toInputDate(item.trainingEndDate as string | null),
        volunteerHours: item.volunteerHours != null ? String(item.volunteerHours) : "",
        hasAllowance: item.hasAllowance === true,
        studentBenefitRating:
          item.studentBenefitRating != null ? String(item.studentBenefitRating) : "",
        numberOfTrainees: item.numberOfTrainees != null ? String(item.numberOfTrainees) : "",
        assignedTasks: String(item.assignedTasks || ""),
        studentReflection: String(item.studentReflection || ""),
        videoUrl: String(item.videoUrl || ""),
      });
      setAttachments(Array.isArray(item.attachments) ? (item.attachments as AttachmentRow[]) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const buildPayload = (submit: boolean) => ({
    applicationId,
    submit,
    organizationName: form.organizationName,
    supervisorName: form.supervisorName,
    supervisorPhone: form.supervisorPhone,
    trainingStartDate: form.trainingStartDate || undefined,
    trainingEndDate: form.trainingEndDate || undefined,
    volunteerHours: form.volunteerHours ? Number(form.volunteerHours) : undefined,
    hasAllowance: form.hasAllowance,
    studentBenefitRating: form.studentBenefitRating ? Number(form.studentBenefitRating) : undefined,
    numberOfTrainees: form.numberOfTrainees ? Number(form.numberOfTrainees) : undefined,
    assignedTasks: form.assignedTasks,
    studentReflection: form.studentReflection,
    videoUrl: form.videoUrl || undefined,
    attachments: pendingUploads,
  });

  const handleSave = async (submit: boolean) => {
    if (!applicationId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/partnerships/final-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(submit)),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setPendingUploads([]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
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
        {reviewNotes ? (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-800">
            {reviewNotes}
          </span>
        ) : null}
      </div>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      <div className="space-y-4">
        <SectionCard>
          <h2 className="mb-4 text-lg font-black text-slate-900">
            {isAr ? "١ — بيانات التدريب" : "1 — Training details"}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={form.organizationName}
              onChange={(e) => setForm((p) => ({ ...p, organizationName: e.target.value }))}
              disabled={!editable}
              placeholder={isAr ? "اسم المؤسسة" : "Organization name"}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
            />
            <input
              value={form.supervisorName}
              onChange={(e) => setForm((p) => ({ ...p, supervisorName: e.target.value }))}
              disabled={!editable}
              placeholder={isAr ? "اسم المشرف" : "Supervisor name"}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
            />
            <input
              value={form.supervisorPhone}
              onChange={(e) => setForm((p) => ({ ...p, supervisorPhone: e.target.value }))}
              disabled={!editable}
              placeholder={isAr ? "هاتف المشرف" : "Supervisor phone"}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
            />
            <input
              type="date"
              value={form.trainingStartDate}
              onChange={(e) => setForm((p) => ({ ...p, trainingStartDate: e.target.value }))}
              disabled={!editable}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
              aria-label={isAr ? "تاريخ البداية" : "Start date"}
            />
            <input
              type="date"
              value={form.trainingEndDate}
              onChange={(e) => setForm((p) => ({ ...p, trainingEndDate: e.target.value }))}
              disabled={!editable}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
              aria-label={isAr ? "تاريخ النهاية" : "End date"}
            />
            <input
              type="number"
              min={0}
              value={form.volunteerHours}
              onChange={(e) => setForm((p) => ({ ...p, volunteerHours: e.target.value }))}
              disabled={!editable}
              placeholder={isAr ? "ساعات التطوع" : "Volunteer hours"}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
            />
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={form.hasAllowance}
                onChange={(e) => setForm((p) => ({ ...p, hasAllowance: e.target.checked }))}
                disabled={!editable}
              />
              {isAr ? "يوجد بدل مالي" : "Has allowance"}
            </label>
          </div>
        </SectionCard>

        <SectionCard>
          <h2 className="mb-4 text-lg font-black text-slate-900">
            {isAr ? "٢ — تقييمي للتجربة التدريبية" : "2 — My training experience"}
          </h2>
          <SurveyRatingControl
            label={isAr ? "مدى استفادتي من التدريب" : "My training benefit"}
            value={form.studentBenefitRating ? Number(form.studentBenefitRating) : 3}
            onChange={(v) => setForm((p) => ({ ...p, studentBenefitRating: String(v) }))}
            isAr={isAr}
            labelSet="student"
            disabled={!editable}
          />
        </SectionCard>

        <SectionCard>
          <h2 className="mb-4 text-lg font-black text-slate-900">
            {isAr ? "٣ — المهام والاستفادة" : "3 — Tasks & benefit"}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="number"
              min={0}
              value={form.numberOfTrainees}
              onChange={(e) => setForm((p) => ({ ...p, numberOfTrainees: e.target.value }))}
              disabled={!editable}
              placeholder={isAr ? "عدد المتدربين في المؤسسة" : "Number of trainees"}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
            />
          </div>
          <textarea
            value={form.assignedTasks}
            onChange={(e) => setForm((p) => ({ ...p, assignedTasks: e.target.value }))}
            disabled={!editable}
            rows={4}
            placeholder={isAr ? "المهام الموكلة إلي" : "Assigned tasks"}
            className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
          />
          <textarea
            value={form.studentReflection}
            onChange={(e) => setForm((p) => ({ ...p, studentReflection: e.target.value }))}
            disabled={!editable}
            rows={4}
            placeholder={isAr ? "أهم ما تعلمته من التدريب" : "What I learned most"}
            className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
          />
        </SectionCard>

        <SectionCard>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-slate-900">
            <Paperclip className="h-5 w-5" aria-hidden />
            {isAr ? "٤ — المرفقات" : "4 — Attachments"}
          </h2>
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
            {isAr ? "٥ — رابط الفيديو" : "5 — Video link"}
          </h2>
          <input
            value={form.videoUrl}
            onChange={(e) => setForm((p) => ({ ...p, videoUrl: e.target.value }))}
            disabled={!editable}
            placeholder="YouTube / Vimeo / Drive / OneDrive"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
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
