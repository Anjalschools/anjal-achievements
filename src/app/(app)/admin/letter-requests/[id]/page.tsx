"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import { getLocale } from "@/lib/i18n";
import { useAppSession } from "@/contexts/AppSessionContext";
import { roleHasCapability } from "@/lib/app-role-scope-matrix";
import {
  ALLOWED_INFERRED_FIELD_VALUES,
  INFERRED_FIELD_UI_LABELS,
} from "@/lib/achievement-inferred-field-allowlist";
import type { LetterRequestedAuthorRole, LetterRequestLanguage, LetterRequestType } from "@/lib/letter-request-types";
import type { LetterRequestStatus } from "@/lib/letter-request-types";
import { Eye, Loader2, Sparkles } from "lucide-react";

const pickLetterApiErrorMessage = (j: Record<string, unknown>, isAr: boolean): string => {
  const ar = typeof j.error === "string" ? j.error.trim() : "";
  const en = typeof j.errorEn === "string" ? j.errorEn.trim() : "";
  if (isAr) return ar || en || "تعذّر إكمال العملية";
  return en || ar || "Request failed";
};

type Item = {
  _id: string;
  status: LetterRequestStatus;
  requestType: LetterRequestType;
  language: LetterRequestLanguage;
  targetOrganization: string;
  requestBody: string;
  requestedAuthorRole: LetterRequestedAuthorRole;
  requestedSpecialization?: string;
  aiDraftText?: string;
  finalApprovedText?: string;
  rejectReason?: string;
  revisionNote?: string;
  verifyUrl?: string;
  studentSnapshot?: Record<string, unknown>;
  studentUser?: { fullName?: string; email?: string; studentId?: string } | null;
};

const specKeys = [...ALLOWED_INFERRED_FIELD_VALUES].filter((k) => k !== "other").sort();

