import { PARTNER_ORGANIZATION_CATEGORY_LABELS } from "@/lib/partnerships/institution-analytics-constants";

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const normalize = (value?: string | null) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenize = (value?: string | null) => {
  const text = normalize(value);
  return text ? text.split(" ").filter((token) => token.length > 1) : [];
};

const overlapScore = (left: string[], right: string[]) => {
  if (!left.length || !right.length) return 0;
  const rightSet = new Set(right);
  let hits = 0;
  for (const token of left) {
    if (rightSet.has(token)) hits += 1;
  }
  return clamp((hits / Math.max(left.length, 1)) * 100);
};

export type StudentMatchProfile = {
  careerInterests: string[];
  targetMajors: string[];
  achievementCategories: string[];
  priorTrainingCategories: string[];
  grade?: string;
  section?: string;
};

export type OpportunityMatchTarget = {
  opportunityId: string;
  title: string;
  description?: string;
  organizationId: string;
  organizationName: string;
  organizationCategory?: string;
  organizationSector?: string;
  organizationCity?: string;
  qualityIndex?: number;
  reliabilityIndex?: number;
};

export type TrainingOpportunityMatchResult = {
  opportunityId: string;
  organizationId: string;
  organizationName: string;
  trainingOpportunityMatchScore: number;
  reasonAr: string;
  reasonEn: string;
};

export const computeTrainingOpportunityMatchScore = (
  student: StudentMatchProfile,
  opportunity: OpportunityMatchTarget
): TrainingOpportunityMatchResult => {
  const interestTokens = [
    ...student.careerInterests,
    ...student.targetMajors,
    student.grade || "",
    student.section || "",
  ].flatMap(tokenize);

  const opportunityTokens = tokenize(
    [
      opportunity.title,
      opportunity.description,
      opportunity.organizationName,
      opportunity.organizationSector,
      opportunity.organizationCity,
      opportunity.organizationCategory
        ? PARTNER_ORGANIZATION_CATEGORY_LABELS[
            opportunity.organizationCategory as keyof typeof PARTNER_ORGANIZATION_CATEGORY_LABELS
          ]?.ar
        : "",
      opportunity.organizationCategory
        ? PARTNER_ORGANIZATION_CATEGORY_LABELS[
            opportunity.organizationCategory as keyof typeof PARTNER_ORGANIZATION_CATEGORY_LABELS
          ]?.en
        : "",
    ].join(" ")
  );

  const interestScore = overlapScore(interestTokens, opportunityTokens);
  const achievementScore = overlapScore(
    student.achievementCategories.flatMap(tokenize),
    opportunityTokens
  );
  const pathwayScore = overlapScore(tokenize(student.targetMajors.join(" ")), opportunityTokens);
  const priorTrainingScore = student.priorTrainingCategories.includes(
    String(opportunity.organizationCategory || "")
  )
    ? 85
    : overlapScore(student.priorTrainingCategories.flatMap(tokenize), opportunityTokens);

  const partnerBoost = clamp(
    ((opportunity.qualityIndex ?? 50) * 0.55 + (opportunity.reliabilityIndex ?? 50) * 0.45) * 0.15
  );

  const trainingOpportunityMatchScore = clamp(
    interestScore * 0.35 +
      achievementScore * 0.25 +
      priorTrainingScore * 0.15 +
      pathwayScore * 0.1 +
      partnerBoost +
      15
  );

  const topInterest = student.careerInterests[0] || student.targetMajors[0] || "";
  const reasonAr = topInterest
    ? `لأنك مهتم بـ${topInterest} و${opportunity.organizationName} تتوافق مع مسارك.`
    : `لأن ${opportunity.organizationName} تتوافق مع ملفك الأكاديمي.`;
  const reasonEn = topInterest
    ? `Because you are interested in ${topInterest} and ${opportunity.organizationName} aligns with your pathway.`
    : `${opportunity.organizationName} aligns with your academic profile.`;

  if (student.priorTrainingCategories.length > 0 && priorTrainingScore >= 70) {
    return {
      opportunityId: opportunity.opportunityId,
      organizationId: opportunity.organizationId,
      organizationName: opportunity.organizationName,
      trainingOpportunityMatchScore,
      reasonAr: `لأن طلاب مسارك حققوا نتائج مرتفعة في جهات مشابهة — ${opportunity.organizationName}.`,
      reasonEn: `Because students on a similar pathway achieved strong outcomes at comparable partners such as ${opportunity.organizationName}.`,
    };
  }

  return {
    opportunityId: opportunity.opportunityId,
    organizationId: opportunity.organizationId,
    organizationName: opportunity.organizationName,
    trainingOpportunityMatchScore,
    reasonAr,
    reasonEn,
  };
};

export const rankOpportunityMatches = (
  student: StudentMatchProfile,
  opportunities: OpportunityMatchTarget[]
) =>
  opportunities
    .map((opportunity) => computeTrainingOpportunityMatchScore(student, opportunity))
    .sort((a, b) => b.trainingOpportunityMatchScore - a.trainingOpportunityMatchScore);
