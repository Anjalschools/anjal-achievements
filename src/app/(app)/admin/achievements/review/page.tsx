"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import AdminAchievementReviewActions from "@/components/admin/AdminAchievementReviewActions";
import {
  buildAchievementDetailHref,
  buildReturnToQueryString,
  parseReviewListQueryString,
} from "@/lib/admin-achievement-review-return-query";
import type { AdminAiAlertTableSortKey } from "@/lib/admin-ai-alert-review-view-model";
import type {
  AdminAchievementReviewListRow as Row,
  AdminReviewTab as Tab,
} from "@/types/admin-achievement-review";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import AchievementStatusBadge from "@/components/achievements/AchievementStatusBadge";
import { getLocale } from "@/lib/i18n";
import {
  attachmentSummary,
  emptyCell,
  emptyOrDash,
  formatAchievementCategoryLabel,
  formatAchievementClassificationLabel,
  formatAchievementFieldLabel,
  formatAchievementTypeLabel,
  formatOrgLabel,
  formatParticipationLabel,
  formatResultLine,
  formatAchievementLevelLabel,
  resolveAchievementTitleForAdmin,
} from "@/lib/admin-achievement-labels";
import { labelCertificateIssuerRole } from "@/lib/certificate-eligibility";
import AdminAchievementAiAlertTable from "@/components/admin/AdminAchievementAiAlertTable";
import { buildAdminAttachmentAiDecisionColumn, shouldShowInAiFlaggedTab } from "@/lib/admin-achievement-ai-decision";
import { getGradeLabel, getSectionLabel } from "@/lib/achievement-display-labels";
import { mergeAdminAchievementListRow } from "@/lib/admin-achievement-list-row-merge";
import {
  compareAdminAchievementListRows,
  type AdminAchievementListSortKey,
} from "@/lib/admin-achievement-list-sort";
import { buildAchievementWorkflowRowClassName } from "@/lib/admin-achievement-row-tone";
import { toneToBadgeClass } from "@/lib/admin-ai-alert-review-view-model";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";

const AdminAchievementsReviewPageContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = getLocale();
  const isAr = locale === "ar";
  const loc = isAr ? "ar" : "en";
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [userRole, setUserRole] = useState<string>("");
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [mawhiba, setMawhiba] = useState<"all" | "yes" | "no">("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [aiReviewUiEnabled, setAiReviewUiEnabled] = useState(false);
  const [aiAssistEnabled, setAiAssistEnabled] = useState(false);
  const [aiReviewerBusy, setAiReviewerBusy] = useState(false);
  const [revisionAiMessage, setRevisionAiMessage] = useState<string | null>(null);
  const [revisionOpen, setRevisionOpen] = useState<Row | null>(null);
  const [revisionText, setRevisionText] = useState("");
  const [deleteOpen, setDeleteOpen] = useState<Row | null>(null);
  const [deleteText, setDeleteText] = useState("");
  const [confirmPatch, setConfirmPatch] = useState<{
    id: string;
    path: string;
    messageAr: string;
    messageEn: string;
  } | null>(null);
  const [adminWorkflowBusy, setAdminWorkflowBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState<Row | null>(null);
  const [rejectText, setRejectText] = useState("");
  const [allListSortKey, setAllListSortKey] = useState<AdminAchievementListSortKey>("default");
  const [allListSortAsc, setAllListSortAsc] = useState(true);
  const [aiAlertSortKey, setAiAlertSortKey] = useState<AdminAiAlertTableSortKey>("severity");
  const [aiAlertSortAsc, setAiAlertSortAsc] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/user/profile", { cache: "no-store" });
        if (!res.ok) {
          setAllowed(false);
          return;
        }
        const data = await res.json();
        const role = String(data.role || "");
        setUserRole(role);
        setAllowed(
          ["admin", "supervisor", "schoolAdmin", "teacher", "judge"].includes(role)
        );
      } catch {
        setAllowed(false);
      }
    })();
  }, []);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        tab,
        page: String(page),
        limit: "20",
      });
      if (debouncedQ) params.set("q", debouncedQ);
      if (mawhiba !== "all") params.set("mawhiba", mawhiba);
      const res = await fetch(`/api/admin/achievements?${params}`, { cache: "no-store" });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (res.status === 403) {
        setAllowed(false);
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(typeof j.error === "string" ? j.error : "Request failed");
      }
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotal(typeof data.total === "number" ? data.total : 0);
      if (data.meta && typeof data.meta.aiReviewUiEnabled === "boolean") {
        setAiReviewUiEnabled(data.meta.aiReviewUiEnabled);
      }
      if (data.meta && typeof data.meta.aiAssistEnabled === "boolean") {
        setAiAssistEnabled(data.meta.aiAssistEnabled);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tab, page, debouncedQ, mawhiba, router]);

  const applyListPatch = useCallback(
    (id: string, patch: Record<string, unknown>) => {
      const mergedPatch = { ...patch, id };
      setItems((prev) => {
        const next = prev.map((row) =>
          row.id === id ? (mergeAdminAchievementListRow(row as Row & Record<string, unknown>, mergedPatch) as Row) : row
        );
        if (tab !== "ai_flagged") return next;
        return next.filter((row) =>
          shouldShowInAiFlaggedTab({
            adminAttachmentOverall: row.adminAttachmentOverall ?? null,
            adminAttachmentAiReview: row.adminAttachmentAiReview ?? null,
            adminDuplicateMarked: row.adminDuplicateMarked,
            aiFlags: row.aiFlags,
            aiReviewStatus: row.aiReviewStatus,
            pendingReReview: row.pendingReReview,
            approvalStatus: row.approvalStatus,
            image: row.image ?? null,
            attachments: row.attachments,
            attachmentsCount: row.attachmentsCount,
          })
        );
      });
    },
    [tab]
  );

  useEffect(() => {
    if (allowed !== true) return;
    fetchList();
  }, [allowed, fetchList]);

  useEffect(() => {
    const parsed = parseReviewListQueryString(searchParams.toString());
    if (parsed.tab) setTab(parsed.tab);
    if (parsed.page !== undefined) setPage(parsed.page);
    if (parsed.q !== undefined) {
      setQ(parsed.q);
      setDebouncedQ(parsed.q);
    }
    if (parsed.sort) setAllListSortKey(parsed.sort);
    if (parsed.sortAsc === true) setAllListSortAsc(true);
    if (parsed.sortAsc === false) setAllListSortAsc(false);
    if (parsed.aiSort) setAiAlertSortKey(parsed.aiSort as AdminAiAlertTableSortKey);
    if (parsed.aiSortAsc === true) setAiAlertSortAsc(true);
    if (parsed.aiSortAsc === false) setAiAlertSortAsc(false);
  }, [searchParams]);

  const tableItems = useMemo(() => {
    if (tab !== "all" || allListSortKey === "default") return items;
    return [...items].sort((a, b) =>
      compareAdminAchievementListRows(a, b, allListSortKey, allListSortAsc, loc)
    );
  }, [items, tab, allListSortKey, allListSortAsc, loc]);

  const buildDetailHref = useCallback(
    (rowId: string) =>
      buildAchievementDetailHref(
        rowId,
        buildReturnToQueryString({
          tab,
          page,
          q: debouncedQ,
          allListSortKey,
          allListSortAsc,
          aiSortKey: aiAlertSortKey,
          aiSortAsc: aiAlertSortAsc,
        })
      ),
    [tab, page, debouncedQ, allListSortKey, allListSortAsc, aiAlertSortKey, aiAlertSortAsc]
  );

  const submitAdminWorkflow = async (
    id: string,
    action: "reject" | "mark_duplicate" | "unmark_duplicate" | "save_admin_note",
    extra?: { message?: string; adminNote?: string }
  ) => {
    setAdminWorkflowBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/achievements/${id}/admin-workflow`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof j.error === "string" ? j.error : "Failed");
      }
      if (typeof j.id === "string") {
        applyListPatch(j.id, j as Record<string, unknown>);
      }
      await fetchList();
      if (action === "reject") {
        setRejectOpen(null);
        setRejectText("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setAdminWorkflowBusy(false);
    }
  };

  const patchAction = async (id: string, path: string) => {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/achievements/${id}/${path}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof j.error === "string" ? j.error : "Failed");
      }
      applyListPatch(id, j as Record<string, unknown>);
      await fetchList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
      setConfirmPatch(null);
    }
  };

  const handleAiReviewerDraft = async () => {
    if (!revisionOpen || !aiAssistEnabled) return;
    setRevisionAiMessage(null);
    setAiReviewerBusy(true);
    try {
      const res = await fetch("/api/ai/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reviewer_notes",
          locale: isAr ? "ar" : "en",
          achievementId: revisionOpen.id,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        data?: { draftAr?: string; draftEn?: string };
      };
      if (!res.ok) {
        throw new Error(typeof j.error === "string" ? j.error : "AI request failed");
      }
      const text = isAr ? j.data?.draftAr || "" : j.data?.draftEn || "";
      if (!text.trim()) {
        throw new Error(isAr ? "لم يُرجع نموذجاً" : "Empty AI draft");
      }
      setRevisionText((prev) => {
        const p = prev.trim();
        return p ? `${p}\n\n———\n${text}` : text;
      });
    } catch (e) {
      setRevisionAiMessage(e instanceof Error ? e.message : "Error");
    } finally {
      setAiReviewerBusy(false);
    }
  };

  const submitRevision = async () => {
    if (!revisionOpen) return;
    const revisionId = revisionOpen.id;
    const msg = revisionText.trim();
    if (!msg) {
      setError(isAr ? "أدخل ملاحظة للطالب" : "Enter a note for the student");
      return;
    }
    setBusyId(revisionId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/achievements/${revisionId}/revision`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof j.error === "string" ? j.error : "Failed");
      }
      setRevisionOpen(null);
      setRevisionText("");
      await fetchList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  };

  const submitDelete = async () => {
    if (!deleteOpen) return;
    const reason = deleteText.trim();
    if (!reason) {
      setError(isAr ? "أدخل سبب الحذف" : "Enter a deletion reason");
      return;
    }
    setBusyId(deleteOpen.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/achievements/${deleteOpen.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof j.error === "string" ? j.error : "Failed");
      }
      setDeleteOpen(null);
      setDeleteText("");
      await fetchList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  };

  const renderActions = (row: Row) => (
    <AdminAchievementReviewActions
      row={row}
      locale={loc}
      userRole={userRole}
      busyId={busyId}
      listDetailHref={buildDetailHref(row.id)}
      onPatch={patchAction}
      onOpenConfirm={setConfirmPatch}
      onOpenRevision={(r) => {
        setRevisionOpen(r);
        setRevisionText("");
        setRevisionAiMessage(null);
      }}
      onOpenReject={(r) => {
        setRejectOpen(r);
        setRejectText("");
      }}
      onOpenDelete={(r) => {
        setDeleteOpen(r);
        setDeleteText("");
      }}
    />
  );

  if (allowed === null) {
    return (
      <PageContainer>
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
        </div>
      </PageContainer>
    );
  }

  if (!allowed) {
    return (
      <PageContainer>
        <p className="py-12 text-center text-text">
          {isAr ? "غير مصرح لك بعرض هذه الصفحة." : "You are not authorized to view this page."}
        </p>
      </PageContainer>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "all", label: isAr ? "الكل" : "All" },
    { key: "pending", label: isAr ? "قيد المراجعة" : "Pending" },
    { key: "needs_revision", label: isAr ? "يحتاج تعديل" : "Needs revision" },
    { key: "pending_re_review", label: isAr ? "تم تعديلها" : "Edited after approval" },
    { key: "approved", label: isAr ? "معتمد" : "Approved" },
    { key: "featured", label: isAr ? "مميز" : "Featured" },
    { key: "rejected", label: isAr ? "مرفوض" : "Rejected" },
    { key: "ai_flagged", label: isAr ? "فحص الذكاء الاصطناعي" : "AI inspection" },
    { key: "duplicate", label: isAr ? "اشتباه تكرار (AI)" : "Duplicate? (AI)" },
    { key: "admin_duplicate_marked", label: isAr ? "مكرر (قرار إداري)" : "Dup (admin)" },
    { key: "level_mismatch", label: isAr ? "مستوى غير متسق" : "Level mismatch?" },
    { key: "attachment_ai_mismatch", label: isAr ? "مرفقات: غير مطابقة" : "Attach: mismatch" },
    { key: "attachment_ai_unclear", label: isAr ? "مرفقات: غير واضحة" : "Attach: unclear" },
    { key: "attachment_ai_match", label: isAr ? "مرفقات: مطابقة" : "Attach: match" },
    { key: "no_attachments", label: isAr ? "بلا مرفقات" : "No attachments" },
  ];

  const renderRowCells = (row: Row) => {
    const raw = row as unknown as Record<string, unknown>;
    const displayTitle = resolveAchievementTitleForAdmin(raw, loc);
    const att = attachmentSummary(row.attachments, row.image, loc);
    const img = row.image;
    const imgUnopt =
      img && (img.startsWith("data:") || img.startsWith("http://") || img.startsWith("https://"));
    const lastMod = row.lastStudentEditAt || row.updatedAt;
    const lastModStr = lastMod
      ? new Date(lastMod).toLocaleString(isAr ? "ar-SA" : "en-US", {
          dateStyle: "short",
          timeStyle: "short",
        })
      : emptyCell(loc);
    const editorHint =
      row.lastEditedByRole === "student"
        ? isAr
          ? "طالب"
          : "Student"
        : row.lastEditedByRole === "admin"
          ? isAr
            ? "أدمن"
            : "Admin"
          : emptyCell(loc);

    const attachmentAiDecision = buildAdminAttachmentAiDecisionColumn(
      {
        adminAttachmentOverall: row.adminAttachmentOverall ?? null,
        adminAttachmentAiReview: row.adminAttachmentAiReview ?? null,
        adminDuplicateMarked: row.adminDuplicateMarked,
        aiFlags: row.aiFlags,
        aiReviewStatus: row.aiReviewStatus,
        pendingReReview: row.pendingReReview,
        image: row.image ?? null,
        attachments: row.attachments,
        attachmentsCount: row.attachmentsCount,
      },
      loc
    );

    const rowBgClass = buildAchievementWorkflowRowClassName(
      row.approvalStatus,
      tab === "all" ? "all_tab" : "default"
    );
    const tdBg = rowBgClass ? `${rowBgClass} ` : "";
    /** Sticky leading column needs opaque bg when row has no tint (tab الكل + pending). */
    const leadStickyBg = tdBg || (tab === "all" ? "bg-white " : "");
    const leadColsAllTab = tab === "all";

    return (
      <>
        {leadColsAllTab ? (
          <>
            <td
              className={`${leadStickyBg}sticky start-0 z-[1] max-w-[140px] px-2 py-2 align-top shadow-[2px_0_6px_-4px_rgba(0,0,0,0.12)]`}
            >
              <p className="text-xs font-medium text-text">{row.student.fullName || emptyCell(loc)}</p>
              <p className="text-[10px] text-text-light">{row.student.email}</p>
            </td>
            <td className={`${tdBg}max-w-[200px] px-2 py-2 align-top`}>
              <p className="font-semibold text-text line-clamp-3">{displayTitle}</p>
            </td>
            <td className={`${tdBg}px-2 py-2 align-top text-xs text-text-light`}>
              {formatAchievementLevelLabel(row.achievementLevel, loc)}
            </td>
          </>
        ) : null}
        <td className={`${tdBg}px-2 py-2 align-top`}>
          <Link
            href={buildDetailHref(row.id)}
            className="relative block h-12 w-12 overflow-hidden rounded-lg bg-gray-100 ring-1 ring-gray-200"
            aria-label={isAr ? "معاينة التفاصيل" : "View details"}
          >
            {img ? (
              <Image src={img} alt="" fill className="object-cover" unoptimized={Boolean(imgUnopt)} sizes="48px" />
            ) : (
              <span className="flex h-full items-center justify-center text-[10px] text-gray-400">—</span>
            )}
          </Link>
        </td>
        <td className={`${tdBg}max-w-[160px] px-2 py-2 align-top`}>
          <div className="flex flex-wrap items-center gap-1">
            <p className="font-semibold text-text line-clamp-2">{displayTitle}</p>
            {row.pendingReReview || row.resubmittedByStudent ? (
              <span className="shrink-0 rounded-full bg-sky-200 px-2 py-0.5 text-[10px] font-bold text-sky-950">
                {isAr ? "تم التعديل" : "Edited"}
              </span>
            ) : null}
          </div>
          <p className="text-[10px] text-text-light line-clamp-1">{row.reviewNote || ""}</p>
        </td>
        <td className={`${tdBg}hidden px-2 py-2 align-top text-xs text-text-light xl:table-cell`}>
          {formatAchievementTypeLabel(row.achievementType, loc)}
        </td>
        <td className={`${tdBg}hidden px-2 py-2 align-top text-xs text-text-light lg:table-cell`}>
          {formatAchievementCategoryLabel(row.achievementCategory, loc)}
        </td>
        <td className={`${tdBg}hidden px-2 py-2 align-top text-xs text-text-light lg:table-cell`}>
          {formatAchievementClassificationLabel(row.achievementClassification, loc)}
        </td>
        <td className={`${tdBg}hidden px-2 py-2 align-top text-xs text-text-light md:table-cell`}>
          {formatAchievementFieldLabel(row.inferredField, loc)}
        </td>
        <td className={`${tdBg}hidden max-w-[120px] px-2 py-2 align-top text-xs text-text-light xl:table-cell`}>
          {formatOrgLabel(raw, loc)}
        </td>
        <td className={`${tdBg}px-2 py-2 align-top text-xs text-text-light`}>
          {formatAchievementLevelLabel(row.achievementLevel, loc)}
        </td>
        <td className={`${tdBg}hidden px-2 py-2 align-top text-xs text-text-light lg:table-cell`}>
          {formatResultLine(raw, loc)}
        </td>
        <td className={`${tdBg}hidden px-2 py-2 align-top text-xs text-text-light xl:table-cell`}>
          {formatParticipationLabel(row.participationType, loc)}
        </td>
        <td className={`${tdBg}max-w-[120px] px-2 py-2 align-top`}>
          <p className="text-xs font-medium text-text">{row.student.fullName || emptyCell(loc)}</p>
          <p className="text-[10px] text-text-light">{row.student.email}</p>
        </td>
        <td className={`${tdBg}hidden px-2 py-2 align-top text-xs text-text-light md:table-cell`}>
          {getGradeLabel(row.student.grade, loc)}
          {row.student.section ? (
            <span className="block text-[10px] text-text-light">{getSectionLabel(row.student.section, loc)}</span>
          ) : null}
        </td>
        <td className={`${tdBg}whitespace-nowrap px-2 py-2 align-top text-xs text-text-light`}>
          {row.date || emptyCell(loc)}
        </td>
        <td className={`${tdBg}hidden px-2 py-2 align-top text-[10px] text-text-light xl:table-cell`}>
          <div>{lastModStr}</div>
          <div className="text-text-light/80">{editorHint}</div>
        </td>
        <td className={`${tdBg}px-2 py-2 align-top`}>
          <AchievementStatusBadge status={row.approvalStatus} locale={loc} />
          <div className="mt-1 flex flex-wrap gap-1">
            {row.adminDuplicateMarked ? (
              <span className="inline-block rounded-full bg-fuchsia-100 px-2 py-0.5 text-[9px] font-bold text-fuchsia-950">
                {isAr ? "مكرر" : "Dup"}
              </span>
            ) : null}
            {row.adminAttachmentOverall === "mismatch" ? (
              <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-bold text-red-900">
                {isAr ? "مرفقات ✗" : "Attach ✗"}
              </span>
            ) : row.adminAttachmentOverall === "unclear" ? (
              <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-950">
                {isAr ? "مرفقات ?" : "Attach ?"}
              </span>
            ) : row.adminAttachmentOverall === "match" ? (
              <span className="inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-900">
                {isAr ? "مرفقات ✓" : "Attach ✓"}
              </span>
            ) : null}
          </div>
          {row.certificateIssued ? (
            <p className="mt-1 text-[10px] font-bold text-emerald-800">
              {isAr ? "شهادة صادرة" : "Certificate issued"}
            </p>
          ) : null}
          {row.certificateIssued && row.certificateApprovedByRole ? (
            <p className="text-[9px] text-slate-600">
              {labelCertificateIssuerRole(row.certificateApprovedByRole, loc)}
            </p>
          ) : null}
          {row.certificateIssued && row.certificateIssuedAt ? (
            <p className="text-[9px] text-slate-500">
              {new Date(row.certificateIssuedAt).toLocaleDateString(isAr ? "ar-SA" : "en-GB")}
            </p>
          ) : null}
        </td>
        <td className={`${tdBg}hidden px-2 py-2 align-top text-xs xl:table-cell`}>
          {row.pendingReReview ? (
            <span className="font-semibold text-sky-800">{isAr ? "يحتاج إعادة مراجعة" : "Re-review"}</span>
          ) : row.resubmittedByStudent ? (
            <span className="font-semibold text-emerald-800">{isAr ? "بانتظار المراجعة" : "Awaiting review"}</span>
          ) : (
            <span className="text-text-light">{isAr ? "—" : "—"}</span>
          )}
        </td>
        <td className={`${tdBg}hidden px-2 py-2 align-top text-xs lg:table-cell`}>
          <span className={att.hasPdf ? "font-semibold text-rose-800" : ""}>{att.label}</span>
        </td>
        {aiReviewUiEnabled ? (
          <td className={`${tdBg}max-w-[140px] px-2 py-2 align-top text-xs`}>
            <span
              className={`inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[10px] font-bold leading-tight ${toneToBadgeClass(attachmentAiDecision.tone)}`}
            >
              <span className="line-clamp-2">{attachmentAiDecision.label}</span>
            </span>
          </td>
        ) : null}
        <td className={`${tdBg}px-2 py-2 align-top`}>{renderActions(row)}</td>
      </>
    );
  };

  const renderMobileCard = (row: Row) => {
    const raw = row as unknown as Record<string, unknown>;
    const displayTitle = resolveAchievementTitleForAdmin(raw, loc);
    const att = attachmentSummary(row.attachments, row.image, loc);
    const img = row.image;
    const imgUnopt =
      img && (img.startsWith("data:") || img.startsWith("http://") || img.startsWith("https://"));
    return (
      <div
        key={row.id}
        className={`rounded-2xl border border-gray-200 p-4 shadow-sm md:hidden ${buildAchievementWorkflowRowClassName(
          row.approvalStatus,
          tab === "all" ? "all_tab" : "default"
        )}`}
      >
        <div className="flex gap-3">
          <Link
            href={buildDetailHref(row.id)}
            className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-100"
            aria-label={isAr ? "معاينة التفاصيل" : "View details"}
          >
            {img ? (
              <Image src={img} alt="" fill className="object-cover" unoptimized={Boolean(imgUnopt)} sizes="64px" />
            ) : (
              <span className="flex h-full items-center justify-center text-gray-400">—</span>
            )}
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold text-text line-clamp-2">{displayTitle}</h3>
              {row.pendingReReview || row.resubmittedByStudent ? (
                <span className="rounded-full bg-sky-200 px-2 py-0.5 text-[10px] font-bold text-sky-950">
                  {isAr ? "تم التعديل" : "Edited"}
                </span>
              ) : null}
            </div>
            <p className="text-xs text-text-light">
              {row.student.fullName} · {formatAchievementTypeLabel(row.achievementType, loc)}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <AchievementStatusBadge status={row.approvalStatus} locale={loc} />
              <span className="text-xs text-text-light">{att.label}</span>
            </div>
          </div>
        </div>
        <div className="mt-3 border-t border-gray-100 pt-3">{renderActions(row)}</div>
      </div>
    );
  };

  return (
    <PageContainer>
      <div dir={isAr ? "rtl" : "ltr"}>
        <PageHeader
          title={isAr ? "مراجعة الإنجازات" : "Achievement review"}
          subtitle={
            isAr
              ? "إدارة واعتماد وتمييز إنجازات الطلاب"
              : "Approve, feature, and manage student achievements"
          }
          actions={
            <Link
              href="/admin/achievements/reports"
              className="text-sm font-semibold text-primary hover:underline"
            >
              {isAr ? "تقارير الإنجازات" : "Achievement reports"}
            </Link>
          }
        />
        {!aiReviewUiEnabled ? (
          <p className="mb-2 text-xs text-text-light">
            {isAr
              ? "طبقة مراجعة آلية متقدمة (AI UI) غير مفعّلة — العمود مخفي حتى يتم تفعيلها من الإعدادات."
              : "Advanced AI review UI is disabled — the column stays hidden until enabled in configuration."}
          </p>
        ) : (
          <p className="mb-4 max-w-3xl text-sm text-text-light">
            {isAr
              ? "اقتراحات الذكاء الاصطناعي للمساعدة فقط — القرار النهائي للمراجع البشري."
              : "AI suggestions are advisory only — the human reviewer has final authority."}
          </p>
        )}

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setTab(t.key);
                  setPage(1);
                }}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  tab === t.key ? "bg-primary text-white" : "bg-gray-100 text-text hover:bg-gray-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder={isAr ? "بحث: طالب، عنوان، نوع…" : "Search student, title, type…"}
              className="min-w-[200px] flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm sm:max-w-md"
              aria-label={isAr ? "بحث" : "Search"}
            />
            <select
              value={mawhiba}
              onChange={(e) => {
                setMawhiba(e.target.value as "all" | "yes" | "no");
                setPage(1);
              }}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm"
              aria-label={isAr ? "فلتر موهبة" : "Mawhiba filter"}
            >
              <option value="all">{isAr ? "موهبة: الكل" : "Mawhiba: all"}</option>
              <option value="yes">{isAr ? "طلاب موهبة" : "Mawhiba"}</option>
              <option value="no">{isAr ? "غير موهبة" : "Non‑Mawhiba"}</option>
            </select>
            <button
              type="button"
              onClick={() => fetchList()}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-text hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              {isAr ? "تحديث" : "Refresh"}
            </button>
          </div>
        </div>

        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {error}
          </div>
        ) : null}

        {tab === "ai_flagged" && aiReviewUiEnabled ? (
          <p className="mb-3 max-w-4xl rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs font-medium text-amber-950">
            {isAr
              ? "طابور عمل: سجلات تحتاج متابعة (مرفقات، تكرار، تنبيهات). السجلات المعتمدة نهائيًا أو المرفوضة تُستبعد تلقائيًا. يمكنك تغيير ترتيب الصفحة الحالية من القائمة فوق الجدول."
              : "Work queue: records that still need follow-up (attachments, duplicates, flags). Fully approved or rejected records drop out automatically. Use the sort control above the table for the current page."}
          </p>
        ) : null}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center text-text-light">
            {isAr ? "لا توجد نتائج." : "No achievements match this filter."}
          </div>
        ) : tab === "ai_flagged" && aiReviewUiEnabled ? (
          <AdminAchievementAiAlertTable
            rows={items as unknown as Record<string, unknown>[]}
            locale={loc}
            getDetailHref={buildDetailHref}
            sortKey={aiAlertSortKey}
            sortAsc={aiAlertSortAsc}
            onSortKeyChange={setAiAlertSortKey}
            onSortAscToggle={() => setAiAlertSortAsc((v) => !v)}
            renderActions={(rowId) => {
              const row = items.find((i) => i.id === rowId);
              return row ? renderActions(row) : null;
            }}
          />
        ) : (
          <>
            {tab === "all" && items.length > 0 ? (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-slate-50/80 px-3 py-2 text-xs">
                <label htmlFor="all-list-sort-key" className="font-semibold text-text">
                  {isAr ? "ترتيب حسب" : "Sort by"}
                </label>
                <select
                  id="all-list-sort-key"
                  value={allListSortKey}
                  onChange={(e) => setAllListSortKey(e.target.value as AdminAchievementListSortKey)}
                  className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 font-medium text-text"
                >
                  <option value="default">{isAr ? "الافتراضي (كما من السيرفر)" : "Default (server order)"}</option>
                  <option value="student">{isAr ? "اسم الطالب" : "Student name"}</option>
                  <option value="title">{isAr ? "اسم الإنجاز" : "Achievement title"}</option>
                  <option value="level">{isAr ? "مستوى الإنجاز" : "Achievement level"}</option>
                  <option value="review">{isAr ? "المراجعة" : "Review"}</option>
                </select>
                <button
                  type="button"
                  disabled={allListSortKey === "default"}
                  onClick={() => setAllListSortAsc((v) => !v)}
                  className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 font-semibold text-text disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {allListSortKey === "default"
                    ? isAr
                      ? "غير متاح"
                      : "N/A"
                    : allListSortAsc
                      ? isAr
                        ? "تصاعدي"
                        : "Ascending"
                      : isAr
                        ? "تنازلي"
                        : "Descending"}
                </button>
              </div>
            ) : null}
            <div className="hidden md:block overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
              <table
                className={`w-full text-sm ${tab === "all" ? "min-w-[1320px]" : "min-w-[1100px]"}`}
              >
                <thead className="border-b border-gray-200 bg-gray-50/90">
                  <tr>
                    {tab === "all" ? (
                      <>
                        <th className="sticky start-0 z-[2] bg-gray-50/95 px-2 py-2 text-start text-sm font-semibold text-text shadow-[2px_0_6px_-4px_rgba(0,0,0,0.12)]">
                          {isAr ? "اسم الطالب" : "Student name"}
                        </th>
                        <th className="px-2 py-2 text-start font-semibold text-text">
                          {isAr ? "اسم الإنجاز" : "Achievement name"}
                        </th>
                        <th className="px-2 py-2 text-start font-semibold text-text">
                          {isAr ? "مستوى الإنجاز" : "Achievement level"}
                        </th>
                      </>
                    ) : null}
                    <th className="px-2 py-2 text-start font-semibold text-text">{isAr ? "صورة" : "Img"}</th>
                    <th className="px-2 py-2 text-start font-semibold text-text">{isAr ? "العنوان" : "Title"}</th>
                    <th className="hidden px-2 py-2 text-start font-semibold text-text xl:table-cell">
                      {isAr ? "النوع" : "Type"}
                    </th>
                    <th className="hidden px-2 py-2 text-start font-semibold text-text lg:table-cell">
                      {isAr ? "التصنيف" : "Category"}
                    </th>
                    <th className="hidden px-2 py-2 text-start font-semibold text-text lg:table-cell">
                      {isAr ? "تصنيف المجال" : "Domain class."}
                    </th>
                    <th className="hidden px-2 py-2 text-start font-semibold text-text md:table-cell">
                      {isAr ? "المجال المستنتج" : "Field"}
                    </th>
                    <th className="hidden px-2 py-2 text-start font-semibold text-text xl:table-cell">
                      {isAr ? "الجهة" : "Org."}
                    </th>
                    <th className="px-2 py-2 text-start font-semibold text-text">{isAr ? "المستوى" : "Level"}</th>
                    <th className="hidden px-2 py-2 text-start font-semibold text-text lg:table-cell">
                      {isAr ? "النتيجة" : "Result"}
                    </th>
                    <th className="hidden px-2 py-2 text-start font-semibold text-text xl:table-cell">
                      {isAr ? "المشاركة" : "Partic."}
                    </th>
                    <th className="px-2 py-2 text-start font-semibold text-text">{isAr ? "الطالب" : "Student"}</th>
                    <th className="hidden px-2 py-2 text-start font-semibold text-text md:table-cell">
                      {isAr ? "صف / قسم" : "Grade"}
                    </th>
                    <th className="px-2 py-2 text-start font-semibold text-text">{isAr ? "التاريخ" : "Date"}</th>
                    <th className="hidden px-2 py-2 text-start font-semibold text-text xl:table-cell">
                      {isAr ? "آخر تعديل" : "Modified"}
                    </th>
                    <th className="px-2 py-2 text-start font-semibold text-text">{isAr ? "المراجعة" : "Review"}</th>
                    <th className="hidden px-2 py-2 text-start font-semibold text-text xl:table-cell">
                      {isAr ? "التعديل" : "Edit state"}
                    </th>
                    <th className="hidden px-2 py-2 text-start font-semibold text-text lg:table-cell">
                      {isAr ? "مرفقات" : "Files"}
                    </th>
                    {aiReviewUiEnabled ? (
                      <th className="px-2 py-2 text-start font-semibold text-text">
                        {isAr ? "قرار الذكاء الاصطناعي" : "AI attachment verdict"}
                      </th>
                    ) : null}
                    <th className="px-2 py-2 text-start font-semibold text-text">{isAr ? "إجراءات" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody>
                  {tableItems.map((row) => {
                    const trBg = buildAchievementWorkflowRowClassName(
                      row.approvalStatus,
                      tab === "all" ? "all_tab" : "default"
                    );
                    return (
                      <tr
                        key={row.id}
                        className={`border-b border-gray-100 last:border-0 ${trBg}`.trim()}
                      >
                        {renderRowCells(row)}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 md:hidden">{tableItems.map((row) => renderMobileCard(row))}</div>
          </>
        )}

        {!loading && total > 20 ? (
          <div className="mt-4 flex justify-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-40"
            >
              {isAr ? "السابق" : "Prev"}
            </button>
            <span className="px-3 py-2 text-sm text-text-light">
              {page} / {Math.max(1, Math.ceil(total / 20))}
            </span>
            <button
              type="button"
              disabled={page >= Math.ceil(total / 20)}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-40"
            >
              {isAr ? "التالي" : "Next"}
            </button>
          </div>
        ) : null}

        {rejectOpen ? (
          <div
            className="fixed inset-0 z-[115] flex items-end justify-center bg-black/40 p-4 sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-achievement-title"
            onClick={() => setRejectOpen(null)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setRejectOpen(null);
            }}
          >
            <div
              className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="reject-achievement-title" className="text-lg font-bold text-red-900">
                {isAr ? "رفض الإنجاز" : "Reject achievement"}
              </h3>
              <p className="mt-1 text-sm text-text-light">
                {isAr
                  ? "سيُشعر الطالب ويُلغى أي شهادة مرتبطة بهذا السجل."
                  : "The student will be notified; any linked certificate will be revoked."}
              </p>
              <textarea
                value={rejectText}
                onChange={(e) => setRejectText(e.target.value)}
                rows={5}
                className="mt-3 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                placeholder={isAr ? "سبب الرفض (يظهر للطالب)…" : "Rejection reason (visible to student)…"}
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectOpen(null)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="button"
                  disabled={adminWorkflowBusy || !rejectOpen}
                  onClick={() => {
                    const msg = rejectText.trim();
                    if (!msg) {
                      setError(isAr ? "أدخل سبب الرفض" : "Enter a rejection reason");
                      return;
                    }
                    if (!rejectOpen) return;
                    void submitAdminWorkflow(rejectOpen.id, "reject", { message: msg });
                  }}
                  className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
                >
                  {isAr ? "تأكيد الرفض" : "Confirm reject"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {confirmPatch ? (
          <div
            className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40 p-4 sm:items-center"
            role="dialog"
            aria-modal="true"
            onClick={() => setConfirmPatch(null)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setConfirmPatch(null);
            }}
          >
            <div
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-sm text-text">
                {isAr ? confirmPatch.messageAr : confirmPatch.messageEn}
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmPatch(null)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="button"
                  disabled={busyId === confirmPatch.id}
                  onClick={() => patchAction(confirmPatch.id, confirmPatch.path)}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {isAr ? "تأكيد" : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {revisionOpen ? (
          <div
            className="fixed inset-0 z-[110] flex items-end justify-center bg-black/40 p-4 sm:items-center"
            role="dialog"
            aria-modal="true"
            onClick={() => setRevisionOpen(null)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setRevisionOpen(null);
            }}
          >
            <div
              className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-text">
                {isAr ? "طلب تعديل من الطالب" : "Request revision from student"}
              </h3>
              <textarea
                value={revisionText}
                onChange={(e) => setRevisionText(e.target.value)}
                rows={5}
                className="mt-3 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                placeholder={isAr ? "اشرح ما يجب تعديله…" : "Explain what must be revised…"}
              />
              {revisionAiMessage ? (
                <p className="mt-2 text-xs text-red-600" role="alert">
                  {revisionAiMessage}
                </p>
              ) : null}
              {aiAssistEnabled ? (
                <div className="mt-3">
                  <button
                    type="button"
                    disabled={aiReviewerBusy}
                    onClick={handleAiReviewerDraft}
                    className="inline-flex items-center gap-2 rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-950 hover:bg-violet-100 disabled:opacity-50"
                  >
                    {aiReviewerBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <Sparkles className="h-4 w-4" aria-hidden />
                    )}
                    {isAr ? "مسودة بالذكاء الاصطناعي (اقتراح)" : "AI draft suggestion"}
                  </button>
                  <p className="mt-1 text-[11px] text-text-light">
                    {isAr
                      ? "للمساعدة فقط — راجع وعدّل قبل الإرسال."
                      : "Advisory only — edit before sending."}
                  </p>
                </div>
              ) : null}
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRevisionOpen(null)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="button"
                  disabled={busyId === revisionOpen.id}
                  onClick={submitRevision}
                  className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {isAr ? "إرسال" : "Send"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {deleteOpen ? (
          <div
            className="fixed inset-0 z-[110] flex items-end justify-center bg-black/40 p-4 sm:items-center"
            role="dialog"
            aria-modal="true"
            onClick={() => setDeleteOpen(null)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setDeleteOpen(null);
            }}
          >
            <div
              className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-red-900">
                {isAr ? "حذف الإنجاز" : "Delete achievement"}
              </h3>
              <p className="mt-1 text-sm text-text-light">
                {isAr
                  ? "سيتم إشعار الطالب. هذا الإجراء لا يمكن التراجع عنه."
                  : "The student will be notified. This cannot be undone."}
              </p>
              <textarea
                value={deleteText}
                onChange={(e) => setDeleteText(e.target.value)}
                rows={4}
                className="mt-3 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                placeholder={isAr ? "سبب الحذف (إلزامي)…" : "Deletion reason (required)…"}
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteOpen(null)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="button"
                  disabled={busyId === deleteOpen.id}
                  onClick={submitDelete}
                  className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
                >
                  {isAr ? "حذف نهائي" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </PageContainer>
  );
};

const AdminAchievementsReviewPage = () => (
  <Suspense
    fallback={
      <PageContainer>
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
        </div>
      </PageContainer>
    }
  >
    <AdminAchievementsReviewPageContent />
  </Suspense>
);

export default AdminAchievementsReviewPage;
