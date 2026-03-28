/**
 * Regression checks for PDF attachment AI guardrails (run: npx tsx scripts/verify-achievement-attachment-review.ts).
 */
import assert from "node:assert/strict";

import {
  applyAttachmentAiGuardrails,
  mergePdfReliability,
} from "../src/lib/achievement-attachment-ai-guardrails";
import { deriveOverallFromChecks } from "../src/lib/achievement-admin-attachment-ai-checks";
import type { AdminAttachmentAiReviewResult } from "../src/types/admin-attachment-ai-review";
import { assessPdfExtractedTextReliability } from "../src/lib/achievement-attachment-normalization";

const baseReview = (over: Partial<AdminAttachmentAiReviewResult>): AdminAttachmentAiReviewResult => ({
  overallMatchStatus: "unclear",
  checks: {
    nameCheck: "unclear",
    yearCheck: "unclear",
    levelCheck: "unclear",
    achievementCheck: "unclear",
  },
  extractedEvidence: {
    detectedStudentName: null,
    detectedYear: null,
    detectedLevel: null,
    detectedAchievementTitle: null,
    detectedMedalOrResult: null,
    detectedIssuer: null,
    notesAr: "",
    notesEn: "",
  },
  recommendationAr: "",
  recommendationEn: "",
  analyzedAt: new Date().toISOString(),
  ...over,
});

// --- Mawhiba-like noisy bilingual extraction (broken lines, mixed scripts)
const mawhibaLikePdfText = `
ش
ه
ادة
اسم الطالب
فاطمة
أحمد
العلي
المسابقة
الدولية
للعلوم
والابتكار
لعام
٢٠٢٣
م
ميدالية فضية
موهبة
`;

const rel = assessPdfExtractedTextReliability(mawhibaLikePdfText);
const agg = mergePdfReliability([{ label: "t1", reliability: rel }]);
assert.equal(agg.lowTextReliability, true, "fragmented PDF-style lines should flag low text reliability");

const modelWrong: AdminAttachmentAiReviewResult = baseReview({
  overallMatchStatus: "mismatch",
  checks: {
    nameCheck: "mismatch",
    yearCheck: "mismatch",
    levelCheck: "unclear",
    achievementCheck: "mismatch",
  },
  extractedEvidence: {
    detectedStudentName: null,
    detectedYear: null,
    detectedLevel: null,
    detectedAchievementTitle: null,
    detectedMedalOrResult: null,
    detectedIssuer: null,
    notesAr: "",
    notesEn: "",
  },
});

const out = applyAttachmentAiGuardrails(modelWrong, {
  record: {
    achievementYear: 2023,
    achievementLevel: "national",
    achievementName: "Science Olympiad",
    nameAr: "فاطمة أحمد العلي",
    medalType: "silver",
  },
  studentCtx: { fullName: "فاطمة أحمد العلي", fullNameAr: "فاطمة أحمد العلي" },
  aggregatedPdfText: mawhibaLikePdfText,
  pdfReliability: agg,
});

assert.notEqual(out.checks.nameCheck, "mismatch", "name must not stay mismatch on low-reliability PDF");
assert.notEqual(out.checks.yearCheck, "mismatch", "year must not stay mismatch when year appears in text");
assert.notEqual(out.checks.achievementCheck, "mismatch", "achievement must not stay mismatch with supportive tokens");
assert.equal(out.checks.levelCheck, "unclear", "level should remain unclear when not explicit");
assert.equal(out.checks.resultCheck, "match", "silver medal in text vs record should match");

assert.ok(
  out.recommendationAr.includes("تعذر الجزم") || out.recommendationEn.toLowerCase().includes("human review"),
  "low reliability should append human-review guidance"
);

