import {
  TRAINING_CONSISTENCY_LOW_THRESHOLD,
  TRAINING_HOURS_MAX,
  TRAINING_HOURS_MIN,
  TRAINING_HOURS_MISMATCH_TOLERANCE_PCT,
  TRAINING_NARRATIVE_SIMILARITY_THRESHOLD,
  TRAINING_RATING_MISMATCH_DELTA,
  type TrainingIntelligenceRiskFlag,
} from "@/lib/partnerships/training-intelligence-constants";

export type TrainingReportConsistencyInput = {
  volunteerHours?: number | null;
  positionTitle?: string;
  practicalBenefitRating?: number | null;
  supervisorCooperationRating?: number | null;
  workEnvironmentRating?: number | null;
  recommendInstitutionToPeers?: boolean | null;
  studentBenefitRating?: number | null;
  assignedTasks?: string;
  studentReflection?: string;
  biggestChallenge?: string;
  challengeResponse?: string;
  wishedToLearn?: string;
  futureImpact?: string;
  overallRecommendation?: number | null;
  attendanceCommitment?: number | null;
  professionalEthics?: number | null;
  institutionUploadedEvaluation?: Record<string, unknown> | null;
  institutionNotes?: string;
  institutionReportExtraction?: Record<string, unknown> | null;
};

export type TrainingConsistencyFieldComparison = {
  field: string;
  labelAr: string;
  labelEn: string;
  studentValue: string | number | boolean | null;
  institutionValue: string | number | boolean | null;
  alignmentScore: number;
  mismatch: boolean;
};

export type TrainingNarrativeSimilarity = {
  pairKey: string;
  labelAr: string;
  labelEn: string;
  similarityPct: number;
  highSimilarity: boolean;
};

export type TrainingReportConsistencyResult = {
  consistencyScore: number;
  riskFlags: TrainingIntelligenceRiskFlag[];
  warnings: string[];
  fieldComparisons: TrainingConsistencyFieldComparison[];
  narrativeSimilarity: TrainingNarrativeSimilarity[];
  maxNarrativeSimilarityPct: number;
};

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(value)));

const normalizeText = (value?: string | null) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenize = (value?: string | null) => {
  const normalized = normalizeText(value);
  if (!normalized) return [];
  return normalized.split(" ").filter((token) => token.length > 1);
};

export const computeTextSimilarityPct = (left?: string | null, right?: string | null): number => {
  const a = new Set(tokenize(left));
  const b = new Set(tokenize(right));
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union > 0 ? clamp((intersection / union) * 100) : 0;
};

const ratingAlignmentScore = (student?: number | null, institution?: number | null) => {
  if (typeof student !== "number" || typeof institution !== "number") return null;
  const delta = Math.abs(student - institution);
  return clamp(100 - delta * 25);
};

const boolAlignmentScore = (student?: boolean | null, institutionPositive?: boolean | null) => {
  if (typeof student !== "boolean" || typeof institutionPositive !== "boolean") return null;
  return student === institutionPositive ? 100 : 35;
};

const titleAlignmentScore = (student?: string, institution?: string) => {
  const a = normalizeText(student);
  const b = normalizeText(institution);
  if (!a || !b) return null;
  if (a === b) return 100;
  if (a.includes(b) || b.includes(a)) return 85;
  return computeTextSimilarityPct(a, b);
};

const uploadedNumber = (uploaded: Record<string, unknown> | null | undefined, key: string) => {
  const value = uploaded?.[key];
  return typeof value === "number" ? value : null;
};

const avgNumbers = (values: Array<number | null | undefined>) => {
  const valid = values.filter((value): value is number => typeof value === "number");
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
};

const institutionRecommendationPositive = (input: TrainingReportConsistencyInput) => {
  if (typeof input.overallRecommendation === "number") {
    return input.overallRecommendation >= 4;
  }
  const uploaded = input.institutionUploadedEvaluation;
  const recommendation = String(uploaded?.recommendation || "").toLowerCase();
  if (!recommendation) return null;
  return recommendation.includes("recommended") || recommendation.includes("موصى");
};

const institutionPracticalRating = (uploaded: Record<string, unknown> | null | undefined) =>
  avgNumbers([
    uploadedNumber(uploaded, "technicalSkillsRating"),
    uploadedNumber(uploaded, "taskExecutionRating"),
    uploadedNumber(uploaded, "problemSolvingRating"),
  ]);

