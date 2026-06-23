import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GlobalFonts, loadImage, PDFDocument, type SKRSContext2D } from "@napi-rs/canvas";
import QRCode from "qrcode";
import {
  INSTITUTION_ASSESSMENT_CATEGORIES,
  INSTITUTION_ASSESSMENT_DIMENSIONS,
  INSTITUTION_OVERALL_RECOMMENDATIONS,
  INSTITUTION_RATING_LABELS,
} from "@/lib/partnerships/training-final-evaluation-ui-constants";
import { getGradeLabel } from "@/constants/grades";
import { getBaseUrl } from "@/lib/get-base-url";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_X = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const FOOTER_MINIMAL_RESERVED = 24;
const HEADER_IMAGE_HEIGHT = 84;
const TITLE_AFTER_HEADER_GAP = 30;
const STAMP_SIZE_PT = Math.round((5.0 / 2.54) * 72);
const CHECKBOX_SIZE = 21;
const MATRIX_ROW_H = 36;
const MATRIX_HEADER_H = 30;
const LABEL_COL_RATIO = 0.48;
const RECOMMENDATION_TITLE_GAP = 18;
const RECOMMENDATION_PRE_SECTION_GAP = 14;
const RECOMMENDATION_OPTION_H = 24;
const REASON_LINE_WIDTH_RATIO = 0.75;
const INFO_TABLE_ROW_H = 22;
const NEW_PAGE_START_Y = 38;
const CATEGORY_ANCHOR_H = 10;
const CATEGORY_TITLE_H = 14;
const MATRIX_AFTER_H = 4;
const WRITING_LINE_COUNT = 7;
const WRITING_LINE_GAP = 17;
const WRITING_SECTION_HEIGHT = WRITING_LINE_COUNT * WRITING_LINE_GAP + 24;
const NARRATIVE_SECTION_H = 10 + 15 + 2 + WRITING_SECTION_HEIGHT + 4;
const LEGEND_BLOCK_H = 32;
const RECOMMENDATION_BLOCK_H =
  16 + RECOMMENDATION_TITLE_GAP + RECOMMENDATION_OPTION_H + 8 + 12 + 14;
const APPROVAL_ROW_SPACING = 32;
const APPROVAL_SECTION_TOP_OFFSET = 0;
const APPROVAL_STAMP_TOP_OFFSET = 4;
const APPROVAL_STAMP_LABEL_OFFSET = 4;
const APPROVAL_SECTION_END_PADDING = 4;
const APPROVAL_BLOCK_H =
  16 +
  Math.max(APPROVAL_STAMP_TOP_OFFSET + STAMP_SIZE_PT, APPROVAL_SECTION_TOP_OFFSET + APPROVAL_ROW_SPACING * 6) +
  APPROVAL_SECTION_END_PADDING;
const FLOWING_FINAL_FOOTER_HEIGHT = 96;
const FINAL_PAGE_TAIL_HEIGHT =
  RECOMMENDATION_PRE_SECTION_GAP + RECOMMENDATION_BLOCK_H + APPROVAL_BLOCK_H + FLOWING_FINAL_FOOTER_HEIGHT;
const QR_DISPLAY_SIZE = 88;
const STROKE_MIN = 1.0;
const STROKE_BORDER = "#64748b";
const STROKE_DIVIDER = "#6b7280";
const STROKE_RULE = "#9ca3af";
const OCR_ANCHOR_COLOR = "#6b7280";

const CATEGORY_OCR_ANCHORS: Record<string, string> = {
  professional_commitment: "[PROFESSIONAL_COMMITMENT]",
  personal_skills: "[PERSONAL_SKILLS]",
  practical_performance: "[WORK_PERFORMANCE]",
  safety: "[SAFETY]",
};

