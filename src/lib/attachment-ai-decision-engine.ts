/**
 * Deterministic decision layer after LLM + guardrails (not prompt-only).
 * Maps field checks → final aiReviewDecision + backward-compatible overallMatchStatus.
 */

import type {
  AdminAttachmentAiChecks,
  AdminAttachmentAiReviewResult,
  AdminAttachmentMatchValue,
  AiReviewDecision,
  AttachmentDocumentKind,
} from "@/types/admin-attachment-ai-review";

const pick = (v: AdminAttachmentMatchValue | undefined): AdminAttachmentMatchValue =>
  v === "match" || v === "mismatch" || v === "unclear" ? v : "unclear";

const resultDimensionRelevant = (record: Record<string, unknown>): boolean => {
  const rt = String(record.resultType || "").trim().toLowerCase();
  const medal = String(record.medalType || "").trim();
  const rank = String(record.rank || "").trim();
  if (medal || rank) return true;
  if (rt === "medal" || rt === "rank" || rt === "nomination" || rt === "special_award") return true;
  return false;
};

const groupAchievementVerdict = (checks: AdminAttachmentAiChecks): AdminAttachmentMatchValue => {
  const trio = [
    checks.contextualSupportCheck,
    checks.documentTitleCheck,
    checks.achievementCheck,
  ].filter((x): x is AdminAttachmentMatchValue => x === "match" || x === "mismatch" || x === "unclear");
  if (trio.some((x) => x === "mismatch")) return "mismatch";
  if (trio.some((x) => x === "match")) return "match";
  return "unclear";
};

const classifyFieldLists = (
  checks: AdminAttachmentAiChecks,
  kind: AttachmentDocumentKind | undefined,
  record: Record<string, unknown>
): { matched: string[]; mismatched: string[]; unclear: string[] } => {
  const matched: string[] = [];
  const mismatched: string[] = [];
  const unclear: string[] = [];
  const push = (label: string, v: AdminAttachmentMatchValue) => {
    if (v === "match") matched.push(label);
    else if (v === "mismatch") mismatched.push(label);
    else unclear.push(label);
  };

  push("studentName", pick(checks.nameCheck));
  const ach =
    kind === "group_list_document" ? groupAchievementVerdict(checks) : pick(checks.achievementCheck);
  push("achievementName", ach);
  push("year", pick(checks.yearCheck));
  push("level", pick(checks.levelCheck));
  if (resultDimensionRelevant(record)) {
    push("result", pick(checks.resultCheck));
  }
  if (checks.documentTitleCheck) push("documentTitle", pick(checks.documentTitleCheck));
  if (checks.contextualSupportCheck) push("contextualSupport", pick(checks.contextualSupportCheck));
  if (checks.optionalRowDataCheck) push("optionalRowData", pick(checks.optionalRowDataCheck));

  return { matched, mismatched, unclear };
};

const buildWarningRecommendationAr = (
  decision: AiReviewDecision,
  unclear: string[],
  mismatched: string[],
  pdfLow: boolean
): { ar: string; en: string; warnings: string[] } => {
  const warnings: string[] = [];
  const has = (k: string) => unclear.includes(k) || mismatched.includes(k);

  if (pdfLow) warnings.push("low_pdf_text_reliability");

  if (decision === "accepted_with_warning") {
    let ar =
      "تم التحقق من تطابق العناصر الأساسية للإنجاز مع الدليل المرفق؛ يُنصح بتدقيق بشري إضافي للحقول المشار إليها أدناه.";
    let en =
      "Core achievement elements match the attached evidence; additional human review is recommended for the fields noted below.";

    if (has("level") && !has("studentName") && !has("achievementName")) {
      ar =
        "تم التحقق من تطابق اسم الطالب واسم الإنجاز والنتيجة من الدليل المرفق، مع وجود اختلاف أو عدم وضوح في المستوى المذكور؛ يُنصح بمراجعة المستوى يدويًا.";
      en =
        "Student name, achievement title, and result align with the evidence; the recorded level is unclear or differs — please verify the level manually.";
      warnings.push("level_followup");
    } else if (has("year") && !has("studentName")) {
      ar =
        "تمت مطابقة العناصر الأساسية، لكن السنة الظاهرة في الدليل غير حاسمة أو تختلف؛ يُنصح بمراجعة السنة يدويًا.";
      en =
        "Core fields match; the year on the document is ambiguous or inconsistent — please verify the year.";
      warnings.push("year_followup");
    } else if (pdfLow) {
      ar =
        "تم قبول المطابقة الأساسية آليًا رغم جودة استخراج نص منخفضة من الملف؛ يُنصح بمراجعة المرفق بصريًا.";
      en =
        "Core match accepted despite low PDF text extraction quality; visual review of the attachment is recommended.";
    }

    return { ar, en, warnings };
  }

  return { ar: "", en: "", warnings };
};

