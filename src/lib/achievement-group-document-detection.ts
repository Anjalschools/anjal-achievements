/**
 * Heuristic classification: individual certificate vs group list / roster / circular (PDF text).
 */

import { collapseWhitespace, normalizeDigitsInString } from "@/lib/achievement-attachment-normalization";

export type AttachmentDocumentKind = "individual_certificate" | "group_list_document" | "unknown_document";

export type AttachmentDocumentKindResult = {
  kind: AttachmentDocumentKind;
  confidence: number;
  reasons: string[];
};

const GROUP_KEYWORD_RES: ReadonlyArray<{ re: RegExp; weight: number; tag: string }> = [
  { re: /المرشحين|المرشحون|مرشح/i, weight: 0.14, tag: "nominee_ar" },
  { re: /المشاركين|المشاركون|مشارك(?!ة)/i, weight: 0.12, tag: "participant_ar" },
  { re: /المتأهلين|المتأهلون|تأهل/i, weight: 0.12, tag: "qualified_ar" },
  { re: /أسماء\s*الطلاب|اسماء\s*الطلاب|قائمة\s*الأسماء|كشف\s*الأسماء/i, weight: 0.14, tag: "name_list_ar" },
  { re: /تعميم|الإدارة\s*التعليمية|مكتب\s*التعليم/i, weight: 0.08, tag: "circular_ar" },
  { re: /الصف|الصفوف|التخصص|الشعبة|المجال|المرحلة/i, weight: 0.06, tag: "row_headers_ar" },
  { re: /المدرسة|مدرسة/i, weight: 0.04, tag: "school_ar" },
  { re: /\broster\b|\bparticipants?\b|\bnominee/i, weight: 0.11, tag: "roster_en" },
  { re: /qualified\s+students?|student\s+list|list\s+of\s+students/i, weight: 0.12, tag: "list_en" },
  { re: /circular|announcement\s+regarding/i, weight: 0.06, tag: "circular_en" },
];

const INDIVIDUAL_KEYWORD_RES: ReadonlyArray<{ re: RegExp; weight: number; tag: string }> = [
  { re: /شهادة\s*(?:تقدير|إتمام|إنجاز|حضور)/i, weight: 0.18, tag: "cert_word_ar" },
  { re: /إلى\s*الطالب|الطالبة\s*:/i, weight: 0.12, tag: "to_student_ar" },
  { re: /يُشهد|يشهد\b/i, weight: 0.14, tag: "witness_ar" },
  { re: /ميدالية\s*(?:ذهبية|فضية|برونزية)/i, weight: 0.12, tag: "medal_ar" },
  { re: /\bcertificate\s+of\b|\bthis\s+certifies\b/i, weight: 0.14, tag: "cert_en" },
  { re: /\baward(ed)?\s+to\b/i, weight: 0.08, tag: "award_en" },
];

const countArabicWordRuns = (line: string): number => {
  const parts = line.split(/\s+/).filter(Boolean);
  let n = 0;
  for (const p of parts) {
    if (/[\u0600-\u06FF\u0750-\u077F]/.test(p) && p.replace(/\d/g, "").length >= 2) n += 1;
  }
  return n;
};

/** Lines that look like a person name (2+ Arabic/Latin word tokens, not mostly digits). */
const lineLooksLikeNameRow = (line: string): boolean => {
  const t = collapseWhitespace(line);
  if (t.length < 6 || t.length > 120) return false;
  if (/^\d+[.)]\s*/.test(t)) {
    const rest = t.replace(/^\d+[.)]\s*/, "");
    return lineLooksLikeNameRow(rest);
  }
  const arWords = countArabicWordRuns(t);
  const latWords = (t.match(/[A-Za-z]{2,}/g) || []).length;
  const digitRatio = (t.match(/\d/g) || []).length / Math.max(t.length, 1);
  if (digitRatio > 0.45) return false;
  return arWords >= 2 || latWords >= 2;
};