const NARRATIVE_SECTIONS = [
  { label: "المهام المسندة للطالب", anchor: "[TASKS]" },
  { label: "أبرز الإنجازات أثناء التدريب", anchor: "[ACHIEVEMENTS]" },
  { label: "نقاط القوة", anchor: "[STRENGTHS]" },
  { label: "فرص التحسين", anchor: "[IMPROVEMENTS]" },
  { label: "ملاحظات إضافية للمشرف", anchor: "[SUPERVISOR_NOTES]" },
] as const;

const COMPACT_RATING_LEGEND = `دليل التقييم: ${[...INSTITUTION_RATING_LABELS]
  .reverse()
  .map((row) => `${row.value} ${row.ar}`)
  .join(" | ")}`;

const FINAL_PAGE_INSTRUCTION =
  "تعليمات التقييم: اختر درجة واحدة فقط لكل بند وضع علامة ✓ داخل المربع المناسب.";

let fontsRegistered = false;

const ensureFonts = () => {
  if (fontsRegistered) return;
  try {
    GlobalFonts.registerFromPath(join(process.cwd(), "public/fonts/Cairo-Regular.ttf"), "Cairo");
    GlobalFonts.registerFromPath(join(process.cwd(), "public/fonts/Cairo-Bold.ttf"), "CairoBold");
    fontsRegistered = true;
  } catch (error) {
    console.warn("[institution-report-pdf] Cairo font registration failed; using fallback fonts", {
      error: error instanceof Error ? error.message : String(error),
    });
    fontsRegistered = true;
  }
};

const formatInstitutionReportGrade = (grade: string | undefined): string => {
  try {
    const raw = String(grade || "").trim();
    if (!raw || raw === "—") return "_________________";
    const canon = raw.replace(/^G(\d{1,2})$/i, "g$1");
    const label = getGradeLabel(canon, "ar");
    if (label === canon || label === raw) return raw;
    return label;
  } catch (error) {
    console.warn("[institution-report-pdf] grade label conversion failed", {
      grade,
      error: error instanceof Error ? error.message : String(error),
    });
    return String(grade || "_________________");
  }
};

export const buildVerificationUrl = (context: InstitutionBlankReportTemplateContext): string => {
  const id = String(context.applicationId || "").trim();
  const base = getBaseUrl();
  // Dedicated training-report verification route only — never /verify/certificate/*.
  // Blank-template QR encodes the application id; verification succeeds only after
  // the institution report approval workflow has produced a verifiable record.
  if (!id) return `${base}/verify/training-report`;
  return `${base}/verify/training-report/${encodeURIComponent(id)}`;
};

const drawRtlText = (
  ctx: SKRSContext2D,
  text: string,
  x: number,
  y: number,
  font: string,
  color = "#111827",
  align: CanvasTextAlign = "right"
) => {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.direction = "rtl";
  ctx.fillText(text, x, y);
};

const drawLtrText = (
  ctx: SKRSContext2D,
  text: string,
  x: number,
  y: number,
  font: string,
  color = OCR_ANCHOR_COLOR,
  align: CanvasTextAlign = "left"
) => {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.direction = "ltr";
  ctx.fillText(text, x, y);
};

const drawRtlBlock = (
  ctx: SKRSContext2D,
  lines: string[],
  startY: number,
  lineHeight: number,
  font: string,
  color = "#111827"
): number => {
  let y = startY;
  for (const line of lines) {
    drawRtlText(ctx, line, PAGE_WIDTH - MARGIN_X, y, font, color);
    y += lineHeight;
  }
  return y;
};

const strokeLine = (
  ctx: SKRSContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color = STROKE_DIVIDER
) => {
  ctx.strokeStyle = color;
  ctx.lineWidth = STROKE_MIN;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
};

const drawFieldRow = (
  ctx: SKRSContext2D,
  label: string,
  value: string,
  xRight: number,
  y: number,
  lineHeight = 15
): number => {
  drawRtlText(ctx, `${label}: ${value}`, xRight, y, "11px Cairo", "#374151");
  return y + lineHeight;
};

const drawBorderedRect = (
  ctx: SKRSContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill = "#ffffff",
  stroke = STROKE_BORDER
) => {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = STROKE_MIN;
  ctx.strokeRect(x, y, w, h);
};

