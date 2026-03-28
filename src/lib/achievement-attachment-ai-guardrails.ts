/**
 * Deterministic guardrails for admin attachment AI review.
 * TypeScript overrides: weak PDF text / missing evidence must not become false "mismatch".
 */

import type {
  AdminAttachmentAiChecks,
  AdminAttachmentAiExtractedEvidence,
  AdminAttachmentAiReviewResult,
  AdminAttachmentMatchValue,
  AttachmentDocumentKind,
} from "@/types/admin-attachment-ai-review";
import { resolveAchievementComparableYearFromDoc } from "@/lib/achievement-duplicate";
import {
  compareAchievementTitles,
  compareStudentNameToRecord,
  collapseWhitespace,
  countLettersInString,
  detectMedalClassInText,
  extractYearsFromText,
  medalClassFromRecord,
  medalCompatibleWithRecord,
  normalizeCertificateSnippet,
  normalizeDigitsInString,
  parseRecordYear,
  yearAppearsInText,
  levelTextSupportsRecord,
  tokenSetOverlapRatio,
} from "@/lib/achievement-attachment-normalization";
import type { AdminAttachmentAiRecordContext } from "@/lib/achievement-admin-attachment-ai";
import { deriveOverallFromChecks } from "@/lib/achievement-admin-attachment-ai-checks";
import type { PdfTextReliability } from "@/lib/achievement-attachment-normalization";

export type { PdfTextReliability };

export type PdfReliabilityAggregate = {
  lowTextReliability: boolean;
  reasons: string[];
  perLabel: Record<string, PdfTextReliability>;
};

export const mergePdfReliability = (
  entries: ReadonlyArray<{ label: string; reliability: PdfTextReliability }>
): PdfReliabilityAggregate => {
  const perLabel: Record<string, PdfTextReliability> = {};
  const reasons = new Set<string>();
  let low = false;
  let totalLetters = 0;
  for (const e of entries) {
    perLabel[e.label] = e.reliability;
    if (e.reliability.lowTextReliability) low = true;
    e.reliability.reasons.forEach((r) => reasons.add(r));
    totalLetters += e.reliability.letterCount;
  }
  if (entries.length > 0 && totalLetters < 45) low = true;
  return {
    lowTextReliability: low,
    reasons: [...reasons],
    perLabel,
  };
};

/** Heuristic lines after common certificate labels (Arabic/English). */
export const extractLabeledField = (text: string, patterns: RegExp[]): string | null => {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    for (const re of patterns) {
      const m = line.match(re);
      if (m && m[1] && String(m[1]).trim()) {
        return String(m[1]).trim();
      }
      if (re.test(line) && i + 1 < lines.length) {
        const nxt = lines[i + 1] ?? "";
        if (nxt.length >= 3 && nxt.length < 220) return nxt;
      }
    }
  }
  return null;
};

export type CertificateTextCandidates = {
  studentName: string | null;
  achievementTitle: string | null;
  year: string | null;
  medalOrResultSnippet: string | null;
  issuer: string | null;
};

