import type { RawActivityRecord } from "@/lib/analytics/ai/activity-intelligence/student-activity-loader";

export type SkillExtractionInput = {
  achievementRecords: RawActivityRecord[];
  trainingTasks?: string;
  trainingReflection?: string;
  portfolioTechnicalSkills?: string[];
  portfolioPersonalSkills?: string[];
  portfolioActivities?: Array<{ title?: string; description?: string; type?: string }>;
  volunteerTitles?: string[];
};

const SKILL_PATTERNS: Array<{ skill: string; patterns: RegExp[] }> = [
  { skill: "Python", patterns: [/python/i, /بايثون/] },
  { skill: "JavaScript", patterns: [/javascript/i, /js\b/i] },
  { skill: "Problem Solving", patterns: [/problem.?solv/i, /حل.?المشكلات/i, /olympiad/i, /أولمبياد/i, /bebras/i, /كنجارو/i] },
  { skill: "Research", patterns: [/research/i, /بحث/i, /science/i, /علوم/i, /mawhiba/i, /موهبة/i] },
  { skill: "Leadership", patterns: [/lead/i, /قيادة/i, /president/i, /رئيس/i, /captain/i, /قائد/i] },
  { skill: "Public Speaking", patterns: [/speak/i, /خطاب/i, /debate/i, /مناظر/i, /presentation/i, /عرض/i] },
  { skill: "Teamwork", patterns: [/team/i, /فريق/i, /collaborat/i, /تعاون/i] },
  { skill: "Mathematics", patterns: [/math/i, /رياض/i, /kangaroo/i, /كنجارو/i] },
  { skill: "Digital Literacy", patterns: [/digital/i, /رقمي/i, /coding/i, /برمج/i, /robot/i, /روبوت/i] },
  { skill: "Communication", patterns: [/communicat/i, /تواصل/i, /writing/i, /كتابة/i] },
  { skill: "Project Management", patterns: [/project/i, /مشروع/i, /initiative/i, /مبادرة/i] },
  { skill: "Data Analysis", patterns: [/data/i, /بيانات/i, /analy/i, /تحليل/i, /excel/i] },
];

const collectText = (input: SkillExtractionInput): string => {
  const parts: string[] = [];
  for (const row of input.achievementRecords) {
    parts.push(
      row.canonicalActivityKey,
      row.activityLabelAr,
      row.activityLabelEn,
      row.achievementType,
      row.achievementClassification,
      row.olympiadField || ""
    );
  }
  if (input.trainingTasks) parts.push(String(input.trainingTasks));
  if (input.trainingReflection) parts.push(String(input.trainingReflection));
  if (input.portfolioTechnicalSkills) parts.push(...input.portfolioTechnicalSkills);
  if (input.portfolioPersonalSkills) parts.push(...input.portfolioPersonalSkills);
  for (const act of input.portfolioActivities || []) {
    parts.push(act.title || "", act.description || "", act.type || "");
  }
  if (input.volunteerTitles) parts.push(...input.volunteerTitles);
  return parts.join(" ").toLowerCase();
};

export const extractCareerSkills = (input: SkillExtractionInput): string[] => {
  const corpus = collectText(input);
  const found = new Set<string>();

  for (const row of SKILL_PATTERNS) {
    if (row.patterns.some((p) => p.test(corpus))) {
      found.add(row.skill);
    }
  }

  for (const skill of [...(input.portfolioTechnicalSkills || []), ...(input.portfolioPersonalSkills || [])]) {
    const trimmed = String(skill || "").trim();
    if (trimmed) found.add(trimmed);
  }

  return [...found].slice(0, 30);
};