const drawOcrAnchor = (ctx: SKRSContext2D, y: number, anchor: string): number => {
  drawLtrText(ctx, anchor, MARGIN_X + 2, y, "7px Cairo", OCR_ANCHOR_COLOR, "left");
  return y + 10;
};

const drawCenteredTitle = (ctx: SKRSContext2D, y: number): number => {
  drawRtlText(
    ctx,
    "التقرير النهائي للتدريب — نموذج المؤسسة",
    PAGE_WIDTH / 2,
    y,
    "17px CairoBold",
    "#0f172a",
    "center"
  );
  return y + 22;
};

const drawCompactRatingLegend = (ctx: SKRSContext2D, y: number): number => {
  drawBorderedRect(ctx, MARGIN_X, y, CONTENT_WIDTH, 26, "#f1f5f9", STROKE_BORDER);
  drawRtlText(ctx, COMPACT_RATING_LEGEND, PAGE_WIDTH - MARGIN_X - 10, y + 17, "10px Cairo", "#1e293b");
  return y + 32;
};

const drawCheckbox = (ctx: SKRSContext2D, cx: number, cy: number, size = CHECKBOX_SIZE) => {
  const x = cx - size / 2;
  const y = cy - size / 2;
  ctx.strokeStyle = "#1f2937";
  ctx.lineWidth = STROKE_MIN;
  ctx.strokeRect(x, y, size, size);
};

const fitLabelFont = (ctx: SKRSContext2D, label: string, maxWidth: number): string => {
  ctx.font = "11px Cairo";
  if (ctx.measureText(label).width <= maxWidth) return "11px Cairo";
  ctx.font = "10px Cairo";
  if (ctx.measureText(label).width <= maxWidth) return "10px Cairo";
  return "9px Cairo";
};

/** RTL layout: البند (right) | 5 | 4 | 3 | 2 | 1 (left). */
const drawRatingMatrix = (ctx: SKRSContext2D, rows: string[], startY: number): number => {
  const labelColW = CONTENT_WIDTH * LABEL_COL_RATIO;
  const scoreColW = (CONTENT_WIDTH - labelColW) / 5;
  const tableX = MARGIN_X;
  const labelColX = tableX + scoreColW * 5;
  const labelRightX = PAGE_WIDTH - MARGIN_X - 10;
  let y = startY;

  drawBorderedRect(ctx, tableX, y, CONTENT_WIDTH, MATRIX_HEADER_H, "#e5e7eb", STROKE_BORDER);
  strokeLine(ctx, labelColX, y, labelColX, y + MATRIX_HEADER_H);
  drawRtlText(ctx, "البند", labelRightX, y + 20, "12px CairoBold", "#0f172a");
  for (let score = 5; score >= 1; score--) {
    const colIndex = score - 1;
    const colX = tableX + scoreColW * colIndex + scoreColW / 2;
    drawRtlText(ctx, String(score), colX, y + 20, "12px CairoBold", "#0f172a", "center");
    if (colIndex > 0) {
      strokeLine(ctx, tableX + scoreColW * colIndex, y, tableX + scoreColW * colIndex, y + MATRIX_HEADER_H);
    }
  }

  y += MATRIX_HEADER_H;
  for (const label of rows) {
    drawBorderedRect(ctx, tableX, y, CONTENT_WIDTH, MATRIX_ROW_H, "#ffffff", STROKE_BORDER);
    const labelFont = fitLabelFont(ctx, label, labelColW - 20);
    drawRtlText(ctx, label, labelRightX, y + MATRIX_ROW_H / 2 + 4, labelFont, "#111827");
    const cellCenterY = y + MATRIX_ROW_H / 2;
    for (let score = 1; score <= 5; score++) {
      const colIndex = score - 1;
      const colX = tableX + scoreColW * colIndex + scoreColW / 2;
      if (colIndex > 0) {
        strokeLine(ctx, tableX + scoreColW * colIndex, y, tableX + scoreColW * colIndex, y + MATRIX_ROW_H);
      }
      drawCheckbox(ctx, colX, cellCenterY);
    }
    strokeLine(ctx, labelColX, y, labelColX, y + MATRIX_ROW_H);
    y += MATRIX_ROW_H;
  }

  return y + 4;
};