export const extractCertificateTextCandidates = (text: string): CertificateTextCandidates => {
  const raw = normalizeDigitsInString(text);
  const flat = collapseWhitespace(raw.replace(/\n/g, " "));

  let studentName =
    extractLabeledField(raw, [
      /(?:الاسم|اسم\s*الطالب|الطالب|student\s*name|name\s*of\s*student)\s*[:：]?\s*(.+)/i,
    ]) ||
    extractLabeledField(raw, [
      /(?:الاسم|اسم\s*الطالب|student\s*name)\s*$/i,
    ]);

  if (!studentName) {
    const mFlat = flat.match(
      /(?:اسم\s*(?:الطالب|الكامل)|الطالب\s*\/\s*الطالبة)\s*[:：]?\s*([\u0600-\u06FF](?:[\u0600-\u06FF\s]|بن|ابن|بنت){6,160}?)(?=\s+(?:السنة|سنة|المقياس|مقياس|موهبة|نتيجة|الدرجة|20\d{2})\b|\s{2,}|$)/i
    );
    if (mFlat?.[1]) studentName = collapseWhitespace(mFlat[1]);
  }
  if (!studentName) {
    const mBin = flat.match(
      /([\u0600-\u06FF]{2,}(?:\s+[\u0600-\u06FF]{2,}){0,4}\s+(?:بن|ابن|بنت)\s+[\u0600-\u06FF]{2,}(?:\s+[\u0600-\u06FF]{2,}){0,4})/i
    );
    if (mBin?.[1] && mBin[1].length >= 12) studentName = collapseWhitespace(mBin[1]);
  }

  let achievementTitle =
    extractLabeledField(raw, [
      /(?:عنوان|الإنجاز|الحدث|المسابقة|البرنامج|المشاركة|achievement|event|competition)\s*[:：]?\s*(.+)/i,
    ]) || null;

  if (!achievementTitle) {
    const mM = flat.match(
      /(مقياس\s+موهبة[^\n۔]{0,200}(?:للقدرات[^\n۔]{0,120})?|موهبة\s+للقدرات[^\n۔]{0,160})/i
    );
    if (mM?.[1]) achievementTitle = collapseWhitespace(mM[1]);
  }

  const years = extractYearsFromText(raw);
  const year = years.length === 1 ? String(years[0]) : years.length > 0 ? String(years[years.length - 1]) : null;

  let medalOrResultSnippet: string | null = null;
  const medalMatch = raw.match(
    /(ميدالية\s*(?:ذهبية|فضية|برونزية)|gold\s*medal|silver\s*medal|bronze\s*medal|مشاركة|participation)/i
  );
  if (medalMatch) medalOrResultSnippet = medalMatch[0].trim();
  const scoreMatch = flat.match(/(\d{3,4})\s*(?:من|\/|÷|\/\s*)\s*(\d{3,4})/);
  if (scoreMatch) {
    const snippet = `${scoreMatch[1]} من ${scoreMatch[2]}`;
    medalOrResultSnippet = medalOrResultSnippet && medalOrResultSnippet.length > snippet.length ? medalOrResultSnippet : snippet;
  }

  const issuer =
    extractLabeledField(raw, [
      /(?:جهة\s*الإصدار|الجهة\s*المنظمة|issuer|organized\s*by|يصدرها)\s*[:：]?\s*(.+)/i,
    ]) || null;

  return {
    studentName: studentName ? collapseWhitespace(studentName) : null,
    achievementTitle: achievementTitle ? collapseWhitespace(achievementTitle) : null,
    year,
    medalOrResultSnippet,
    issuer: issuer ? collapseWhitespace(issuer) : null,
  };
};

const mergeEvidence = (
  model: AdminAttachmentAiExtractedEvidence,
  heur: CertificateTextCandidates
): AdminAttachmentAiExtractedEvidence => {
  const longer = (a: string | null, b: string | null): string | null => {
    const sa = String(a || "").trim();
    const sb = String(b || "").trim();
    if (!sa) return sb || null;
    if (!sb) return sa || null;
    return sb.length > sa.length ? sb : sa;
  };

  return {
    detectedStudentName: longer(model.detectedStudentName, heur.studentName),
    detectedYear: longer(model.detectedYear, heur.year),
    detectedLevel: model.detectedLevel,
    detectedAchievementTitle: longer(model.detectedAchievementTitle, heur.achievementTitle),
    detectedMedalOrResult: longer(model.detectedMedalOrResult, heur.medalOrResultSnippet),
    detectedIssuer: longer(model.detectedIssuer, heur.issuer),
    notesAr: model.notesAr,
    notesEn: model.notesEn,
  };
};

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

/**
 * Explicit contradiction: different student name with strong extracted signal and decent text quality.
 */
const explicitNameMismatch = (input: {
  detected: string | null;
  systemNames: string[];
  letterCount: number;
}): boolean => {
  const det = String(input.detected || "").trim();
  if (det.length < 6 || input.letterCount < 70) return false;
  const cmp = compareStudentNameToRecord({ detected: det, systemNames: input.systemNames });
  if (cmp.strength === "none" && tokenSetOverlapRatio(det, input.systemNames.join(" ")) < 0.08) {
    return significantTokens(det) >= 2;
  }
  return false;
};

