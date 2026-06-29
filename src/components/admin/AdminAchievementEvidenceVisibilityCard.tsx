"use client";

import { useCallback, useEffect, useState } from "react";
import { Globe2, Loader2 } from "lucide-react";

import type { AchievementAttachmentObject } from "@/lib/achievement-attachments";

type AttachmentVisibilityRow = {
  index: number;
  name: string;
  mimeType: string;
  showInPublicPortfolio: boolean;
};

type Props = {
  achievementId: string;
  attachmentItems: AchievementAttachmentObject[];
  isAr: boolean;
};

const AdminAchievementEvidenceVisibilityCard = ({
  achievementId,
  attachmentItems,
  isAr,
}: Props) => {
  const [rows, setRows] = useState<AttachmentVisibilityRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setRows(
      attachmentItems.map((item, index) => ({
        index,
        name: item.name,
        mimeType: item.mimeType,
        showInPublicPortfolio: item.showInPublicPortfolio === true,
      }))
    );
  }, [attachmentItems]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/achievements/${achievementId}/evidence-visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: rows.map((row) => ({
            index: row.index,
            showInPublicPortfolio: row.showInPublicPortfolio,
          })),
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Save failed");
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Error");
    } finally {
      setSaving(false);
    }
  }, [achievementId, rows]);

  if (rows.length === 0) return null;

  const dirty = rows.some(
    (row, index) => row.showInPublicPortfolio !== (attachmentItems[index]?.showInPublicPortfolio === true)
  );

  return (
    <div className="rounded-2xl border border-sky-200/80 bg-sky-50/40 p-4 shadow-sm">
      <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-sky-950">
        <Globe2 className="h-4 w-4 shrink-0" aria-hidden />
        {isAr ? "أدلة الملف العام" : "Public portfolio evidence"}
      </h2>
      <p className="mt-1 text-[11px] leading-snug text-sky-900/80">
        {isAr
          ? "اختر المرفقات التي تظهر في ملف الإنجاز العام. الافتراضي مخفي حتى يوافق المشرف."
          : "Choose which attachments appear on the public portfolio. Default is hidden until approved."}
      </p>
      <div className="mt-3 space-y-2">
        {rows.map((row) => (
          <label
            key={row.index}
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/60 bg-white/90 px-3 py-2.5 shadow-sm"
          >
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-sky-400 text-sky-700 focus:ring-sky-600"
              checked={row.showInPublicPortfolio}
              onChange={(event) =>
                setRows((current) =>
                  current.map((item) =>
                    item.index === row.index
                      ? { ...item, showInPublicPortfolio: event.target.checked }
                      : item
                  )
                )
              }
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-slate-900">{row.name}</span>
              <span className="text-[11px] text-slate-500">{row.mimeType}</span>
            </span>
          </label>
        ))}
      </div>
      {err ? <p className="mt-2 text-xs text-red-600">{err}</p> : null}
      <button
        type="button"
        disabled={!dirty || saving}
        onClick={() => void handleSave()}
        className="mt-3 inline-flex items-center gap-2 rounded-xl bg-sky-800 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {isAr ? "حفظ الأدلة العامة" : "Save public evidence"}
      </button>
    </div>
  );
};

export default AdminAchievementEvidenceVisibilityCard;
