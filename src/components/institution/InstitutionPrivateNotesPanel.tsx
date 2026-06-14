"use client";

import { useState } from "react";
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
  const [category, setCategory] = useState<InstitutionPrivateNoteCategory>("evaluation");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

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
    <div className="space-y-3">
      <p className="text-xs text-text-light">
        {isAr ? "ملاحظات خاصة بالمؤسسة — لا تظهر للطالب أو المشرف" : "Institution-only notes — not visible to student or supervisor"}
      </p>
      <ul className="max-h-40 space-y-2 overflow-y-auto text-sm">
        {notes.length === 0 ? (
          <li className="text-xs text-text-light">{isAr ? "لا توجد ملاحظات." : "No notes yet."}</li>
        ) : (
          notes.map((row) => (
            <li key={row.id} className="rounded-lg border border-border/60 px-3 py-2">
              <p className="text-[10px] font-bold text-primary">
                {PRIVATE_NOTE_CATEGORY_LABELS[row.category as InstitutionPrivateNoteCategory]?.[isAr ? "ar" : "en"] || row.category}
              </p>
              <p className="text-text">{row.body}</p>
            </li>
          ))
        )}
      </ul>
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value as InstitutionPrivateNoteCategory)}
        className="w-full rounded-lg border border-border px-2 py-1.5 text-xs"
      >
        {INSTITUTION_PRIVATE_NOTE_CATEGORIES.map((cat) => (
          <option key={cat} value={cat}>
            {PRIVATE_NOTE_CATEGORY_LABELS[cat][isAr ? "ar" : "en"]}
          </option>
        ))}
      </select>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={isAr ? "اكتب ملاحظة خاصة…" : "Write a private note…"}
        className="min-h-16 w-full rounded-lg border border-border px-3 py-2 text-sm"
      />
      <button
        type="button"
        disabled={saving || !body.trim()}
        onClick={() => void handleSave()}
        className="rounded-lg border border-primary bg-primary px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
      >
        {saving ? (isAr ? "جاري الحفظ…" : "Saving…") : isAr ? "حفظ الملاحظة" : "Save note"}
      </button>
    </div>
  );
};

export default InstitutionPrivateNotesPanel;