const institutionSupervisorRating = (uploaded: Record<string, unknown> | null | undefined) =>
  avgNumbers([
    uploadedNumber(uploaded, "communicationRating"),
    uploadedNumber(uploaded, "disciplineRating"),
  ]);

const institutionEnvironmentRating = (uploaded: Record<string, unknown> | null | undefined) =>
  avgNumbers([
    uploadedNumber(uploaded, "teamworkRating"),
    uploadedNumber(uploaded, "initiativeRating"),
  ]);

const extractHoursFromText = (text?: string | null): number | null => {
  const flat = String(text || "");
  const match =
    flat.match(/(\d{2,3})\s*(?:ساعة|ساعات|hour|hours)/i) ||
    flat.match(/(?:ساعات|hours)\s*[:：]?\s*(\d{2,3})/i);
  if (!match) return null;
  const hours = Number(match[1]);
  return Number.isFinite(hours) ? hours : null;
};

export const analyzeTrainingReportConsistency = (
  input: TrainingReportConsistencyInput
): TrainingReportConsistencyResult => {
  const uploaded = input.institutionUploadedEvaluation || null;
  const riskFlags: TrainingIntelligenceRiskFlag[] = [];
  const warnings: string[] = [];
  const fieldComparisons: TrainingConsistencyFieldComparison[] = [];

  const institutionTitle = String(uploaded?.positionTitle || "").trim() || null;

  const comparisons: Array<Omit<TrainingConsistencyFieldComparison, "mismatch">> = [
    {
      field: "trainingHours",
      labelAr: "ساعات التدريب",
      labelEn: "Training hours",
      studentValue: input.volunteerHours ?? null,
      institutionValue: extractHoursFromText(
        [String(uploaded?.assignedTasks || ""), input.institutionNotes || ""].join(" ")
      ),
      alignmentScore: 100,
    },
    {
      field: "recommendation",
      labelAr: "التوصية",
      labelEn: "Recommendation",
      studentValue: input.recommendInstitutionToPeers ?? null,
      institutionValue: institutionRecommendationPositive(input),
      alignmentScore: 100,
    },
    {
      field: "practicalBenefit",
      labelAr: "الاستفادة العملية",
      labelEn: "Practical benefit",
      studentValue: input.practicalBenefitRating ?? null,
      institutionValue: institutionPracticalRating(uploaded),
      alignmentScore: 100,
    },
    {
      field: "supervisorCooperation",
      labelAr: "تعاون المشرف",
      labelEn: "Supervisor cooperation",
      studentValue: input.supervisorCooperationRating ?? null,
      institutionValue: institutionSupervisorRating(uploaded),
      alignmentScore: 100,
    },
    {
      field: "workEnvironment",
      labelAr: "بيئة العمل",
      labelEn: "Work environment",
      studentValue: input.workEnvironmentRating ?? null,
      institutionValue: institutionEnvironmentRating(uploaded),
      alignmentScore: 100,
    },
    {
      field: "roleTitle",
      labelAr: "المسمى الوظيفي",
      labelEn: "Role title",
      studentValue: input.positionTitle || null,
      institutionValue: institutionTitle,
      alignmentScore: 100,
    },
  ];

  for (const row of comparisons) {
    let alignmentScore = row.alignmentScore;
    if (row.field === "trainingHours") {
      const studentHours = typeof row.studentValue === "number" ? row.studentValue : null;
      const institutionHours = typeof row.institutionValue === "number" ? row.institutionValue : null;
      if (studentHours != null && (studentHours < TRAINING_HOURS_MIN || studentHours > TRAINING_HOURS_MAX)) {
        riskFlags.push("UNUSUAL_HOURS");
        warnings.push(`ساعات التدريب المُبلَّغة (${studentHours}) غير اعتيادية.`);
      }
      if (studentHours != null && institutionHours != null) {
        const deltaPct = Math.abs(studentHours - institutionHours) / Math.max(studentHours, 1);
        alignmentScore = deltaPct * 100 <= TRAINING_HOURS_MISMATCH_TOLERANCE_PCT ? 100 : clamp(100 - deltaPct * 100);
        if (alignmentScore < 70) {
          riskFlags.push("HOURS_MISMATCH");
          warnings.push(`تعارض في ساعات التدريب: الطالب ${studentHours} — المؤسسة ${institutionHours}.`);
        }
      } else {
        alignmentScore = studentHours != null ? 80 : 50;
      }
    } else if (row.field === "recommendation") {
      const score = boolAlignmentScore(
        typeof row.studentValue === "boolean" ? row.studentValue : null,
        typeof row.institutionValue === "boolean" ? row.institutionValue : null
      );
      alignmentScore = score ?? 50;
    } else if (row.field === "roleTitle") {
      alignmentScore =
        titleAlignmentScore(String(row.studentValue || ""), String(row.institutionValue || "")) ?? 50;
    } else {
      const score = ratingAlignmentScore(
        typeof row.studentValue === "number" ? row.studentValue : null,
        typeof row.institutionValue === "number" ? row.institutionValue : null
      );
      alignmentScore = score ?? 50;
      if (
        typeof row.studentValue === "number" &&
        typeof row.institutionValue === "number" &&
        Math.abs(row.studentValue - row.institutionValue) >= TRAINING_RATING_MISMATCH_DELTA
      ) {
        riskFlags.push("RATING_MISMATCH");
        warnings.push(
          `${row.labelAr}: الطالب ${row.studentValue}/5 — المؤسسة ${Math.round(row.institutionValue * 10) / 10}/5.`
        );
      }
    }

    fieldComparisons.push({
      ...row,
      alignmentScore,
      mismatch: alignmentScore < 70,
    });
  }

  const scored = fieldComparisons.filter((row) => row.alignmentScore > 0);
  const consistencyScore =
    scored.length > 0
      ? clamp(scored.reduce((sum, row) => sum + row.alignmentScore, 0) / scored.length)
      : 0;

  if (consistencyScore < TRAINING_CONSISTENCY_LOW_THRESHOLD) {
    riskFlags.push("LOW_CONSISTENCY");
    warnings.push(`درجة الاتساق ${consistencyScore}% — يلزم مراجعة التقريرين معاً.`);
  }

  const studentNarrative = [
    input.assignedTasks,
    input.studentReflection,
    input.biggestChallenge,
    input.challengeResponse,
    input.wishedToLearn,
    input.futureImpact,
  ]
    .filter(Boolean)
    .join("\n");

  const institutionNarrative = [
    uploaded?.assignedTasks,
    uploaded?.achievements,
    uploaded?.strengths,
    uploaded?.improvementAreas,
    input.institutionNotes,
  ]
    .map((value) => String(value || ""))
    .filter(Boolean)
    .join("\n");

  const narrativeSimilarity: TrainingNarrativeSimilarity[] = [
    {
      pairKey: "tasks",
      labelAr: "المهام المسندة",
      labelEn: "Assigned tasks",
      similarityPct: computeTextSimilarityPct(input.assignedTasks, String(uploaded?.assignedTasks || "")),
      highSimilarity: false,
    },
    {
      pairKey: "learning_outcomes",
      labelAr: "نواتج التعلم والتأمل",
      labelEn: "Learning outcomes & reflection",
      similarityPct: computeTextSimilarityPct(studentNarrative, institutionNarrative),
      highSimilarity: false,
    },
  ].map((row) => ({
    ...row,
    highSimilarity: row.similarityPct >= TRAINING_NARRATIVE_SIMILARITY_THRESHOLD,
  }));

  const maxNarrativeSimilarityPct = Math.max(...narrativeSimilarity.map((row) => row.similarityPct), 0);
  if (maxNarrativeSimilarityPct >= TRAINING_NARRATIVE_SIMILARITY_THRESHOLD) {
    riskFlags.push("HIGH_TEXT_SIMILARITY");
    warnings.push(`تشابه نصي مرتفع (${maxNarrativeSimilarityPct}%) بين سرد الطالب والمؤسسة.`);
  }

  const mismatchCount = fieldComparisons.filter((row) => row.mismatch).length;
  if (mismatchCount >= 3 || (riskFlags.includes("RATING_MISMATCH") && riskFlags.includes("HOURS_MISMATCH"))) {
    riskFlags.push("INSTITUTION_STUDENT_MISMATCH");
  }

  return {
    consistencyScore,
    riskFlags: [...new Set(riskFlags)],
    warnings: [...new Set(warnings)],
    fieldComparisons,
    narrativeSimilarity,
    maxNarrativeSimilarityPct,
  };
};