const AdminLetterRequestDetailPage = () => {
  const params = useParams<{ id: string }>();
  const locale = getLocale();
  const isAr = locale === "ar";
  const { profile } = useAppSession();
  const canWorkflow = roleHasCapability(profile?.role, "approveRejectWorkflow");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  /** Mirrors `isAiAssistEnabled()` on the server (same as certificate AI). */
  const [aiAssistEnabled, setAiAssistEnabled] = useState(true);
  const [aiDraftActionError, setAiDraftActionError] = useState<string | null>(null);

  const [targetOrganization, setTargetOrganization] = useState("");
  const [requestBody, setRequestBody] = useState("");
  const [requestType, setRequestType] = useState<LetterRequestType>("testimonial");
  const [language, setLanguage] = useState<LetterRequestLanguage>("ar");
  const [requestedAuthorRole, setRequestedAuthorRole] = useState<LetterRequestedAuthorRole>("school_administration");
  const [requestedSpecialization, setRequestedSpecialization] = useState("");
  const [aiDraftText, setAiDraftText] = useState("");
  const [finalApprovedText, setFinalApprovedText] = useState("");

  const load = useCallback(async () => {
    if (!params?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/letter-requests/${params.id}`, { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Failed");
      setAiAssistEnabled(typeof j.aiAssistEnabled === "boolean" ? j.aiAssistEnabled : true);
      setAiDraftActionError(null);
      const it = j.item as Item;
      setItem({ ...it, studentUser: (j.studentUser as Item["studentUser"]) ?? it.studentUser });
      setTargetOrganization(it.targetOrganization);
      setRequestBody(it.requestBody);
      setRequestType(it.requestType);
      setLanguage(it.language);
      setRequestedAuthorRole(it.requestedAuthorRole);
      setRequestedSpecialization(it.requestedSpecialization || "");
      setAiDraftText(it.aiDraftText || "");
      setFinalApprovedText(it.finalApprovedText || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [params?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const showSpec = requestedAuthorRole === "teacher" || requestedAuthorRole === "supervisor";

  const handleSave = async () => {
    if (!params?.id) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/letter-requests/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetOrganization: targetOrganization.trim(),
          requestBody: requestBody.trim(),
          requestType,
          language,
          requestedAuthorRole,
          requestedSpecialization: showSpec ? requestedSpecialization : "",
          aiDraftText,
          finalApprovedText,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Failed");
      setItem((prev) => ({ ...(j.item as Item), studentUser: prev?.studentUser ?? (j.item as Item).studentUser }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const handleAi = async (action: "generate" | "regenerate" | "refine") => {
    if (!params?.id) return;
    if (!aiAssistEnabled) {
      setAiDraftActionError(
        isAr
          ? "المساعدة الذكية غير متاحة في بيئة الخادم. يمكنك متابعة الكتابة والحفظ يدوياً."
          : "AI assist is not available on the server. You can still edit and save manually."
      );
      return;
    }
    setAiBusy(true);
    setAiDraftActionError(null);
    try {
      const res = await fetch(`/api/admin/letter-requests/${params.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok || j.ok === false) {
        throw new Error(pickLetterApiErrorMessage(j, isAr));
      }
      const it = j.item as Item;
      setItem((prev) => ({ ...it, studentUser: prev?.studentUser ?? it.studentUser }));
      setAiDraftText(it.aiDraftText || "");
    } catch (e) {
      setAiDraftActionError(e instanceof Error ? e.message : isAr ? "تعذّر تنفيذ الطلب" : "Request failed");
    } finally {
      setAiBusy(false);
    }
  };

  const handleApprove = async () => {
    if (!params?.id || !canWorkflow) return;
    const text = finalApprovedText.trim();
    if (text.length < 20) {
      setError(isAr ? "أدخل نصاً نهائياً كافياً" : "Enter sufficient final text");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/letter-requests/${params.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finalApprovedText: text }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Failed");
      const approved = j.item as Item;
      setItem((prev) => ({ ...approved, studentUser: prev?.studentUser ?? approved.studentUser }));
      setFinalApprovedText(approved.finalApprovedText || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!params?.id || !canWorkflow) return;
    const reason = window.prompt(isAr ? "سبب الرفض" : "Rejection reason");
    if (!reason || reason.trim().length < 3) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/letter-requests/${params.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Failed");
      const rejected = j.item as Item;
      setItem((prev) => ({ ...rejected, studentUser: prev?.studentUser ?? rejected.studentUser }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const handleRevision = async () => {
    if (!params?.id || !canWorkflow) return;
    const note = window.prompt(isAr ? "ملاحظات للطالب" : "Note for student");
    if (!note || note.trim().length < 3) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/letter-requests/${params.id}/request-revision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Failed");
      const rev = j.item as Item;
      setItem((prev) => ({ ...rev, studentUser: prev?.studentUser ?? rev.studentUser }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <p className="py-12 text-center text-text-light">{isAr ? "جاري التحميل…" : "Loading…"}</p>
      </PageContainer>
    );
  }

  if (error && !item) {
    return (
      <PageContainer>
        <p className="py-8 text-center text-red-600">{error}</p>
        <Link href="/admin/letter-requests" className="block text-center text-primary">
          {isAr ? "العودة" : "Back"}
        </Link>
      </PageContainer>
    );
  }

  if (!item) return null;

  const snap = item.studentSnapshot || {};
  const stuName =
    (typeof snap.fullNameAr === "string" && snap.fullNameAr) ||
    (typeof snap.fullNameEn === "string" && snap.fullNameEn) ||
    (typeof snap.fullName === "string" && snap.fullName) ||
    item.studentUser?.fullName ||
    "—";

  return (
    <PageContainer>
      <PageHeader
        title={isAr ? "مراجعة الطلب" : "Review request"}
        subtitle={`${stuName} · ${item.status}`}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/admin/letter-requests" className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700">
          {isAr ? "القائمة" : "List"}
        </Link>
        <Link
          href={`/admin/letter-requests/${item._id}/preview`}
          className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-200"
        >
          <Eye className="h-4 w-4" />
          {isAr ? "معاينة" : "Preview"}
        </Link>
      </div>

      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

      <SectionCard className="mb-4">
        <h3 className="mb-2 text-sm font-bold text-slate-900">{isAr ? "بيانات الطالب" : "Student"}</h3>
        <p className="text-sm text-slate-800">{stuName}</p>
        {item.studentUser?.studentId ? (
          <p className="text-xs text-slate-500">{item.studentUser.studentId}</p>
        ) : typeof snap.studentId === "string" ? (
          <p className="text-xs text-slate-500">{snap.studentId}</p>
        ) : null}
      </SectionCard>

      <SectionCard className="mb-4">
        <h3 className="mb-3 text-sm font-bold text-slate-900">{isAr ? "حقول الطلب" : "Request fields"}</h3>
        <div className={`grid gap-3 sm:grid-cols-2 ${isAr ? "text-right" : "text-left"}`}>
          <div>
            <label className="mb-1 block text-xs font-semibold">{isAr ? "النوع" : "Type"}</label>
            <select
              value={requestType}
              disabled={item.status === "approved"}
              onChange={(e) => setRequestType(e.target.value as LetterRequestType)}
              className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm disabled:opacity-60"
            >
              <option value="testimonial">{isAr ? "إفادة" : "Testimonial"}</option>
              <option value="recommendation">{isAr ? "توصية" : "Recommendation"}</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">{isAr ? "اللغة" : "Language"}</label>
            <select
              value={language}
              disabled={item.status === "approved"}
              onChange={(e) => setLanguage(e.target.value as LetterRequestLanguage)}
              className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm disabled:opacity-60"
            >
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
        <div className={`mt-3 ${isAr ? "text-right" : "text-left"}`}>
          <label className="mb-1 block text-xs font-semibold">{isAr ? "الجهة الموجهة" : "Target organization"}</label>
          <input
            disabled={item.status === "approved"}
            className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm disabled:opacity-60"
            value={targetOrganization}
            onChange={(e) => setTargetOrganization(e.target.value)}
          />
        </div>
        <div className={`mt-3 ${isAr ? "text-right" : "text-left"}`}>
          <label className="mb-1 block text-xs font-semibold">{isAr ? "نص الطالب المرجعي" : "Student reference text"}</label>
          <textarea
            disabled={item.status === "approved"}
            className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm disabled:opacity-60"
            rows={5}
            value={requestBody}
            onChange={(e) => setRequestBody(e.target.value)}
          />
        </div>
        <div className={`mt-3 grid gap-3 sm:grid-cols-2 ${isAr ? "text-right" : "text-left"}`}>
          <div>
            <label className="mb-1 block text-xs font-semibold">{isAr ? "المُوقِّع المطلوب" : "Requested signatory"}</label>
            <select
              disabled={item.status === "approved"}
              value={requestedAuthorRole}
              onChange={(e) => setRequestedAuthorRole(e.target.value as LetterRequestedAuthorRole)}
              className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm disabled:opacity-60"
            >
              <option value="teacher">{isAr ? "معلم" : "Teacher"}</option>
              <option value="supervisor">{isAr ? "مشرف" : "Supervisor"}</option>
              <option value="school_administration">{isAr ? "إدارة المدرسة" : "School administration"}</option>
            </select>
          </div>
          {showSpec ? (
            <div>
              <label className="mb-1 block text-xs font-semibold">{isAr ? "التخصص" : "Specialization"}</label>
              <select
                disabled={item.status === "approved"}
                value={requestedSpecialization}
                onChange={(e) => setRequestedSpecialization(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm disabled:opacity-60"
              >
                <option value="">{isAr ? "اختر…" : "Select…"}</option>
                {specKeys.map((k) => (
                  <option key={k} value={k}>
                    {INFERRED_FIELD_UI_LABELS[k]?.[isAr ? "ar" : "en"] ?? k}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard className="mb-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900">{isAr ? "مسودة الذكاء الاصطناعي" : "AI draft"}</h3>
          {item.status !== "approved" ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={aiBusy || !aiAssistEnabled}
                onClick={() => handleAi("generate")}
                className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
              >
                {aiBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {isAr ? "توليد" : "Generate"}
              </button>
              <button
                type="button"
                disabled={aiBusy || !aiAssistEnabled}
                onClick={() => handleAi("regenerate")}
                className="rounded-lg border border-violet-200 px-3 py-1.5 text-xs font-semibold text-violet-800 disabled:opacity-50"
              >
                {isAr ? "إعادة التوليد" : "Regenerate"}
              </button>
              <button
                type="button"
                disabled={aiBusy || !aiAssistEnabled}
                onClick={() => handleAi("refine")}
                className="rounded-lg border border-violet-200 px-3 py-1.5 text-xs font-semibold text-violet-800 disabled:opacity-50"
              >
                {isAr ? "تحسين الصياغة" : "Refine wording"}
              </button>
            </div>
          ) : null}
        </div>
        {!aiAssistEnabled ? (
          <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            {isAr
              ? "المساعدة الذكية غير مفعّلة على الخادم (نفس إعدادات مراجعة الشهادات). يمكنك كتابة المسودة يدوياً والحفظ والاعتماد دون التوليد الآلي."
              : "AI assist is off on the server (same settings as certificate review). You can type the draft manually, save, and approve."}
          </p>
        ) : null}
        {aiDraftActionError ? (
          <p className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{aiDraftActionError}</p>
        ) : null}
        <textarea
          disabled={item.status === "approved"}
          className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm disabled:opacity-60"
          rows={10}
          value={aiDraftText}
          onChange={(e) => setAiDraftText(e.target.value)}
        />
        {item.status !== "approved" ? (
          <button
            type="button"
            onClick={() => setFinalApprovedText(aiDraftText)}
            className="mt-2 text-xs font-semibold text-primary hover:underline"
          >
            {isAr ? "اعتماد النص الحالي في المحرر (نسخ إلى النهائي)" : "Copy into final editor"}
          </button>
        ) : null}
      </SectionCard>

      <SectionCard className="mb-4">
        <h3 className="mb-2 text-sm font-bold text-slate-900">{isAr ? "النص النهائي المعتمد" : "Final approved text"}</h3>
        <textarea
          disabled={item.status === "approved"}
          className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm disabled:opacity-60"
          rows={12}
          value={finalApprovedText}
          onChange={(e) => setFinalApprovedText(e.target.value)}
        />
        {item.verifyUrl ? (
          <p className="mt-2 text-xs text-slate-500">
            {isAr ? "رابط التحقق: " : "Verify URL: "}
            <span className="break-all font-mono" dir="ltr">
              {item.verifyUrl}
            </span>
          </p>
        ) : null}
      </SectionCard>

      <div className="mb-6 flex flex-wrap gap-2">
        {item.status !== "approved" ? (
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {isAr ? "حفظ التعديلات" : "Save changes"}
          </button>
        ) : null}
        {canWorkflow && item.status !== "approved" ? (
          <>
            <button
              type="button"
              disabled={saving}
              onClick={handleApprove}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {isAr ? "اعتماد الخطاب" : "Approve letter"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleRevision}
              className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-900 disabled:opacity-50"
            >
              {isAr ? "طلب تعديل" : "Request revision"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleReject}
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-800 disabled:opacity-50"
            >
              {isAr ? "رفض" : "Reject"}
            </button>
          </>
        ) : null}
      </div>
    </PageContainer>
  );
};

export default AdminLetterRequestDetailPage;
