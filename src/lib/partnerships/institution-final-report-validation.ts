import {
  INSTITUTION_REPORT_AUTO_POPULATE_CONFIDENCE,
  INSTITUTION_REPORT_EXPECTED_RATING_COUNT,
  INSTITUTION_REPORT_RATING_FIELDS,
  formatInstitutionReportExtractionMethod,
  type InstitutionFinalReportExtractionResult,
  type InstitutionReportRatingRowDetail,
  type InstitutionReportReviewStatus,
  type InstitutionReportRiskFlag,
  type InstitutionReportValidationResult,
} from "@/lib/partnerships/institution-final-report-constants";
import {
  visionRowIsMultiple,
  visionRowIsValid,
} from "@/lib/partnerships/institution-final-report-vision-shared";

const DEBUG = process.env.AI_DEBUG === "1";
const VISION_SIGNAL_THRESHOLD = 35;

const hasRating = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;

const hasText = (value: unknown) => Boolean(String(value || "").trim());

const countOcrRatingSelections = (text: string, labelPatterns: RegExp[]): number => {
  for (const pattern of labelPatterns) {
    const match = text.match(pattern);
    if (!match || match.index == null) continue;
    const windowStart = match.index + match[0].length;
    const window = text.slice(windowStart, windowStart + 36);
    const checkedPairs = window.match(/[✓✔☑Xx]\s*[1-5]|[1-5]\s*[✓✔☑Xx]/g) || [];
    if (checkedPairs.length >= 2) return checkedPairs.length;
    if (checkedPairs.length === 1) return 1;
    const firstDigit = window.match(/^\s*[✓✔☑Xx]?\s*([1-5])\b/);
    if (firstDigit) return 1;
    return 0;
  }
  return -1;
};

const detectStampInDocument = (
  text: string,
  extractionHasStamp: boolean,
  visionStampDetected?: boolean,
  visionStampConfidence?: number
): boolean => {
  if (visionStampDetected && (visionStampConfidence ?? 0) >= VISION_SIGNAL_THRESHOLD) {
    return true;
  }
  const flat = String(text || "").trim();
  if (!flat) return false;
  const withoutTemplateLabel = flat.replace(/الختم الرسمي للمؤسسة/g, " ");
  const stampSignals =
    /(?:مختوم|official seal|institution stamp|ختم[\s:：]+(?!$)[^\n]{2,})/i.test(withoutTemplateLabel) ||
    /(?:stamp|seal)[\s:：]+[^\n]{2,}/i.test(withoutTemplateLabel);
  return extractionHasStamp && stampSignals;
};

const detectSignatureInDocument = (
  text: string,
  extractionHasSignature: boolean,
  visionSignatureDetected?: boolean,
  visionSignatureConfidence?: number
): boolean => {
  if (visionSignatureDetected && (visionSignatureConfidence ?? 0) >= VISION_SIGNAL_THRESHOLD) {
    return true;
  }
  const flat = String(text || "").trim();
  if (!flat) return false;
  const signedLine = /توقيع[\s:：]*[^\n_\s—\-]{4,}/i.test(flat);
  const handwritingCue = /(?:signed|signature present|وقع[\s:：]+[^\n]{3,})/i.test(flat);
  return extractionHasSignature || signedLine || handwritingCue;
};

const visionHasUsableRatings = (extraction: InstitutionFinalReportExtractionResult) =>
  (extraction.visionVerification?.ratingRows.some((row) => visionRowIsValid(row)) ?? false) ||
  INSTITUTION_REPORT_RATING_FIELDS.some(({ key }) =>
    hasRating(extraction[key as keyof InstitutionFinalReportExtractionResult])
  );

const isOcrReviewFailed = (
  extraction: InstitutionFinalReportExtractionResult,
  ocrText: string
): boolean => {
  const emptyOcr = !String(ocrText || "").trim();
  const noRatings = INSTITUTION_REPORT_RATING_FIELDS.every(
    ({ key }) => !hasRating(extraction[key as keyof InstitutionFinalReportExtractionResult])
  );
  const visionSucceeded =
    (extraction.visionConfidence ?? 0) >= VISION_SIGNAL_THRESHOLD && visionHasUsableRatings(extraction);

  if (visionSucceeded) return false;

  return (
    emptyOcr &&
    noRatings &&
    (extraction.overallConfidence ?? extraction.confidenceScore) <= 0 &&
    (extraction.extractionMethod === "heuristic" || extraction.extractionMethod === "ocr")
  );
};

