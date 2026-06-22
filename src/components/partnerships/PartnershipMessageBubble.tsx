"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import PartnershipMessageActionsMenu, {
  type PartnershipMessageActionItem,
} from "@/components/partnerships/PartnershipMessageActionsMenu";
import type { PartnershipMessageActionsMode } from "@/lib/partnerships/partnership-message-ui-constants";

export type PartnershipMessageBubbleRow = {
  id: string;
  senderId?: string;
  senderRole: string;
  body: string;
  messageType?: "user" | "system";
  isSystem?: boolean;
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
  actionsMode?: PartnershipMessageActionsMode;
  /** T.1.2.G/H — bypass ⋮ menu; render inline actions only for UI isolation. */
  forceInlineDebug?: boolean;
  onUpdated?: (message: PartnershipMessageBubbleRow) => void;
};

const PartnershipMessageBubble = ({
  message,
  isAr,
  apiBase = "/api/partnerships/messages",
  align = "start",
  bubbleClassName = "",
  actionsMode = "dropdown",
  forceInlineDebug = false,
  onUpdated,
}: PartnershipMessageBubbleProps) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(message.body);
  }, [message.body]);

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

  const handleStartEdit = () => {
    setDraft(message.body);
    setEditing(true);
  };

  const isMineBubble = align === "end" || message.isMine === true;
  const canEdit = message.canEdit === true;
  const canDelete = message.canDelete === true;
  const canRestore = message.canRestore === true;
  const showActions = !editing && (canEdit || canDelete || canRestore);

  const [preferInlineOnCoarsePointer, setPreferInlineOnCoarsePointer] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const narrow = window.matchMedia("(max-width: 768px)").matches;
    setPreferInlineOnCoarsePointer(coarse || narrow);
  }, []);

  const effectiveActionsMode = forceInlineDebug
    ? "inline"
    : actionsMode === "inline" || preferInlineOnCoarsePointer
      ? "inline"
      : "dropdown";

  const inlineActionClass =
    "inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-60";
  const inlineDeleteClass =
    "inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2 py-1 text-[11px] font-bold text-red-600 shadow-sm transition hover:bg-red-50 disabled:opacity-60";
  const inlineRestoreClass =
    "inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2 py-1 text-[11px] font-bold text-emerald-700 shadow-sm transition hover:bg-emerald-50 disabled:opacity-60";

  const menuItems: PartnershipMessageActionItem[] = [];
  if (canEdit) {
    menuItems.push({
      key: "edit",
      label: isAr ? "تعديل" : "Edit",
      emoji: "✏️",
      tone: "default",
      onSelect: handleStartEdit,
    });
  }
  if (canDelete) {
    menuItems.push({
      key: "delete",
      label: isAr ? "حذف" : "Delete",
      emoji: "🗑",
      tone: "danger",
      onSelect: () => void handleDelete(),
    });
  }
  if (canRestore) {
    menuItems.push({
      key: "restore",
      label: isAr ? "استعادة" : "Restore",
      emoji: "↩",
      tone: "success",
      onSelect: () => void handleRestore(),
    });
  }

  const renderInlineActions = () => (
    <div className="flex flex-wrap items-center gap-1.5" data-testid="partnership-message-inline-actions">
      {canEdit ? (
        <button
          type="button"
          onClick={handleStartEdit}
          disabled={busy}
          className={inlineActionClass}
          aria-label={isAr ? "تعديل الرسالة" : "Edit message"}
        >
          <span aria-hidden>✏️</span>
          {isAr ? "تعديل" : "Edit"}
        </button>
      ) : null}
      {canDelete ? (
        <button
          type="button"
          onClick={() => void handleDelete()}
          disabled={busy}
          className={inlineDeleteClass}
          aria-label={isAr ? "حذف الرسالة" : "Delete message"}
        >
          <span aria-hidden>🗑</span>
          {isAr ? "حذف" : "Delete"}
        </button>
      ) : null}
      {canRestore ? (
        <button
          type="button"
          onClick={() => void handleRestore()}
          disabled={busy}
          className={inlineRestoreClass}
          aria-label={isAr ? "استعادة الرسالة" : "Restore message"}
        >
          <span aria-hidden>↩</span>
          {isAr ? "استعادة" : "Restore"}
        </button>
      ) : null}
    </div>
  );

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

      <div className="flex max-w-full flex-col gap-1.5 px-1">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          <span>{formatTime(message.createdAt)}</span>
          {message.isEdited ? (
            <span className="text-slate-400">{isAr ? "(تم التعديل)" : "(edited)"}</span>
          ) : null}
          {showActions && effectiveActionsMode === "dropdown" ? (
            <PartnershipMessageActionsMenu
              isAr={isAr}
              align={isMineBubble ? "end" : "start"}
              busy={busy}
              items={menuItems}
              triggerLabel={isAr ? "إجراءات الرسالة" : "Message actions"}
            />
          ) : null}
        </div>
        {showActions && effectiveActionsMode === "inline" ? renderInlineActions() : null}
      </div>
      {error ? <p className="px-1 text-[11px] text-red-600">{error}</p> : null}
    </div>
  );
};

export default PartnershipMessageBubble;
