"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MoreVertical } from "lucide-react";

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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [menuOpen]);

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
    setMenuOpen(false);
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
    setMenuOpen(false);
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
    setMenuOpen(false);
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
  const showActions =
    !message.isSystem &&
    !editing &&
    (message.canEdit || message.canDelete || message.canRestore);

  return (
    <div
      className={`group flex flex-col gap-1 ${isMineBubble ? "items-end" : "items-start"}`}
      tabIndex={showActions ? 0 : undefined}
    >
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

        {showActions ? (
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              disabled={busy}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 opacity-0 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary group-hover:opacity-100 group-focus-within:opacity-100 aria-expanded:opacity-100"
              aria-label={isAr ? "إجراءات الرسالة" : "Message actions"}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              title={isAr ? "إجراءات" : "Actions"}
            >
              <MoreVertical className="h-4 w-4" aria-hidden />
            </button>
            {menuOpen ? (
              <div
                role="menu"
                className={`absolute z-20 min-w-[9rem] rounded-xl border border-slate-200 bg-white py-1 shadow-lg ${
                  isMineBubble ? "left-0" : "right-0"
                }`}
              >
                {message.canEdit ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setDraft(message.body);
                      setEditing(true);
                      setMenuOpen(false);
                    }}
                    className="block w-full px-3 py-2 text-start text-xs font-bold text-slate-800 hover:bg-slate-50"
                  >
                    {isAr ? "تعديل" : "Edit"}
                  </button>
                ) : null}
                {message.canDelete ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void handleDelete()}
                    className="block w-full px-3 py-2 text-start text-xs font-bold text-red-600 hover:bg-red-50"
                  >
                    {isAr ? "حذف" : "Delete"}
                  </button>
                ) : null}
                {message.canRestore ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void handleRestore()}
                    className="block w-full px-3 py-2 text-start text-xs font-bold text-emerald-700 hover:bg-emerald-50"
                  >
                    {isAr ? "استعادة" : "Restore"}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {error ? <p className="px-1 text-[11px] text-red-600">{error}</p> : null}
    </div>
  );
};

export default PartnershipMessageBubble;