export const validateInstitutionFinalReport = (
  extraction: InstitutionFinalReportExtractionResult,
  ocrText = extraction.ocrTextPreview || ""
): InstitutionReportValidationResult => {
  const riskFlags: InstitutionReportRiskFlag[] = [];
  const warnings: string[] = [];
  const missingRatingKeys: string[] = [];
  const invalidRatingRows: string[] = [];
  const ratingRowDetails: InstitutionReportRatingRowDetail[] = [];

  const visionVerification = extraction.visionVerification;
  const ocrConfidence = extraction.ocrConfidence ?? extraction.confidenceScore;
  const visionConfidence = extraction.visionConfidence ?? 0;
  const overallConfidence = extraction.overallConfidence ?? extraction.confidenceScore;
  const extractionMethod = formatInstitutionReportExtractionMethod(extraction.extractionMethod);

  let ratingsDetected = 0;
  const visionSucceeded =
    visionConfidence >= VISION_SIGNAL_THRESHOLD && visionHasUsableRatings(extraction);

  if (isOcrReviewFailed(extraction, ocrText)) {
    riskFlags.push("AI_REVIEW_FAILED", "OCR_FAILED");
    warnings.push("تعذر قراءة التقرير آلياً — يلزم مراجعة المشرف يدوياً.");
  } else if (!String(ocrText || "").trim() && !visionSucceeded) {
    riskFlags.push("OCR_FAILED");
    warnings.push("تعذر استخراج نص التقرير — يلزم مراجعة يدوية.");
  }

  for (const row of INSTITUTION_REPORT_RATING_FIELDS) {
    const extractedRating = extraction[row.key as keyof InstitutionFinalReportExtractionResult];
    const visionRow = visionVerification?.ratingRows.find((item) => item.key === row.key);
    const ocrSelections = countOcrRatingSelections(ocrText, row.labelPatterns);

    if (visionRow && visionRowIsMultiple(visionRow)) {
      invalidRatingRows.push(row.key);
      riskFlags.push("INVALID_RATING_ROW", "MULTIPLE_SELECTIONS");
      warnings.push(`البند «${row.labelAr}» يحتوي على أكثر من اختيار.`);
      ratingRowDetails.push({
        key: row.key,
        labelAr: row.labelAr,
        rowStatus: "MULTIPLE",
        selectedRating: visionRow.selectedRating,
      });
      if (hasRating(extractedRating)) ratingsDetected += 1;
      continue;
    }

    if (visionRow && visionRowIsValid(visionRow)) {
      ratingsDetected += 1;
      ratingRowDetails.push({
        key: row.key,
        labelAr: row.labelAr,
        rowStatus: "VALID",
        selectedRating: visionRow.selectedRating ?? (hasRating(extractedRating) ? extractedRating : undefined),
      });
      continue;
    }

    if (ocrSelections >= 2) {
      invalidRatingRows.push(row.key);
      riskFlags.push("INVALID_RATING_ROW", "MULTIPLE_SELECTIONS");
      warnings.push(`البند «${row.labelAr}» يحتوي على أكثر من اختيار.`);
      ratingRowDetails.push({ key: row.key, labelAr: row.labelAr, rowStatus: "MULTIPLE" });
      if (hasRating(extractedRating)) ratingsDetected += 1;
      continue;
    }

    if (hasRating(extractedRating) || ocrSelections === 1) {
      ratingsDetected += 1;
      ratingRowDetails.push({
        key: row.key,
        labelAr: row.labelAr,
        rowStatus: "VALID",
        selectedRating: hasRating(extractedRating) ? extractedRating : undefined,
      });
      continue;
    }

    missingRatingKeys.push(row.key);
    ratingRowDetails.push({ key: row.key, labelAr: row.labelAr, rowStatus: "EMPTY" });
    warnings.push(`${row.labelAr}: غير مقيم`);
  }

  const missingRatings = Math.max(0, INSTITUTION_REPORT_EXPECTED_RATING_COUNT - ratingsDetected);
  if (missingRatings > 0) {
    riskFlags.push("MISSING_RATINGS", "MISSING_EVALUATIONS");
  }

  const stampDetected = detectStampInDocument(
    ocrText,
    extraction.hasStamp,
    visionVerification?.stampDetected,
    visionVerification?.stampConfidence
  );
  if (!stampDetected) {
    riskFlags.push("MISSING_STAMP");
    warnings.push("لا يوجد ختم رسمي للمؤسسة.");
  }

  const signatureDetected = detectSignatureInDocument(
    ocrText,
    extraction.hasSignature,
    visionVerification?.signatureDetected,
    visionVerification?.signatureConfidence
  );
  if (!signatureDetected) {
    riskFlags.push("MISSING_SIGNATURE");
    warnings.push("لا يوجد توقيع معتمد.");
  }

  const recommendationDetected = Boolean(extraction.recommendation);

  const approvalFieldsDetected = {
    supervisorName: hasText(extraction.supervisorName),
    positionTitle: hasText(extraction.positionTitle),
    signature: signatureDetected,
  };

  const approvalComplete =
    approvalFieldsDetected.supervisorName &&
    approvalFieldsDetected.positionTitle &&
    approvalFieldsDetected.signature;

  if (!approvalComplete) {
    riskFlags.push("APPROVAL_INCOMPLETE");
    if (!approvalFieldsDetected.supervisorName) {
      warnings.push("اسم المشرف المباشر غير موجود.");
    }
    if (!approvalFieldsDetected.positionTitle) {
      warnings.push("المسمى الوظيفي غير موجود.");
    }
  }

  const uniqueFlags = [...new Set(riskFlags)];

  const reviewStatus: InstitutionReportReviewStatus =
    uniqueFlags.length === 0 &&
    ratingsDetected >= INSTITUTION_REPORT_EXPECTED_RATING_COUNT &&
    stampDetected &&
    signatureDetected &&
    approvalComplete &&
    overallConfidence >= INSTITUTION_REPORT_AUTO_POPULATE_CONFIDENCE
      ? "APPROVED"
      : "REQUIRES_REVIEW";

  const validationResult: InstitutionReportValidationResult = {
    ratingsDetected,
    expectedRatings: INSTITUTION_REPORT_EXPECTED_RATING_COUNT,
    missingRatings,
    missingRatingKeys,
    invalidRatingRows: [...new Set(invalidRatingRows)],
    stampDetected,
    signatureDetected,
    recommendationDetected,
    approvalFieldsDetected,
    approvalComplete,
    confidence: overallConfidence,
    ocrConfidence,
    visionConfidence,
    overallConfidence,
    stampConfidence: visionVerification?.stampConfidence,
    signatureConfidence: visionVerification?.signatureConfidence,
    extractionMethod,
    ratingRowDetails,
    reviewStatus,
    riskFlags: uniqueFlags,
    warnings: [...new Set(warnings)],
  };

  console.info("[institution-final-report-ai]", {
    extractionMethod: validationResult.extractionMethod,
    ratingsDetected: validationResult.ratingsDetected,
    stampDetected: validationResult.stampDetected,
    signatureDetected: validationResult.signatureDetected,
    ocrConfidence: validationResult.ocrConfidence,
    visionConfidence: validationResult.visionConfidence,
    overallConfidence: validationResult.overallConfidence,
    reviewStatus: validationResult.reviewStatus,
    riskFlags: validationResult.riskFlags,
  });

  if (DEBUG) {
    console.info("[institution-final-report-ai:debug]", validationResult);
  }

  return validationResult;
};

export const institutionReportValidationStatusLabel = (
  validation: InstitutionReportValidationResult | null | undefined,
  locale: "ar" | "en"
): string => {
  if (!validation) return locale === "ar" ? "غير متوفر" : "Unavailable";
  if (validation.reviewStatus === "APPROVED") return locale === "ar" ? "سليم" : "Complete";
  if (
    validation.riskFlags.includes("AI_REVIEW_FAILED") ||
    validation.riskFlags.includes("OCR_FAILED")
  ) {
    return locale === "ar" ? "بحاجة مراجعة" : "Needs review";
  }
  return locale === "ar" ? "ناقص" : "Incomplete";
};