// --- Low reliability + model resultCheck mismatch + explicit "Silver Medal" -> still match when compatible with record
const fragmentedSilverPdf = `
ش
ه
ادة
اسم الطالب
فاطمة
أحمد
العلي
Science Olympiad
Silver Medal
لعام
٢٠٢٥
م
`;
const relFragSilver = assessPdfExtractedTextReliability(fragmentedSilverPdf);
const aggFragSilver = mergePdfReliability([{ label: "frag-silver", reliability: relFragSilver }]);
assert.equal(aggFragSilver.lowTextReliability, true, "mawhiba-like fragmentation should stay low reliability");

const modelResultMismatch: AdminAttachmentAiReviewResult = baseReview({
  checks: {
    nameCheck: "match",
    yearCheck: "match",
    levelCheck: "match",
    achievementCheck: "match",
    resultCheck: "mismatch",
  },
  extractedEvidence: {
    detectedStudentName: null,
    detectedYear: null,
    detectedLevel: null,
    detectedAchievementTitle: null,
    detectedMedalOrResult: "Silver Medal",
    detectedIssuer: null,
    notesAr: "",
    notesEn: "",
  },
});

const outLowRelSilver = applyAttachmentAiGuardrails(modelResultMismatch, {
  record: {
    achievementYear: 2025,
    achievementLevel: "national",
    achievementName: "Science Olympiad",
    nameAr: "فاطمة أحمد العلي",
    medalType: "ميدالية فضية",
  },
  studentCtx: { fullName: "فاطمة أحمد العلي", fullNameAr: "فاطمة أحمد العلي" },
  aggregatedPdfText: fragmentedSilverPdf,
  pdfReliability: aggFragSilver,
});

assert.equal(
  outLowRelSilver.checks.resultCheck,
  "match",
  "compatible silver evidence must yield resultCheck match even when PDF reliability is low"
);
assert.equal(
  deriveOverallFromChecks(outLowRelSilver.checks),
  "match",
  "when all checks including result are match, overall is match"
);

// --- Record expects a medal but document has no medal wording -> resultCheck stays unclear
const textNoMedal = "Student Jane Doe\nYear 2025\nLocal Science Fair\n";
const relNoMedal = assessPdfExtractedTextReliability(textNoMedal);
const aggNoMedal = mergePdfReliability([{ label: "no-medal", reliability: relNoMedal }]);
const modelNoMedalEvidence = baseReview({
  checks: {
    nameCheck: "match",
    yearCheck: "match",
    levelCheck: "match",
    achievementCheck: "match",
  },
});
const outNoMedal = applyAttachmentAiGuardrails(modelNoMedalEvidence, {
  record: {
    achievementYear: 2025,
    achievementName: "Science Fair",
    medalType: "silver",
  },
  studentCtx: { fullName: "Jane Doe" },
  aggregatedPdfText: textNoMedal,
  pdfReliability: aggNoMedal,
});
assert.equal(outNoMedal.checks.resultCheck, "unclear", "no medal signal in text should not invent result match");

// --- Clean text: explicit different year should still allow mismatch when reliability is OK
const cleanCert = `
Certificate of Achievement
Student name: Sara Ali Khan
Event: National Robotics Fair
Year: 2019
Gold medal
`;

const cleanRel = assessPdfExtractedTextReliability(cleanCert);
assert.equal(cleanRel.lowTextReliability, false, "clean fixture should not be low reliability");

const aggClean = mergePdfReliability([{ label: "c1", reliability: cleanRel }]);

const modelYearMismatch: AdminAttachmentAiReviewResult = baseReview({
  checks: {
    nameCheck: "match",
    yearCheck: "mismatch",
    levelCheck: "unclear",
    achievementCheck: "unclear",
  },
});

const out2 = applyAttachmentAiGuardrails(modelYearMismatch, {
  record: {
    achievementYear: 2024,
    achievementName: "Robotics",
  },
  studentCtx: { fullName: "Sara Ali Khan" },
  aggregatedPdfText: cleanCert,
  pdfReliability: aggClean,
});

assert.equal(out2.checks.yearCheck, "mismatch", "explicit contradictory year should remain mismatch when text is reliable");

// eslint-disable-next-line no-console
console.log("verify-achievement-attachment-review: OK");
