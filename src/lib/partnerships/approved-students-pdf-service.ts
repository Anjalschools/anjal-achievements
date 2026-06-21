import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import mongoose from "mongoose";
import { GlobalFonts, loadImage, PDFDocument, type SKRSContext2D } from "@napi-rs/canvas";
import connectDB from "@/lib/mongodb";
import AcademicYear from "@/models/AcademicYear";
import PartnerOrganization from "@/models/PartnerOrganization";
import SchoolYear from "@/models/SchoolYear";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingOpportunity from "@/models/TrainingOpportunity";
import User from "@/models/User";
import { getGradeLabel } from "@/constants/grades";
import { gradeToStage } from "@/lib/partnerships/partnerships-eligibility";

const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;
const MARGIN_X = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const BASE_ROW_HEIGHT = 22;
const LINE_HEIGHT = 11;
const HEADER_BAND = 92;
const FOOTER_Y = PAGE_HEIGHT - 28;
const DEFAULT_SCHOOL_NAME_AR = "مدارس الأنجال الأهلية";

export type ApprovedStudentReportRow = {
  index: number;
  studentName: string;
  grade: string;
  stage: string;
  school: string;
  pathway: string;
  studentPhone: string;
  parentPhone: string;
  email: string;
};

export type ApprovedStudentsReportContext = {
  institutionName: string;
  schoolYearLabel: string;
  rows: ApprovedStudentReportRow[];
  generatedAt: string;
  generatedBy: string;
};

const STAGE_LABELS: Record<string, string> = {
  elementary: "ابتدائي",
  middle: "متوسط",
  high: "ثانوي",
};

const pathwayLabel = (value: string | undefined): string => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "arabic" || normalized.includes("عربي")) return "عربي";
  if (normalized === "international" || normalized.includes("دولي")) return "دولي";
  return value ? String(value) : "—";
};

let fontsRegistered = false;

const ensureFonts = () => {
  if (fontsRegistered) return;
  GlobalFonts.registerFromPath(join(process.cwd(), "public/fonts/Cairo-Regular.ttf"), "Cairo");
  GlobalFonts.registerFromPath(join(process.cwd(), "public/fonts/Cairo-Bold.ttf"), "CairoBold");
  fontsRegistered = true;
};

const resolveSchoolYear = async (schoolYearId: string) => {
  if (!mongoose.Types.ObjectId.isValid(schoolYearId)) {
    throw new Error("Invalid schoolYearId");
  }

  const academicYear = await AcademicYear.findById(schoolYearId).lean();
  if (academicYear) {
    return {
      label: String(academicYear.label || academicYear.name || ""),
      name: String(academicYear.name || ""),
      id: String(academicYear._id),
    };
  }

  const schoolYear = await SchoolYear.findById(schoolYearId).lean();
  if (schoolYear) {
    return {
      label: String(schoolYear.name || ""),
      name: String(schoolYear.name || ""),
      id: String(schoolYear._id),
    };
  }

  throw new Error("School year not found");
};

export const loadApprovedStudentsReportContext = async (input: {
  institutionId: string;
  schoolYearId: string;
}): Promise<ApprovedStudentsReportContext> => {
  await connectDB();

  if (!mongoose.Types.ObjectId.isValid(input.institutionId)) {
    throw new Error("Invalid institutionId");
  }

  const organization = await PartnerOrganization.findById(input.institutionId).lean();
  if (!organization) throw new Error("Institution not found");

  const year = await resolveSchoolYear(input.schoolYearId);
  const opportunities = await TrainingOpportunity.find({
    organizationId: input.institutionId,
  })
    .select("_id")
    .lean();
  const opportunityIds = opportunities.map((row) => row._id);
  if (!opportunityIds.length) {
    return {
      institutionName: String(organization.name || ""),
      schoolYearLabel: year.label,
      rows: [],
      generatedAt: new Date().toLocaleString("ar-SA"),
      generatedBy: "النظام",
    };
  }

  const yearFilter = {
    $or: [
      { academicYearId: new mongoose.Types.ObjectId(year.id) },
      { academicYear: year.name },
      { academicYearLabel: year.label },
      { academicYear: year.label },
    ],
  };

  const applications = await StudentTrainingApplication.find({
    opportunityId: { $in: opportunityIds },
    status: "accepted",
    archived: { $ne: true },
    ...yearFilter,
  })
    .sort({ "studentSnapshot.fullName": 1 })
    .lean();

  const studentIds = applications.map((row) => row.studentId);
  const users = await User.find({ _id: { $in: studentIds } })
    .select("phone guardianPhone email section")
    .lean();
  const userMap = new Map(users.map((row) => [String(row._id), row]));

  const rows: ApprovedStudentReportRow[] = applications.map((app, index) => {
    const student = userMap.get(String(app.studentId));
    const snapshot = app.studentSnapshot;
    const stageKey = String(snapshot?.stage || gradeToStage(String(snapshot?.grade || "")));
    const grade = getGradeLabel(snapshot?.grade, "ar");
    const sectionSource = String(student?.section || snapshot?.schoolType || "").trim();
    return {
      index: index + 1,
      studentName: String(snapshot?.fullName || ""),
      grade,
      stage: STAGE_LABELS[stageKey] || stageKey,
      school: DEFAULT_SCHOOL_NAME_AR,
      pathway: pathwayLabel(sectionSource),
      studentPhone: String(student?.phone || "—"),
      parentPhone: String(student?.guardianPhone || "—"),
      email: String(student?.email || "—"),
    };
  });

  return {
    institutionName: String(organization.name || ""),
    schoolYearLabel: year.label,
    rows,
    generatedAt: new Date().toLocaleString("ar-SA"),
    generatedBy: "النظام",
  };
};

