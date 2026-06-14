"use client";

import { useState } from "react";
import {
  Calendar,
  CheckCircle2,
  FileText,
  Link2,
  MessageSquare,
  Video,
  XCircle,
} from "lucide-react";
import { getLocale } from "@/lib/i18n";

type InstitutionConversationQuickActionsProps = {
  applicationId: string | null;
  threadKind: "student" | "supervisor";
  onActionComplete?: () => void;
};

const InstitutionConversationQuickActions = ({
  applicationId,
  threadKind,
  onActionComplete,
}: InstitutionConversationQuickActionsProps) => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showCustomDoc, setShowCustomDoc] = useState(false);
  const [showMeetingLink, setShowMeetingLink] = useState<"zoom" | "teams" | "meet" | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [notes, setNotes] = useState("");

  const runAction = async (action: string, extra?: Record<string, unknown>) => {
    if (threadKind === "student" && !applicationId && action !== "send_feedback") return;
    setBusy(action);
    setError(null);
    try {
      const res = await fetch("/api/institution/training/quick-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          applicationId: applicationId || undefined,
          locale,
          ...extra,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setShowSchedule(false);
      setShowCustomDoc(false);
      setShowMeetingLink(null);
      setShowFeedback(false);
      setNotes("");
      onActionComplete?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  };

  const btnClass =
    "inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs font-bold text-text transition hover:border-primary hover:bg-primary/5 disabled:opacity-60";

  return (
    <div className="border-t border-border/70 pt-3">
      <p className="mb-2 text-xs font-bold text-text-light">
        {isAr ? "إجراءات سريعة" : "Quick actions"}
      </p>
      {error ? <p className="mb-2 text-xs text-red-600">{error}</p> : null}

      {threadKind === "student" && applicationId ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!!busy} className={btnClass} onClick={() => void runAction("request_cv")}>
            <FileText className="h-3.5 w-3.5" aria-hidden />
            {isAr ? "طلب سيرة ذاتية" : "Request CV"}
          </button>
          <button
            type="button"
            disabled={!!busy}
            className={btnClass}
            onClick={() => void runAction("request_intro_video")}
          >
            <Video className="h-3.5 w-3.5" aria-hidden />
            {isAr ? "طلب فيديو" : "Request video"}
          </button>
          <button
            type="button"
            disabled={!!busy}
            className={btnClass}
            onClick={() => void runAction("request_motivation_letter")}
          >
            <FileText className="h-3.5 w-3.5" aria-hidden />
            {isAr ? "خطاب دافع" : "Motivation letter"}
          </button>
          <button
            type="button"
            disabled={!!busy}
            className={btnClass}
            onClick={() => void runAction("request_portfolio")}
          >
            <FileText className="h-3.5 w-3.5" aria-hidden />
            {isAr ? "ملف أعمال" : "Portfolio"}
          </button>
          <button type="button" disabled={!!busy} className={btnClass} onClick={() => setShowCustomDoc((v) => !v)}>
            <FileText className="h-3.5 w-3.5" aria-hidden />
            {isAr ? "مستند مخصص" : "Custom document"}
          </button>
          <button type="button" disabled={!!busy} className={btnClass} onClick={() => setShowSchedule((v) => !v)}>
            <Calendar className="h-3.5 w-3.5" aria-hidden />
            {isAr ? "جدولة مقابلة" : "Schedule interview"}
          </button>
          <button type="button" disabled={!!busy} className={btnClass} onClick={() => setShowMeetingLink("zoom")}>
            <Link2 className="h-3.5 w-3.5" aria-hidden />
            Zoom
          </button>
          <button type="button" disabled={!!busy} className={btnClass} onClick={() => setShowMeetingLink("teams")}>
            <Link2 className="h-3.5 w-3.5" aria-hidden />
            Teams
          </button>
          <button type="button" disabled={!!busy} className={btnClass} onClick={() => setShowMeetingLink("meet")}>
            <Link2 className="h-3.5 w-3.5" aria-hidden />
            Meet
          </button>
          <button
            type="button"
            disabled={!!busy}
            className={`${btnClass} border-emerald-300 text-emerald-900`}
            onClick={() => void runAction("accept_student", { notes: notes.trim() || undefined })}
          >
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            {isAr ? "قبول" : "Accept"}
          </button>
          <button
            type="button"
            disabled={!!busy}
            className={`${btnClass} border-red-300 text-red-900`}
            onClick={() => void runAction("reject_student", { rejectionReason: notes.trim() || undefined })}
          >
            <XCircle className="h-3.5 w-3.5" aria-hidden />
            {isAr ? "رفض" : "Reject"}
          </button>
          <button type="button" disabled={!!busy} className={btnClass} onClick={() => setShowFeedback((v) => !v)}>
            <MessageSquare className="h-3.5 w-3.5" aria-hidden />
            {isAr ? "ملاحظات" : "Feedback"}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!!busy} className={btnClass} onClick={() => setShowMeetingLink("zoom")}>
            <Link2 className="h-3.5 w-3.5" aria-hidden />
            Zoom
          </button>
          <button type="button" disabled={!!busy} className={btnClass} onClick={() => setShowMeetingLink("teams")}>
            <Link2 className="h-3.5 w-3.5" aria-hidden />
            Teams
          </button>
          <button type="button" disabled={!!busy} className={btnClass} onClick={() => setShowMeetingLink("meet")}>
            <Link2 className="h-3.5 w-3.5" aria-hidden />
            Meet
          </button>
          <button type="button" disabled={!!busy} className={btnClass} onClick={() => setShowFeedback((v) => !v)}>
            <MessageSquare className="h-3.5 w-3.5" aria-hidden />
            {isAr ? "ملاحظات" : "Feedback"}
          </button>
        </div>
      )}

      {showCustomDoc ? (
        <div className="mt-3 space-y-2 rounded-xl border border-border bg-gray-50 p-3">
          <input
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            placeholder={isAr ? "عنوان المستند" : "Document title"}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
          <input
            value={customDescription}
            onChange={(e) => setCustomDescription(e.target.value)}
            placeholder={isAr ? "وصف (اختياري)" : "Description (optional)"}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={!!busy || !customTitle.trim()}
            className={btnClass}
            onClick={() =>
              void runAction("request_custom_document", {
                customTitle: customTitle.trim(),
                customDescription: customDescription.trim(),
              })
            }
          >
            {isAr ? "إرسال الطلب" : "Send request"}
          </button>
        </div>
      ) : null}

      {showSchedule ? (
        <div className="mt-3 space-y-2 rounded-xl border border-border bg-gray-50 p-3">
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            aria-label={isAr ? "موعد المقابلة" : "Interview time"}
          />
          <input
            value={meetingUrl}
            onChange={(e) => setMeetingUrl(e.target.value)}
            placeholder={isAr ? "رابط الاجتماع (اختياري)" : "Meeting link (optional)"}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={!!busy || !scheduledAt}
            className={btnClass}
            onClick={() =>
              void runAction("schedule_interview", {
                scheduledAt: new Date(scheduledAt).toISOString(),
                meetingUrl: meetingUrl.trim() || undefined,
              })
            }
          >
            {isAr ? "تأكيد الجدولة" : "Confirm schedule"}
          </button>
        </div>
      ) : null}

      {showMeetingLink ? (
        <div className="mt-3 space-y-2 rounded-xl border border-border bg-gray-50 p-3">
          <input
            value={meetingUrl}
            onChange={(e) => setMeetingUrl(e.target.value)}
            placeholder={isAr ? "الصق رابط الاجتماع" : "Paste meeting link"}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={!!busy || !meetingUrl.trim()}
            className={btnClass}
            onClick={() =>
              void runAction(
                showMeetingLink === "zoom"
                  ? "send_zoom_link"
                  : showMeetingLink === "teams"
                    ? "send_teams_link"
                    : "send_meet_link",
                { meetingUrl: meetingUrl.trim() }
              )
            }
          >
            {isAr ? "إرسال الرابط" : "Send link"}
          </button>
        </div>
      ) : null}

      {showFeedback ? (
        <div className="mt-3 space-y-2 rounded-xl border border-border bg-gray-50 p-3">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={isAr ? "اكتب ملاحظاتك…" : "Write your feedback…"}
            className="min-h-16 w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={!!busy || !notes.trim()}
            className={btnClass}
            onClick={() => void runAction("send_feedback", { notes: notes.trim() })}
          >
            {isAr ? "إرسال الملاحظات" : "Send feedback"}
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default InstitutionConversationQuickActions;
