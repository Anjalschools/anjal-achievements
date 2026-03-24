"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageContainer from "@/components/layout/PageContainer";
import AchievementStatusBadge from "@/components/achievements/AchievementStatusBadge";
import AdminAchievementReviewActions from "@/components/admin/AdminAchievementReviewActions";
import AdminAchievementAdminEditForm from "@/components/admin/AdminAchievementAdminEditForm";
import AdminAchievementVisibilityCard from "@/components/admin/AdminAchievementVisibilityCard";
import { AdminAchievementReviewDetailBody } from "@/components/admin/AdminAchievementReviewDetailBody";
import { detailApiToListRow } from "@/lib/admin-achievement-detail-to-list-row";
import { getLocale } from "@/lib/i18n";
import { resolveAchievementTitleForAdmin } from "@/lib/admin-achievement-labels";
import type { AdminAchievementDetailApi, AdminAchievementReviewListRow } from "@/types/admin-achievement-review";
import { Loader2, Sparkles, ArrowLeft, ArrowRight, Pencil } from "lucide-react";

type ConfirmPatch = {
  id: string;
  path: string;
  messageAr: string;
  messageEn: string;
};

type AdminAchievementReviewDetailScreenProps = {
  achievementId: string;
  /** Encoded query string for list (without leading ?) */
  returnTo: string | undefined;
};