const significantTokens = (s: string): number =>
  s
    .split(/\s+/)
    .map((x) => normalizeCertificateSnippet(x))
    .filter((x) => x.length >= 3).length;

/**
 * Explicit year contradiction: several years in doc, record year absent, another year heavily favored (conservative).
 */
const explicitYearMismatch = (input: {
  recordYear: number | null;
  text: string;
  letterCount: number;
}): boolean => {
  const R = input.recordYear;
  if (R === null || input.letterCount < 75) return false;
  const ys = extractYearsFromText(input.text);
  if (ys.length === 0) return false;
  if (ys.includes(R)) return false;
  if (ys.length === 1) {
    const y = ys[0];
    return y >= 1990 && y <= 2100 && Math.abs(y - R) >= 1;
  }
  return false;
};

const explicitAchievementMismatch = (input: {
  recordTitles: string[];
  detected: string | null;
  fullText: string;
  letterCount: number;
}): boolean => {
  if (input.letterCount < 90) return false;
  const det = String(input.detected || "").trim();
  if (det.length < 14) return false;
  const { strength, ratio } = compareAchievementTitles({
    recordTitles: input.recordTitles,
    detectedTitle: det,
    fullText: input.fullText,
  });
  return strength === "none" && ratio < 0.12;
};

export type AttachmentAiGuardrailContext = {
  record: Record<string, unknown>;
  studentCtx: AdminAttachmentAiRecordContext["student"];
  aggregatedPdfText: string;
  pdfReliability: PdfReliabilityAggregate;
  /** Soft signal when full group-list pipeline was not used (e.g. borderline confidence). */
  documentKindHint?: { kind: AttachmentDocumentKind; confidence: number; reasons: string[] };
};

const applyGroupListDocumentGuardrails = (
  parsed: AdminAttachmentAiReviewResult,
  ctx: AttachmentAiGuardrailContext
): AdminAttachmentAiReviewResult => {
  const rel = ctx.pdfReliability;
  const checks: AdminAttachmentAiChecks = { ...parsed.checks };
  delete checks.resultCheck;

  if (rel.lowTextReliability) {
    if (checks.nameCheck === "mismatch") checks.nameCheck = "unclear";
    if (checks.documentTitleCheck === "mismatch") checks.documentTitleCheck = "unclear";
    if (checks.achievementCheck === "mismatch") checks.achievementCheck = "unclear";
    if (checks.contextualSupportCheck === "mismatch") checks.contextualSupportCheck = "unclear";
    if (checks.optionalRowDataCheck === "mismatch") checks.optionalRowDataCheck = "unclear";
  }

  let recommendationAr = parsed.recommendationAr;
  let recommendationEn = parsed.recommendationEn;
  if (rel.lowTextReliability) {
    const ar = [
      "\u062a\u0639\u0630\u0631 \u0627\u0644\u062c\u0632\u0645 \u0628\u0628\u0639\u0636 \u0627\u0644\u062d\u0642\u0648\u0644 \u0645\u0646 \u0627\u0644\u0646\u0635 \u0627\u0644\u0645\u0633\u062a\u062e\u0631\u062c \u0622\u0644\u064a\u064b\u0627 \u0645\u0646 \u0645\u0644\u0641 PDF",
      "(\u0642\u0627\u0626\u0645\u0629 \u062c\u0645\u0627\u0639\u064a\u0629)\u061b \u064a\u064f\u0646\u0635\u062d \u0628\u0645\u0631\u0627\u062c\u0639\u0629 \u0628\u0634\u0631\u064a\u0629 \u0644\u0644\u0623\u0633\u0645\u0627\u0621 \u0641\u064a \u0627\u0644\u062c\u062f\u0648\u0644.",
    ].join(" ");
    const en =
      "Low PDF text quality for a group list; human verification of the table rows is recommended.";
    if (!recommendationAr.includes("استخراج منخفضة")) {
      recommendationAr = collapseWhitespace(`${recommendationAr} ${ar}`.trim());
    }
    if (!recommendationEn.toLowerCase().includes("low pdf text quality for a group list")) {
      recommendationEn = collapseWhitespace(`${recommendationEn} ${en}`.trim());
    }
  }

  const overallMatchStatus = deriveOverallFromChecks(checks);
  return {
    ...parsed,
    checks,
    overallMatchStatus,
    recommendationAr,
    recommendationEn,
  };
};

