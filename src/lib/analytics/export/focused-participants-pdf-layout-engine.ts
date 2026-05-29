/**
 * Focused participants table PDF layout — fixed column widths, RTL-aware roles, pagination-safe grid.
 */

export type ParticipantColumnRole =
  | "studentName"
  | "gender"
  | "section"
  | "mawhiba"
  | "grade"
  | "stage"
  | "school"
  | "activity"
  | "year"
  | "result"
  | "level"
  | "score"
  | "approval"
  | "unknown";

import { getPdfPageLayout } from "@/lib/pdf/pdf-page-layout-engine";

export type FocusedParticipantsPageMargins = {
  topMm: number;
  bottomMm: number;
  leftMm: number;
  rightMm: number;
};

const LANDSCAPE_LAYOUT = getPdfPageLayout("landscape");

export const FOCUSED_PARTICIPANTS_PDF_MARGINS: FocusedParticipantsPageMargins = {
  topMm: LANDSCAPE_LAYOUT.marginTop,
  bottomMm: LANDSCAPE_LAYOUT.marginBottom,
  leftMm: LANDSCAPE_LAYOUT.marginLeft,
  rightMm: LANDSCAPE_LAYOUT.marginRight,
};

export const FOCUSED_PARTICIPANTS_PAGE = {
  widthMm: LANDSCAPE_LAYOUT.pageWidth,
  heightMm: LANDSCAPE_LAYOUT.pageHeight,
  margins: FOCUSED_PARTICIPANTS_PDF_MARGINS,
  usableWidthMm: LANDSCAPE_LAYOUT.printableWidth,
  contentStartY: LANDSCAPE_LAYOUT.contentStartY,
  contentEndY: LANDSCAPE_LAYOUT.contentEndY,
} as const;

type RoleWidthSpec = { minMm: number; baseMm: number };

const ROLE_WIDTHS: Record<ParticipantColumnRole, RoleWidthSpec> = {
  studentName: { minMm: 36, baseMm: 46 },
  school: { minMm: 20, baseMm: 26 },
  activity: { minMm: 22, baseMm: 28 },
  grade: { minMm: 12, baseMm: 16 },
  stage: { minMm: 12, baseMm: 16 },
  gender: { minMm: 10, baseMm: 13 },
  section: { minMm: 10, baseMm: 13 },
  mawhiba: { minMm: 10, baseMm: 13 },
  year: { minMm: 9, baseMm: 12 },
  result: { minMm: 12, baseMm: 16 },
  level: { minMm: 11, baseMm: 14 },
  score: { minMm: 9, baseMm: 12 },
  approval: { minMm: 11, baseMm: 14 },
  unknown: { minMm: 10, baseMm: 12 },
};

const ROLE_PATTERNS: Array<{ role: ParticipantColumnRole; tokens: string[] }> = [
  { role: "studentName", tokens: ["اسم الطالب", "student", "learner", "participant name", "name"] },
  { role: "gender", tokens: ["الجنس", "gender", "sex"] },
  { role: "section", tokens: ["القسم", "section", "track"] },
  { role: "mawhiba", tokens: ["موهبة", "mawhiba", "gifted"] },
  { role: "grade", tokens: ["الصف", "grade", "class"] },
  { role: "stage", tokens: ["المرحلة", "stage"] },
  { role: "school", tokens: ["المدرسة", "school", "organization", "org"] },
  { role: "activity", tokens: ["النشاط", "activity", "program", "competition"] },
  { role: "year", tokens: ["السنة", "year", "academic"] },
  { role: "result", tokens: ["النتيجة", "result", "outcome"] },
  { role: "level", tokens: ["المستوى", "level"] },
  { role: "score", tokens: ["الدرجة", "score", "points", "mark"] },
  { role: "approval", tokens: ["الاعتماد", "approval", "approved", "status"] },
];

const normalizeHeader = (h: string): string =>
  h
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[‑–—]/g, "-");

export const resolveParticipantColumnRole = (header: string): ParticipantColumnRole => {
  const n = normalizeHeader(header);
  for (const { role, tokens } of ROLE_PATTERNS) {
    if (tokens.some((t) => n.includes(t.toLowerCase()))) return role;
  }
  return "unknown";
};