const tableLikeLineRatio = (lines: string[]): number => {
  if (lines.length < 5) return 0;
  let tabOrWide = 0;
  for (const ln of lines) {
    if (/\t/.test(ln) || /\s{3,}/.test(ln) || /\|/.test(ln)) tabOrWide += 1;
  }
  return tabOrWide / lines.length;
};

export type DetectAttachmentDocumentKindInput = {
  text: string;
  /** When false, only use text (e.g. empty PDF extract). */
  hasRenderablePdfPreview?: boolean;
};

/**
 * Multi-signal classifier. Not a substitute for human review.
 */
export const detectAttachmentDocumentKind = (input: DetectAttachmentDocumentKindInput): AttachmentDocumentKindResult => {
  const raw = normalizeDigitsInString(String(input.text || ""));
  const text = raw.trim();
  const reasons: string[] = [];

  if (text.length < 40) {
    reasons.push("text_too_short");
    return {
      kind: input.hasRenderablePdfPreview ? "unknown_document" : "unknown_document",
      confidence: 0.25,
      reasons,
    };
  }

  let groupScore = 0;
  let indivScore = 0;

  for (const { re, weight, tag } of GROUP_KEYWORD_RES) {
    if (re.test(text)) {
      groupScore += weight;
      reasons.push(`group:${tag}`);
    }
  }
  for (const { re, weight, tag } of INDIVIDUAL_KEYWORD_RES) {
    if (re.test(text)) {
      indivScore += weight;
      reasons.push(`individual:${tag}`);
    }
  }

  const lines = text
    .split(/\r?\n/)
    .map((l) => collapseWhitespace(l))
    .filter((l) => l.length > 0);

  const nameLikeLines = lines.filter(lineLooksLikeNameRow);
  if (nameLikeLines.length >= 5) {
    groupScore += 0.18;
    reasons.push(`many_name_like_lines:${nameLikeLines.length}`);
  } else if (nameLikeLines.length >= 3) {
    groupScore += 0.08;
    reasons.push(`some_name_like_lines:${nameLikeLines.length}`);
  }

  const tlr = tableLikeLineRatio(lines);
  if (tlr >= 0.22 && lines.length >= 8) {
    groupScore += 0.1;
    reasons.push(`table_like_layout:${tlr.toFixed(2)}`);
  }

  const headerish = lines.slice(0, 12).join(" ");
  if (/م\s*|ت\s*|الاسم|التخصص|الصف|المدرسة|#\s*name|name\s*$/im.test(headerish)) {
    groupScore += 0.06;
    reasons.push("column_header_hints");
  }

  if (indivScore >= 0.2 && groupScore < 0.25 && nameLikeLines.length <= 2) {
    indivScore += 0.06;
    reasons.push("individual_dominant_sparse_names");
  }

  groupScore = Math.min(1, groupScore);
  indivScore = Math.min(1, indivScore);

  const diff = groupScore - indivScore;

  let kind: AttachmentDocumentKind;
  let confidence: number;

  if (diff >= 0.12 && groupScore >= 0.28) {
    kind = "group_list_document";
    confidence = Math.min(0.95, 0.35 + groupScore * 0.55 + Math.max(0, diff) * 0.2);
  } else if (diff <= -0.08 && indivScore >= 0.22) {
    kind = "individual_certificate";
    confidence = Math.min(0.92, 0.35 + indivScore * 0.5);
  } else if (groupScore >= 0.45 && groupScore > indivScore) {
    kind = "group_list_document";
    confidence = Math.min(0.9, groupScore);
  } else if (indivScore > groupScore && indivScore >= 0.18) {
    kind = "individual_certificate";
    confidence = Math.min(0.88, indivScore);
  } else {
    kind = "unknown_document";
    confidence = 0.4 + Math.max(groupScore, indivScore) * 0.35;
    reasons.push("ambiguous_signals");
  }

  return { kind, confidence, reasons: [...new Set(reasons)].slice(0, 24) };
};
