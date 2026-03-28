/**
 * Title + tabular row extraction from group lists / rosters (flat PDF text).
 */

import type { GroupStudentRowCandidate } from "@/types/admin-attachment-ai-review";
import {
  collapseWhitespace,
  compareStudentNameToRecord,
  extractYearsFromText,
  normalizeDigitsInString,
  normalizeNameForCompare,
  tokenSetOverlapRatio,
  normalizedContainsEitherWay,
  type NameMatchStrength,
} from "@/lib/achievement-attachment-normalization";

export type GroupDocumentTitleResult = {
  title: string | null;
  confidence: number;
  source: string;
};

const TITLE_LINE_RES: ReadonlyArray<{ re: RegExp; source: string }> = [
  {
    re: /^(?:تعميم|تعميم\s*رقم|الطلبة\s*المرشحون|الطلاب\s*المرشحون|المرشحون\s*للمشاركة)[^\n]{0,200}/i,
    source: "ar_header_nomination",
  },
  {
    re: /^(?:بيان|تعميم|أسماء|اسماء)\s*[^\n]{0,40}المتأهلين[^\n]{0,160}/i,
    source: "ar_qualified_header",
  },
  {
    re: /^(?:ملتقى|المؤتمر|المنتدى)\s+[^\n]{10,200}/i,
    source: "ar_forum_title",
  },
  {
    re: /^(?:أسماء\s*الطلاب|اسماء\s*الطلاب)\s*(?:المشاركين|المرشحين|المتأهلين)?[^\n]{0,200}/i,
    source: "ar_student_names",
  },
  {
    re: /^(?:الطلاب\s*المتأهلون|قائمة\s*المشاركين|كشف\s*بأسماء)[^\n]{0,200}/i,
    source: "ar_qualified_list",
  },
  {
    re: /^(?:قائمة|بيان)\s+[^\n]{10,180}/i,
    source: "ar_list_generic",
  },
  {
    re: /^(?:List\s+of\s+(?:participants|students|nominees)|Qualified\s+students|Student\s+roster)[^\n]{0,200}/i,
    source: "en_list_header",
  },
];

export const extractGroupDocumentTitle = (text: string): GroupDocumentTitleResult => {
  const raw = normalizeDigitsInString(String(text || "").trim());
  if (!raw) return { title: null, confidence: 0, source: "empty" };

  const lines = raw
    .split(/\r?\n/)
    .map((l) => collapseWhitespace(l))
    .filter((l) => l.length > 8);

  const head = lines.slice(0, 22);
  for (const line of head) {
    for (const { re, source } of TITLE_LINE_RES) {
      const m = line.match(re);
      if (m && m[0] && m[0].length >= 12) {
        const title = collapseWhitespace(m[0].slice(0, 220));
        const confidence = Math.min(0.9, 0.45 + Math.min(1, title.length / 120) * 0.35);
        return { title, confidence, source };
      }
    }
  }

  for (const line of head) {
    if (line.length >= 24 && line.length <= 200 && /الطلاب|الطلبة|قائمة|تعميم|participants|nominee|roster/i.test(line)) {
      return {
        title: line,
        confidence: 0.42,
        source: "first_substantive_line",
      };
    }
  }

  return { title: null, confidence: 0, source: "not_found" };
};