export type FocusedParticipantColumnLayout = {
  header: string;
  role: ParticipantColumnRole;
  widthMm: number;
  cssClass: string;
};

export type FocusedParticipantsTableLayoutPlan = {
  columns: FocusedParticipantColumnLayout[];
  tableWidthMm: number;
  colgroupHtml: string;
  bodyFontPx: number;
  headerFontPx: number;
};

const columnCssClass = (role: ParticipantColumnRole): string => {
  if (role === "studentName") return "fp-col-name";
  if (role === "school" || role === "activity") return "fp-col-medium";
  if (
    role === "gender" ||
    role === "section" ||
    role === "mawhiba" ||
    role === "year" ||
    role === "score" ||
    role === "approval"
  ) {
    return "fp-col-compact";
  }
  if (role === "grade" || role === "stage" || role === "result" || role === "level") {
    return "fp-col-fixed";
  }
  return "fp-col-default";
};

const scaleWidths = (
  widths: number[],
  roles: ParticipantColumnRole[],
  targetMm: number
): number[] => {
  const mins = roles.map((r) => ROLE_WIDTHS[r].minMm);
  let sum = widths.reduce((a, b) => a + b, 0);
  if (sum <= targetMm) {
    let slack = targetMm - sum;
    const priority: ParticipantColumnRole[] = ["studentName", "school", "activity"];
    for (const pr of priority) {
      const idx = roles.indexOf(pr);
      if (idx < 0 || slack <= 0) continue;
      const add = Math.min(slack, pr === "studentName" ? 14 : 6);
      widths[idx] = (widths[idx] ?? 0) + add;
      slack -= add;
    }
    if (slack > 0) {
      const nameIdx = roles.indexOf("studentName");
      if (nameIdx >= 0) widths[nameIdx] = (widths[nameIdx] ?? 0) + slack;
    }
    return widths;
  }
  let overflow = sum - targetMm;
  const order = [...widths.keys()].sort((a, b) => widths[b]! - widths[a]!);
  for (const i of order) {
    if (overflow <= 0) break;
    const room = widths[i]! - mins[i]!;
    if (room <= 0) continue;
    const cut = Math.min(room, overflow);
    widths[i] = widths[i]! - cut;
    overflow -= cut;
  }
  return widths;
};

export const buildFocusedParticipantsTableLayout = (
  headers: string[]
): FocusedParticipantsTableLayoutPlan => {
  const roles = headers.map((h) => resolveParticipantColumnRole(h));
  let widths = roles.map((r) => ROLE_WIDTHS[r].baseMm);
  widths = scaleWidths(widths, roles, FOCUSED_PARTICIPANTS_PAGE.usableWidthMm);

  const columns: FocusedParticipantColumnLayout[] = headers.map((header, i) => ({
    header,
    role: roles[i]!,
    widthMm: Math.round((widths[i] ?? ROLE_WIDTHS.unknown.baseMm) * 10) / 10,
    cssClass: columnCssClass(roles[i]!),
  }));

  const tableWidthMm =
    Math.round(columns.reduce((s, c) => s + c.widthMm, 0) * 10) / 10;

  const colgroupHtml = `<colgroup>${columns
    .map((c) => `<col class="${c.cssClass}" style="width:${c.widthMm}mm" />`)
    .join("")}</colgroup>`;

  const colCount = columns.length;
  const bodyFontPx = colCount > 11 ? 7.25 : colCount > 9 ? 7.75 : 8.25;
  const headerFontPx = bodyFontPx + 0.5;

  return {
    columns,
    tableWidthMm,
    colgroupHtml,
    bodyFontPx,
    headerFontPx,
  };
};

export const assertFocusedParticipantsLayoutReady = (
  plan: FocusedParticipantsTableLayoutPlan
): void => {
  if (plan.columns.length === 0) {
    throw new Error("Focused participants PDF: no columns");
  }
  if (plan.tableWidthMm > FOCUSED_PARTICIPANTS_PAGE.usableWidthMm + 0.5) {
    throw new Error(
      `Focused participants PDF: table width ${plan.tableWidthMm}mm exceeds printable ${FOCUSED_PARTICIPANTS_PAGE.usableWidthMm}mm`
    );
  }
};