export const applyAttachmentAiGuardrails = (
  parsed: AdminAttachmentAiReviewResult,
  ctx: AttachmentAiGuardrailContext
): AdminAttachmentAiReviewResult => {
  if (parsed.detectedDocumentKind === "group_list_document") {
    return applyGroupListDocumentGuardrails(parsed, ctx);
  }

  const rel = ctx.pdfReliability;
  const text = ctx.aggregatedPdfText;
  const heur = extractCertificateTextCandidates(text);
  const mergedEv = mergeEvidence(parsed.extractedEvidence, heur);

  const sysNames = systemNameList({ achievement: ctx.record, student: ctx.studentCtx });
  const recordYear = parseRecordYear(resolveAchievementComparableYearFromDoc(ctx.record));
  const titles = recordAchievementTitles(ctx.record);
  const recordLevel = String(ctx.record.achievementLevel || ctx.record.level || "");

  const nameStat = compareStudentNameToRecord({
    detected: mergedEv.detectedStudentName,
    systemNames: sysNames,
  });
  const titleStat = compareAchievementTitles({
    recordTitles: titles,
    detectedTitle: mergedEv.detectedAchievementTitle,
    fullText: text,
  });
  const yearOk = yearAppearsInText(recordYear, text);
  const medalScanText = [text, mergedEv.detectedMedalOrResult || ""].filter(Boolean).join("\n");
  const medalOk = medalCompatibleWithRecord(medalScanText, {
    medalType: String(ctx.record.medalType || ""),
    resultType: String(ctx.record.resultType || ""),
    rank: String(ctx.record.rank || ""),
  });

  const nextChecks: AdminAttachmentAiChecks = { ...parsed.checks };
  const letterCount = rel.perLabel
    ? Object.values(rel.perLabel).reduce((a, b) => a + (b?.letterCount ?? 0), 0)
    : countLettersInString(text);

  const allowMismatch = !rel.lowTextReliability && letterCount >= 65;

  type CoreAttachmentCheckKey = "nameCheck" | "yearCheck" | "levelCheck" | "achievementCheck";

  const resolveCheck = (
    key: CoreAttachmentCheckKey,
    supportsMatch: boolean,
    explicitConflict: boolean
  ): void => {
    let v: AdminAttachmentMatchValue = nextChecks[key];
    if (v === "mismatch" && (!allowMismatch || !explicitConflict)) {
      v = "unclear";
    }
    if (v === "unclear" && supportsMatch) {
      v = "match";
    }
    if (v === "match" && explicitConflict && allowMismatch) {
      v = "mismatch";
    }
    nextChecks[key] = v;
  };

  const nameConflict = explicitNameMismatch({
    detected: mergedEv.detectedStudentName,
    systemNames: sysNames,
    letterCount,
  });
  resolveCheck("nameCheck", nameStat.strength === "strong", nameConflict);

  const yearConflict = explicitYearMismatch({ recordYear, text, letterCount });
  resolveCheck("yearCheck", Boolean(recordYear !== null && yearOk), yearConflict);

  const achConflict = explicitAchievementMismatch({
    recordTitles: titles,
    detected: mergedEv.detectedAchievementTitle,
    fullText: text,
    letterCount,
  });
  resolveCheck("achievementCheck", titleStat.strength === "strong", achConflict);

  // Level: scope is often implicit on certificates; never keep model "mismatch" without a dedicated contradiction detector.
  if (nextChecks.levelCheck === "mismatch") {
    nextChecks.levelCheck = "unclear";
  } else if (
    nextChecks.levelCheck === "unclear" &&
    recordLevel &&
    levelTextSupportsRecord(recordLevel, text) === "support"
  ) {
    nextChecks.levelCheck = "match";
  }

  // Result / medal (optional check)
  let resultCheck: AdminAttachmentMatchValue | undefined = parsed.checks.resultCheck;
  const hasMedalSignal =
    detectMedalClassInText(medalScanText) !== "unknown" || Boolean(mergedEv.detectedMedalOrResult);
  const hasRecordMedal =
    medalClassFromRecord({
      medalType: String(ctx.record.medalType || ""),
      resultType: String(ctx.record.resultType || ""),
      rank: String(ctx.record.rank || ""),
    }) !== "unknown";

  if (resultCheck === undefined) {
    if (hasMedalSignal && hasRecordMedal) {
      resultCheck = medalOk ? "match" : "unclear";
    } else if (hasRecordMedal && !hasMedalSignal) {
      resultCheck = "unclear";
    }
  } else if (resultCheck === "mismatch") {
    // Low reliability must not force a false "mismatch", but explicit compatible medal evidence
    // should still yield "match" (do not downgrade to "unclear" before checking medalOk).
    if (!hasRecordMedal || !hasMedalSignal) {
      resultCheck = "unclear";
    } else if (medalOk) {
      resultCheck = "match";
    } else if (!allowMismatch) {
      resultCheck = "unclear";
    }
  } else if (resultCheck === "unclear" && medalOk && hasRecordMedal) {
    resultCheck = "match";
  }

  const groupHint =
    ctx.documentKindHint?.kind === "group_list_document" && ctx.documentKindHint.confidence >= 0.28;
  if (groupHint) {
    resultCheck = undefined;
  }

  const checksFinal: AdminAttachmentAiChecks = {
    ...nextChecks,
    ...(resultCheck !== undefined ? { resultCheck } : {}),
  };

  let recommendationAr = parsed.recommendationAr;
  let recommendationEn = parsed.recommendationEn;

  if (rel.lowTextReliability) {
    const ar = [
      "\u062a\u0639\u0630\u0631 \u0627\u0644\u062c\u0632\u0645 \u0628\u0628\u0639\u0636 \u0627\u0644\u062d\u0642\u0648\u0644 \u0645\u0646 \u0627\u0644\u0646\u0635 \u0627\u0644\u0645\u0633\u062a\u062e\u0631\u062c \u0622\u0644\u064a\u064b\u0627 \u0645\u0646 \u0645\u0644\u0641 PDF",
      "(\u062c\u0648\u062f\u0629 \u0627\u0644\u0627\u0633\u062a\u062e\u0631\u0627\u062c \u0645\u0646\u062e\u0641\u0636\u0629 \u0623\u0648 \u0646\u0635 \u0645\u0643\u0633\u0651\u0631 \u0623\u0648 \u062b\u0646\u0627\u0626\u064a \u0627\u0644\u0644\u063a\u0629)\u061b",
      "\u064a\u064f\u0646\u0635\u062d \u0628\u0627\u0644\u0645\u0631\u0627\u062c\u0639\u0629 \u0627\u0644\u0628\u0634\u0631\u064a\u0629 \u0644\u0644\u0645\u0631\u0641\u0642.",
    ].join(" ");
    const en =
      "Some fields could not be judged reliably from automatically extracted PDF text (low extraction quality, noisy layout, or bilingual text). Human review of the attachment is recommended.";
    if (!recommendationAr.includes("تعذر الجزم")) {
      recommendationAr = collapseWhitespace(`${recommendationAr} ${ar}`.trim());
    }
    if (!recommendationEn.toLowerCase().includes("human review")) {
      recommendationEn = collapseWhitespace(`${recommendationEn} ${en}`.trim());
    }
  }

  const overallMatchStatus = deriveOverallFromChecks(checksFinal);

  return {
    ...parsed,
    checks: checksFinal,
    extractedEvidence: mergedEv,
    overallMatchStatus,
    recommendationAr,
    recommendationEn,
    modelNote: parsed.modelNote,
  };
};