const drawExpandedWritingArea = (ctx: SKRSContext2D, label: string, y: number, ocrAnchor?: string): number => {
  if (ocrAnchor) y = drawOcrAnchor(ctx, y, ocrAnchor);
  y = drawRtlBlock(ctx, [label], y, 15, "12px CairoBold", "#0f172a");
  const areaY = y + 2;
  drawBorderedRect(ctx, MARGIN_X, areaY, CONTENT_WIDTH, WRITING_SECTION_HEIGHT, "#ffffff", STROKE_BORDER);
  const lineStartX = MARGIN_X + 12;
  const lineEndX = PAGE_WIDTH - MARGIN_X - 12;
  const lineTop = areaY + 16;
  for (let i = 0; i < WRITING_LINE_COUNT; i++) {
    const lineY = lineTop + WRITING_LINE_GAP * i;
    strokeLine(ctx, lineStartX, lineY, lineEndX, STROKE_RULE);
  }
  return areaY + WRITING_SECTION_HEIGHT + 4;
};

const drawRecommendationSection = (ctx: SKRSContext2D, y: number): number => {
  y = drawRtlBlock(ctx, ["التوصية"], y, 16, "14px CairoBold", "#0f172a");
  y += RECOMMENDATION_TITLE_GAP;
  drawBorderedRect(ctx, MARGIN_X, y, CONTENT_WIDTH, RECOMMENDATION_OPTION_H, "#ffffff", STROKE_BORDER);
  const colW = CONTENT_WIDTH / 3;
  for (let i = 0; i < INSTITUTION_OVERALL_RECOMMENDATIONS.length; i++) {
    const rec = INSTITUTION_OVERALL_RECOMMENDATIONS[i];
    const cellLeft = MARGIN_X + colW * i;
    const cellCenter = cellLeft + colW / 2;
    const cellMidY = y + RECOMMENDATION_OPTION_H / 2;
    drawCheckbox(ctx, cellCenter - 42, cellMidY, CHECKBOX_SIZE);
    drawRtlText(ctx, rec.ar, cellCenter + 8, cellMidY + 4, "11px CairoBold", "#111827", "center");
    if (i > 0) {
      strokeLine(ctx, cellLeft, y, cellLeft, y + RECOMMENDATION_OPTION_H);
    }
  }
  y += RECOMMENDATION_OPTION_H + 8;
  drawRtlText(ctx, "سبب التوصية (اختياري):", PAGE_WIDTH - MARGIN_X, y, "11px Cairo", "#374151");
  y += 12;
  const reasonLineW = CONTENT_WIDTH * REASON_LINE_WIDTH_RATIO;
  const reasonLineX = MARGIN_X + (CONTENT_WIDTH - reasonLineW) / 2;
  strokeLine(ctx, reasonLineX, y, reasonLineX + reasonLineW, STROKE_DIVIDER);
  return y + 14;
};

