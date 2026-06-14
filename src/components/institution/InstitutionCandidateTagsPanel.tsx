"use client";

import { useState } from "react";
import {
  CANDIDATE_TAG_LABELS,
  PREDEFINED_CANDIDATE_TAGS,
  type PredefinedCandidateTag,
} from "@/lib/partnerships/institution-candidate-pipeline-constants";

type TagRow = { id: string; tag: string };

type InstitutionCandidateTagsPanelProps = {
  applicationId: string;
  tags: TagRow[];
  isAr: boolean;
  onUpdated: () => void;
};

const tagLabel = (tag: string, isAr: boolean) => {
  const predefined = CANDIDATE_TAG_LABELS[tag as PredefinedCandidateTag];
  if (predefined) return isAr ? predefined.ar : predefined.en;
  return tag;
};

const InstitutionCandidateTagsPanel = ({ applicationId, tags, isAr, onUpdated }: InstitutionCandidateTagsPanelProps) => {
  const [customTag, setCustomTag] = useState("");
  const [busy, setBusy] = useState(false);

  const handleAdd = async (tag: string) => {
    if (!tag.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/institution/training/applications/${encodeURIComponent(applicationId)}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag: tag.trim() }),
      });
      if (!res.ok) throw new Error("Failed");
      setCustomTag("");
      onUpdated();
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (tagId: string) => {
    setBusy(true);
    try {
      await fetch(
        `/api/institution/training/applications/${encodeURIComponent(applicationId)}/tags?tagId=${encodeURIComponent(tagId)}`,
        { method: "DELETE" }
      );
      onUpdated();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {tags.map((row) => (
          <span
            key={row.id}
            className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary"
          >
            {tagLabel(row.tag, isAr)}
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleRemove(row.id)}
              className="text-primary/70 hover:text-primary"
              aria-label={isAr ? "إزالة" : "Remove"}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="mb-2 flex flex-wrap gap-1">
        {PREDEFINED_CANDIDATE_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            disabled={busy || tags.some((t) => t.tag === tag)}
            onClick={() => void handleAdd(tag)}
            className="rounded-lg border border-border px-2 py-1 text-[10px] font-bold hover:bg-gray-50 disabled:opacity-50"
          >
            + {tagLabel(tag, isAr)}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={customTag}
          onChange={(e) => setCustomTag(e.target.value)}
          placeholder={isAr ? "وسم مخصص" : "Custom tag"}
          className="flex-1 rounded-lg border border-border px-2 py-1 text-xs"
        />
        <button
          type="button"
          disabled={busy || !customTag.trim()}
          onClick={() => void handleAdd(customTag)}
          className="rounded-lg border border-primary bg-primary px-3 py-1 text-xs font-bold text-white disabled:opacity-60"
        >
          {isAr ? "إضافة" : "Add"}
        </button>
      </div>
    </div>
  );
};

export default InstitutionCandidateTagsPanel;
