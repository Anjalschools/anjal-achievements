"use client";

import { useState } from "react";
import { Loader2, Pencil, RotateCcw, Trash2 } from "lucide-react";

export type PartnershipMessageBubbleRow = {
  id: string;
  senderRole: string;
  body: string;
  templateKey?: string | null;
  createdAt: string | null;
  editedAt?: string | null;
  isEdited?: boolean;
  isDeleted?: boolean;
  canRestore?: boolean;
  isMine?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
};

type PartnershipMessageBubbleProps = {
  message: PartnershipMessageBubbleRow;
  isAr: boolean;
  apiBase?: string;
  align?: "start" | "end";
  bubbleClassName?: string;
  onUpdated?: (message: PartnershipMessageBubbleRow) => void;
};

const PartnershipMessageBubble = ({
  message,
  isAr,
  apiBase = "/api/partnerships/messages",
  align = "start",
  bubbleClassName = "",
  onUpdated,
}: PartnershipMessageBubbleProps) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatTime = (value: string | null | undefined) => {
    if (!value) return "";
    try {
      return new Date(value).toLocaleString(isAr ? "ar-SA" : "en-US", {
        dateStyle: "short",
        timeStyle: "short",
      });
    } catch {
      return value;
    }
  };

  const handleEdit = async () => {
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/${encodeURIComponent(message.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setEditing(false);
      if (json.message) onUpdated?.(json.message as PartnershipMessageBubbleRow);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(isAr ? "حذف هذه الرسالة؟" : "Delete this message?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/${encodeURIComponent(message.id)}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      if (json.message) onUpdated?.(json.message as PartnershipMessageBubbleRow);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/${encodeURIComponent(message.id)}/restore`, {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      if (json.message) onUpdated?.(json.message as PartnershipMessageBubbleRow);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const isMineBubble = align === "end" || message.isMine;

  return (
    <div className={`flex flex-col gap-1 ${isMineBubble ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${bubbleClassName} ${
          message.isDeleted ? "italic text-slate-500" : ""
        }`}
      >
        {editing ? (
          <div className="space-y-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-900"
              aria-label={isAr ? "تعديل الرسالة" : "Edit message"}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleEdit()}
                disabled={busy || !draft.trim()}
                className="rounded-lg bg-primary px-3 py-1 text-xs font-bold text-white disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : isAr ? "حفظ" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setDraft(message.body);
                }}
                disabled={busy}
                className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-bold"
              >
                {isAr ? "إلغاء" : "Cancel"}
              </button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap">{message.body}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 px-1 text-[11px] text-slate-500">
        <span>{formatTime(message.createdAt)}</span>
        {message.isEdited ? (
          <span className="text-slate-400">{isAr ? "(تم التعديل)" : "(edited)"}</span>
        ) : null}
        {!editing && message.canEdit ? (
          <button
            type="button"
            onClick={() => {
              setDraft(message.body);
              setEditing(true);
            }}
            disabled={busy}
            className="inline-flex items-center gap-0.5 font-bold text-primary hover:underline disabled:opacity-60"
            aria-label={isAr ? "تعديل" : "Edit"}
            title={isAr ? "تعديل" : "Edit"}
          >
            <Pencil className="h-3 w-3" aria-hidden />
            {isAr ? "تعديل" : "Edit"}
          </button>
        ) : null}
        {!editing && message.canDelete ? (
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={busy}
            className="inline-flex items-center gap-0.5 font-bold text-red-600 hover:underline disabled:opacity-60"
            aria-label={isAr ? "حذف" : "Delete"}
            title={isAr ? "حذف" : "Delete"}
          >
            <Trash2 className="h-3 w-3" aria-hidden />
            {isAr ? "حذف" : "Delete"}
          </button>
        ) : null}
        {message.canRestore ? (
          <button
            type="button"
            onClick={() => void handleRestore()}
            disabled={busy}
            className="inline-flex items-center gap-0.5 font-bold text-emerald-700 hover:underline disabled:opacity-60"
            aria-label={isAr ? "تراجع عن الحذف" : "Undo delete"}
            title={isAr ? "تراجع عن الحذف" : "Undo delete"}
          >
            <RotateCcw className="h-3 w-3" aria-hidden />
            {isAr ? "تراجع" : "Undo"}
          </button>
        ) : null}
      </div>
      {error ? <p className="px-1 text-[11px] text-red-600">{error}</p> : null}
    </div>
  );
};

export default PartnershipMessageBubble;