const drawApprovalSection = (ctx: SKRSContext2D, context: InstitutionBlankReportTemplateContext, y: number): number => {
  y = drawRtlBlock(ctx, ["منطقة الاعتماد والختم"], y, 16, "14px CairoBold", "#0f172a");

  const stampX = PAGE_WIDTH - MARGIN_X - STAMP_SIZE_PT - 6;
  const stampY = y + APPROVAL_STAMP_TOP_OFFSET;
  drawRtlText(
    ctx,
    "الختم الرسمي للمؤسسة",
    stampX + STAMP_SIZE_PT / 2,
    stampY - APPROVAL_STAMP_LABEL_OFFSET,
    "11px CairoBold",
    "#374151",
    "center"
  );
  drawBorderedRect(ctx, stampX, stampY, STAMP_SIZE_PT, STAMP_SIZE_PT, "#ffffff", STROKE_BORDER);

  const leftRight = stampX - 16;
  let leftY = y + APPROVAL_SECTION_TOP_OFFSET;
  leftY = drawFieldRow(
    ctx,
    "اسم الجهة",
    context.institutionName || "_________________",
    leftRight,
    leftY,
    APPROVAL_ROW_SPACING
  );
  leftY = drawFieldRow(ctx, "اسم المشرف المباشر", "_________________", leftRight, leftY, APPROVAL_ROW_SPACING);
  leftY = drawFieldRow(ctx, "اسم المقيم", "_________________", leftRight, leftY, APPROVAL_ROW_SPACING);
  leftY = drawFieldRow(ctx, "المسمى الوظيفي", "_________________", leftRight, leftY, APPROVAL_ROW_SPACING);
  drawRtlText(ctx, "التوقيع:", leftRight, leftY, "11px Cairo", "#374151");
  strokeLine(ctx, MARGIN_X + 8, leftY + 10, leftRight - 16, leftY + 10, STROKE_DIVIDER);
  leftY += APPROVAL_ROW_SPACING;
  drawFieldRow(ctx, "التاريخ", "_________________", leftRight, leftY, APPROVAL_ROW_SPACING);

  return Math.max(leftY, stampY + STAMP_SIZE_PT) + APPROVAL_SECTION_END_PADDING;
};

const buildVerificationPayload = (context: InstitutionBlankReportTemplateContext) =>
  buildVerificationUrl(context);

const drawMinimalPageFooter = (ctx: SKRSContext2D, pageNumber: number, totalPages: number) => {
  drawRtlText(
    ctx,
    `صفحة ${pageNumber} من ${totalPages}`,
    PAGE_WIDTH / 2,
    PAGE_HEIGHT - 12,
    "9px Cairo",
    "#475569",
    "center"
  );
};

const drawFinalPageFooter = async (
  ctx: SKRSContext2D,
  context: InstitutionBlankReportTemplateContext,
  pageNumber: number,
  totalPages: number,
  startY: number
): Promise<number> => {
  const footerTop = startY + 4;
  strokeLine(ctx, MARGIN_X, footerTop, PAGE_WIDTH - MARGIN_X, footerTop, STROKE_BORDER);

  const qrX = MARGIN_X + 2;
  const qrY = footerTop + 4;
  try {
    const qrBuffer = await QRCode.toBuffer(buildVerificationPayload(context), {
      margin: 1,
      width: QR_DISPLAY_SIZE,
      errorCorrectionLevel: "M",
    });
    const qrImage = await loadImage(qrBuffer);
    ctx.drawImage(qrImage, qrX, qrY, QR_DISPLAY_SIZE, QR_DISPLAY_SIZE);
    drawRtlText(
      ctx,
      "رمز التحقق",
      qrX + QR_DISPLAY_SIZE / 2,
      qrY + QR_DISPLAY_SIZE + 12,
      "8px Cairo",
      "#475569",
      "center"
    );
  } catch (qrError) {
    console.warn("[institution-report-pdf] QR generation failed; continuing without QR image", {
      verificationUrl: buildVerificationPayload(context),
      error: qrError instanceof Error ? qrError.message : String(qrError),
    });
    drawBorderedRect(ctx, qrX, qrY, QR_DISPLAY_SIZE, QR_DISPLAY_SIZE, "#f8fafc", STROKE_BORDER);
  }

  drawRtlText(ctx, FINAL_PAGE_INSTRUCTION, PAGE_WIDTH - MARGIN_X, footerTop + 14, "8px Cairo", "#374151");
  drawRtlText(
    ctx,
    "يرجى تسليم النموذج لجهة التدريب لتعبئته واعتماده وختمه، ثم إعادته للطالب لرفعه في منصة تميز الأنجال.",
    PAGE_WIDTH - MARGIN_X,
    footerTop + 28,
    "8px Cairo",
    "#374151"
  );
  drawRtlText(
    ctx,
    "جميع المعلومات الواردة في هذا النموذج تمثل التقييم الرسمي للطالب من جهة التدريب.",
    PAGE_WIDTH - MARGIN_X,
    footerTop + 42,
    "8px Cairo",
    "#475569"
  );
  drawRtlText(
    ctx,
    "وثيقة تقييم تدريب معتمدة للاستخدام الرسمي فقط",
    PAGE_WIDTH - MARGIN_X,
    footerTop + 56,
    "9px CairoBold",
    "#1e293b"
  );

  drawRtlText(
    ctx,
    `صفحة ${pageNumber} من ${totalPages}`,
    PAGE_WIDTH / 2,
    PAGE_HEIGHT - 10,
    "9px Cairo",
    "#475569",
    "center"
  );

  return footerTop + FLOWING_FINAL_FOOTER_HEIGHT;
};

