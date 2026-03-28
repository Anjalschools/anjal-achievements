/**
 * End-to-end trace for admin achievement attachment review (PDF → candidates → AI → guardrails).
 *
 * Usage:
 *   npx tsx scripts/debug-achievement-attachment-pipeline.ts --fixture=mawhiba-2025 [--mock-ai=path.json] [--no-ai]
 *   npx tsx scripts/debug-achievement-attachment-pipeline.ts --fixture=clean-success [--no-ai]
 *   npx tsx scripts/debug-achievement-attachment-pipeline.ts --pdf=/absolute/path/to/cert.pdf [--record=path.json] [--mock-ai=path.json] [--no-ai]
 *
 * With OpenAI configured and without --no-ai/--mock-ai, calls the same API as production.
 * Do not commit real student PDFs; pass local paths only.
 */

import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";

dotenv.config();

import { PDFParse } from "pdf-parse";

import {
  ADMIN_ATTACHMENT_AI_REVIEW_SYSTEM_PROMPT,
  buildAchievementRecordPayloadForAi,
  buildAdminAttachmentAiUserText,
  collectAttachmentReviewInputs,
  parseAdminAttachmentAiPayload,
  type AdminAttachmentAiRecordContext,
} from "../src/lib/achievement-admin-attachment-ai";
import { deriveOverallFromChecks } from "../src/lib/achievement-admin-attachment-ai-checks";
import {
  applyAttachmentAiGuardrails,
  extractCertificateTextCandidates,
  mergePdfReliability,
} from "../src/lib/achievement-attachment-ai-guardrails";
import { assessPdfExtractedTextReliability } from "../src/lib/achievement-attachment-normalization";
import {
  buildPdfReviewInputs,
  decodePdfDataUrlToBuffer,
  MAX_PDF_BYTES_FOR_ACHIEVEMENT_REVIEW,
  PDF_REVIEW_TEXT_FIRST_PAGES,
} from "../src/lib/achievement-admin-pdf-review";
import { detectAttachmentDocumentKind } from "../src/lib/achievement-group-document-detection";
import {
  buildGroupListAttachmentReviewResult,
  shouldUseGroupListAttachmentPipeline,
} from "../src/lib/achievement-group-document-review";
import { openAiChatJsonObjectWithVision, type VisionUserPart } from "../src/lib/openai-vision-json";
import type { AdminAttachmentAiReviewResult } from "../src/types/admin-attachment-ai-review";

// --- Fixtures (no real PII beyond synthetic Arabic name used in regression tests)

const FIXTURE_MAWHIBA_2025 = `
ش
ه
ادة
اسم الطالب
فاطمة
أحمد
العلي
Summer Camp Chemistry Olympiad
لعام
2025
م
Silver Medal
ميدالية فضية
موهبة
`;

const FIXTURE_CLEAN_SUCCESS = `
Certificate of Achievement
Student name: Sara Ali Khan
Event: National Robotics Fair
Year: 2024
Silver medal
Organized by: STEM Board
`;

const DEFAULT_RECORD_MAWHIBA: AdminAttachmentAiRecordContext = {
  achievement: {
    achievementYear: 2025,
    achievementLevel: "national",
    achievementName: "Chemistry Olympiad Summer Camp",
    nameAr: "فاطمة أحمد العلي",
    medalType: "silver",
    resultType: "",
    rank: "",
  },
  student: {
    fullName: "فاطمة أحمد العلي",
    fullNameAr: "فاطمة أحمد العلي",
  },
};

const DEFAULT_RECORD_CLEAN: AdminAttachmentAiRecordContext = {
  achievement: {
    achievementYear: 2024,
    achievementLevel: "national",
    achievementName: "National Robotics Fair",
    nameAr: "",
    medalType: "silver",
    resultType: "",
    rank: "",
  },
  student: {
    fullName: "Sara Ali Khan",
    fullNameEn: "Sara Ali Khan",
  },
};

