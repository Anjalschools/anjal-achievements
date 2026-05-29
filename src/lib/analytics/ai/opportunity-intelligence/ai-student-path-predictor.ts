/**
 * Academic pathway & competition ladder — progression-aware recommendations.
 */

import type { CompetitionOpportunityVerdict } from "@/lib/analytics/ai/opportunity-intelligence/opportunity-types";
import type { PathwayRecommendation } from "@/lib/analytics/ai/opportunity-intelligence/opportunity-types";
import type { StudentAcademicContext } from "@/lib/analytics/ai/opportunity-intelligence/opportunity-types";

type PathwayRule = {
  id: string;
  when: (ctx: StudentAcademicContext) => boolean;
  recommend: string[];
  avoid: string[];
  titleAr: string;
  titleEn: string;
  rationaleAr: string;
  rationaleEn: string;
  priority: PathwayRecommendation["priority"];
};

const PATHWAY_RULES: PathwayRule[] = [
  {
    id: "math-middle-strong",
    when: (s) =>
      s.stage === "middle" &&
      s.achievementHistory.mathStrength >= 55 &&
      (s.achievementHistory.activityKeys.some((k) => k.includes("kangaroo")) ||
        s.achievementHistory.goldCount >= 1),
    recommend: ["kaust_math", "ibdaa", "olympiad_training", "nasmo"],
    avoid: ["qiyas", "sat", "misk", "srsi"],
    titleAr: "مسار الرياضيات والأولمبياد",
    titleEn: "Math & olympiad pathway",
    rationaleAr:
      "أداء رياضيات قوي في المتوسط مع مشاركات كانجارو — ركّز على كاوست وإبداع ونسمو مستقبلًا.",
    rationaleEn:
      "Strong middle-school math with Kangaroo signal — prioritize KAUST math, Ibdaa, and future Nasmo.",
    priority: "high",
  },
  {
    id: "international-sat",
    when: (s) =>
      s.section === "international" ||
      s.studyAbroadIntent ||
      s.achievementHistory.languageStrength >= 50,
    recommend: ["sat", "ielts", "ibdaa"],
    avoid: ["qiyas"],
    titleAr: "مسار دولي / لغة",
    titleEn: "International / language pathway",
    rationaleAr: "القسم الدولي أو هدف الدراسة بالخارج — ارفع أولوية SAT وIELTS والبحث العلمي.",
    rationaleEn: "International section or study-abroad intent — raise SAT, IELTS, and research priority.",
    priority: "high",
  },
  {
    id: "gifted-primary",
    when: (s) => s.stage === "primary" && s.gradeNumber != null && s.gradeNumber <= 6,
    recommend: ["mawhiba_discovery", "bebras", "kangaroo"],
    avoid: ["qiyas", "sat", "srsi", "misk", "nasmo"],
    titleAr: "مسار موهبة مبكر",
    titleEn: "Early gifted pathway",
    rationaleAr: "مرحلة ابتدائية — بناء قاعدة عبر موهبة وبيبراس وكانجارو فقط.",
    rationaleEn: "Primary stage — build foundation via gifted discovery, Bebras, and Kangaroo only.",
    priority: "medium",
  },
  {
    id: "secondary-qiyas",
    when: (s) =>
      s.stage === "secondary" &&
      s.gradeNumber != null &&
      s.gradeNumber >= 11 &&
      s.achievementHistory.qiyasScore != null,
    recommend: ["qiyas"],
    avoid: ["bebras", "kangaroo"],
    titleAr: "مسار قياس ثانوي",
    titleEn: "Secondary standardized testing",
    rationaleAr: "ثانوي مع مؤشر قياس — أولوية القدرات/التحصيلي.",
    rationaleEn: "Secondary with Qiyas signal — prioritize aptitude testing.",
    priority: "high",
  },
  {
    id: "future-srsi",
    when: (s) => s.stage === "middle" && s.achievementHistory.scienceStrength >= 45,
    recommend: ["ibdaa", "mawhiba_discovery", "srsi"],
    avoid: ["qiyas", "sat"],
    titleAr: "تحضير SRSI مستقبلي",
    titleEn: "Future SRSI preparation",
    rationaleAr: "متوسط بمؤشر علوم — جهّز لإبداع ثم SRSI في ثاني ثانوي.",
    rationaleEn: "Middle school science strength — prepare via Ibdaa toward SRSI in grade 11.",
    priority: "medium",
  },
];

export const predictStudentPathways = (
  student: StudentAcademicContext,
  verdicts: CompetitionOpportunityVerdict[]
): PathwayRecommendation[] => {
  const recommended = new Set(
    verdicts
      .filter((v) => v.decision === "RECOMMENDED" || v.decision === "HIGH_POTENTIAL")
      .map((v) => v.competitionKey)
  );

  const out: PathwayRecommendation[] = [];

  for (const rule of PATHWAY_RULES) {
    if (!rule.when(student)) continue;
    const keys = rule.recommend.filter(
      (k) => recommended.has(k) || verdicts.some((v) => v.competitionKey === k && v.decision !== "BLOCKED")
    );
    if (keys.length === 0) continue;
    out.push({
      id: rule.id,
      titleAr: rule.titleAr,
      titleEn: rule.titleEn,
      competitionKeys: keys,
      avoidKeys: rule.avoid,
      rationaleAr: rule.rationaleAr,
      rationaleEn: rule.rationaleEn,
      priority: rule.priority,
    });
  }

  return out;
};

export const deriveStrengthsWeaknesses = (
  student: StudentAcademicContext,
  verdicts: CompetitionOpportunityVerdict[]
): { strengths: string[]; weaknesses: string[] } => {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const s = student.achievementHistory;

  if (s.mathStrength >= 50) strengths.push("قوة في المسار الرياضي");
  if (s.scienceStrength >= 50) strengths.push("قوة في المسار العلمي");
  if (s.languageStrength >= 50) strengths.push("قوة لغوية / دولية");
  if (s.medalCount >= 3) strengths.push("تاريخ تتويج متكرر");
  if (s.continuityYears >= 2) strengths.push("استمرارية مشاركة");

  if (s.participationCount === 0) weaknesses.push("لا يوجد سجل مشاركات كافٍ");
  if (s.medalCount === 0 && s.participationCount > 2) weaknesses.push("مشاركة دون نتائج قوية");
  if (student.gradeInferred) weaknesses.push("بيانات الصف غير مؤكدة");

  const blockedHigh = verdicts.filter((v) => v.decision === "BLOCKED").length;
  if (blockedHigh > 6) weaknesses.push("عدة برامج غير مناسبة للمرحلة الحالية");

  if (strengths.length === 0) strengths.push("إمكانية بناء مسار من الصفر عبر برامج التأسيس");
  return { strengths, weaknesses };
};