const drawUnifiedInfoTable = (
  ctx: SKRSContext2D,
  context: InstitutionBlankReportTemplateContext,
  y: number
): number => {
  const rightColW = CONTENT_WIDTH * 0.52;
  const leftColW = CONTENT_WIDTH - rightColW;
  const tableX = MARGIN_X;
  const dividerX = tableX + leftColW;
  const rowCount = 6;
  const tableH = rowCount * INFO_TABLE_ROW_H;
  const rightColRight = PAGE_WIDTH - MARGIN_X - 8;
  const leftColRight = dividerX - 8;

  const rightFields: [string, string][] = [
    ["اسم الطالب", context.studentName || "_________________"],
    ["الصف", formatInstitutionReportGrade(context.grade)],
    ["المدرسة", context.school || "_________________"],
    ["جهة التدريب", context.institutionName || "_________________"],
    ["تاريخ البداية", context.trainingStartDate || "_________________"],
    ["تاريخ النهاية", context.trainingEndDate || "_________________"],
  ];
  const leftFields: [string, string][] = [
    ["اسم المشرف المباشر", "_________________"],
    ["رقم التواصل", "_________________"],
    ["المسمى الوظيفي", "_________________"],
  ];

  drawBorderedRect(ctx, tableX, y, CONTENT_WIDTH, tableH, "#ffffff", STROKE_BORDER);
  strokeLine(ctx, dividerX, y, dividerX, y + tableH);

  for (let row = 0; row < rowCount; row++) {
    const rowY = y + INFO_TABLE_ROW_H * row + INFO_TABLE_ROW_H / 2 + 4;
    if (row > 0) {
      strokeLine(ctx, tableX, y + INFO_TABLE_ROW_H * row, tableX + CONTENT_WIDTH, y + INFO_TABLE_ROW_H * row);
    }
    const [rightLabel, rightValue] = rightFields[row];
    drawRtlText(ctx, `${rightLabel}: ${rightValue}`, rightColRight, rowY, "11px Cairo", "#374151");
    if (row < leftFields.length) {
      const [leftLabel, leftValue] = leftFields[row];
      drawRtlText(ctx, `${leftLabel}: ${leftValue}`, leftColRight, rowY, "11px Cairo", "#374151");
    }
  }

  return y + tableH + 6;
};

const footerReserveForPage = (_pageNumber: number, _totalPages: number) => FOOTER_MINIMAL_RESERVED;

type LayoutOptions = {
  totalPages: number;
  drawFooters: boolean;
};

const usableHeightForPage = (pageNumber: number, totalPages: number): number =>
  PAGE_HEIGHT - footerReserveForPage(pageNumber, totalPages);

type PageTracker = {
  current: number;
  total: number;
};

