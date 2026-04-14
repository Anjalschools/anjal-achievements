"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import { getLocale } from "@/lib/i18n";
import {
  ALLOWED_INFERRED_FIELD_VALUES,
  INFERRED_FIELD_UI_LABELS,
} from "@/lib/achievement-inferred-field-allowlist";
import type { LetterRequestedAuthorRole, LetterRequestLanguage, LetterRequestType } from "@/lib/letter-request-types";

const specKeys = [...ALLOWED_INFERRED_FIELD_VALUES].filter((k) => k !== "other").sort();

const NewLetterRequestPage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [requestType, setRequestType] = useState<LetterRequestType>("testimonial");
  const [language, setLanguage] = useState<LetterRequestLanguage>("ar");
  const [targetOrganization, setTargetOrganization] = useState("");
  const [requestedWriterName, setRequestedWriterName] = useState("");
  const [requestBody, setRequestBody] = useState("");
  const [requestedAuthorRole, setRequestedAuthorRole] = useState<LetterRequestedAuthorRole>("school_administration");
  const [requestedSpecialization, setRequestedSpecialization] = useState("");

  const showSpec = requestedAuthorRole === "teacher" || requestedAuthorRole === "supervisor";

  const specOptions = useMemo(
    () =>
      specKeys.map((k) => ({
        value: k,
        label: INFERRED_FIELD_UI_LABELS[k]?.[isAr ? "ar" : "en"] ?? k,
      })),
    [isAr]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        requestType,
        language,
        targetOrganization: targetOrganization.trim(),
        requestedWriterName: requestedWriterName.trim(),
        requestBody: requestBody.trim(),
        requestedAuthorRole,
      };
      if (showSpec) body.requestedSpecialization = requestedSpecialization;

      const res = await fetch("/api/letter-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Failed");
      const id = j.item?._id;
      if (id) router.replace(`/letter-requests/${id}`);
      else router.replace("/letter-requests");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title={isAr ? "طلب جديد" : "New request"}
        subtitle={isAr ? "إفادة رسمية أو خطاب توصية." : "Official testimonial or recommendation letter."}
      />
      <SectionCard>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className={`grid gap-4 sm:grid-cols-2 ${isAr ? "text-right" : "text-left"}`}>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-800">
                {isAr ? "نوع الطلب" : "Request type"}
              </label>
              <select
                value={requestType}
                onChange={(e) => setRequestType(e.target.value as LetterRequestType)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="testimonial">{isAr ? "إفادة" : "Testimonial"}</option>
                <option value="recommendation">{isAr ? "خطاب توصية" : "Recommendation letter"}</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-800">
                {isAr ? "لغة الخطاب" : "Letter language"}
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as LetterRequestLanguage)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="ar">{isAr ? "العربية" : "Arabic"}</option>
                <option value="en">{isAr ? "الإنجليزية" : "English"}</option>
              </select>
            </div>
          </div>

          <div className={isAr ? "text-right" : "text-left"}>
            <label className="mb-1 block text-sm font-semibold text-slate-800">
              {isAr ? "اسم الشخص المطلوب منه كتابة الخطاب" : "Requested author (who should write the letter)"}
            </label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={200}
              value={requestedWriterName}
              onChange={(e) => setRequestedWriterName(e.target.value)}
              placeholder={isAr ? "مثال: أ. فلان الفلاني" : "e.g. Mr. John Smith"}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-slate-500">
              {isAr
                ? "يُعرض للإدارة فقط؛ لا يُستبدل تلقائياً باسم الموقّع على الخطاب المعتمد."
                : "Shown to staff only; not the same as the final printed signatory name."}
            </p>
          </div>

          <div className={isAr ? "text-right" : "text-left"}>
            <label className="mb-1 block text-sm font-semibold text-slate-800">
              {isAr ? "الجهة المقدَّم لها الخطاب" : "Recipient organization"}
            </label>
            <input
              type="text"
              required
              maxLength={200}
              value={targetOrganization}
              onChange={(e) => setTargetOrganization(e.target.value)}
              placeholder={isAr ? "مثال: جامعة الملك فيصل" : "e.g. King Faisal University"}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </div>

          <div className={isAr ? "text-right" : "text-left"}>
            <label className="mb-1 block text-sm font-semibold text-slate-800">
              {isAr ? "محتوى الطلب / الوصف المرجعي" : "Reference content for the letter"}
            </label>
            <textarea
              required
              minLength={10}
              rows={8}
              value={requestBody}
              onChange={(e) => setRequestBody(e.target.value)}
              placeholder={
                isAr
                  ? "اكتب الوقائع والإنجازات التي تريد الإشارة إليها (دون اختلاق معلومات)."
                  : "Describe facts and achievements to reference (do not invent information)."
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </div>

          <div className={`grid gap-4 sm:grid-cols-2 ${isAr ? "text-right" : "text-left"}`}>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-800">
                {isAr ? "الجهة المطلوبة للتوقيع" : "Requested signatory"}
              </label>
              <select
                value={requestedAuthorRole}
                onChange={(e) => setRequestedAuthorRole(e.target.value as LetterRequestedAuthorRole)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="teacher">{isAr ? "معلم" : "Teacher"}</option>
                <option value="supervisor">{isAr ? "مشرف" : "Supervisor"}</option>
                <option value="school_administration">{isAr ? "إدارة المدرسة" : "School administration"}</option>
              </select>
            </div>
            {showSpec ? (
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-800">
                  {isAr ? "التخصص / المجال" : "Specialization / field"}
                </label>
                <select
                  required
                  value={requestedSpecialization}
                  onChange={(e) => setRequestedSpecialization(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
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

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className={`flex flex-wrap gap-3 ${isAr ? "justify-start" : "justify-end"}`}>
            <Link
              href="/letter-requests"
              className="inline-flex items-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {isAr ? "إلغاء" : "Cancel"}
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center rounded-lg bg-primary px-5 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              {submitting ? (isAr ? "جاري الإرسال…" : "Submitting…") : isAr ? "إرسال الطلب" : "Submit request"}
            </button>
          </div>
        </form>
      </SectionCard>
    </PageContainer>
  );
};

export default NewLetterRequestPage;
