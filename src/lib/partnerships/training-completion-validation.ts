import { isAllowedTrainingVideoUrl, isValidRating } from "@/lib/partnerships/training-completion-constants";

export type TrainingReportSubmitInput = {
  supervisorName?: string;
  trainingStartDate?: string;
  trainingEndDate?: string;
  volunteerHours?: number;
  studentBenefitRating?: number;
  positionTitle?: string;
  assignedTasks?: string;
  studentReflection?: string;
  supervisorCooperationRating?: number;
  practicalBenefitRating?: number;
  workEnvironmentRating?: number;
  recommendInstitutionToPeers?: boolean;
  biggestChallenge?: string;
  challengeResponse?: string;
  wishedToLearn?: string;
  futureImpact?: string;
  videoUrl?: string;
  organizationNameFromApplication?: string;
};

const parseDate = (value?: string) => {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

export const validateTrainingReportSubmitPayload = (input: TrainingReportSubmitInput): string[] => {
  const errors: string[] = [];
  if (!String(input.organizationNameFromApplication || "").trim()) {
    errors.push("organizationName is required");
  }
  if (!String(input.supervisorName || "").trim()) errors.push("supervisorName is required");

  const start = parseDate(input.trainingStartDate);
  const end = parseDate(input.trainingEndDate);
  if (!start) errors.push("trainingStartDate is required");
  if (!end) errors.push("trainingEndDate is required");
  if (start && end && end.getTime() < start.getTime()) {
    errors.push("trainingEndDate must be on or after trainingStartDate");
  }

  if (input.volunteerHours == null || Number(input.volunteerHours) <= 0) {
    errors.push("volunteerHours must be greater than zero");
  }
  if (!isValidRating(input.studentBenefitRating)) errors.push("studentBenefitRating must be 1-5");
  if (!String(input.positionTitle || "").trim()) errors.push("positionTitle is required");
  if (!String(input.assignedTasks || "").trim()) errors.push("assignedTasks is required");
  if (!String(input.studentReflection || "").trim()) errors.push("studentReflection is required");

  if (!isValidRating(input.supervisorCooperationRating)) {
    errors.push("supervisorCooperationRating must be 1-5");
  }
  if (!isValidRating(input.practicalBenefitRating)) {
    errors.push("practicalBenefitRating must be 1-5");
  }
  if (!isValidRating(input.workEnvironmentRating)) {
    errors.push("workEnvironmentRating must be 1-5");
  }
  if (typeof input.recommendInstitutionToPeers !== "boolean") {
    errors.push("recommendInstitutionToPeers is required");
  }

  for (const [field, value] of [
    ["biggestChallenge", input.biggestChallenge],
    ["challengeResponse", input.challengeResponse],
    ["wishedToLearn", input.wishedToLearn],
    ["futureImpact", input.futureImpact],
  ] as const) {
    if (!String(value || "").trim()) errors.push(`${field} is required`);
  }

  if (input.videoUrl && !isAllowedTrainingVideoUrl(input.videoUrl)) {
    errors.push("videoUrl must be YouTube, Vimeo, Google Drive, or OneDrive");
  }

  return errors;
};
