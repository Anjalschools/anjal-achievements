/**
 * Per-attachment merge + certificate / group extraction smoke tests.
 * Run: npm run verify:attachment-per-file
 */
import assert from "node:assert/strict";

import { aggregatePerFileAttachmentReviewResults } from "../src/lib/achievement-admin-attachment-ai";
import { extractCertificateTextCandidates } from "../src/lib/achievement-attachment-ai-guardrails";
import {
  extractGroupDocumentStudentRows,
  findMatchingStudentInGroupDocument,
} from "../src/lib/achievement-group-document-extraction";
import type { AdminAttachmentPerFileReview } from "../src/types/admin-attachment-ai-review";
import { deriveOverallFromChecks } from "../src/lib/achievement-admin-attachment-ai-checks";

const emptyEv = () => ({
  detectedStudentName: null as string | null,
  detectedYear: null as string | null,
  detectedLevel: null as string | null,
  detectedAchievementTitle: null as string | null,
  detectedMedalOrResult: null as string | null,
  detectedIssuer: null as string | null,
  notesAr: "",
  notesEn: "",
});

// --- Individual certificate heuristics (flat + newlines)
const certLike = `
اسم الطالب: عبدالله محمد بن حسين السحيب
المقياس: مقياس موهبة للقدرات العقلية المتعددة
السنة: 2025
الدرجة: 1763 من 2000
`;
const cand = extractCertificateTextCandidates(certLike);
assert.ok(cand.studentName && cand.studentName.includes("عبدالله"), "extract student with bin");
assert.ok(cand.achievementTitle && cand.achievementTitle.includes("موهبة"), "mawhiba title");
assert.equal(cand.year, "2025", "year");
assert.ok(cand.medalOrResultSnippet && cand.medalOrResultSnippet.includes("1763"), "score snippet");

// --- Group list row + name match (record without bin)
const listLike = `
بيان أسماء المتأهلين للمشاركة
1 عبدالله محمد بن حسين السحيب مكتب تعليم الأحساء كيمياء الثالث متوسط
`;
const rows = extractGroupDocumentStudentRows(listLike);
assert.ok(rows.length >= 1, "parsed at least one row");
const match = findMatchingStudentInGroupDocument(rows, ["عبدالله محمد حسين السحيب"]);
assert.equal(match.found, true, "student found via relaxed name compare");

// --- Merge two per-file reviews => aggregate checks + length 2
const ts = new Date().toISOString();
const f1: AdminAttachmentPerFileReview = {
  attachmentIndex: 0,
  label: "primary",
  fileName: "cert.pdf",
  overallMatchStatus: "match",
  checks: {
    nameCheck: "match",
    yearCheck: "match",
    levelCheck: "match",
    achievementCheck: "match",
    resultCheck: "match",
  },
  extractedEvidence: {
    ...emptyEv(),
    detectedStudentName: "عبدالله محمد بن حسين السحيب",
    detectedYear: "2025",
    detectedAchievementTitle: "مقياس موهبة",
  },
  recommendationAr: "",
  recommendationEn: "",
  analyzedAt: ts,
  detectedDocumentKind: "individual_certificate",
  summaryAr: "شهادة فردية.",
  summaryEn: "Individual certificate.",
};

const f2: AdminAttachmentPerFileReview = {
  attachmentIndex: 1,
  label: "attachment-1",
  fileName: "list.pdf",
  overallMatchStatus: "match",
  checks: {
    nameCheck: "match",
    yearCheck: "match",
    levelCheck: "match",
    achievementCheck: "match",
    documentTitleCheck: "match",
    contextualSupportCheck: "match",
  },
  extractedEvidence: {
    ...emptyEv(),
    detectedStudentName: "عبدالله محمد بن حسين السحيب",
  },
  recommendationAr: "",
  recommendationEn: "",
  analyzedAt: ts,
  detectedDocumentKind: "group_list_document",
  groupDocumentAnalysis: {
    studentFound: true,
    matchType: "strong",
    matchedRow: rows[0] ?? null,
    rowCount: rows.length,
  },
  summaryAr: "قائمة.",
  summaryEn: "List.",
};

const merged = aggregatePerFileAttachmentReviewResults([f1, f2]);
assert.equal(merged.checks.nameCheck, "match");
assert.equal(deriveOverallFromChecks(merged.checks), "match");
assert.ok(
  merged.extractedEvidence.detectedStudentName && merged.extractedEvidence.detectedStudentName.includes("عبدالله"),
  "merged name"
);

// eslint-disable-next-line no-console
console.log("verify-achievement-per-attachment-review: OK");
