/** Fields captured before a student re-edit triggers re-review (approved → pending re-review). */
export const APPROVED_SNAPSHOT_KEYS = [
  "nameAr",
  "nameEn",
  "achievementName",
  "achievementType",
  "achievementCategory",
  "achievementClassification",
  "achievementLevel",
  "participationType",
  "teamRole",
  "resultType",
  "resultValue",
  "medalType",
  "rank",
  "nominationText",
  "specialAwardText",
  "recognitionText",
  "otherResultText",
  "description",
  "organization",
  "competitionName",
  "customCompetitionName",
  "programName",
  "exhibitionName",
  "image",
  "attachments",
  "evidenceUrl",
  "evidenceFileName",
] as const;

export type ApprovedSnapshot = Partial<Record<(typeof APPROVED_SNAPSHOT_KEYS)[number], unknown>>;

export const pickApprovedSnapshot = (doc: Record<string, unknown>): ApprovedSnapshot => {
  const out: ApprovedSnapshot = {};
  for (const k of APPROVED_SNAPSHOT_KEYS) {
    const v = doc[k];
    if (v !== undefined) out[k] = v;
  }
  return out;
};

const stableStringify = (v: unknown): string => {
  try {
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      const o = v as Record<string, unknown>;
      return JSON.stringify(o, Object.keys(o).sort());
    }
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
};

export const diffSnapshotChangedKeys = (before: ApprovedSnapshot, after: ApprovedSnapshot): string[] => {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed: string[] = [];
  for (const k of keys) {
    const b = before[k as keyof ApprovedSnapshot];
    const a = after[k as keyof ApprovedSnapshot];
    if (stableStringify(b) !== stableStringify(a)) changed.push(k);
  }
  return changed.sort();
};
