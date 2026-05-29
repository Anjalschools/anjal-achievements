/**
 * Rule-based eligibility evaluation — metadata config only.
 */

import { normalizeGrade } from "@/constants/grades";
import { getStageByGrade, type ReportStage } from "@/lib/report-stage-mapping";
import type {
  CompetitionEligibilityConfig,
  EligibilityProgram,
  EligibilityStage,
} from "@/lib/analytics/ai/opportunity-intelligence/competition-eligibility-config";
import { eligibilityConfigByKey } from "@/lib/analytics/ai/opportunity-intelligence/competition-eligibility-config";
import type { StudentAcademicContext } from "@/lib/analytics/ai/opportunity-intelligence/opportunity-types";

export type EligibilityEvaluation = {
  eligible: boolean;
  blocked: boolean;
  futureOnly: boolean;
  reasonsAr: string[];
  reasonsEn: string[];
};

const gradeToNumber = (grade: string): number | null => {
  const g = normalizeGrade(grade);
  if (!g) return null;
  const n = Number(g.replace("g", ""));
  return Number.isFinite(n) ? n : null;
};

export const resolveGradeNumber = (
  grade: string,
  stage: ReportStage
): { gradeNumber: number | null; inferred: boolean } => {
  const direct = gradeToNumber(grade);
  if (direct != null) return { gradeNumber: direct, inferred: false };
  if (stage === "primary") return { gradeNumber: 5, inferred: true };
  if (stage === "middle") return { gradeNumber: 8, inferred: true };
  if (stage === "secondary") return { gradeNumber: 11, inferred: true };
  return { gradeNumber: null, inferred: true };
};

const normalizeProgram = (section: StudentAcademicContext["section"]): EligibilityProgram | null => {
  if (section === "arabic") return "arabic";
  if (section === "international") return "international";
  return null;
};

const stageAllowed = (stage: ReportStage, allowed: EligibilityStage[]): boolean => {
  if (stage === "unknown") return false;
  return allowed.includes(stage);
};

const programAllowed = (
  program: EligibilityProgram | null,
  allowed: EligibilityProgram[]
): boolean => {
  if (allowed.includes("any")) return true;
  if (!program) return allowed.includes("any");
  return allowed.includes(program);
};