const AdminAchievementReviewDetailScreen = ({
  achievementId,
  returnTo,
}: AdminAchievementReviewDetailScreenProps) => {
  const router = useRouter();
  const locale = getLocale();
  const isAr = locale === "ar";
  const loc = isAr ? "ar" : "en";

  const backHref = `/admin/achievements/review${returnTo && returnTo.trim() ? `?${returnTo.trim()}` : ""}`;

  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [userRole, setUserRole] = useState<string>("");
  const [detailPayload, setDetailPayload] = useState<AdminAchievementDetailApi | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [aiAssistEnabled, setAiAssistEnabled] = useState(false);
  const [aiReviewerBusy, setAiReviewerBusy] = useState(false);
  const [revisionAiMessage, setRevisionAiMessage] = useState<string | null>(null);
  const [revisionOpen, setRevisionOpen] = useState<AdminAchievementReviewListRow | null>(null);
  const [revisionText, setRevisionText] = useState("");
  const [deleteOpen, setDeleteOpen] = useState<AdminAchievementReviewListRow | null>(null);
  const [deleteText, setDeleteText] = useState("");
  const [confirmPatch, setConfirmPatch] = useState<ConfirmPatch | null>(null);
  const [attachmentAiBusy, setAttachmentAiBusy] = useState(false);
  const [adminNoteDraft, setAdminNoteDraft] = useState("");
  const [adminWorkflowBusy, setAdminWorkflowBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState<AdminAchievementReviewListRow | null>(null);
  const [rejectText, setRejectText] = useState("");
  const [clientOrigin, setClientOrigin] = useState("");
  const [editAchievementOpen, setEditAchievementOpen] = useState(false);

  useEffect(() => {
    setClientOrigin(typeof window !== "undefined" ? window.location.origin : "");
  }, []);

  const loadDetail = useCallback(async () => {
    setDetailLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/achievements/${achievementId}/detail`, { cache: "no-store" });
      const j = (await res.json().catch(() => ({}))) as AdminAchievementDetailApi & { error?: string };
      if (!res.ok || !j?.achievement) {
        throw new Error(typeof j.error === "string" ? j.error : "detail failed");
      }
      setDetailPayload(j);
    } catch {
      setError(isAr ? "تعذر تحميل التفاصيل" : "Could not load details");
      setDetailPayload(null);
    } finally {
      setDetailLoading(false);
    }
  }, [achievementId, isAr]);

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
        setAllowed(["admin", "supervisor", "schoolAdmin", "teacher", "judge"].includes(role));
      } catch {
        setAllowed(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (allowed !== true) return;
    void loadDetail();
  }, [allowed, loadDetail]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/achievements?page=1&limit=1&tab=all", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (data.meta && typeof data.meta.aiAssistEnabled === "boolean") {
          setAiAssistEnabled(data.meta.aiAssistEnabled);
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  useEffect(() => {
    if (!detailPayload?.achievement) return;
    const n = detailPayload.achievement.adminWorkflowNote;
    setAdminNoteDraft(typeof n === "string" ? n : "");
  }, [detailPayload]);

  const listRow: AdminAchievementReviewListRow | null = detailPayload
    ? detailApiToListRow(detailPayload)
    : null;

  const navigateBack = () => {
    router.push(backHref);
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
      navigateBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
      setConfirmPatch(null);
    }
  };

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
      if (action === "reject") {
        setRejectOpen(null);
        setRejectText("");
        navigateBack();
        return;
      }
      await loadDetail();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setAdminWorkflowBusy(false);
    }
  };

  const runAttachmentAiReview = async () => {
    setAttachmentAiBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/achievements/${achievementId}/attachment-ai-review`, {
        method: "POST",
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        review?: Record<string, unknown>;
      };
      if (!res.ok) {
        throw new Error(typeof j.error === "string" ? j.error : "AI review failed");
      }
      if (j.review) {
        setDetailPayload((prev) =>
          prev
            ? {
                ...prev,
                achievement: { ...prev.achievement, adminAttachmentAiReview: j.review },
              }
            : null
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setAttachmentAiBusy(false);
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
      navigateBack();
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
      navigateBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  };

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

  const titleAchievement = detailPayload
    ? resolveAchievementTitleForAdmin(detailPayload.achievement, loc)
    : "";

  const BackIcon = isAr ? ArrowRight : ArrowLeft;

  return (
    <PageContainer>
      <div dir={isAr ? "rtl" : "ltr"} className="space-y-6">
        <header className="border-b border-gray-200 pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={backHref}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-text hover:bg-gray-50"
              >
                <BackIcon className="h-4 w-4 shrink-0" aria-hidden />
                {isAr ? "رجوع إلى المراجعة" : "Back to review"}
              </Link>
              {listRow ? <AchievementStatusBadge status={listRow.approvalStatus} locale={loc} /> : null}
              {userRole === "admin" && detailPayload ? (
                <button
                  type="button"
                  onClick={() => setEditAchievementOpen((v) => !v)}
                  className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                    editAchievementOpen
                      ? "border-indigo-600 bg-indigo-50 text-indigo-900"
                      : "border-indigo-300 bg-white text-indigo-900 hover:bg-indigo-50/80"
                  }`}
                  aria-expanded={editAchievementOpen}
                  aria-controls="admin-achievement-edit-panel"
                >
                  <Pencil className="h-4 w-4 shrink-0" aria-hidden />
                  {isAr ? "تعديل الإنجاز" : "Edit achievement"}
                </button>
              ) : null}
            </div>
            <div className="min-w-0 flex-1 text-start">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-light">
                {isAr ? "تفاصيل الإنجاز" : "Achievement details"}
              </p>
              <h1 className="mt-1 break-words text-xl font-bold text-text md:text-2xl">{titleAchievement || "—"}</h1>
              {detailPayload?.student?.fullName ? (
                <p className="mt-1 text-sm text-text-light">{detailPayload.student.fullName}</p>
              ) : null}
            </div>
          </div>
        </header>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {error}
          </div>
        ) : null}

        {detailLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
          </div>
        ) : detailPayload && listRow ? (
          <div className="grid gap-6 lg:grid-cols-12">
            {userRole === "admin" ? (
              <div id="admin-achievement-edit-panel" className="lg:col-span-12">
                <AdminAchievementAdminEditForm
                  achievementId={achievementId}
                  detail={detailPayload}
                  isAr={isAr}
                  open={editAchievementOpen}
                  onOpenChange={setEditAchievementOpen}
                  onSaved={loadDetail}
                />
              </div>
            ) : null}
            <aside className="space-y-4 lg:col-span-4 xl:col-span-3">
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <h2 className="text-xs font-bold uppercase tracking-wide text-text-light">
                  {isAr ? "ملخص" : "Summary"}
                </h2>
                <p className="mt-2 text-sm font-semibold text-text">
                  {detailPayload.student?.fullName || (isAr ? "—" : "—")}
                </p>
                <p className="text-xs text-text-light">{detailPayload.student?.email}</p>
                <div className="mt-3">
                  <AchievementStatusBadge status={detailPayload.computed.approvalStatus} locale={loc} />
                </div>
                {listRow.image ? (
                  <div className="relative mt-4 aspect-video w-full overflow-hidden rounded-xl bg-gray-100 ring-1 ring-gray-200">
                    <Image
                      src={listRow.image}
                      alt=""
                      fill
                      className="object-cover"
                      unoptimized={
                        listRow.image.startsWith("data:") ||
                        listRow.image.startsWith("http://") ||
                        listRow.image.startsWith("https://")
                      }
                      sizes="(max-width: 1024px) 100vw, 280px"
                    />
                  </div>
                ) : null}
              </div>

              <AdminAchievementVisibilityCard
                achievementId={achievementId}
                detail={detailPayload}
                isAr={isAr}
                onSaved={loadDetail}
              />

              <div className="rounded-2xl border border-gray-200 bg-slate-50/80 p-4 shadow-sm">
                <h2 className="text-xs font-bold uppercase tracking-wide text-slate-700">
                  {isAr ? "سير عمل إداري" : "Admin workflow"}
                </h2>
                <p className="mt-1 text-[10px] text-text-light">
                  {isAr
                    ? "قراراتك نهائية. تحليل المرفقات بالذكاء الاصطناعي استشاري فقط."
                    : "Your decisions are final. Attachment AI is advisory only."}
                </p>
                <label className="mt-3 block text-[11px] font-semibold text-text" htmlFor="admin-workflow-note-page">
                  {isAr ? "ملاحظة إدارية (داخلية)" : "Internal admin note"}
                </label>
                <textarea
                  id="admin-workflow-note-page"
                  value={adminNoteDraft}
                  onChange={(e) => setAdminNoteDraft(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                  disabled={adminWorkflowBusy}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={adminWorkflowBusy}
                    onClick={() =>
                      void submitAdminWorkflow(achievementId, "save_admin_note", {
                        adminNote: adminNoteDraft,
                      })
                    }
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {isAr ? "حفظ الملاحظة" : "Save note"}
                  </button>
                  {detailPayload.achievement?.adminDuplicateMarked === true ? (
                    <button
                      type="button"
                      disabled={adminWorkflowBusy}
                      onClick={() => void submitAdminWorkflow(achievementId, "unmark_duplicate")}
                      className="rounded-lg border border-fuchsia-300 bg-fuchsia-50 px-3 py-1.5 text-xs font-semibold text-fuchsia-950 hover:bg-fuchsia-100 disabled:opacity-50"
                    >
                      {isAr ? "إلغاء تعليم التكرار" : "Unmark duplicate"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={adminWorkflowBusy}
                      onClick={() => void submitAdminWorkflow(achievementId, "mark_duplicate")}
                      className="rounded-lg border border-fuchsia-400 bg-fuchsia-100 px-3 py-1.5 text-xs font-semibold text-fuchsia-950 hover:bg-fuchsia-200 disabled:opacity-50"
                    >
                      {isAr ? "تعليم كمكرر" : "Mark duplicate"}
                    </button>
                  )}
                </div>
                {adminWorkflowBusy ? (
                  <p className="mt-2 text-[10px] text-text-light">
                    <Loader2 className="inline h-3 w-3 animate-spin" aria-hidden />{" "}
                    {isAr ? "جاري الحفظ…" : "Saving…"}
                  </p>
                ) : null}
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-text-light">
                  {isAr ? "إجراءات" : "Actions"}
                </h2>
                <AdminAchievementReviewActions
                  row={listRow}
                  locale={loc}
                  userRole={userRole}
                  busyId={busyId}
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
              </div>
            </aside>

            <div className="lg:col-span-8 xl:col-span-9">
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:p-6">
                <AdminAchievementReviewDetailBody
                  detail={detailPayload}
                  loc={loc}
                  isAr={isAr}
                  clientOrigin={clientOrigin}
                  aiAssistEnabled={aiAssistEnabled}
                  attachmentAiBusy={attachmentAiBusy}
                  onRunAttachmentAi={() => void runAttachmentAiReview()}
                />
              </div>
            </div>
          </div>
        ) : (
          <p className="text-center text-text-light">{isAr ? "لا توجد بيانات." : "No data."}</p>
        )}

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
              <p className="text-sm text-text">{isAr ? confirmPatch.messageAr : confirmPatch.messageEn}</p>
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

export default AdminAchievementReviewDetailScreen;