/**
 * Apply deterministic rules on top of guardrailed checks. Mutates/extends the review payload.
 */
export const applyDeterministicAttachmentReviewDecision = (
  result: AdminAttachmentAiReviewResult,
  ctx: {
    record: Record<string, unknown>;
    pdfReliabilityLow: boolean;
  }
): AdminAttachmentAiReviewResult => {
  const checks = result.checks;
  const kind = result.detectedDocumentKind;
  const pdfLow = ctx.pdfReliabilityLow;

  const nameV = pick(checks.nameCheck);
  const achV = kind === "group_list_document" ? groupAchievementVerdict(checks) : pick(checks.achievementCheck);
  let resultV: AdminAttachmentMatchValue = "match";
  if (resultDimensionRelevant(ctx.record)) {
    resultV = checks.resultCheck !== undefined ? pick(checks.resultCheck) : "unclear";
  }

  const secondaryKeys: Array<{ key: keyof AdminAttachmentAiChecks; label: string }> = [
    { key: "yearCheck", label: "year" },
    { key: "levelCheck", label: "level" },
  ];
  const secondaryConflict =
    secondaryKeys.some(({ key }) => pick(checks[key] as AdminAttachmentMatchValue) === "mismatch") ||
    secondaryKeys.some(({ key }) => pick(checks[key] as AdminAttachmentMatchValue) === "unclear");

  const coreMismatch = nameV === "mismatch" || achV === "mismatch" || resultV === "mismatch";
  const coreAllMatch = nameV === "match" && achV === "match" && resultV === "match";

  let decision: AiReviewDecision;
  let reasonAr: string;
  let reasonEn: string;

  if (coreMismatch) {
    if (pdfLow) {
      decision = "unclear";
      reasonAr =
        "يُعَدُّ عدم التطابق محتملًا بسبب ضعف جودة استخراج النص من الملف؛ تُفضّل مراجعة بشرية للمرفق.";
      reasonEn =
        "A mismatch signal exists but PDF text extraction is weak; human review of the attachment is preferred.";
    } else {
      decision = "rejected";
      reasonAr = "تضارب صريح بين بيانات السجل والدليل في أحد العناصر الأساسية (الاسم أو الإنجاز أو النتيجة).";
      reasonEn = "Explicit conflict between the record and evidence on a core field (name, achievement, or result).";
    }
  } else if (coreAllMatch) {
    if (secondaryConflict || pdfLow) {
      decision = "accepted_with_warning";
      reasonAr = "تطابق قوي للعناصر الأساسية مع وجود ملاحظات على حقول ثانوية أو على جودة الاستخراج.";
      reasonEn = "Strong core match with secondary-field notes or extraction-quality caveats.";
    } else {
      decision = "accepted";
      reasonAr = "تطابق العناصر الأساسية (الاسم والإنجاز والنتيجة عند انطباقها) مع الدليل المرفق.";
      reasonEn = "Core fields (name, achievement, and result where applicable) align with the attached evidence.";
    }
  } else {
    decision = "unclear";
    reasonAr = "تعذر الحسم الآلي الكامل لأحد العناصر الأساسية بسبب نقص أو غموض في الدليل.";
    reasonEn = "Could not conclusively verify a core field due to missing or ambiguous evidence.";
  }

  const lists = classifyFieldLists(checks, kind, ctx.record);
  const rec = buildWarningRecommendationAr(decision, lists.unclear, lists.mismatched, pdfLow);

  const overallMatchStatus: AdminAttachmentMatchValue =
    decision === "accepted" || decision === "accepted_with_warning"
      ? "match"
      : decision === "rejected"
        ? "mismatch"
        : "unclear";

  const recommendationAr =
    decision === "accepted_with_warning" && rec.ar
      ? rec.ar
      : result.recommendationAr || rec.ar;
  const recommendationEn =
    decision === "accepted_with_warning" && rec.en
      ? rec.en
      : result.recommendationEn || rec.en;

  const allWarnings = [...new Set(rec.warnings)];

  return {
    ...result,
    overallMatchStatus,
    checks,
    recommendationAr: recommendationAr.trim() || result.recommendationAr,
    recommendationEn: recommendationEn.trim() || result.recommendationEn,
    modelOverallMatchStatus: result.overallMatchStatus,
    aiReviewDecision: decision,
    aiDecisionReasonAr: reasonAr,
    aiDecisionReasonEn: reasonEn,
    aiReviewWarnings: allWarnings,
    aiMatchedFields: lists.matched,
    aiMismatchedFields: lists.mismatched,
    aiUnclearFields: lists.unclear,
  };
};
