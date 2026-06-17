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

const scoreLabel = (n: number) => (n > 0 ? `${n} / 5` : "—");

const ensurePageSpace = (
  pdf: PDFDocument,
  ctx: SKRSContext2D,
  y: number,
  needed: number
): { ctx: SKRSContext2D; y: number } => {
  if (y + needed <= PAGE_HEIGHT - 40) return { ctx, y };
  pdf.endPage();
  const nextCtx = pdf.beginPage(PAGE_WIDTH, PAGE_HEIGHT) as SKRSContext2D;
  nextCtx.fillStyle = "#ffffff";
  nextCtx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  return { ctx: nextCtx, y: 48 };
};

export const generateTrainingFinalReportPdfBuffer = async (
  context: TrainingFinalReportTemplateContext
): Promise<Buffer> => {
  ensureFonts();
  const pdf = new PDFDocument({ title: "Training Final Evaluation Report" });
  let ctx = pdf.beginPage(PAGE_WIDTH, PAGE_HEIGHT) as SKRSContext2D;

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

  if (context.studentSection) {
    const st = context.studentSection;
    ({ ctx, y } = ensurePageSpace(pdf, ctx, y, 120));
    y += 6;
    y = drawRtlBlock(ctx, ["تقييم الطالب للتجربة التدريبية"], y, 20, "14px CairoBold");
    y = drawFieldRow(ctx, "الفائدة العملية", scoreLabel(st.practicalBenefitScore), y);
    y = drawFieldRow(ctx, "وضوح الأهداف", scoreLabel(st.objectivesClarityScore), y);
    y = drawFieldRow(ctx, "جودة الإشراف", scoreLabel(st.supervisionQualityScore), y);
    y = drawFieldRow(ctx, "بيئة العمل", scoreLabel(st.workEnvironmentScore), y);
    y = drawFieldRow(ctx, "ملاءمة التدريب", scoreLabel(st.relevanceScore), y);
    y = drawFieldRow(ctx, "الرضا العام", st.overallSatisfactionScore > 0 ? `${st.overallSatisfactionScore} / 10` : "—", y);
    y = drawFieldRow(ctx, "يوصي الطالب بالفرصة", st.recommendToStudents ? "نعم" : "لا", y);
    if (st.majorTasksCompleted) {
      y += 4;
      y = drawRtlBlock(ctx, ["المهام المنجزة"], y, 18, "12px CairoBold");
      y = drawRtlBlock(ctx, wrapRtlLines(ctx, st.majorTasksCompleted, CONTENT_WIDTH), y, 16, "12px Cairo");
    }
    if (st.skillsLearned) {
      y += 4;
      y = drawRtlBlock(ctx, ["المهارات المكتسبة"], y, 18, "12px CairoBold");
      y = drawRtlBlock(ctx, wrapRtlLines(ctx, st.skillsLearned, CONTENT_WIDTH), y, 16, "12px Cairo");
    }
    if (st.mostValuableExperience) {
      y += 4;
      y = drawRtlBlock(ctx, ["أثمن تجربة"], y, 18, "12px CairoBold");
      y = drawRtlBlock(ctx, wrapRtlLines(ctx, st.mostValuableExperience, CONTENT_WIDTH), y, 16, "12px Cairo");
    }
    if (st.improvementSuggestions) {
      y += 4;
      y = drawRtlBlock(ctx, ["اقتراحات التحسين"], y, 18, "12px CairoBold");
      y = drawRtlBlock(ctx, wrapRtlLines(ctx, st.improvementSuggestions, CONTENT_WIDTH), y, 16, "12px Cairo");
    }
    if (st.videoUrl) {
      y += 4;
      y = drawFieldRow(ctx, "رابط الفيديو", st.videoUrl, y);
    }
    if (st.imageEvidence && st.imageEvidence.length > 0) {
      y += 4;
      y = drawRtlBlock(ctx, ["صور التدريب"], y, 18, "12px CairoBold");
      for (const img of st.imageEvidence) {
        const label = img.label ? `${img.label}: ` : "";
        const line = `${label}${img.fileName}${img.caption ? ` — ${img.caption}` : ""}`;
        y = drawRtlBlock(ctx, wrapRtlLines(ctx, line, CONTENT_WIDTH), y, 16, "12px Cairo");
      }
    }
  }

  ({ ctx, y } = ensurePageSpace(pdf, ctx, y, 200));
  y += 6;
  y = drawRtlBlock(ctx, ["تقييم المؤسسة للطالب"], y, 20, "14px CairoBold");

  if (context.institutionSectionComplete === false) {
    y = drawRtlBlock(
      ctx,
      ["لم تُكمل المؤسسة التقييم عبر البوابة بعد — يُترك هذا القسم فارغاً للتعبئة اليدوية."],
      y,
      16,
      "11px Cairo",
      "#64748b"
    );
    y += 8;
    y = drawFieldRow(ctx, "اسم المشرف", "_________________", y);
    y = drawFieldRow(ctx, "المسمى الوظيفي", "_________________", y);
    y = drawFieldRow(ctx, "التوقيع", "_______________________________", y);
    y = drawFieldRow(ctx, "ختم المؤسسة", "[ مساحة الختم ]", y);
  } else {
    y += 4;
    y = drawRtlBlock(ctx, ["المهام الموكلة"], y, 20, "14px CairoBold");
    const taskLines = wrapRtlLines(ctx, context.assignedTasks || "—", CONTENT_WIDTH);
    y = drawRtlBlock(ctx, taskLines, y, 16, "12px Cairo");

    y += 6;
    y = drawRtlBlock(ctx, ["التقييم المهني"], y, 20, "14px CairoBold");
    const s = context.scores;
    y = drawFieldRow(ctx, "الالتزام بالحضور", scoreLabel(s.attendance), y);
    y = drawFieldRow(ctx, "الانضباط المهني", scoreLabel(s.workEthics), y);
    y = drawFieldRow(ctx, "التواصل", scoreLabel(s.communication), y);
    y = drawFieldRow(ctx, "العمل الجماعي", scoreLabel(s.teamwork), y);
    y = drawFieldRow(ctx, "المهارات التقنية", scoreLabel(s.learningSpeed), y);
    y = drawFieldRow(ctx, "الأخلاقيات المهنية", scoreLabel(s.professionalism), y);
    y = drawFieldRow(ctx, "المبادرة", scoreLabel(s.initiative), y);
    y = drawFieldRow(ctx, "حل المشكلات", scoreLabel(s.workQuality), y);
    y = drawFieldRow(ctx, "اتباع أنظمة السلامة", scoreLabel(s.safetyCompliance), y);
    y = drawFieldRow(ctx, "جودة تنفيذ المهام", scoreLabel(s.taskExecution), y);

    y += 4;
    y = drawRtlBlock(ctx, ["القرار النهائي"], y, 20, "14px CairoBold");
    y = drawFieldRow(ctx, "اجتاز التدريب", context.passedTraining ? "نعم" : "لا", y);
    y = drawFieldRow(ctx, "يوصى بتدريب مستقبلي", context.recommendFutureTraining ? "نعم" : "لا", y);
    y = drawFieldRow(ctx, "يوصى بالتوظيف", context.recommendEmployment ? "نعم" : "لا", y);
    if (context.topAchievements) {
      y += 4;
      y = drawRtlBlock(ctx, ["أبرز الإنجازات"], y, 18, "12px CairoBold");
      y = drawRtlBlock(ctx, wrapRtlLines(ctx, context.topAchievements, CONTENT_WIDTH), y, 16, "12px Cairo");
    }
    if (context.strengths) {
      y += 4;
      y = drawRtlBlock(ctx, ["نقاط القوة"], y, 18, "12px CairoBold");
      y = drawRtlBlock(ctx, wrapRtlLines(ctx, context.strengths, CONTENT_WIDTH), y, 16, "12px Cairo");
    }
    if (context.improvementAreas) {
      y += 4;
      y = drawRtlBlock(ctx, ["فرص التحسين"], y, 18, "12px CairoBold");
      y = drawRtlBlock(ctx, wrapRtlLines(ctx, context.improvementAreas, CONTENT_WIDTH), y, 16, "12px Cairo");
    }
    y = drawFieldRow(ctx, "توصية المؤسسة", context.finalRecommendation || "—", y);

    y += 8;
    y = drawRtlBlock(ctx, ["بيانات المشرف"], y, 20, "14px CairoBold");
    y = drawFieldRow(ctx, "اسم المشرف", context.supervisorName || "_________________", y);
    y = drawFieldRow(ctx, "المسمى الوظيفي", context.supervisorTitle || "_________________", y);
    y = drawFieldRow(ctx, "رقم التواصل", context.supervisorPhone || "_________________", y);
    y = drawFieldRow(ctx, "التوقيع", "_______________________________", y);
    y = drawFieldRow(ctx, "ختم المؤسسة", "[ مساحة الختم ]", y);
  }

  ({ ctx, y } = ensurePageSpace(pdf, ctx, y, 30));
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
