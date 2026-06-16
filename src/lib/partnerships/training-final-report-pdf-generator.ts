import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GlobalFonts, loadImage, PDFDocument, type SKRSContext2D } from "@napi-rs/canvas";
import type { TrainingFinalReportTemplateContext } from "@/lib/partnerships/training-final-report-template-constants";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_X = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

let fontsRegistered = false;

const ensureFonts = () => {
  if (fontsRegistered) return;
  GlobalFonts.registerFromPath(join(process.cwd(), "public/fonts/Cairo-Regular.ttf"), "Cairo");
  GlobalFonts.registerFromPath(join(process.cwd(), "public/fonts/Cairo-Bold.ttf"), "CairoBold");
  fontsRegistered = true;
};

const wrapRtlLines = (ctx: SKRSContext2D, text: string, maxWidth: number): string[] => {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const trial = current ? `${current} ${word}` : word;
    if (ctx.measureText(trial).width <= maxWidth) current = trial;
    else {
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

const drawFieldRow = (ctx: SKRSContext2D, label: string, value: string, y: number): number => {
  ctx.font = "12px Cairo";
  ctx.fillStyle = "#374151";
  ctx.textAlign = "right";
  ctx.direction = "rtl";
  ctx.fillText(`${label}: ${value}`, PAGE_WIDTH - MARGIN_X, y);
  return y + 18;
};

const scoreLabel = (n: number) => `${n} / 5`;

export const generateTrainingFinalReportPdfBuffer = async (
  context: TrainingFinalReportTemplateContext
): Promise<Buffer> => {
  ensureFonts();
  const pdf = new PDFDocument({ title: "Training Final Evaluation Report" });
  const ctx = pdf.beginPage(PAGE_WIDTH, PAGE_HEIGHT) as SKRSContext2D;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);

  const headerBuffer = readFileSync(join(process.cwd(), "public/report-header.png"));
  const headerImage = await loadImage(headerBuffer);
  const headerHeight = 92;
  ctx.drawImage(headerImage, 0, 0, PAGE_WIDTH, headerHeight);

  let y = headerHeight + 24;
  y = drawRtlBlock(ctx, ["تقرير التقييم النهائي للتدريب الصيفي"], y, 24, "18px CairoBold", "#0f172a");
  y = drawRtlBlock(ctx, [`تاريخ الإنشاء: ${context.generatedAt}`], y + 2, 16, "11px Cairo", "#64748b");

  y += 8;
  y = drawRtlBlock(ctx, ["بيانات التدريب"], y, 20, "14px CairoBold");
  y = drawFieldRow(ctx, "اسم الطالب", context.studentName, y);
  y = drawFieldRow(ctx, "المدرسة", context.school, y);
  y = drawFieldRow(ctx, "المؤسسة التدريبية", context.institutionName, y);
  y = drawFieldRow(ctx, "فرصة التدريب", context.opportunityTitle, y);
  y = drawFieldRow(ctx, "تاريخ البداية", context.trainingStartDate, y);
  y = drawFieldRow(ctx, "تاريخ النهاية", context.trainingEndDate, y);
  y = drawFieldRow(ctx, "ساعات التدريب", context.trainingHours, y);

  y += 6;
  y = drawRtlBlock(ctx, ["المهام الموكلة"], y, 20, "14px CairoBold");
  const taskLines = wrapRtlLines(ctx, context.assignedTasks || "—", CONTENT_WIDTH);
  y = drawRtlBlock(ctx, taskLines, y, 16, "12px Cairo");

  y += 6;
  y = drawRtlBlock(ctx, ["التقييم المهني"], y, 20, "14px CairoBold");
  const s = context.scores;
  y = drawFieldRow(ctx, "الحضور", scoreLabel(s.attendance), y);
  y = drawFieldRow(ctx, "الانضباط في المواعيد", scoreLabel(s.punctuality), y);
  y = drawFieldRow(ctx, "الالتزام بالتعليمات", scoreLabel(s.instructionCompliance), y);
  y = drawFieldRow(ctx, "أخلاقيات العمل", scoreLabel(s.workEthics), y);
  y = drawFieldRow(ctx, "المسؤولية", scoreLabel(s.responsibility), y);
  y = drawFieldRow(ctx, "الاحترافية", scoreLabel(s.professionalism), y);

  y += 4;
  y = drawRtlBlock(ctx, ["المهارات الناعمة والتقنية"], y, 20, "14px CairoBold");
  y = drawFieldRow(ctx, "التواصل", scoreLabel(s.communication), y);
  y = drawFieldRow(ctx, "العمل الجماعي", scoreLabel(s.teamwork), y);
  y = drawFieldRow(ctx, "المبادرة", scoreLabel(s.initiative), y);
  y = drawFieldRow(ctx, "سرعة التعلم", scoreLabel(s.learningSpeed), y);
  y = drawFieldRow(ctx, "تنفيذ المهام", scoreLabel(s.taskExecution), y);
  y = drawFieldRow(ctx, "جودة العمل", scoreLabel(s.workQuality), y);
  y = drawFieldRow(ctx, "السلامة", scoreLabel(s.safetyCompliance), y);

  y += 4;
  y = drawRtlBlock(ctx, ["القرار النهائي"], y, 20, "14px CairoBold");
  y = drawFieldRow(ctx, "اجتاز التدريب", context.passedTraining ? "نعم" : "لا", y);
  y = drawFieldRow(ctx, "يوصى بتدريب مستقبلي", context.recommendFutureTraining ? "نعم" : "لا", y);
  y = drawFieldRow(ctx, "يوصى بالتوظيف", context.recommendEmployment ? "نعم" : "لا", y);
  y = drawFieldRow(ctx, "نقاط القوة", context.strengths || "—", y);
  y = drawFieldRow(ctx, "مجالات التحسين", context.improvementAreas || "—", y);
  y = drawFieldRow(ctx, "التوصية النهائية", context.finalRecommendation || "—", y);

  y += 8;
  y = drawRtlBlock(ctx, ["بيانات المشرف (يُعبأ يدوياً عند الطباعة)"], y, 20, "14px CairoBold");
  y = drawFieldRow(ctx, "اسم المشرف", context.supervisorName || "_________________", y);
  y = drawFieldRow(ctx, "المسمى الوظيفي", context.supervisorTitle || "_________________", y);
  y = drawFieldRow(ctx, "التوقيع", "_______________________________", y);
  y = drawFieldRow(ctx, "ختم المؤسسة", "[ مساحة الختم ]", y);

  ctx.font = "10px Cairo";
  ctx.fillStyle = "#94a3b8";
  ctx.textAlign = "center";
  ctx.direction = "rtl";
  ctx.fillText(
    "يرجى طباعة التقرير وتوقيعه وختمه ثم إعادة رفعه بصيغة PDF.",
    PAGE_WIDTH / 2,
    PAGE_HEIGHT - 28
  );

  pdf.endPage();
  return pdf.close();
};
