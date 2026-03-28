"use client";

import Image from "next/image";
import { useCallback, useMemo, useState, type KeyboardEvent } from "react";
import AchievementStatusBadge from "@/components/achievements/AchievementStatusBadge";
import { downloadResolvedAttachment, openResolvedAttachmentInNewTab } from "@/lib/achievement-attachment-open";
import {
  formatAchievementCategoryLabel,
  formatAchievementClassificationLabel,
  formatAchievementFieldLabel,
  formatAchievementLevelLabel,
  formatAchievementTypeLabel,
  formatOrgLabel,
  formatParticipationLabel,
} from "@/lib/admin-achievement-labels";
import { formatLocalizedResultLine } from "@/lib/achievementDisplay";
import { labelCertificateIssuerRole } from "@/lib/certificate-eligibility";
import {
  buildAttachmentRow,
  mergeStudentDetailAttachmentSources,
  partitionStudentAchievementDescription,
  resolveStudentAttachmentHref,
  type AttachmentRow,
} from "@/lib/student-achievement-details-display";
import type { AdminAchievementDetailApi } from "@/types/admin-achievement-review";
import {
  buildAdminAttachmentAiDecisionColumn,
  resolveAiReviewRunStatus,
} from "@/lib/admin-achievement-ai-decision";
import {
  getAiReviewDecisionLabel,
  getAiReviewRunStatusLabel,
  getGradeLabel,
  getSectionLabel,
  getTriStateMatchLabel,
} from "@/lib/achievement-display-labels";
import { ExternalLink, FileText, Loader2, Sparkles } from "lucide-react";

const fieldLabelAr = (key: string): string => {
  const m: Record<string, string> = {
    nameAr: "الاسم (عربي)",
    nameEn: "الاسم (إنجليزي)",
    achievementName: "المعرّف",
    achievementType: "نوع الإنجاز",
    achievementLevel: "المستوى",
    description: "الوصف",
    image: "صورة",
    attachments: "مرفقات",
    resultType: "نوع النتيجة",
    organization: "الجهة المنظمة",
  };
  return m[key] || key;
};

const isPdfAttachmentRow = (r: AttachmentRow): boolean => {
  const h = r.href || "";
  if (h.startsWith("data:") && /application\/pdf/i.test(h)) return true;
  if (/\.pdf(\?|$)/i.test(h)) return true;
  if (r.displayName && /\.pdf$/i.test(r.displayName)) return true;
  return false;
};