const MOCK_MODEL_BAD_MISMATCH = {
  overallMatchStatus: "mismatch",
  checks: {
    nameCheck: "mismatch",
    yearCheck: "mismatch",
    levelCheck: "unclear",
    achievementCheck: "mismatch",
    resultCheck: "mismatch",
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
  modelNote: "mock: pessimistic model",
};

const MOCK_MODEL_CLEAN_MATCH = {
  overallMatchStatus: "match",
  checks: {
    nameCheck: "match",
    yearCheck: "match",
    levelCheck: "unclear",
    achievementCheck: "match",
    resultCheck: "match",
  },
  extractedEvidence: {
    detectedStudentName: "Sara Ali Khan",
    detectedYear: "2024",
    detectedLevel: null,
    detectedAchievementTitle: "National Robotics Fair",
    detectedMedalOrResult: "Silver medal",
    detectedIssuer: "STEM Board",
    notesAr: "",
    notesEn: "",
  },
  recommendationAr: "",
  recommendationEn: "",
  modelNote: "mock: optimistic model",
};

type CliOpts = {
  fixture: "mawhiba-2025" | "clean-success" | null;
  pdfPath: string | null;
  recordPath: string | null;
  mockAiPath: string | null;
  noAi: boolean;
};

const parseArgs = (argv: string[]): CliOpts => {
  let fixture: CliOpts["fixture"] = null;
  let pdfPath: string | null = null;
  let recordPath: string | null = null;
  let mockAiPath: string | null = null;
  let noAi = false;
  for (const a of argv) {
    if (a.startsWith("--fixture=")) {
      const v = a.slice("--fixture=".length).trim();
      if (v === "mawhiba-2025" || v === "clean-success") fixture = v;
    } else if (a.startsWith("--pdf=")) {
      pdfPath = a.slice("--pdf=".length).trim() || null;
    } else if (a.startsWith("--record=")) {
      recordPath = a.slice("--record=".length).trim() || null;
    } else if (a.startsWith("--mock-ai=")) {
      mockAiPath = a.slice("--mock-ai=".length).trim() || null;
    } else if (a === "--no-ai") {
      noAi = true;
    }
  }
  return { fixture, pdfPath, recordPath, mockAiPath, noAi };
};

const loadJsonRecord = (p: string): AdminAttachmentAiRecordContext => {
  const raw = fs.readFileSync(p, "utf8");
  const j = JSON.parse(raw) as { achievement?: Record<string, unknown>; student?: unknown };
  if (!j.achievement || typeof j.achievement !== "object") {
    throw new Error("record JSON must include { achievement: {...}, student?: {...} }");
  }
  const student = j.student;
  return {
    achievement: j.achievement,
    student:
      student && typeof student === "object"
        ? (student as AdminAttachmentAiRecordContext["student"])
        : null,
  };
};

const section = (title: string) => {
  // eslint-disable-next-line no-console
  console.log(`\n======== ${title} ========`);
};

const printJson = (label: string, value: unknown) => {
  // eslint-disable-next-line no-console
  console.log(label, JSON.stringify(value, null, 2));
};

async function rawPdfTextFromBuffer(buffer: Buffer): Promise<{ raw: string; error?: string }> {
  if (buffer.length > MAX_PDF_BYTES_FOR_ACHIEVEMENT_REVIEW) {
    return { raw: "", error: "pdf_too_large" };
  }
  const parser = new PDFParse({ data: buffer });
  try {
    const tr = await parser.getText({ first: PDF_REVIEW_TEXT_FIRST_PAGES });
    return { raw: String(tr.text || "") };
  } catch (e) {
    return { raw: "", error: e instanceof Error ? e.message : "pdf_text_failed" };
  } finally {
    await parser.destroy().catch(() => {});
  }
}

async function runTrace(opts: CliOpts): Promise<void> {
  const ctx: AdminAttachmentAiRecordContext =
    opts.recordPath
      ? loadJsonRecord(opts.recordPath)
      : opts.fixture === "clean-success"
        ? DEFAULT_RECORD_CLEAN
        : DEFAULT_RECORD_MAWHIBA;

  const recordPayload = buildAchievementRecordPayloadForAi(ctx);

  let aggregatedPdfText = "";
  let pdfReliability = mergePdfReliability([]);
  let visionParts: VisionUserPart[] = [];
  let textHints: string[] = [];
  let attachmentMeta: Record<string, unknown> = { mode: opts.fixture ? "fixture-text" : "pdf" };

  if (opts.pdfPath) {
    const abs = path.isAbsolute(opts.pdfPath) ? opts.pdfPath : path.resolve(process.cwd(), opts.pdfPath);
    if (!fs.existsSync(abs)) {
      throw new Error(`PDF not found: ${abs}`);
    }
    const buffer = fs.readFileSync(abs);
    attachmentMeta = {
      mode: "local_pdf_file",
      path: abs,
      byteLength: buffer.length,
      withinLimit: buffer.length <= MAX_PDF_BYTES_FOR_ACHIEVEMENT_REVIEW,
    };

    const rawParse = await rawPdfTextFromBuffer(buffer);
    section("1) Attachment loading + raw PDF text (direct parse, same page window as production)");
    printJson("attachmentMetadata", attachmentMeta);
    printJson("rawExtractedPdfTextLength", rawParse.raw.length);
    // eslint-disable-next-line no-console
    console.log("rawExtractedPdfText (full, may be long):\n", rawParse.raw);
    if (rawParse.error) printJson("rawParseError", rawParse.error);

    const slice = await buildPdfReviewInputs(buffer, "debug-cli");
    section("2) buildPdfReviewInputs (cleaned text + reliability + images)");
    printJson("cleanedExtractedPdfTextLength", slice.text.length);
    // eslint-disable-next-line no-console
    console.log("cleanedExtractedPdfText:\n", slice.text);
    printJson("textReliability (page slice aggregate)", slice.textReliability);
    printJson("lowPdfTextReliability", slice.lowPdfTextReliability);
    printJson("pdfHints", slice.hints);
    printJson("renderedImageCount", slice.images.length);

    aggregatedPdfText = slice.text;
    pdfReliability = mergePdfReliability([{ label: "debug-pdf", reliability: slice.textReliability }]);

    const b64 = buffer.toString("base64");
    const dataUrl = `data:application/pdf;base64,${b64}`;
    const achievementForCollect = { ...ctx.achievement, image: dataUrl, attachments: [] };
    const collected = await collectAttachmentReviewInputs(achievementForCollect);
    visionParts = collected.visionParts;
    textHints = collected.textHints;
    aggregatedPdfText = collected.aggregatedPdfText;
    pdfReliability = collected.pdfReliability;

    section("2b) collectAttachmentReviewInputs (production path — should match slice text)");
    printJson("aggregatedPdfTextLength", aggregatedPdfText.length);
    printJson("mergedPdfReliability", pdfReliability);
    printJson("visionPartsCount", visionParts.length);
  } else if (opts.fixture === "mawhiba-2025" || opts.fixture === "clean-success") {
    const text = opts.fixture === "clean-success" ? FIXTURE_CLEAN_SUCCESS : FIXTURE_MAWHIBA_2025;
    aggregatedPdfText = text.replace(/\s+/g, " ").trim();
    const rel = assessPdfExtractedTextReliability(text);
    pdfReliability = mergePdfReliability([{ label: `fixture:${opts.fixture}`, reliability: rel }]);
    textHints = [
      `Extracted PDF text (fixture:${opts.fixture}, truncated):\n${aggregatedPdfText.slice(0, 7000)}`,
    ];
    if (pdfReliability.lowTextReliability) {
      textHints.push(
        `PDF text reliability (fixture): LOW — automated checks will not treat missing/noisy text as contradiction. Reasons: ${pdfReliability.reasons.join(", ") || "unspecified"}.`
      );
    }
    visionParts = [];
    attachmentMeta = {
      mode: "inline_fixture",
      fixture: opts.fixture,
      textLength: aggregatedPdfText.length,
    };
    section("1–2) Fixture text (no file) — raw == cleaned after whitespace normalize");
    printJson("attachmentMetadata", attachmentMeta);
    // eslint-disable-next-line no-console
    console.log("rawExtractedPdfText / cleanedExtractedPdfText:\n", aggregatedPdfText);
    printJson("textReliability", rel);
    printJson("mergedPdfReliability", pdfReliability);
  } else {
    throw new Error("Specify --fixture=mawhiba-2025 | clean-success or --pdf=/path/to/file.pdf");
  }

  const docKindDetection = detectAttachmentDocumentKind({
    text: aggregatedPdfText,
    hasRenderablePdfPreview: visionParts.length > 0,
  });

  section("3) Document kind (detectAttachmentDocumentKind)");
  printJson("detectedDocumentKind", docKindDetection.kind);
  printJson("kindConfidence", docKindDetection.confidence);
  printJson("kindReasons", docKindDetection.reasons);

  const useGroup = shouldUseGroupListAttachmentPipeline(aggregatedPdfText, docKindDetection);
  printJson("shouldUseGroupListAttachmentPipeline", useGroup);

  const extractedCertificateCandidates = extractCertificateTextCandidates(aggregatedPdfText);
  section("4) Certificate candidates (extractCertificateTextCandidates)");
  printJson("extractedCertificateCandidates", extractedCertificateCandidates);

  section("5) Expected record fields (buildAchievementRecordPayloadForAi + ctx)");
  printJson("expectedRecordPayload (aiPrompt record JSON)", recordPayload);
  printJson("expectedStudentName", {
    fullName: ctx.student?.fullName,
    fullNameAr: ctx.student?.fullNameAr,
    fullNameEn: ctx.student?.fullNameEn,
  });
  printJson("expectedAchievementTitle", {
    achievementName: ctx.achievement.achievementName,
    nameAr: ctx.achievement.nameAr,
    customAchievementName: ctx.achievement.customAchievementName,
    title: ctx.achievement.title,
  });
  printJson("expectedYearComparable", recordPayload.achievementYearRecorded);
  printJson("expectedMedalResult", {
    medalType: ctx.achievement.medalType,
    resultType: ctx.achievement.resultType,
    rank: ctx.achievement.rank,
  });

  const guardCtx = {
    record: ctx.achievement,
    studentCtx: ctx.student,
    aggregatedPdfText,
    pdfReliability,
    documentKindHint: {
      kind: docKindDetection.kind,
      confidence: docKindDetection.confidence,
      reasons: docKindDetection.reasons,
    },
  };

  if (useGroup) {
    section("6) Group-list pipeline (no OpenAI)");
    const groupBefore = buildGroupListAttachmentReviewResult({
      ctx,
      aggregatedPdfText,
      detection: docKindDetection,
    });
    printJson("groupResult.beforeGuardrails.checks", groupBefore.checks);
    printJson("groupResult.beforeGuardrails.overall", groupBefore.overallMatchStatus);
    printJson("groupResult.beforeGuardrails.extractedEvidence", groupBefore.extractedEvidence);
    printJson("groupDocumentAnalysis", groupBefore.groupDocumentAnalysis);

    const groupAfter = applyAttachmentAiGuardrails(groupBefore, guardCtx);
    section("7) Guardrails (group path)");
    printJson("checksAfterGuardrails", groupAfter.checks);
    printJson("derivedOverallFromChecks (explicit)", deriveOverallFromChecks(groupAfter.checks));
    printJson("finalOverall (on result)", groupAfter.overallMatchStatus);
    printJson("finalExtractedEvidence", groupAfter.extractedEvidence);
    return;
  }

  const userText = buildAdminAttachmentAiUserText({
    record: recordPayload,
    docKindDetection,
    textHints,
    visionPartsCount: visionParts.length,
  });

  const userParts: VisionUserPart[] = [{ type: "text", text: userText }, ...visionParts];

  section("6) AI prompt input (text part + vision part counts)");
  printJson("aiPromptPayload", {
    systemPromptLength: ADMIN_ATTACHMENT_AI_REVIEW_SYSTEM_PROMPT.length,
    userTextLength: userText.length,
    userTextFull: userText,
    visionImageParts: visionParts.filter((p) => p.type === "image_url").length,
    textHintsEmbedded: textHints.length,
  });

  let rawModelOutput = "";
  let parsedModel: unknown;

  if (opts.mockAiPath) {
    const mp = path.isAbsolute(opts.mockAiPath) ? opts.mockAiPath : path.resolve(process.cwd(), opts.mockAiPath);
    parsedModel = JSON.parse(fs.readFileSync(mp, "utf8")) as unknown;
    rawModelOutput = JSON.stringify(parsedModel);
    section("7) Raw AI output (from --mock-ai file)");
    printJson("rawModelOutput", rawModelOutput.slice(0, 8000));
  } else if (opts.noAi) {
    parsedModel =
      opts.fixture === "clean-success" ? MOCK_MODEL_CLEAN_MATCH : MOCK_MODEL_BAD_MISMATCH;
    rawModelOutput = JSON.stringify(parsedModel);
    section("7) Raw AI output (--no-ai built-in mock)");
    printJson("rawModelOutput", rawModelOutput);
  } else {
    section("7) Raw AI output (live OpenAI — same helper as production)");
    const ai = await openAiChatJsonObjectWithVision({
      system: ADMIN_ATTACHMENT_AI_REVIEW_SYSTEM_PROMPT,
      userParts,
      maxTokens: 1600,
      temperature: 0.12,
    });
    if (!ai.ok) {
      printJson("openAiError", { message: ai.message, code: ai.code });
      // eslint-disable-next-line no-console
      console.log("Falling back to built-in mock so guardrails trace still prints. Re-run with OPENAI_API_KEY or --mock-ai.");
      parsedModel =
        opts.fixture === "clean-success" ? MOCK_MODEL_CLEAN_MATCH : MOCK_MODEL_BAD_MISMATCH;
      rawModelOutput = JSON.stringify(parsedModel);
    } else {
      rawModelOutput = ai.rawText;
      parsedModel = ai.parsed;
      printJson("rawModelOutputPreview", rawModelOutput.slice(0, 8000));
    }
  }

  const parsedReview = parseAdminAttachmentAiPayload(parsedModel);
  if (!parsedReview) {
    printJson("parseAdminAttachmentAiPayload", null);
    throw new Error("Model payload did not match expected shape");
  }

  const checksBeforeGuardrails: AdminAttachmentAiReviewResult["checks"] = { ...parsedReview.checks };
  const evidenceBefore = { ...parsedReview.extractedEvidence };

  section("8) Parsed model (before guardrails)");
  printJson("parsedModelOutput.checks", parsedReview.checks);
  printJson("parsedModelOutput.extractedEvidence", parsedReview.extractedEvidence);
  printJson("parsedModelOutput.overallMatchStatus", parsedReview.overallMatchStatus);
  printJson("deriveOverallFromChecks(parsed checks only)", deriveOverallFromChecks(parsedReview.checks));

  const afterGuardrails = applyAttachmentAiGuardrails(parsedReview, guardCtx);

  section("9) After applyAttachmentAiGuardrails");
  printJson("checksBeforeGuardrails", checksBeforeGuardrails);
  printJson("extractedEvidenceBeforeGuardrails (model-only)", evidenceBefore);
  printJson("checksAfterGuardrails", afterGuardrails.checks);
  printJson("extractedEvidenceAfterGuardrails (merged with heuristics)", afterGuardrails.extractedEvidence);

  const fieldDiff = {
    nameCheck: { before: checksBeforeGuardrails.nameCheck, after: afterGuardrails.checks.nameCheck },
    yearCheck: { before: checksBeforeGuardrails.yearCheck, after: afterGuardrails.checks.yearCheck },
    levelCheck: { before: checksBeforeGuardrails.levelCheck, after: afterGuardrails.checks.levelCheck },
    achievementCheck: {
      before: checksBeforeGuardrails.achievementCheck,
      after: afterGuardrails.checks.achievementCheck,
    },
    resultCheck: {
      before: checksBeforeGuardrails.resultCheck,
      after: afterGuardrails.checks.resultCheck,
    },
  };
  printJson("checkDiffBeforeAfter", fieldDiff);

  section("10) Final summary");
  printJson("derivedOverallFromChecks(after guardrails)", deriveOverallFromChecks(afterGuardrails.checks));
  printJson("finalOverallOnResult", afterGuardrails.overallMatchStatus);
  printJson("finalSummary", {
    overallMatchStatus: afterGuardrails.overallMatchStatus,
    checks: afterGuardrails.checks,
    extractedEvidence: afterGuardrails.extractedEvidence,
    recommendationAr: afterGuardrails.recommendationAr,
    recommendationEn: afterGuardrails.recommendationEn,
    detectedDocumentKind: afterGuardrails.detectedDocumentKind ?? docKindDetection.kind,
  });
}

const main = async () => {
  const opts = parseArgs(process.argv.slice(2));
  // eslint-disable-next-line no-console
  console.log("debug-achievement-attachment-pipeline", opts);
  await runTrace(opts);
  // eslint-disable-next-line no-console
  console.log("\n======== DONE ========");
};

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