const ensurePageSpace = (
  pdf: PDFDocument,
  ctx: SKRSContext2D,
  y: number,
  needed: number,
  tracker: PageTracker,
  layout: LayoutOptions,
  finalRenderedPages: number[]
): { ctx: SKRSContext2D; y: number } => {
  const usable = usableHeightForPage(tracker.current, layout.totalPages);
  if (y + needed <= usable) {
    return { ctx, y };
  }
  finalRenderedPages.push(tracker.current);
  if (layout.drawFooters) {
    drawMinimalPageFooter(ctx, tracker.current, layout.totalPages);
  }
  pdf.endPage();
  tracker.current += 1;
  const nextCtx = pdf.beginPage(PAGE_WIDTH, PAGE_HEIGHT) as SKRSContext2D;
  nextCtx.fillStyle = "#ffffff";
  nextCtx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  return { ctx: nextCtx, y: NEW_PAGE_START_Y };
};

const drawNarrativeSections = (
  pdf: PDFDocument,
  ctx: SKRSContext2D,
  y: number,
  tracker: PageTracker,
  layout: LayoutOptions,
  finalRenderedPages: number[],
  startIndex = 0
): { ctx: SKRSContext2D; y: number } => {
  let currentCtx = ctx;
  let currentY = y;
  for (let i = startIndex; i < NARRATIVE_SECTIONS.length; i++) {
    const section = NARRATIVE_SECTIONS[i];
    const result = ensurePageSpace(
      pdf,
      currentCtx,
      currentY,
      NARRATIVE_SECTION_H,
      tracker,
      layout,
      finalRenderedPages
    );
    currentCtx = result.ctx;
    currentY = result.y;
    currentY = drawExpandedWritingArea(currentCtx, section.label, currentY, section.anchor);
  }
  return { ctx: currentCtx, y: currentY };
};

export type InstitutionBlankReportTemplateContext = {
  studentName: string;
  school: string;
  grade: string;
  institutionName: string;
  trainingStartDate: string;
  trainingEndDate: string;
  generatedAt: string;
  applicationId?: string;
  academicYear?: string;
};

export class InstitutionReportPdfRenderError extends Error {
  readonly stage: string;

  constructor(stage: string, cause: unknown) {
    const base = cause instanceof Error ? cause : new Error(String(cause));
    super(`[institution-report-pdf:${stage}] ${base.message}`);
    this.name = "InstitutionReportPdfRenderError";
    this.stage = stage;
    this.cause = cause;
  }
}