const drawHeader = async (ctx: SKRSContext2D) => {
  const headerBuffer = readFileSync(join(process.cwd(), "public/report-header.png"));
  const headerImage = await loadImage(headerBuffer);
  ctx.drawImage(headerImage, 0, 0, PAGE_WIDTH, HEADER_BAND);
};

const drawTitle = (ctx: SKRSContext2D, context: ApprovedStudentsReportContext, y: number) => {
  ctx.font = "16px CairoBold";
  ctx.fillStyle = "#0f172a";
  ctx.textAlign = "center";
  ctx.direction = "rtl";
  ctx.fillText("كشف الطلاب المعتمدين للتدريب الصيفي", PAGE_WIDTH / 2, y);
  ctx.font = "13px Cairo";
  ctx.fillStyle = "#334155";
  ctx.fillText(context.institutionName, PAGE_WIDTH / 2, y + 22);
  ctx.fillText(context.schoolYearLabel, PAGE_WIDTH / 2, y + 40);
  return y + 58;
};

const columnWidths = [24, 96, 56, 44, 92, 36, 68, 68, 178];
const columnLabels = [
  "م",
  "الطالب",
  "الصف",
  "المرحلة",
  "المدرسة",
  "المسار",
  "جوال الطالب",
  "جوال ولي الأمر",
  "البريد الإلكتروني",
];

const wrapCellLines = (ctx: SKRSContext2D, text: string, maxWidth: number, font: string): string[] => {
  ctx.font = font;
  const source = String(text || "").trim() || "—";
  const words = source.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  const pushCurrent = () => {
    if (current) lines.push(current);
    current = "";
  };

  const pushLongToken = (token: string) => {
    let chunk = "";
    for (const ch of token) {
      const trial = `${chunk}${ch}`;
      if (ctx.measureText(trial).width <= maxWidth) chunk = trial;
      else {
        if (chunk) lines.push(chunk);
        chunk = ch;
      }
    }
    current = chunk;
  };

  for (const word of words.length ? words : [source]) {
    const trial = current ? `${current} ${word}` : word;
    if (ctx.measureText(trial).width <= maxWidth) {
      current = trial;
      continue;
    }
    if (current) pushCurrent();
    if (ctx.measureText(word).width <= maxWidth) current = word;
    else pushLongToken(word);
  }
  if (current) pushCurrent();
  return lines.length ? lines : ["—"];
};

const drawWrappedCell = (
  ctx: SKRSContext2D,
  text: string,
  x: number,
  width: number,
  startY: number,
  font: string
): number => {
  const lines = wrapCellLines(ctx, text, width - 6, font);
  ctx.font = font;
  ctx.fillStyle = "#111827";
  ctx.textAlign = "center";
  ctx.direction = "rtl";
  let y = startY;
  for (const line of lines) {
    ctx.fillText(line, x + width / 2, y);
    y += LINE_HEIGHT;
  }
  return lines.length;
};

const drawTableHeader = (ctx: SKRSContext2D, y: number) => {
  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(MARGIN_X, y - 14, CONTENT_WIDTH, 20);
  ctx.font = "10px CairoBold";
  ctx.fillStyle = "#0f172a";
  ctx.textAlign = "center";
  ctx.direction = "rtl";
  let x = PAGE_WIDTH - MARGIN_X;
  columnLabels.forEach((label, index) => {
    const width = columnWidths[index];
    x -= width;
    ctx.fillText(label, x + width / 2, y);
  });
  return y + 12;
};

