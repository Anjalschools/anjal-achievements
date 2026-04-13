"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import { getLocale } from "@/lib/i18n";
import {
  letterRequestStatusDescriptionAr,
  letterRequestStatusDescriptionEn,
  letterRequestStatusLabelAr,
  letterRequestStatusLabelEn,
} from "@/lib/letter-request-status-ui";
import type { LetterRequestedAuthorRole, LetterRequestLanguage, LetterRequestStatus, LetterRequestType } from "@/lib/letter-request-types";
import {
  ALLOWED_INFERRED_FIELD_VALUES,
  INFERRED_FIELD_UI_LABELS,
} from "@/lib/achievement-inferred-field-allowlist";
import { ArrowLeft, ArrowRight, Copy, ExternalLink } from "lucide-react";

const specKeys = [...ALLOWED_INFERRED_FIELD_VALUES].filter((k) => k !== "other").sort();

type Item = {
  _id: string;
  requestType: LetterRequestType;
  language: LetterRequestLanguage;
  targetOrganization: string;
  requestBody: string;
  requestedAuthorRole: LetterRequestedAuthorRole;
  requestedSpecialization?: string;
  status: LetterRequestStatus;
  finalApprovedText?: string;
  rejectReason?: string;
  revisionNote?: string;
  verifyUrl?: string;
  verificationPath?: string;
  approvedAt?: string;
  createdAt: string;
};