export const evaluateEligibility = (
  student: StudentAcademicContext,
  config: CompetitionEligibilityConfig
): EligibilityEvaluation => {
  const reasonsAr: string[] = [];
  const reasonsEn: string[] = [];
  const g = student.gradeNumber;

  if (g == null) {
    return {
      eligible: false,
      blocked: true,
      futureOnly: false,
      reasonsAr: ["الصف الدراسي غير محدد — لا يمكن التحقق من الأهلية"],
      reasonsEn: ["Grade unknown — cannot verify eligibility"],
    };
  }

  if (config.blockedGrades?.includes(g)) {
    reasonsAr.push(`الصف ${g} مستبعد صراحةً من ${config.titleAr}`);
    reasonsEn.push(`Grade ${g} is explicitly excluded from ${config.titleEn}`);
    return { eligible: false, blocked: true, futureOnly: false, reasonsAr, reasonsEn };
  }

  if (g < config.minGrade || g > config.maxGrade || !config.allowedGrades.includes(g)) {
    const future =
      config.futureWindow &&
      g < config.futureWindow.minGrade &&
      g >= config.futureWindow.minGrade - 3;
    if (future) {
      reasonsAr.push(
        `غير مؤهل حاليًا — مخصص للصفوف ${config.minGrade}–${config.maxGrade}`,
        `الطالب في الصف ${g}`
      );
      reasonsEn.push(
        `Not eligible yet — targets grades ${config.minGrade}–${config.maxGrade}`,
        `Student is in grade ${g}`
      );
      return { eligible: false, blocked: false, futureOnly: true, reasonsAr, reasonsEn };
    }
    reasonsAr.push(
      `المسابقة/البرنامج للصفوف ${config.minGrade}–${config.maxGrade}`,
      `الطالب في الصف ${g}`
    );
    reasonsEn.push(
      `Program is for grades ${config.minGrade}–${config.maxGrade}`,
      `Student is in grade ${g}`
    );
    return { eligible: false, blocked: true, futureOnly: false, reasonsAr, reasonsEn };
  }

  if (!stageAllowed(student.stage, config.allowedStages)) {
    reasonsAr.push(`المرحلة ${student.stage} خارج نطاق البرنامج`);
    reasonsEn.push(`Stage ${student.stage} is outside program scope`);
    return { eligible: false, blocked: true, futureOnly: false, reasonsAr, reasonsEn };
  }

  const prog = normalizeProgram(student.section);
  if (!programAllowed(prog, config.allowedPrograms)) {
    reasonsAr.push("القسم/المسار لا يطابق شروط البرنامج");
    reasonsEn.push("Section/track does not match program requirements");
    return { eligible: false, blocked: true, futureOnly: false, reasonsAr, reasonsEn };
  }

  if (config.requiresInternational && student.section !== "international") {
    reasonsAr.push("البرنامج موجه للقسم الدولي أو مسار الدراسة بالخارج");
    reasonsEn.push("Program targets international section or study-abroad track");
    return { eligible: false, blocked: true, futureOnly: false, reasonsAr, reasonsEn };
  }

  if (config.requiresMawhiba && !student.mawhiba) {
    reasonsAr.push("يتطلب تسجيل موهبة");
    reasonsEn.push("Requires Mawhiba registration");
    return { eligible: false, blocked: true, futureOnly: false, reasonsAr, reasonsEn };
  }

  if (config.key === "sat" && !student.studyAbroadIntent && student.section !== "international") {
    reasonsAr.push("SAT أولوية للقسم الدولي أو من لديه هدف دراسة بالخارج");
    reasonsEn.push("SAT is prioritized for international section or study-abroad intent");
    return {
      eligible: true,
      blocked: false,
      futureOnly: false,
      reasonsAr: [...reasonsAr, "مؤهل مع أولوية مسار دولي منخفضة"],
      reasonsEn: [...reasonsEn, "Eligible with lower international-track priority"],
    };
  }

  return {
    eligible: true,
    blocked: false,
    futureOnly: false,
    reasonsAr: reasonsAr.length ? reasonsAr : [`مؤهل أكاديميًا لـ ${config.titleAr}`],
    reasonsEn: reasonsEn.length ? reasonsEn : [`Academically eligible for ${config.titleEn}`],
  };
};

export const buildStudentAcademicContext = (input: {
  participantId: string;
  grade?: string;
  section?: string;
  stageKey?: string;
  mawhiba?: boolean;
  studyAbroadIntent?: boolean;
  signals?: Partial<StudentAcademicContext["achievementHistory"]>;
}): StudentAcademicContext => {
  const grade = String(input.grade ?? "").trim();
  const sectionRaw = String(input.section ?? "").toLowerCase();
  const section: StudentAcademicContext["section"] =
    sectionRaw.includes("intl") || sectionRaw.includes("دولي") ? "international"
    : sectionRaw.includes("arab") || sectionRaw.includes("عربي") ? "arabic"
    : "unknown";

  const stageFromKey = input.stageKey as StudentAcademicContext["stage"] | undefined;
  const stage =
    stageFromKey === "primary" || stageFromKey === "middle" || stageFromKey === "secondary"
      ? stageFromKey
      : getStageByGrade(grade);

  const { gradeNumber, inferred } = resolveGradeNumber(grade, stage);

  const defaultSignals: StudentAcademicContext["achievementHistory"] = {
    activityKeys: [],
    participationCount: 0,
    medalCount: 0,
    goldCount: 0,
    silverCount: 0,
    bronzeCount: 0,
    nominationCount: 0,
    distinctActivities: 0,
    continuityYears: 0,
    mathStrength: 0,
    scienceStrength: 0,
    languageStrength: 0,
    qiyasScore: null,
    satScore: null,
    tags: [],
  };

  return {
    participantId: input.participantId,
    grade,
    gradeNumber,
    gradeInferred: inferred,
    stage,
    section,
    mawhiba: input.mawhiba === true,
    studyAbroadIntent: input.studyAbroadIntent === true,
    achievementHistory: { ...defaultSignals, ...input.signals },
  };
};

export const evaluateEligibilityByKey = (
  student: StudentAcademicContext,
  competitionKey: string
): EligibilityEvaluation | null => {
  const config = eligibilityConfigByKey(competitionKey);
  if (!config) return null;
  return evaluateEligibility(student, config);
};