export const AdminAchievementReviewDetailBody = ({
  detail,
  loc,
  isAr,
  clientOrigin,
  aiAssistEnabled,
  attachmentAiBusy,
  onRunAttachmentAi,
}: {
  detail: AdminAchievementDetailApi;
  loc: "ar" | "en";
  isAr: boolean;
  /** Same-origin base for resolving relative attachment paths (mirrors student achievements detail). */
  clientOrigin?: string;
  aiAssistEnabled: boolean;
  attachmentAiBusy: boolean;
  onRunAttachmentAi: () => void;
}) => {
  const a = detail.achievement;
  const snap = (a.previousApprovedSnapshot as Record<string, unknown> | undefined) || null;
  const changed = Array.isArray(a.changedFields) ? (a.changedFields as string[]) : [];

  const desc = String(a.description || "").trim();
  const gallery: string[] = [];
  const img = typeof a.image === "string" && a.image.trim() ? a.image : "";
  if (img) gallery.push(img);

  const originArg = clientOrigin?.trim() ? clientOrigin.trim() : undefined;

  const attachmentRows = useMemo(() => {
    const structured =
      Array.isArray(a.attachmentItems) && (a.attachmentItems as unknown[]).length > 0
        ? (a.attachmentItems as unknown[])
        : null;
    if (structured) {
      return structured
        .map((item, i) => buildAttachmentRow(item, i, loc, originArg))
        .filter((x): x is NonNullable<typeof x> => Boolean(x));
    }
    const { derivedFileStrings } = partitionStudentAchievementDescription(a.description);
    const ev = String(a.evidenceUrl || "").trim();
    const merged = mergeStudentDetailAttachmentSources(
      derivedFileStrings,
      a.attachments as unknown[] | undefined,
      ev || undefined
    );
    return merged
      .map((item, i) => buildAttachmentRow(item, i, loc, originArg))
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
  }, [a.attachmentItems, a.attachments, a.description, a.evidenceUrl, loc, originArg]);

  const [attachOpenError, setAttachOpenError] = useState<string | null>(null);

  const handleOpenResolved = useCallback(
    (href: string | null, kind: "attachment" | "image") => {
      setAttachOpenError(null);
      if (!href) {
        setAttachOpenError(
          isAr
            ? kind === "image"
              ? "رابط الصورة غير صالح"
              : "رابط المرفق غير صالح"
            : kind === "image"
              ? "Invalid image link"
              : "Invalid attachment link"
        );
        return;
      }
      const ok = openResolvedAttachmentInNewTab(href);
      if (!ok) {
        setAttachOpenError(isAr ? "تعذر فتح المرفق" : "Could not open attachment");
      }
    },
    [isAr]
  );

  const handleOpenAttachmentRow = useCallback(
    (row: AttachmentRow) => {
      if (!row.canOpen || !row.href) {
        setAttachOpenError(isAr ? "رابط المرفق غير صالح" : "Invalid attachment link");
        return;
      }
      handleOpenResolved(row.href, "attachment");
    },
    [handleOpenResolved, isAr]
  );

  const handleDownloadRow = useCallback(
    (row: AttachmentRow) => {
      setAttachOpenError(null);
      if (!row.canOpen || !row.href) {
        setAttachOpenError(isAr ? "رابط المرفق غير صالح" : "Invalid attachment link");
        return;
      }
      const ok = downloadResolvedAttachment(row.href, row.dataDownloadName);
      if (!ok) {
        setAttachOpenError(isAr ? "تعذر تحميل المرفق" : "Could not download attachment");
      }
    },
    [isAr]
  );

  const handleOpenGallery = useCallback(
    (src: string) => {
      const resolved = resolveStudentAttachmentHref(src, originArg);
      handleOpenResolved(resolved, "image");
    },
    [handleOpenResolved, originArg]
  );

  const handleGalleryKeyDown = useCallback(
    (e: KeyboardEvent, src: string) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleOpenGallery(src);
      }
    },
    [handleOpenGallery]
  );
  const row = (label: string, value: string) => (
    <div className="border-b border-gray-100 py-2 last:border-0">
      <dt className="text-xs font-semibold text-text-light">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap break-words text-sm text-text">{value || (isAr ? "غير محدد" : "—")}</dd>
    </div>
  );

  const principalAt = a.principalApprovedAt ? String(a.principalApprovedAt) : "";
  const supervisorAt = a.activitySupervisorApprovedAt ? String(a.activitySupervisorApprovedAt) : "";
  const adminAt = a.adminApprovedAt ? String(a.adminApprovedAt) : "";
  const judgeAt = a.judgeApprovedAt ? String(a.judgeApprovedAt) : "";
  const certIssued = a.certificateIssued === true;
  const issuerRole = typeof a.certificateApprovedByRole === "string" ? a.certificateApprovedByRole : "";
  const issuedAtStr = a.certificateIssuedAt ? String(a.certificateIssuedAt) : "";

  const adminDup = a.adminDuplicateMarked === true;
  const attRev = a.adminAttachmentAiReview as Record<string, unknown> | undefined;

  const attAttachments = Array.isArray(a.attachments) ? (a.attachments as unknown[]) : [];
  const attachmentUrlsForDecision = attAttachments
    .map((x) => (typeof x === "string" ? x : (x as { url?: string })?.url))
    .filter((x): x is string => typeof x === "string" && Boolean(x.trim()));
  const hasAttachmentEvidence =
    Boolean(String(a.image || "").trim()) || attachmentUrlsForDecision.length > 0;

  const attachmentAiColumn = buildAdminAttachmentAiDecisionColumn(
    {
      adminAttachmentOverall: (a.adminAttachmentOverall as string | null) ?? null,
      adminAttachmentAiReview: (a.adminAttachmentAiReview as Record<string, unknown> | null) ?? null,
      image: (a.image as string | null) ?? null,
      attachments: attachmentUrlsForDecision,
      attachmentsCount: attachmentUrlsForDecision.length,
    },
    loc
  );
  const attRun = resolveAiReviewRunStatus({
    adminAttachmentAiReview: (a.adminAttachmentAiReview as Record<string, unknown> | null) ?? null,
  });

  return (
    <div className="space-y-4">
      {adminDup ? (
        <div
          className="rounded-xl border border-fuchsia-300 bg-fuchsia-50 px-3 py-2 text-sm font-semibold text-fuchsia-950"
          role="status"
        >
          {isAr
            ? "مُعلَّم كمكرر بقرار إداري — راجع سجلات الطالب المماثلة."
            : "Marked duplicate by admin — review similar records for this student."}
        </div>
      ) : null}
      {hasAttachmentEvidence ? (
        <div
          className={`rounded-xl border px-3 py-2 text-sm ${
            attachmentAiColumn.tone === "danger"
              ? "border-red-300 bg-red-50 text-red-950"
              : attachmentAiColumn.tone === "success"
                ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                : attachmentAiColumn.tone === "warning"
                  ? "border-amber-300 bg-amber-50 text-amber-950"
                  : "border-slate-200 bg-slate-50 text-slate-900"
          }`}
          role="status"
        >
          <p className="font-semibold">
            {isAr ? "قرار فحص المرفقات: " : "Attachment check: "}
            {attachmentAiColumn.label}
          </p>
          {attRun ? (
            <p className="mt-1 text-[11px] opacity-90">
              {isAr ? "حالة التنفيذ: " : "Run status: "}
              {getAiReviewRunStatusLabel(attRun, loc)}
            </p>
          ) : null}
          {attRev && typeof attRev.aiDecisionReasonAr === "string" && String(attRev.aiDecisionReasonAr).trim() ? (
            <p className="mt-1 text-[11px] leading-snug opacity-95">
              {isAr ? String(attRev.aiDecisionReasonAr) : String(attRev.aiDecisionReasonEn || attRev.aiDecisionReasonAr)}
            </p>
          ) : null}
        </div>
      ) : null}
      <AchievementStatusBadge status={detail.computed.approvalStatus} locale={loc} />
      {detail.computed.approvalStatus === "approved" || detail.computed.approvalStatus === "featured" ? (
        <section className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs text-slate-800">
          <h3 className="mb-1 font-bold text-slate-900">
            {isAr ? "شهادة الشكر والتقدير" : "Appreciation certificate"}
          </h3>
          <p className="mb-2 text-[11px] leading-snug text-slate-600">
            {isAr
              ? "تُصدر الشهادة تلقائيًا بعد أول اعتماد معتمد من إحدى الجهات المخوّلة: الإدارة، مدير المدرسة، رائد/مشرف النشاط، أو المحكم."
              : "A certificate is issued automatically after the first valid approval from any authorized party: administration, school principal, activity supervisor, or judge."}
          </p>
          <ul className="list-inside list-disc space-y-0.5">
            <li>
              {isAr ? "حالة الشهادة: " : "Certificate: "}
              {certIssued ? (isAr ? "تم الإصدار" : "Issued") : isAr ? "لم يُصدر بعد" : "Not issued yet"}
            </li>
            {certIssued && issuerRole ? (
              <li>
                {isAr ? "أول جهة أصدرت الشهادة: " : "First issuing party: "}
                <span className="font-semibold text-slate-900">{labelCertificateIssuerRole(issuerRole, loc)}</span>
              </li>
            ) : null}
            {certIssued && issuedAtStr ? (
              <li>
                {isAr ? "تاريخ الإصدار: " : "Issued at: "}
                {new Date(issuedAtStr).toLocaleString(isAr ? "ar-SA" : "en-GB", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </li>
            ) : null}
            <li className="list-none text-[10px] text-slate-500">
              {isAr ? "سجل التوقيعات (اختياري): " : "Sign-off log: "}
              {isAr ? "إدارة" : "Admin"} {adminAt ? "✓" : "—"} · {isAr ? "مدير" : "Principal"}{" "}
              {principalAt ? "✓" : "—"} · {isAr ? "نشاط" : "Activity"} {supervisorAt ? "✓" : "—"} ·{" "}
              {isAr ? "محكم" : "Judge"} {judgeAt ? "✓" : "—"}
            </li>
          </ul>
        </section>
      ) : null}
      <dl>
        {row(isAr ? "الوصف" : "Description", desc || (isAr ? "لا يوجد وصف" : "No description"))}
        {row(isAr ? "نوع الإنجاز" : "Type", formatAchievementTypeLabel(String(a.achievementType || ""), loc))}
        {row(
          isAr ? "التصنيف" : "Category",
          formatAchievementCategoryLabel(String(a.achievementCategory || ""), loc)
        )}
        {row(
          isAr ? "تصنيف المجال" : "Classification",
          formatAchievementClassificationLabel(String(a.achievementClassification || ""), loc)
        )}
        {row(isAr ? "المجال" : "Field", formatAchievementFieldLabel(String(a.inferredField || a.domain || ""), loc))}
        {row(isAr ? "الجهة المنظمة" : "Organization", formatOrgLabel(a as Record<string, unknown>, loc))}
        {row(isAr ? "المستوى" : "Level", formatAchievementLevelLabel(String(a.achievementLevel || a.level || ""), loc))}
        {row(
          isAr ? "النتيجة" : "Result",
          formatLocalizedResultLine(
            String(a.resultType || ""),
            String(a.medalType || ""),
            String(a.rank || ""),
            loc
          )
        )}
        {row(isAr ? "نوع المشاركة" : "Participation", formatParticipationLabel(String(a.participationType || ""), loc))}
        {row(isAr ? "التاريخ" : "Date", detail.computed.dateIso || "")}
      </dl>

      {detail.student ? (
        <section>
          <h3 className="mb-2 text-sm font-bold text-text">{isAr ? "الطالب" : "Student"}</h3>
          <dl>
            {row(isAr ? "الاسم" : "Name", String(detail.student.fullName || ""))}
            {row("Email", String(detail.student.email || ""))}
            {row(isAr ? "الصف" : "Grade", getGradeLabel(detail.student.grade, loc))}
            {row(isAr ? "القسم" : "Section", getSectionLabel(detail.student.section, loc))}
          </dl>
        </section>
      ) : null}

      {detail.duplicateReview ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-3">
          <h3 className="mb-2 text-sm font-bold text-amber-950">
            {isAr ? "فحص التكرار (نفس الطالب + نفس الإنجاز + نفس السنة)" : "Duplicate check (same student, name, year)"}
          </h3>
          {a.adminDuplicateMarked === true ? (
            <p className="mb-2 text-xs font-bold text-fuchsia-900">
              {isAr
                ? "تنبيه: هذا السجل مُعلَّم يدويًا كمكرر من قبل الإدارة."
                : "This record is manually flagged as duplicate by an administrator."}
            </p>
          ) : null}
          {detail.duplicateReview.hasDuplicate ? (
            <>
              <p className="text-sm font-semibold text-amber-900">
                {isAr
                  ? `يوجد احتمال تكرار: ${detail.duplicateReview.count} سجل آخر بنفس المعايير (السنة ${detail.duplicateReview.comparableYear}).`
                  : `Possible duplicate: ${detail.duplicateReview.count} other record(s) in year ${detail.duplicateReview.comparableYear}.`}
              </p>
              <ul className="mt-2 space-y-2 text-xs">
                {detail.duplicateReview.items.map((it) => (
                  <li key={it.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/80 px-2 py-2">
                    <span className="font-medium text-text">{it.title}</span>
                    <a
                      href={`/achievements/${it.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" aria-hidden />
                      {isAr ? "عرض" : "Open"}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-amber-900">
              {isAr ? "لا يوجد تكرار مطابق حسب قاعدة السنة." : "No duplicate found under the year-based rule."}
            </p>
          )}
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900">
            {isAr ? "مراجعة الذكاء الاصطناعي للمرفقات" : "AI attachment review"}
          </h3>
          {aiAssistEnabled ? (
            <button
              type="button"
              disabled={attachmentAiBusy}
              onClick={onRunAttachmentAi}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            >
              {attachmentAiBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="h-4 w-4" aria-hidden />
              )}
              {isAr ? "إعادة فحص" : "Re-run check"}
            </button>
          ) : (
            <span className="text-[11px] text-text-light">
              {isAr ? "الذكاء الاصطناعي غير مفعّل." : "AI is not enabled."}
            </span>
          )}
        </div>
        <p className="mb-2 text-[11px] text-text-light">
          {isAr
            ? "يُشغَّل الفحص تلقائيًا بعد حفظ الإنجاز عند وجود مرفقات. زر «إعادة فحص» اختياري بعد التعديل أو عند الفشل. لا يغيّر الاعتماد النهائي."
            : "A check runs automatically after save when attachments exist. “Re-run” is optional after edits or failures. Does not change final approval."}
        </p>
        {(() => {
          const ar = a.adminAttachmentAiReview as Record<string, unknown> | undefined;
          if (!ar || typeof ar !== "object") {
            return (
              <p className="text-xs text-text-light">{isAr ? "لم يُنفَّذ تحليل بعد." : "No analysis run yet."}</p>
            );
          }
          const checks = ar.checks as Record<string, unknown> | undefined;
          const ev = ar.extractedEvidence as Record<string, unknown> | undefined;
          const overall = String(ar.overallMatchStatus || "");
          const at = ar.analyzedAt ? String(ar.analyzedAt) : "";
          return (
            <div className="space-y-2 text-xs">
              <p className="font-semibold text-slate-900">
                {isAr ? "الحالة العامة (بعد قواعد الحسم): " : "Overall (rule-based): "}
                {getTriStateMatchLabel(overall, loc)}
              </p>
              {typeof ar.aiReviewDecision === "string" && String(ar.aiReviewDecision).trim() ? (
                <p className="text-[11px] text-slate-700">
                  {isAr ? "القرار الآلي: " : "AI decision: "}
                  {getAiReviewDecisionLabel(ar.aiReviewDecision, loc)}
                </p>
              ) : null}
              {Array.isArray(ar.aiReviewWarnings) && ar.aiReviewWarnings.length > 0 ? (
                <p className="text-[11px] text-amber-900">
                  {isAr ? "تحذيرات: " : "Warnings: "}
                  {(ar.aiReviewWarnings as string[]).join(", ")}
                </p>
              ) : null}
              {at ? (
                <p className="text-[10px] text-text-light">
                  {isAr ? "آخر تحليل: " : "Last run: "}
                  {new Date(at).toLocaleString(isAr ? "ar-SA" : "en-GB", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              ) : null}
              {typeof ar.overallAttachmentReviewSummaryAr === "string" &&
              String(ar.overallAttachmentReviewSummaryAr).trim() ? (
                <p className="rounded-lg border border-slate-200 bg-white/80 px-2 py-2 text-[11px] text-slate-800">
                  {isAr ? "ملخص المرفقات: " : "Attachments summary: "}
                  {String(ar.overallAttachmentReviewSummaryAr)}
                </p>
              ) : null}
              {loc === "en" &&
              typeof ar.overallAttachmentReviewSummaryEn === "string" &&
              String(ar.overallAttachmentReviewSummaryEn).trim() ? (
                <p className="rounded-lg border border-slate-200 bg-white/80 px-2 py-2 text-[11px] text-slate-800">
                  {String(ar.overallAttachmentReviewSummaryEn)}
                </p>
              ) : null}
              {checks ? (
                <ul className="grid gap-1 sm:grid-cols-2">
                  <li>
                    {isAr ? "الاسم: " : "Name: "}
                    {getTriStateMatchLabel(checks.nameCheck, loc)}
                  </li>
                  <li>
                    {isAr ? "السنة: " : "Year: "}
                    {getTriStateMatchLabel(checks.yearCheck, loc)}
                  </li>
                  <li>
                    {isAr ? "المستوى: " : "Level: "}
                    {getTriStateMatchLabel(checks.levelCheck, loc)}
                  </li>
                  <li>
                    {isAr ? "الإنجاز: " : "Achievement: "}
                    {getTriStateMatchLabel(checks.achievementCheck, loc)}
                  </li>
                  {checks.resultCheck != null && String(checks.resultCheck).trim() !== "" ? (
                    <li>
                      {isAr ? "النتيجة / الميدالية: " : "Result / medal: "}
                      {getTriStateMatchLabel(checks.resultCheck, loc)}
                    </li>
                  ) : null}
                </ul>
              ) : null}
              {Array.isArray(ar.attachmentReviews) && ar.attachmentReviews.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-slate-800">
                    {isAr ? "تحليل كل مرفق PDF على حدة" : "Per-PDF attachment analysis"}
                  </p>
                  {(ar.attachmentReviews as Record<string, unknown>[]).map((rev, idx) => {
                    const fn = rev.fileName ? String(rev.fileName) : rev.label ? String(rev.label) : `#${idx + 1}`;
                    const kind = String(rev.detectedDocumentKind || "");
                    const kindLabel =
                      kind === "group_list_document"
                        ? isAr
                          ? "قائمة / تعميم"
                          : "Group list / roster"
                        : kind === "individual_certificate"
                          ? isAr
                            ? "شهادة فردية"
                            : "Individual certificate"
                          : isAr
                            ? "نوع غير مؤكد"
                            : "Unknown kind";
                    const oc = rev.checks as Record<string, unknown> | undefined;
                    const evOne = rev.extractedEvidence as Record<string, unknown> | undefined;
                    const g = rev.groupDocumentAnalysis as Record<string, unknown> | undefined;
                    return (
                      <div
                        key={`att-${idx}-${fn}`}
                        className="rounded-lg border border-violet-200/80 bg-violet-50/40 px-3 py-2"
                      >
                        <p className="text-[11px] font-bold text-violet-950">
                          {isAr ? "المرفق" : "Attachment"} {idx + 1}
                          {fn ? `: ${fn}` : ""}
                        </p>
                        <p className="mt-1 text-[10px] text-violet-900/90">
                          {isAr ? "نوع الوثيقة: " : "Document kind: "}
                          {kindLabel}
                        </p>
                        {oc ? (
                          <ul className="mt-1 grid gap-0.5 text-[10px] text-slate-800 sm:grid-cols-2">
                            <li>
                              {isAr ? "الاسم: " : "Name: "}
                              {getTriStateMatchLabel(oc.nameCheck, loc)}
                            </li>
                            <li>
                              {isAr ? "السنة: " : "Year: "}
                              {getTriStateMatchLabel(oc.yearCheck, loc)}
                            </li>
                            <li>
                              {isAr ? "الإنجاز: " : "Achievement: "}
                              {getTriStateMatchLabel(oc.achievementCheck, loc)}
                            </li>
                            <li>
                              {isAr ? "الحالة العامة: " : "Overall: "}
                              {getTriStateMatchLabel(rev.overallMatchStatus, loc)}
                            </li>
                          </ul>
                        ) : null}
                        {evOne && typeof evOne === "object" ? (
                          <dl className="mt-2 space-y-1 border-t border-violet-100 pt-2 text-[10px] text-slate-800">
                            {row(
                              isAr ? "اسم مستخرج" : "Detected name",
                              String(evOne.detectedStudentName || "").trim() || (isAr ? "غير متوفر" : "Not available")
                            )}
                            {row(
                              isAr ? "السنة" : "Year",
                              String(evOne.detectedYear || "").trim() || (isAr ? "غير متوفر" : "Not available")
                            )}
                            {row(
                              isAr ? "عنوان الإنجاز" : "Achievement title",
                              String(evOne.detectedAchievementTitle || "").trim() || (isAr ? "غير متوفر" : "Not available")
                            )}
                            {row(
                              isAr ? "النتيجة" : "Result",
                              String(evOne.detectedMedalOrResult || "").trim() || (isAr ? "غير متوفر" : "Not available")
                            )}
                          </dl>
                        ) : null}
                        {g && g.studentFound === true && g.matchedRow && typeof g.matchedRow === "object" ? (
                          <div className="mt-2 rounded border border-emerald-200 bg-emerald-50/80 px-2 py-1.5 text-[10px] text-emerald-950">
                            <p className="font-semibold">{isAr ? "صف مطابق في القائمة" : "Matched roster row"}</p>
                            <p className="mt-1 whitespace-pre-wrap break-words">
                              {String((g.matchedRow as { rawRow?: string }).rawRow || "")}
                            </p>
                          </div>
                        ) : null}
                        {typeof rev.summaryAr === "string" && rev.summaryAr.trim() ? (
                          <p className="mt-2 text-[10px] text-slate-600">{String(rev.summaryAr)}</p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
              <div className="mt-3 rounded-xl border border-slate-200 bg-white/90 px-3 py-3">
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-800">
                  {isAr ? "مستخرج من الملف (مجمّع)" : "Extracted from attachments (combined)"}
                </h4>
                {ev && typeof ev === "object" ? (
                  <dl className="space-y-2 text-xs">
                    {row(
                      isAr ? "الاسم المستخرج من الملف" : "Detected student name",
                      String(ev.detectedStudentName || "").trim() || (isAr ? "غير متوفر" : "Not available")
                    )}
                    {row(
                      isAr ? "السنة المستخرجة" : "Detected year",
                      String(ev.detectedYear || "").trim() || (isAr ? "غير متوفر" : "Not available")
                    )}
                    {row(
                      isAr ? "المستوى المستخرج" : "Detected level",
                      String(ev.detectedLevel || "").trim() || (isAr ? "غير متوفر" : "Not available")
                    )}
                    {row(
                      isAr ? "عنوان / اسم الإنجاز المستخرج" : "Detected achievement title",
                      String(ev.detectedAchievementTitle || "").trim() || (isAr ? "غير متوفر" : "Not available")
                    )}
                    {row(
                      isAr ? "النتيجة / الميدالية المستخرجة" : "Detected result / medal",
                      String(ev.detectedMedalOrResult || "").trim() || (isAr ? "غير متوفر" : "Not available")
                    )}
                    {row(
                      isAr ? "جهة الإصدار المستخرجة" : "Detected issuer",
                      String(ev.detectedIssuer || "").trim() || (isAr ? "غير متوفر" : "Not available")
                    )}
                    {row(
                      isAr ? "ملاحظات (عربي)" : "Notes (Arabic)",
                      String(ev.notesAr || "").trim() || (isAr ? "غير متوفر" : "Not available")
                    )}
                    {loc === "en"
                      ? row("Notes (English)", String(ev.notesEn || "").trim() || "Not available")
                      : null}
                    {row(
                      isAr ? "التوصية (عربي)" : "Recommendation (Arabic)",
                      String(ar.recommendationAr || "").trim() || (isAr ? "غير متوفر" : "Not available")
                    )}
                    {loc === "en"
                      ? row("Recommendation (English)", String(ar.recommendationEn || "").trim() || "Not available")
                      : null}
                  </dl>
                ) : (
                  <p className="text-xs text-text-light">
                    {isAr ? "لا توجد بيانات مستخرجة في آخر تحليل." : "No extracted fields in the last run."}
                  </p>
                )}
              </div>
            </div>
          );
        })()}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-bold text-text">{isAr ? "ملاحظات المراجعة" : "Review notes"}</h3>
        <p className="text-sm text-text-light">{String(a.reviewNote || "").trim() || (isAr ? "لا توجد" : "None")}</p>
        {Array.isArray(a.reviewComments) && (a.reviewComments as unknown[]).length > 0 ? (
          <ul className="mt-2 list-inside list-disc text-xs text-text-light">
            {(a.reviewComments as { message?: string; type?: string }[])
              .slice(-8)
              .reverse()
              .map((c, i) => (
                <li key={i}>
                  <span className="font-semibold">{c.type}:</span> {c.message}
                </li>
              ))}
          </ul>
        ) : null}
      </section>

      {attachOpenError ? (
        <div
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950"
        >
          {attachOpenError}
        </div>
      ) : null}

      <section>
        <h3 className="mb-2 text-sm font-bold text-text">{isAr ? "الصور" : "Images"}</h3>
        {gallery.length === 0 ? (
          <p className="text-sm text-text-light">{isAr ? "لا توجد صور" : "No images"}</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {gallery.map((src, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleOpenGallery(src)}
                onKeyDown={(e) => handleGalleryKeyDown(e, src)}
                aria-label={isAr ? "فتح الصورة في تبويب جديد" : "Open image in new tab"}
                tabIndex={0}
                className="relative aspect-video w-full cursor-pointer overflow-hidden rounded-xl bg-gray-100 text-left ring-1 ring-gray-200 transition hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Image src={src} alt="" fill className="object-cover" unoptimized sizes="200px" />
              </button>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-bold text-text">{isAr ? "المرفقات" : "Attachments"}</h3>
        {attachmentRows.length === 0 && !img ? (
          <p className="text-sm text-text-light">{isAr ? "لا توجد مرفقات" : "No attachments"}</p>
        ) : (
          <ul className="space-y-2">
            {attachmentRows.map((row, i) => {
              const isPdf = isPdfAttachmentRow(row);
              const label =
                row.displayName?.trim() ||
                (row.href ? row.href.slice(0, 80) : isAr ? "مرفق" : "Attachment");
              return (
                <li
                  key={`att-${i}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-2"
                >
                  <span className="flex min-w-0 flex-1 items-center gap-2 text-xs font-medium text-text">
                    <FileText className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                    {isPdf ? (
                      <span className="shrink-0 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-900">
                        PDF
                      </span>
                    ) : null}
                    <span className="max-w-[min(100%,280px)] truncate" title={label}>
                      {label}
                    </span>
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {row.canOpen && row.href ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenAttachmentRow(row)}
                          className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-white px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/5"
                        >
                          <ExternalLink className="h-3 w-3" aria-hidden />
                          {isAr ? "فتح" : "Open"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadRow(row)}
                          className="inline-flex items-center gap-1 rounded-lg bg-primary px-2 py-1 text-xs font-semibold text-white hover:opacity-95"
                        >
                          <FileText className="h-3 w-3" aria-hidden />
                          {isAr ? "تحميل" : "Download"}
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-text-light">
                        {isAr ? "رابط غير متاح" : "Link unavailable"}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {snap && changed.length > 0 ? (
        <section>
          <h3 className="mb-2 text-sm font-bold text-text">{isAr ? "التغييرات الأخيرة" : "Recent changes"}</h3>
          <ul className="space-y-2 text-xs">
            {changed.slice(0, 24).map((key) => {
              const before = snap[key];
              const after = a[key];
              return (
                <li key={key} className="rounded-lg border border-amber-100 bg-amber-50/50 px-2 py-2">
                  <p className="font-semibold text-amber-950">{fieldLabelAr(key)}</p>
                  <p className="text-text-light">
                    <span className="font-medium">{isAr ? "قبل: " : "Before: "}</span>
                    {before === undefined ? "—" : JSON.stringify(before).slice(0, 200)}
                  </p>
                  <p className="text-text">
                    <span className="font-medium">{isAr ? "بعد: " : "After: "}</span>
                    {after === undefined ? "—" : JSON.stringify(after).slice(0, 200)}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {typeof a.aiSummary === "string" && a.aiSummary.trim() ? (
        <section className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800">
          <span className="font-semibold">{isAr ? "ملخص AI: " : "AI summary: "}</span>
          {a.aiSummary}
        </section>
      ) : null}
    </div>
  );
};
