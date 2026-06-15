import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GlobalFonts, loadImage, PDFDocument, type SKRSContext2D } from "@napi-rs/canvas";
import type { ParentConsentTemplateContext } from "@/lib/partnerships/parent-consent-template-constants";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_X = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

let fontsRegistered = false;

const ensureFonts = () => {
  if (fontsRegistered) return;
  const fontPath = join(process.cwd(), "public/fonts/Cairo-Regular.ttf");
  GlobalFonts.registerFromPath(fontPath, "Cairo");
  const boldPath = join(process.cwd(), "public/fonts/Cairo-Bold.ttf");
  GlobalFonts.registerFromPath(boldPath, "CairoBold");
  fontsRegistered = true;
};

const wrapRtlLines = (ctx: SKRSContext2D, text: string, maxWidth: number): string[] => {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const trial = current ? `${current} ${word}` : word;
    if (ctx.measureText(trial).width <= maxWidth) {
      current = trial;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [text];
};

const drawRtlBlock = (
  ctx: SKRSContext2D,
  lines: string[],
  startY: number,
  lineHeight: number,
  font: string,
  color = "#111827"
): number => {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = "right";
  ctx.direction = "rtl";
  let y = startY;
  for (const line of lines) {
    ctx.fillText(line, PAGE_WIDTH - MARGIN_X, y);
    y += lineHeight;
  }
  return y;
};

const drawFieldRow = (
  ctx: SKRSContext2D,
  label: string,
  value: string,
  y: number
): number => {
  ctx.font = "12px Cairo";
  ctx.fillStyle = "#374151";
  ctx.textAlign = "right";
  ctx.direction = "rtl";
  ctx.fillText(`${label}: ${value}`, PAGE_WIDTH - MARGIN_X, y);
  return y + 20;
};

const drawBlankLine = (ctx: SKRSContext2D, label: string, y: number): number => {
  ctx.font = "12px Cairo";
  ctx.fillStyle = "#111827";
  ctx.textAlign = "right";
  ctx.direction = "rtl";
  ctx.fillText(`${label}: _________________________________`, PAGE_WIDTH - MARGIN_X, y);
  return y + 28;
};

export const generateParentConsentPdfBuffer = async (
  context: ParentConsentTemplateContext
): Promise<Buffer> => {
  ensureFonts();
  const pdf = new PDFDocument({ title: "Parent Consent Form" });
  const ctx = pdf.beginPage(PAGE_WIDTH, PAGE_HEIGHT) as SKRSContext2D;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);

  const headerPath = join(process.cwd(), "public/report-header.png");
  const headerBuffer = readFileSync(headerPath);
  const headerImage = await loadImage(headerBuffer);
  const headerHeight = 92;
  ctx.drawImage(headerImage, 0, 0, PAGE_WIDTH, headerHeight);

  let y = headerHeight + 28;
  y = drawRtlBlock(ctx, ["نموذج موافقة ولي الأمر — التدريب الصيفي"], y, 24, "18px CairoBold", "#0f172a");
  y = drawRtlBlock(
    ctx,
    [`رقم الطلب: ${context.applicationNumber}`, `تاريخ إنشاء النموذج: ${context.generatedAt}`],
    y + 4,
    18,
    "11px Cairo",
    "#64748b"
  );

  y += 8;
  y = drawRtlBlock(ctx, ["بيانات الطالب"], y, 20, "14px CairoBold");
  y = drawFieldRow(ctx, "اسم الطالب", context.studentName, y);
  y = drawFieldRow(ctx, "رقم الهوية", context.studentNationalId || "—", y);
  y = drawFieldRow(ctx, "الصف", context.grade, y);
  y = drawFieldRow(ctx, "المدرسة", context.school, y);

  y += 6;
  y = drawRtlBlock(ctx, ["بيانات التدريب"], y, 20, "14px CairoBold");
  y = drawFieldRow(ctx, "المؤسسة التدريبية", context.organizationName, y);
  y = drawFieldRow(ctx, "اسم الفرصة التدريبية", context.opportunityTitle, y);
  y = drawFieldRow(ctx, "فترة التدريب", context.trainingPeriod, y);
  y = drawFieldRow(ctx, "عدد الساعات", context.trainingHours, y);
  y = drawFieldRow(ctx, "جهة التدريب", context.trainingProvider, y);

  y += 6;
  y = drawRtlBlock(ctx, ["إقرار ولي الأمر"], y, 20, "14px CairoBold");
  const bodyParagraphs = [
    "أقر أنا ولي أمر الطالب/ـة المذكور/ـة أعلاه بالموافقة على مشاركته/ـا في برنامج التدريب الصيفي الموضح بياناته في هذا النموذج.",
    "أتحمل مسؤولية متابعة حضور ابني/ابنتي والالتزام بتعليمات المؤسسة التدريبية.",
    "أقر باطلاعي على بيانات التدريب الواردة أعلاه وموافقتي على المشاركة وفق الشروط المعتمدة.",
    "أوافق على مشاركة بيانات التواصل اللازمة بين المدرسة والمؤسسة التدريبية عند الحاجة لإتمام إجراءات التدريب.",
  ];
  for (const paragraph of bodyParagraphs) {
    const lines = wrapRtlLines(ctx, paragraph, CONTENT_WIDTH);
    y = drawRtlBlock(ctx, lines, y, 18, "12px Cairo");
    y += 4;
  }

  y += 8;
  y = drawRtlBlock(ctx, ["توقيع ولي الأمر (يُعبأ يدوياً بعد الطباعة)"], y, 20, "14px CairoBold");
  y = drawBlankLine(ctx, "اسم ولي الأمر", y);
  y = drawBlankLine(ctx, "رقم الهوية", y);
  y = drawBlankLine(ctx, "صلة القرابة", y);
  y = drawBlankLine(ctx, "رقم الجوال", y);
  y = drawBlankLine(ctx, "التوقيع", y);
  y = drawBlankLine(ctx, "التاريخ", y);

  ctx.font = "10px Cairo";
  ctx.fillStyle = "#94a3b8";
  ctx.textAlign = "center";
  ctx.direction = "rtl";
  ctx.fillText(
    "يرجى طباعة النموذج وتوقيعه ثم إعادة رفعه بصيغة PDF أو JPG أو PNG.",
    PAGE_WIDTH / 2,
    PAGE_HEIGHT - 28
  );

  pdf.endPage();
  return pdf.close();
};