const measureRowHeight = (ctx: SKRSContext2D, row: ApprovedStudentReportRow): number => {
  const values = [
    String(row.index),
    row.studentName,
    row.grade,
    row.stage,
    row.school,
    row.pathway,
    row.studentPhone,
    row.parentPhone,
    row.email,
  ];
  const fonts = ["9px Cairo", "9px Cairo", "9px Cairo", "9px Cairo", "9px Cairo", "9px Cairo", "9px Cairo", "9px Cairo", "8px Cairo"];
  let maxLines = 1;
  values.forEach((value, index) => {
    const lines = wrapCellLines(ctx, value, columnWidths[index] - 6, fonts[index]).length;
    maxLines = Math.max(maxLines, lines);
  });
  return Math.max(BASE_ROW_HEIGHT, maxLines * LINE_HEIGHT + 8);
};

const drawTableRow = (ctx: SKRSContext2D, row: ApprovedStudentReportRow, y: number): number => {
  const values = [
    String(row.index),
    row.studentName,
    row.grade,
    row.stage,
    row.school,
    row.pathway,
    row.studentPhone,
    row.parentPhone,
    row.email,
  ];
  const fonts = [
    "9px Cairo",
    "9px Cairo",
    "9px Cairo",
    "9px Cairo",
    "9px Cairo",
    "9px Cairo",
    "9px Cairo",
    "9px Cairo",
    "8px Cairo",
  ];

  let x = PAGE_WIDTH - MARGIN_X;
  let maxLines = 1;
  const cellLines: number[] = [];

  values.forEach((value, index) => {
    const width = columnWidths[index];
    x -= width;
    const lines = wrapCellLines(ctx, value, width - 6, fonts[index]).length;
    cellLines.push(lines);
    maxLines = Math.max(maxLines, lines);
  });

  x = PAGE_WIDTH - MARGIN_X;
  values.forEach((value, index) => {
    const width = columnWidths[index];
    x -= width;
    drawWrappedCell(ctx, value, x, width, y, fonts[index]);
  });

  const rowHeight = Math.max(BASE_ROW_HEIGHT, maxLines * LINE_HEIGHT + 8);
  ctx.strokeStyle = "#e5e7eb";
  ctx.beginPath();
  ctx.moveTo(MARGIN_X, y + rowHeight - 6);
  ctx.lineTo(PAGE_WIDTH - MARGIN_X, y + rowHeight - 6);
  ctx.stroke();
  return rowHeight;
};

const drawFooter = (ctx: SKRSContext2D, context: ApprovedStudentsReportContext) => {
  ctx.font = "9px Cairo";
  ctx.fillStyle = "#64748b";
  ctx.textAlign = "right";
  ctx.direction = "rtl";
  ctx.fillText(
    `إجمالي الطلاب: ${context.rows.length} | تاريخ التصدير: ${context.generatedAt} | ${context.generatedBy}`,
    PAGE_WIDTH - MARGIN_X,
    FOOTER_Y
  );
};

export const generateApprovedStudentsPdfBuffer = async (
  context: ApprovedStudentsReportContext
): Promise<Buffer> => {
  ensureFonts();
  const pdf = new PDFDocument({ title: "Approved Students Report" });

  let pageIndex = 0;
  let y = 0;
  let rowCursor = 0;

  const startPage = async () => {
    const ctx = pdf.beginPage(PAGE_WIDTH, PAGE_HEIGHT) as SKRSContext2D;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
    await drawHeader(ctx);
    y = drawTitle(ctx, context, HEADER_BAND + 24);
    y = drawTableHeader(ctx, y + 8);
    pageIndex += 1;
    return ctx;
  };

  let ctx = await startPage();
  let remainingHeight = FOOTER_Y - y - 16;

  while (rowCursor < context.rows.length) {
    const row = context.rows[rowCursor];
    const rowHeight = measureRowHeight(ctx, row);
    if (rowHeight > remainingHeight && rowCursor > 0) {
      drawFooter(ctx, context);
      pdf.endPage();
      ctx = await startPage();
      y = drawTableHeader(ctx, HEADER_BAND + 82);
      remainingHeight = FOOTER_Y - y - 16;
    }
    drawTableRow(ctx, row, y);
    y += rowHeight;
    remainingHeight -= rowHeight;
    rowCursor += 1;
  }

  if (context.rows.length === 0) {
    ctx.font = "12px Cairo";
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "center";
    ctx.direction = "rtl";
    ctx.fillText("لا يوجد طلاب معتمدون لهذه المؤسسة في العام المحدد.", PAGE_WIDTH / 2, y + 20);
  }

  drawFooter(ctx, context);
  pdf.endPage();
  return pdf.close() as Buffer;
};

export const buildApprovedStudentsPdf = async (input: {
  institutionId: string;
  schoolYearId: string;
}) => {
  const context = await loadApprovedStudentsReportContext(input);
  const buffer = await generateApprovedStudentsPdfBuffer(context);
  return { buffer, context };
};
