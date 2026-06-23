export type InstitutionReportValidationDiagnostics = {
  ocrExecuted: boolean;
  visionExecuted: boolean;
  ocrError?: string;
  visionError?: string;
  pagesDetected?: number;
  fileType?: string;
  fileSize?: number;
  failureReasonAr?: string;
  failureReasonEn?: string;
};

const inferFileType = (fileName?: string, mimeType?: string) => {
  const name = String(fileName || "").toLowerCase();
  const mime = String(mimeType || "").toLowerCase();
  if (name.endsWith(".pdf") || mime === "application/pdf") return "pdf";
  if (/\.(png|jpe?g)$/i.test(name) || mime.startsWith("image/")) return "image";
  return mime || name.split(".").pop() || "unknown";
};

export const buildInstitutionReportValidationDiagnostics = (
  extractionMeta: Record<string, unknown> | null | undefined,
  opts?: { fileName?: string; mimeType?: string; fileSize?: number }
): InstitutionReportValidationDiagnostics | null => {
  if (!extractionMeta) return null;

  const validationResult =
    extractionMeta.validationResult && typeof extractionMeta.validationResult === "object"
      ? (extractionMeta.validationResult as Record<string, unknown>)
      : null;
  const riskFlags = [
    ...(Array.isArray(extractionMeta.riskFlags) ? extractionMeta.riskFlags : []),
    ...(Array.isArray(validationResult?.riskFlags) ? validationResult.riskFlags : []),
  ].map(String);

  const extractionMethod = String(
    validationResult?.extractionMethod || extractionMeta.extractionMethod || ""
  ).toLowerCase();
  const ocrExecuted =
    extractionMethod === "ocr" ||
    extractionMethod === "hybrid" ||
    extractionMethod === "heuristic" ||
    typeof extractionMeta.ocrTextPreview === "string";
  const visionExecuted = extractionMethod === "vision" || extractionMethod === "hybrid";

  let ocrError: string | undefined;
  let visionError: string | undefined;
  let failureReasonAr: string | undefined;
  let failureReasonEn: string | undefined;

  if (riskFlags.includes("OCR_FAILED") || (ocrExecuted && !String(extractionMeta.ocrTextPreview || "").trim())) {
    ocrError = "OCR extraction failed";
    failureReasonAr = "فشل استخراج OCR";
    failureReasonEn = "OCR extraction failed";
  }

  if (riskFlags.includes("AI_REVIEW_FAILED")) {
    visionError = "Vision extraction failed";
    failureReasonAr = failureReasonAr || "فشل استخراج الرؤية";
    failureReasonEn = failureReasonEn || "Vision extraction failed";
  }

  const warnings = Array.isArray(validationResult?.warnings)
    ? validationResult.warnings.map(String)
    : [];
  if (warnings.some((w) => /unsupported pdf|pdf structure/i.test(w))) {
    ocrError = ocrError || "Unsupported PDF structure";
    failureReasonAr = failureReasonAr || "بنية PDF غير مدعومة";
    failureReasonEn = failureReasonEn || "Unsupported PDF structure";
  }
  if (warnings.some((w) => /no readable pages|readable pages/i.test(w))) {
    ocrError = ocrError || "No readable pages detected";
    failureReasonAr = failureReasonAr || "لم يتم العثور على صفحات قابلة للقراءة";
    failureReasonEn = failureReasonEn || "No readable pages detected";
  }
  if (warnings.some((w) => /resolution|low quality/i.test(w))) {
    visionError = visionError || "Image resolution too low";
    failureReasonAr = failureReasonAr || "دقة الصورة منخفضة جداً";
    failureReasonEn = failureReasonEn || "Image resolution too low";
  }

  const fieldsExtracted =
    extractionMeta.fieldsExtracted && typeof extractionMeta.fieldsExtracted === "object"
      ? (extractionMeta.fieldsExtracted as Record<string, unknown>)
      : null;
  const pagesDetected =
    typeof fieldsExtracted?.pagesDetected === "number"
      ? fieldsExtracted.pagesDetected
      : typeof validationResult?.pagesDetected === "number"
        ? validationResult.pagesDetected
        : undefined;

  return {
    ocrExecuted,
    visionExecuted,
    ocrError,
    visionError,
    pagesDetected,
    fileType: inferFileType(opts?.fileName, opts?.mimeType),
    fileSize: opts?.fileSize,
    failureReasonAr,
    failureReasonEn,
  };
};