const LetterRequestDetailPage = () => {
  const params = useParams<{ id: string }>();
  const locale = getLocale();
  const isAr = locale === "ar";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [editing, setEditing] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [targetOrganization, setTargetOrganization] = useState("");
  const [requestBody, setRequestBody] = useState("");
  const [requestType, setRequestType] = useState<LetterRequestType>("testimonial");
  const [language, setLanguage] = useState<LetterRequestLanguage>("ar");
  const [requestedAuthorRole, setRequestedAuthorRole] = useState<LetterRequestedAuthorRole>("school_administration");
  const [requestedSpecialization, setRequestedSpecialization] = useState("");

  const load = useCallback(async () => {
    if (!params?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/letter-requests/${params.id}`, { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Failed");
      const it = j.item as Item;
      setItem(it);
      setTargetOrganization(it.targetOrganization);
      setRequestBody(it.requestBody);
      setRequestType(it.requestType);
      setLanguage(it.language);
      setRequestedAuthorRole(it.requestedAuthorRole);
      setRequestedSpecialization(it.requestedSpecialization || "");
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
  const canEdit = item?.status === "pending" || item?.status === "needs_revision";

  const specOptions = useMemo(
    () =>
      specKeys.map((k) => ({
        value: k,
        label: INFERRED_FIELD_UI_LABELS[k]?.[isAr ? "ar" : "en"] ?? k,
      })),
    [isAr]
  );

  const handleSave = async () => {
    if (!params?.id) return;
    setSaving(true);
    setSaveErr(null);
    try {
      const body: Record<string, unknown> = {
        targetOrganization: targetOrganization.trim(),
        requestBody: requestBody.trim(),
        requestType,
        language,
        requestedAuthorRole,
      };
      if (showSpec) body.requestedSpecialization = requestedSpecialization;

      const res = await fetch(`/api/letter-requests/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Failed");
      setItem(j.item as Item);
      setEditing(false);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyVerify = async () => {
    if (!item?.verifyUrl) return;
    try {
      await navigator.clipboard.writeText(item.verifyUrl);
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <p className="py-12 text-center text-text-light">{isAr ? "جاري التحميل…" : "Loading…"}</p>
      </PageContainer>
    );
  }

  if (error || !item) {
    return (
      <PageContainer>
        <p className="py-8 text-center text-red-600">{error || (isAr ? "غير موجود" : "Not found")}</p>
        <Link href="/letter-requests" className="block text-center text-primary">
          {isAr ? "العودة للقائمة" : "Back to list"}
        </Link>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className={`mb-4 ${isAr ? "text-right" : "text-left"}`} dir={isAr ? "rtl" : "ltr"}>
        <Link
          href="/letter-requests"
          className={`inline-flex items-center gap-2 rounded-xl border-2 border-primary/25 bg-primary/5 px-4 py-2.5 text-sm font-bold text-primary shadow-sm transition hover:bg-primary/10 ${
            isAr ? "flex-row-reverse" : ""
          }`}
        >
          {isAr ? (
            <>
              <span>العودة إلى قائمة الطلبات</span>
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
            </>
          ) : (
            <>
              <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
              <span>Back to requests list</span>
            </>
          )}
        </Link>
      </div>

      <PageHeader
        title={isAr ? "تفاصيل الطلب" : "Request details"}
        subtitle={item.targetOrganization}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href="/letter-requests"
          className="inline-flex rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          {isAr ? "القائمة" : "List"}
        </Link>
        {item.status === "approved" && item.verificationPath ? (
          <Link
            href={`/letter-requests/${item._id}/document`}
            className="inline-flex rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-emerald-700"
          >
            {isAr ? "عرض الخطاب / PDF" : "View letter / PDF"}
          </Link>
        ) : null}
      </div>

      <SectionCard>
        <div className={`mb-4 flex flex-wrap items-center gap-2 ${isAr ? "text-right" : "text-left"}`}>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-800">
            {isAr ? letterRequestStatusLabelAr(item.status) : letterRequestStatusLabelEn(item.status)}
          </span>
          <p className="text-sm text-slate-600">
            {isAr ? letterRequestStatusDescriptionAr(item.status) : letterRequestStatusDescriptionEn(item.status)}
          </p>
        </div>

        {item.status === "rejected" && item.rejectReason ? (
          <p className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">
            {isAr ? "سبب الرفض: " : "Reason: "}
            {item.rejectReason}
          </p>
        ) : null}
        {item.status === "needs_revision" && item.revisionNote ? (
          <p className="mb-4 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {isAr ? "ملاحظات المراجعة: " : "Reviewer note: "}
            {item.revisionNote}
          </p>
        ) : null}

        {canEdit && !editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mb-4 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-primary hover:bg-slate-50"
          >
            {isAr ? "تعديل الطلب" : "Edit request"}
          </button>
        ) : null}

        {editing && canEdit ? (
          <div className="space-y-4">
            <div className={`grid gap-3 sm:grid-cols-2 ${isAr ? "text-right" : "text-left"}`}>
              <div>
                <label className="mb-1 block text-xs font-semibold">{isAr ? "النوع" : "Type"}</label>
                <select
                  value={requestType}
                  onChange={(e) => setRequestType(e.target.value as LetterRequestType)}
                  className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                >
                  <option value="testimonial">{isAr ? "إفادة" : "Testimonial"}</option>
                  <option value="recommendation">{isAr ? "توصية" : "Recommendation"}</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">{isAr ? "اللغة" : "Language"}</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as LetterRequestLanguage)}
                  className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                >
                  <option value="ar">العربية</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>
            <div className={isAr ? "text-right" : "text-left"}>
              <label className="mb-1 block text-xs font-semibold">{isAr ? "الجهة" : "Organization"}</label>
              <input
                className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                value={targetOrganization}
                onChange={(e) => setTargetOrganization(e.target.value)}
              />
            </div>
            <div className={isAr ? "text-right" : "text-left"}>
              <label className="mb-1 block text-xs font-semibold">{isAr ? "النص المرجعي" : "Reference text"}</label>
              <textarea
                className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                rows={6}
                value={requestBody}
                onChange={(e) => setRequestBody(e.target.value)}
              />
            </div>
            <div className={`grid gap-3 sm:grid-cols-2 ${isAr ? "text-right" : "text-left"}`}>
              <div>
                <label className="mb-1 block text-xs font-semibold">{isAr ? "المُوقِّع" : "Signatory"}</label>
                <select
                  value={requestedAuthorRole}
                  onChange={(e) => setRequestedAuthorRole(e.target.value as LetterRequestedAuthorRole)}
                  className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                >
                  <option value="teacher">{isAr ? "معلم" : "Teacher"}</option>
                  <option value="supervisor">{isAr ? "مشرف" : "Supervisor"}</option>
                  <option value="school_administration">{isAr ? "إدارة المدرسة" : "School administration"}</option>
                </select>
              </div>
              {showSpec ? (
                <div>
                  <label className="mb-1 block text-xs font-semibold">{isAr ? "التخصص" : "Field"}</label>
                  <select
                    className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                    value={requestedSpecialization}
                    onChange={(e) => setRequestedSpecialization(e.target.value)}
                  >
                    <option value="">{isAr ? "اختر…" : "Select…"}</option>
                    {specOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
            {saveErr ? <p className="text-sm text-red-600">{saveErr}</p> : null}
            <div className={`flex gap-2 ${isAr ? "justify-start" : "justify-end"}`}>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setTargetOrganization(item.targetOrganization);
                  setRequestBody(item.requestBody);
                  setRequestType(item.requestType);
                  setLanguage(item.language);
                  setRequestedAuthorRole(item.requestedAuthorRole);
                  setRequestedSpecialization(item.requestedSpecialization || "");
                }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                {isAr ? "إلغاء" : "Cancel"}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {saving ? "…" : isAr ? "حفظ" : "Save"}
              </button>
            </div>
          </div>
        ) : (
          <dl className={`space-y-3 text-sm ${isAr ? "text-right" : "text-left"}`}>
            <div>
              <dt className="text-xs font-semibold text-slate-500">{isAr ? "النوع" : "Type"}</dt>
              <dd className="font-medium text-slate-900">
                {item.requestType === "testimonial"
                  ? isAr
                    ? "إفادة"
                    : "Testimonial"
                  : isAr
                    ? "خطاب توصية"
                    : "Recommendation"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-slate-500">{isAr ? "اللغة" : "Language"}</dt>
              <dd className="font-medium text-slate-900">{item.language === "ar" ? "العربية" : "English"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-slate-500">{isAr ? "النص المرجعي" : "Reference text"}</dt>
              <dd className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-slate-800">{item.requestBody}</dd>
            </div>
          </dl>
        )}

        {item.status === "approved" && item.verifyUrl ? (
          <div className="mt-6 border-t border-slate-100 pt-4">
            <p className="mb-2 text-sm font-semibold text-slate-800">{isAr ? "رابط التحقق" : "Verification link"}</p>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={item.verifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                {isAr ? "فتح صفحة التحقق" : "Open verification"}
              </a>
              <button
                type="button"
                onClick={handleCopyVerify}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700"
              >
                <Copy className="h-3.5 w-3.5" />
                {isAr ? "نسخ الرابط" : "Copy link"}
              </button>
            </div>
          </div>
        ) : null}
      </SectionCard>
    </PageContainer>
  );
};

export default LetterRequestDetailPage;
