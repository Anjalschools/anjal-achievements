/**
 * Deterministic admin attachment review for group lists / rosters / circulars (no individual certificate semantics).
 */

import type {
  AdminAttachmentAiExtractedEvidence,
  AdminAttachmentAiReviewResult,
  AdminAttachmentMatchValue,
  AttachmentDocumentKind,
} from "@/types/admin-attachment-ai-review";
import type { AdminAttachmentAiRecordContext } from "@/lib/achievement-admin-attachment-ai";
import {
  compareAchievementTitles,
  countLettersInString,
  parseRecordYear,
  yearAppearsInText,
} from "@/lib/achievement-attachment-normalization";
import { resolveAchievementComparableYearFromDoc } from "@/lib/achievement-duplicate";
import { deriveOverallFromChecks } from "@/lib/achievement-admin-attachment-ai-checks";
import type { AttachmentDocumentKindResult } from "@/lib/achievement-group-document-detection";
import {
  extractGroupDocumentTitle,
  extractGroupDocumentStudentRows,
  extractYearHintsFromGroupDocument,
  findMatchingStudentInGroupDocument,
} from "@/lib/achievement-group-document-extraction";

const recordAchievementTitles = (achievement: Record<string, unknown>): string[] => {
  const parts = [
    achievement.customAchievementName,
    achievement.achievementName,
    achievement.nameAr,
    achievement.nameEn,
    achievement.title,
    achievement.competitionName,
    achievement.programName,
    achievement.exhibitionName,
  ]
    .map((x) => String(x || "").trim())
    .filter(Boolean);
  return [...new Set(parts)];
};

const systemNameList = (ctx: AdminAttachmentAiRecordContext): string[] => {
  const s = ctx.student;
  const names = [s?.fullName, s?.fullNameAr, s?.fullNameEn].map((x) => String(x || "").trim()).filter(Boolean);
  return [...new Set(names)];
};

/** Minimum classifier confidence to take the group-only deterministic path (no certificate AI). */
export const GROUP_LIST_PIPELINE_MIN_CONFIDENCE = 0.38;

/** Enough letters in extracted PDF text to trust row parsing. */
export const GROUP_LIST_PIPELINE_MIN_LETTERS = 52;

export const shouldUseGroupListAttachmentPipeline = (
  aggregatedPdfText: string,
  detection: AttachmentDocumentKindResult
): boolean => {
  if (detection.kind !== "group_list_document") return false;
  if (detection.confidence < GROUP_LIST_PIPELINE_MIN_CONFIDENCE) return false;
  const letters = countLettersInString(aggregatedPdfText);
  if (letters < GROUP_LIST_PIPELINE_MIN_LETTERS) return false;
  return true;
};

/**
 * Build a full review result for roster / nominee lists. Omits resultCheck; uses extended optional checks.
 */
