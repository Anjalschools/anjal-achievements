"use client";

import Link from "next/link";
import type { AdminAchievementReviewListRow } from "@/types/admin-achievement-review";

type ConfirmPatch = {
  id: string;
  path: string;
  messageAr: string;
  messageEn: string;
};

export type AdminAchievementReviewActionsProps = {
  row: AdminAchievementReviewListRow;
  locale: "ar" | "en";
  userRole: string;
  busyId: string | null;
  listDetailHref?: string;
  onPatch: (id: string, path: string) => void;
  onOpenConfirm: (p: ConfirmPatch) => void;
  onOpenRevision: (row: AdminAchievementReviewListRow) => void;
  onOpenReject: (row: AdminAchievementReviewListRow) => void;
  onOpenDelete: (row: AdminAchievementReviewListRow) => void;
};

const AdminAchievementReviewActions = ({
  row,
  locale,
  userRole,
  busyId,
  listDetailHref,
  onPatch,
  onOpenConfirm,
  onOpenRevision,
  onOpenReject,
  onOpenDelete,
}: AdminAchievementReviewActionsProps) => {
  const isAr = locale === "ar";
  const busy = busyId === row.id;
  const st = row.approvalStatus;
  const showPrimary =
    st === "pending" ||
    st === "needs_revision" ||
    st === "pending_re_review" ||
    st === "rejected";

  return (
    <div className="flex flex-col gap-1.5">
      {listDetailHref ? (
        <Link
          href={listDetailHref}
          className="rounded-lg border border-primary/40 bg-primary/5 px-3 py-1.5 text-center text-xs font-semibold text-primary hover:bg-primary/10"
        >
          {isAr ? "تفاصيل" : "Details"}
        </Link>
      ) : null}
      {showPrimary && userRole === "judge" ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onPatch(row.id, "approve-judge")}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {isAr ? "اعتماد (محكم)" : "Approve (judge)"}
        </button>
      ) : showPrimary ? (
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            onOpenConfirm({
              id: row.id,
              path: "approve",
              messageAr: "تأكيد اعتماد هذا الإنجاز؟",
              messageEn: "Approve this achievement?",
            })
          }
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {isAr ? "اعتماد" : "Approve"}
        </button>
      ) : null}
      {showPrimary ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onOpenRevision(row)}
          className="rounded-lg border border-amber-400 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-50"
        >
          {isAr ? "طلب تعديل" : "Needs revision"}
        </button>
      ) : null}
      {showPrimary ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onOpenReject(row)}
          className="rounded-lg border border-red-400 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-950 hover:bg-red-100 disabled:opacity-50"
        >
          {isAr ? "رفض" : "Reject"}
        </button>
      ) : null}
      {st === "approved" && !row.pendingReReview ? (
        <>
          {(userRole === "admin" || userRole === "schoolAdmin") && !row.principalApprovedAt ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onPatch(row.id, "approve-principal")}
              className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-950 hover:bg-indigo-100 disabled:opacity-50"
            >
              {isAr ? "اعتماد مدير المدرسة" : "Principal sign-off"}
            </button>
          ) : null}
          {["admin", "teacher", "supervisor"].includes(userRole) && !row.activitySupervisorApprovedAt ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onPatch(row.id, "approve-activity-supervisor")}
              className="rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-950 hover:bg-violet-100 disabled:opacity-50"
            >
              {isAr ? "اعتماد مشرف النشاط" : "Supervisor sign-off"}
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              onOpenConfirm({
                id: row.id,
                path: "feature",
                messageAr: "تمييز هذا الإنجاز على المنصة؟",
                messageEn: "Feature this achievement?",
              })
            }
            className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {isAr ? "تمييز" : "Feature"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              onOpenConfirm({
                id: row.id,
                path: "pending",
                messageAr: "إرجاع الإنجاز لحالة المراجعة؟ قد تُلغى الشهادة الحالية.",
                messageEn: "Return to pending review? Current certificate may be invalidated.",
              })
            }
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-text hover:bg-gray-50 disabled:opacity-50"
          >
            {isAr ? "إرجاع للمراجعة" : "Back to pending"}
          </button>
        </>
      ) : null}
      {st === "featured" ? (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={() => onPatch(row.id, "unfeature")}
            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-50"
          >
            {isAr ? "إلغاء التمييز" : "Unfeature"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              onOpenConfirm({
                id: row.id,
                path: "pending",
                messageAr: "إرجاع الإنجاز لحالة المراجعة؟",
                messageEn: "Return this achievement to pending review?",
              })
            }
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-text hover:bg-gray-50 disabled:opacity-50"
          >
            {isAr ? "إرجاع للمراجعة" : "Back to pending"}
          </button>
        </>
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => onOpenDelete(row)}
        className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-900 hover:bg-red-100 disabled:opacity-50"
      >
        {isAr ? "حذف" : "Delete"}
      </button>
    </div>
  );
};

export default AdminAchievementReviewActions;