const drawReportHeaderImage = async (ctx: SKRSContext2D): Promise<boolean> => {
  try {
    const headerBuffer = readFileSync(join(process.cwd(), "public/report-header.png"));
    const headerImage = await loadImage(headerBuffer);
    ctx.drawImage(headerImage, 0, 0, PAGE_WIDTH, HEADER_IMAGE_HEIGHT);
    return true;
  } catch (error) {
    console.warn("[institution-report-pdf] report-header.png unavailable; continuing without header image", {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
};

const renderInstitutionBlankReportTemplatePdf = async (
  context: InstitutionBlankReportTemplateContext,
  layout: LayoutOptions
): Promise<{ buffer: Buffer; pageCount: number }> => {
  let stage = "fonts";
  try {
    ensureFonts();
    const finalRenderedPages: number[] = [];
    const tracker: PageTracker = { current: 1, total: layout.totalPages };

    stage = "pdf-document-init";
    const pdf = new PDFDocument({ title: "Institution Final Training Report Template" });
    let ctx = pdf.beginPage(PAGE_WIDTH, PAGE_HEIGHT) as SKRSContext2D;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);

    stage = "header-image";
    const headerDrawn = await drawReportHeaderImage(ctx);

    stage = "title-and-info-table";
    let y = (headerDrawn ? HEADER_IMAGE_HEIGHT : 0) + TITLE_AFTER_HEADER_GAP;
    y = drawCenteredTitle(ctx, y);
    drawRtlText(
      ctx,
      `تاريخ الإنشاء: ${context.generatedAt}`,
      PAGE_WIDTH / 2,
      y,
      "10px Cairo",
      "#475569",
      "center"
    );
    y += 14;
    y = drawUnifiedInfoTable(ctx, context, y);

    const dimensionLabels = Object.fromEntries(
      INSTITUTION_ASSESSMENT_DIMENSIONS.map((d) => [d.key, d.ar])
    ) as Record<string, string>;

    stage = "evaluation-matrices";
    let legendDrawn = false;
    for (const category of INSTITUTION_ASSESSMENT_CATEGORIES) {
      const rows = category.keys.map((key) => dimensionLabels[key]).filter(Boolean);
      const needed =
        (legendDrawn ? 0 : LEGEND_BLOCK_H) +
        CATEGORY_ANCHOR_H +
        CATEGORY_TITLE_H +
        MATRIX_HEADER_H +
        rows.length * MATRIX_ROW_H +
        MATRIX_AFTER_H;
      ({ ctx, y } = ensurePageSpace(pdf, ctx, y, needed, tracker, layout, finalRenderedPages));

      if (!legendDrawn) {
        y = drawCompactRatingLegend(ctx, y);
        legendDrawn = true;
      }

      const anchor = CATEGORY_OCR_ANCHORS[category.id];
      if (anchor) y = drawOcrAnchor(ctx, y, anchor);
      y = drawRtlBlock(ctx, [category.ar], y, 14, "13px CairoBold", "#0f172a");
      y = drawRatingMatrix(ctx, rows, y);

      if (category.id === "safety") {
        stage = "narrative-sections";
        ({ ctx, y } = drawNarrativeSections(pdf, ctx, y, tracker, layout, finalRenderedPages, 0));
        stage = "evaluation-matrices";
      }
    }

    stage = "final-page-tail";
    ({ ctx, y } = ensurePageSpace(
      pdf,
      ctx,
      y,
      FINAL_PAGE_TAIL_HEIGHT,
      tracker,
      layout,
      finalRenderedPages
    ));
    y += RECOMMENDATION_PRE_SECTION_GAP;
    y = drawRecommendationSection(ctx, y);
    y = drawApprovalSection(ctx, context, y);

    finalRenderedPages.push(tracker.current);
    const totalPages = finalRenderedPages.length;
    tracker.total = totalPages;

    if (layout.drawFooters && totalPages !== layout.totalPages) {
      console.warn("[institution-report-pdf] rendered page count differs from layout target", {
        layoutTargetPages: layout.totalPages,
        renderedPages: totalPages,
      });
    }

    if (layout.drawFooters) {
      stage = "final-page-footer";
      await drawFinalPageFooter(ctx, context, tracker.current, totalPages, y);
    }

    stage = "pdf-close";
    pdf.endPage();
    return { buffer: pdf.close(), pageCount: totalPages };
  } catch (error) {
    throw new InstitutionReportPdfRenderError(stage, error);
  }
};

export const generateInstitutionBlankReportTemplatePdfBuffer = async (
  context: InstitutionBlankReportTemplateContext
): Promise<Buffer> => {
  let stage = "layout-pass";
  try {
    const layoutPass = await renderInstitutionBlankReportTemplatePdf(context, {
      totalPages: Number.MAX_SAFE_INTEGER,
      drawFooters: false,
    });

    stage = "footer-pass";
    const footerPass = await renderInstitutionBlankReportTemplatePdf(context, {
      totalPages: layoutPass.pageCount,
      drawFooters: true,
    });

    console.info("[institution-report-pdf] PDF generation complete", {
      layoutPages: layoutPass.pageCount,
      renderedPages: footerPass.pageCount,
      verificationUrl: buildVerificationUrl(context),
      gradeLabel: formatInstitutionReportGrade(context.grade),
    });

    return footerPass.buffer;
  } catch (error) {
    if (error instanceof InstitutionReportPdfRenderError) {
      throw error;
    }
    throw new InstitutionReportPdfRenderError(stage, error);
  }
};

/** Runtime alias used by institution template export services. */
export const generateInstitutionFinalReportTemplatePdf = generateInstitutionBlankReportTemplatePdfBuffer;