const HEADER_SKIP_RE =
  /^(?:م|ت|#|no\.?|الاسم|الاسم\s*الرباعي|التخصص|الصف|الشعبة|المدرسة|الإدارة|المجال|المرحلة|المشارك|المرشح|name|grade|school)/i;

const SPEC_KEYS: ReadonlyArray<{ re: RegExp; key: keyof Pick<GroupStudentRowCandidate, "grade" | "specialization" | "field" | "section"> }> = [
  { re: /الصف\s*[:：]?\s*([^\s|،,]{1,40})/, key: "grade" },
  { re: /التخصص\s*[:：]?\s*([^\s|،,]{1,60})/, key: "specialization" },
  { re: /الشعبة\s*[:：]?\s*([^\s|،,]{1,40})/, key: "section" },
  { re: /المجال\s*[:：]?\s*([^\s|،,]{1,60})/, key: "field" },
];

const splitRowCells = (line: string): string[] => {
  if (line.includes("\t")) return line.split("\t").map((c) => collapseWhitespace(c)).filter(Boolean);
  if (line.includes("|")) return line.split("|").map((c) => collapseWhitespace(c)).filter(Boolean);
  if (/\s{3,}/.test(line)) return line.split(/\s{3,}/).map((c) => collapseWhitespace(c)).filter(Boolean);
  return [collapseWhitespace(line)];
};

const pickLongestArabicNameCell = (cells: string[]): string | null => {
  let best: string | null = null;
  let bestLen = 0;
  for (const c of cells) {
    const t = collapseWhitespace(c);
    if (t.length < 4) continue;
    const ar = (t.match(/[\u0600-\u06FF\u0750-\u077F]+/g) || []).join("");
    if (ar.length >= 6 && t.length > bestLen && !/^\d+$/.test(t)) {
      best = t;
      bestLen = t.length;
    }
  }
  return best;
};

const pickLatinNameCell = (cells: string[]): string | null => {
  for (const c of cells) {
    const t = collapseWhitespace(c);
    if (/^[A-Za-z][A-Za-z\s.'-]{4,80}$/.test(t) && (t.match(/[A-Za-z]+/g) || []).length >= 2) return t;
  }
  return null;
};

const extractNameFromLine = (line: string): { name: string | null; cells: string[] } => {
  const trimmed = collapseWhitespace(line.replace(/^\d+[.)]\s*/, ""));
  const cells = splitRowCells(trimmed);
  let name = pickLongestArabicNameCell(cells) || pickLatinNameCell(cells);
  if (!name && cells.length > 0) {
    const first = cells[0] ?? "";
    if (lineLooksLikePlainName(first)) name = first;
  }
  return { name, cells };
};

const lineLooksLikePlainName = (s: string): boolean => {
  const t = collapseWhitespace(s);
  if (t.length < 6 || t.length > 90) return false;
  const arWords = (t.match(/[\u0600-\u06FF\u0750-\u077F]{2,}/g) || []).length;
  const latWords = (t.match(/[A-Za-z]{2,}/g) || []).length;
  return arWords >= 2 || latWords >= 2;
};

const sniffOfficeSchool = (line: string, cells: string[]): { office: string | null; school: string | null } => {
  let office: string | null = null;
  let school: string | null = null;
  const blob = `${line} ${cells.join(" ")}`;
  const om = blob.match(/(?:الإدارة|مكتب\s*تعليم)\s*[:：]?\s*([^\n|،]{4,80})/);
  if (om) office = collapseWhitespace(om[1] ?? "");
  const sm = blob.match(/(?:المدرسة|مدرسة)\s*[:：]?\s*([^\n|،]{4,80})/);
  if (sm) school = collapseWhitespace(sm[1] ?? "");
  return { office, school };
};

const sniffFieldsFromBlob = (blob: string): Partial<GroupStudentRowCandidate> => {
  const out: Partial<GroupStudentRowCandidate> = {};
  for (const { re, key } of SPEC_KEYS) {
    const m = blob.match(re);
    if (m && m[1]) {
      const v = collapseWhitespace(m[1]);
      if (v) out[key] = v;
    }
  }
  return out;
};

const rankFromLine = (line: string): string | null => {
  const m = line.match(/(?:المركز|الترتيب|الرقم)\s*[:：]?\s*(\d{1,3})\b/);
  return m ? m[1] ?? null : null;
};

export const extractGroupDocumentStudentRows = (text: string): GroupStudentRowCandidate[] => {
  const raw = normalizeDigitsInString(String(text || ""));
  const lines = raw
    .split(/\r?\n/)
    .map((l) => collapseWhitespace(l))
    .filter((l) => l.length > 0);

  const rows: GroupStudentRowCandidate[] = [];

  for (const line of lines) {
    if (line.length < 6) continue;
    if (HEADER_SKIP_RE.test(line) && line.length < 55) continue;
    const { name, cells } = extractNameFromLine(line);
    if (!name || name.length < 4) continue;

    const normalizedRow = normalizeNameForCompare(line);
    const studentNorm = normalizeNameForCompare(name);
    const { office, school } = sniffOfficeSchool(line, cells);
    const fields = sniffFieldsFromBlob(line);
    const rk = rankFromLine(line);

    let confidence = 0.45;
    if (cells.length >= 2) confidence += 0.12;
    if (office || school) confidence += 0.08;
    if (fields.grade || fields.specialization) confidence += 0.1;
    confidence = Math.min(0.92, confidence);

    rows.push({
      rawRow: line,
      normalizedRow: normalizedRow || line,
      studentName: name,
      studentNameNormalized: studentNorm || null,
      educationOffice: office,
      schoolName: school,
      grade: fields.grade ?? null,
      specialization: fields.specialization ?? null,
      field: fields.field ?? null,
      section: fields.section ?? null,
      rankOrSeat: rk,
      confidence,
      sourcePage: null,
    });
  }

  return rows;
};

export type GroupStudentMatchResult = {
  found: boolean;
  bestMatch: GroupStudentRowCandidate | null;
  score: number;
  matchType: "strong" | "partial" | "none";
  alternatives: GroupStudentRowCandidate[];
  reason: string;
};

/** Public alias matching user naming; delegates to shared normalizer. */
export const normalizePersonName = (s: string): string => normalizeNameForCompare(s);

export const findMatchingStudentInGroupDocument = (
  rows: GroupStudentRowCandidate[],
  expectedStudentNames: string[]
): GroupStudentMatchResult => {
  const sys = expectedStudentNames.map((x) => String(x || "").trim()).filter(Boolean);
  if (sys.length === 0 || rows.length === 0) {
    return {
      found: false,
      bestMatch: null,
      score: 0,
      matchType: "none",
      alternatives: [],
      reason: "no_expected_names_or_no_rows",
    };
  }

  type Scored = { row: GroupStudentRowCandidate; score: number; strength: NameMatchStrength };

  const scored: Scored[] = [];

  for (const row of rows) {
    const det = row.studentName || "";
    if (!det) continue;
    const cmp = compareStudentNameToRecord({ detected: det, systemNames: sys });
    let score = 0;
    if (cmp.strength === "strong") score = 0.92;
    else if (cmp.strength === "weak") score = 0.62;
    else {
      let bestRatio = 0;
      for (const s of sys) {
        bestRatio = Math.max(bestRatio, tokenSetOverlapRatio(det, s));
        if (normalizedContainsEitherWay(det, s)) bestRatio = Math.max(bestRatio, 0.72);
      }
      score = bestRatio;
    }
    const strength: NameMatchStrength =
      score >= 0.78 ? "strong" : score >= 0.42 ? "weak" : "none";
    scored.push({ row, score, strength });
  }

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  const alts = scored.filter((s) => s.score >= 0.38 && s.row !== best?.row).slice(0, 5).map((s) => s.row);

  if (!best || best.strength === "none" || best.score < 0.35) {
    return {
      found: false,
      bestMatch: null,
      score: best?.score ?? 0,
      matchType: "none",
      alternatives: alts,
      reason: "no_row_met_name_threshold",
    };
  }

  const matchType: "strong" | "partial" = best.strength === "strong" || best.score >= 0.75 ? "strong" : "partial";

  return {
    found: true,
    bestMatch: best.row,
    score: best.score,
    matchType,
    alternatives: alts,
    reason: matchType === "strong" ? "high_token_overlap_or_containment" : "moderate_overlap_review_recommended",
  };
};

export const extractYearHintsFromGroupDocument = (text: string, title: string | null): number[] => {
  const blob = `${title || ""}\n${text}`;
  return extractYearsFromText(blob);
};
