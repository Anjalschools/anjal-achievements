"use client";

import { useMemo, useState } from "react";
import {
  INSTITUTION_PRIVATE_NOTE_CATEGORIES,
  PRIVATE_NOTE_CATEGORY_LABELS,
  type InstitutionPrivateNoteCategory,
} from "@/lib/partnerships/institution-candidate-pipeline-constants";

type NoteRow = {
  id: string;
  category: string;
  body: string;
  createdAt: string | null;
};

type InstitutionPrivateNotesPanelProps = {
  applicationId: string;
  notes: NoteRow[];
  isAr: boolean;
  onUpdated: () => void;
};

const InstitutionPrivateNotesPanel = ({ applicationId, notes, isAr, onUpdated }: InstitutionPrivateNotesPanelProps) => {
  const [category, setCategory] = useState<InstitutionPrivateNoteCategory>("interview");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const sortedNotes = useMemo(
    () =>
      [...notes].sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      }),
    [notes]
  );

  const handleSave = async () => {
    if (!body.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/institution/training/applications/${encodeURIComponent(applicationId)}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, body: body.trim() }),
      });
      if (!res.ok) throw new Error("Failed");
      setBody("");
      onUpdated();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-text-light">
        {isAr ? "ملاحظات خاصة بالمؤسسة — لا تظهر للطالب أو المشرف" : "Institution-only notes — not visible to student or supervisor"}
      </p>

      <div className="flex flex-wrap gap-2">
        {INSTITUTION_PRIVATE_NOTE_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={`rounded-full px-3 py-1 text-xs font-bold transition ${
              category === cat ? "bg-primary text-white" : "border border-border bg-white text-text-light"
            }`}
          >
            {PRIVATE_NOTE_CATEGORY_LABELS[cat][isAr ? "ar" : "en"]}
          </button>
        ))}
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={
          isAr
            ? `اكتب ملاحظة في: ${PRIVATE_NOTE_CATEGORY_LABELS[category].ar}`
            : `Write a note in: ${PRIVATE_NOTE_CATEGORY_LABELS[category].en}`
        }
        className="min-h-20 w-full rounded-xl border border-border px-3 py-2 text-sm"
        aria-label={isAr ? "نص الملاحظة" : "Note text"}
      />
      <button
        type="button"
        disabled={saving || !body.trim()}
        onClick={() => void handleSave()}
        className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
      >
        {saving ? (isAr ? "جاري الحفظ…" : "Saving…") : isAr ? "إضافة ملاحظة" : "Add note"}
      </button>

      <div>
        <p className="mb-2 text-sm font-bold">{isAr ? "الجدول الزمني للملاحظات" : "Notes timeline"}</p>
        {sortedNotes.length === 0 ? (
          <p className="text-xs text-text-light">{isAr ? "لا توجد ملاحظات." : "No notes yet."}</p>
        ) : (
          <ul className="max-h-64 space-y-2 overflow-y-auto border-s-2 border-primary/20 ps-3">
            {sortedNotes.map((row) => (
              <li key={row.id} className="relative rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                <p className="text-[10px] font-bold text-primary">
                  {PRIVATE_NOTE_CATEGORY_LABELS[row.category as InstitutionPrivateNoteCategory]?.[isAr ? "ar" : "en"] || row.category}
                  {row.createdAt ? (
                    <span className="ms-2 font-normal text-text-light">
                      {new Date(row.createdAt).toLocaleString(isAr ? "ar-SA" : "en-US")}
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-sm text-foreground">{row.body}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default InstitutionPrivateNotesPanel;
