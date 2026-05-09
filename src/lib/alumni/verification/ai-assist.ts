import type { IAlumniVerificationAttachment } from "@/models/AlumniVerificationRequest";

/**
 * Placeholder verification AI: deterministic heuristic until OCR / name-matching / fraud models are wired.
 */
export const runVerificationAiAssist = async (input: {
  fullName: string;
  attachments: IAlumniVerificationAttachment[];
}): Promise<{ score: number; notes: string }> => {
  let score = 0.35;
  if (input.attachments.length >= 1) score += 0.15;
  if (input.attachments.length >= 2) score += 0.12;
  if (input.attachments.length >= 4) score += 0.1;
  const types = new Set(input.attachments.map((a) => a.type));
  if (types.has("linkedin")) score += 0.1;
  if (types.has("university_email")) score += 0.12;
  if (types.has("certificate") || types.has("student_id")) score += 0.08;
  const nameOk = input.fullName.trim().split(/\s+/).filter(Boolean).length >= 2;
  if (nameOk) score += 0.05;
  score = Math.min(0.95, Math.round(score * 100) / 100);
  return {
    score,
    notes:
      "Rule-based pre-review score only (no OCR). Integrate document OCR, employer domain checks, and face/name matching in a later iteration.",
  };
};