export const buildGroupListAttachmentReviewResult = (input: {
  ctx: AdminAttachmentAiRecordContext;
  aggregatedPdfText: string;
  detection: AttachmentDocumentKindResult;
}): AdminAttachmentAiReviewResult => {
  const { ctx, aggregatedPdfText, detection } = input;
  const text = aggregatedPdfText;
  const titles = recordAchievementTitles(ctx.achievement);
  const sysNames = systemNameList(ctx);
  const recordYear = parseRecordYear(resolveAchievementComparableYearFromDoc(ctx.achievement));

  const titleRes = extractGroupDocumentTitle(text);
  const rows = extractGroupDocumentStudentRows(text);
  const nameMatch = findMatchingStudentInGroupDocument(rows, sysNames);
  const yearsInDoc = extractYearHintsFromGroupDocument(text, titleRes.title);

  const titleVsRecord = compareAchievementTitles({
    recordTitles: titles,
    detectedTitle: titleRes.title,
    fullText: text,
  });

  const yearOk = recordYear !== null && yearAppearsInText(recordYear, text);

  let nameCheck: AdminAttachmentMatchValue;
  if (nameMatch.matchType === "strong") nameCheck = "match";
  else if (nameMatch.matchType === "partial") nameCheck = "unclear";
  else {
    const listSeemsStructured = rows.length >= 6 && detection.confidence >= 0.45;
    const lowLetters = countLettersInString(text) < 70;
    if (listSeemsStructured && sysNames.length > 0 && sysNames[0]!.length >= 6 && !lowLetters) {
      nameCheck = "mismatch";
    } else {
      nameCheck = "unclear";
    }
  }

  const documentTitleCheck: AdminAttachmentMatchValue =
    titleRes.title && (titleVsRecord.strength === "strong" || titleVsRecord.strength === "weak")
      ? "match"
      : titleRes.title
        ? "unclear"
        : "unclear";

  const yearCheck: AdminAttachmentMatchValue = yearOk
    ? "match"
    : yearsInDoc.length > 0 && recordYear !== null && !yearsInDoc.includes(recordYear)
      ? "unclear"
      : "unclear";

  const achievementCheck: AdminAttachmentMatchValue = documentTitleCheck;

  const row = nameMatch.bestMatch;
  const hasRowMeta = Boolean(
    row &&
      (row.grade ||
        row.specialization ||
        row.field ||
        row.section ||
        row.educationOffice ||
        row.schoolName ||
        row.rankOrSeat)
  );
  const optionalRowDataCheck: AdminAttachmentMatchValue =
    nameMatch.found && hasRowMeta ? "match" : nameMatch.found ? "unclear" : "unclear";

  let contextualSupportCheck: AdminAttachmentMatchValue = "unclear";
  if (nameMatch.matchType === "strong" && (documentTitleCheck === "match" || yearCheck === "match")) {
    contextualSupportCheck = "match";
  } else if (nameMatch.matchType === "strong") {
    contextualSupportCheck = "unclear";
  } else if (nameMatch.matchType === "partial") {
    contextualSupportCheck = "unclear";
  }

  const levelCheck: AdminAttachmentMatchValue = "unclear";

  const checks = {
    nameCheck,
    yearCheck,
    levelCheck,
    achievementCheck,
    documentTitleCheck,
    contextualSupportCheck,
    optionalRowDataCheck,
  };

  const detectedName = nameMatch.bestMatch?.studentName ?? null;
  const detectedYearStr =
    recordYear !== null && yearsInDoc.includes(recordYear)
      ? String(recordYear)
      : yearsInDoc.length === 1
        ? String(yearsInDoc[0])
        : yearsInDoc.length > 0
          ? String(yearsInDoc[yearsInDoc.length - 1])
          : null;

  const extractedEvidence: AdminAttachmentAiExtractedEvidence = {
    detectedStudentName: detectedName,
    detectedYear: detectedYearStr,
    detectedLevel: row?.grade ?? row?.section ?? null,
    detectedAchievementTitle: titleRes.title,
    detectedMedalOrResult: null,
    detectedIssuer: row?.educationOffice ?? row?.schoolName ?? null,
    notesAr: `وثيقة قائمة جماعية/تعميم (مستخرجة آلياً). صفوف مرشحة: ${rows.length}. تطابق الاسم: ${nameMatch.matchType}.`,
    notesEn: `Group list / roster document (heuristic). Parsed rows: ${rows.length}. Name match: ${nameMatch.matchType}. ${nameMatch.reason}`,
  };

  const recommendationAr = [
    "المستند يُصنَّف كقائمة جماعية أو تعميم وليس كشهادة فردية.",
    nameMatch.found
      ? nameMatch.matchType === "strong"
        ? "تم العثور على اسم الطالب ضمن القائمة بتطابق قوي."
        : "يُشتبه بوجود اسم الطالب؛ يُنصح بمراجعة بشرية للصف."
      : "لم يُعثر على اسم الطالب بثقة داخل القائمة المستخرجة.",
    titleRes.title ? `عنوان الوثيقة: ${titleRes.title.slice(0, 160)}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const recommendationEn = [
    "The attachment is classified as a group list / roster / circular, not an individual certificate.",
    nameMatch.found
      ? nameMatch.matchType === "strong"
        ? "The student's name appears in the list with strong alignment."
        : "Possible name match; human review of the row is recommended."
      : "The student's name was not located reliably in the extracted list.",
    titleRes.title ? `Document heading: ${titleRes.title.slice(0, 160)}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const overallMatchStatus = deriveOverallFromChecks({
    ...checks,
  });

  const kind: AttachmentDocumentKind = "group_list_document";

  return {
    overallMatchStatus,
    checks,
    extractedEvidence,
    recommendationAr,
    recommendationEn,
    analyzedAt: new Date().toISOString(),
    modelNote: `group_list_pipeline:v1 confidence=${detection.confidence.toFixed(2)} reasons=${detection.reasons.slice(0, 6).join(";")}`,
    detectedDocumentKind: kind,
    groupDocumentAnalysis: {
      title: titleRes.title,
      titleConfidence: titleRes.confidence,
      titleSource: titleRes.source,
      studentFound: nameMatch.found,
      matchType: nameMatch.matchType,
      matchScore: nameMatch.score,
      matchedRow: nameMatch.bestMatch,
      rowCount: rows.length,
      detectionReasons: detection.reasons,
      kindConfidence: detection.confidence,
    },
  };
};
