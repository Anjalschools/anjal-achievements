import type { InstitutionReportRatingRowStatus } from "@/lib/partnerships/institution-final-report-constants";

export type InstitutionReportVisionRatingRow = {
  key: string;
  rowStatus: InstitutionReportRatingRowStatus;
  selectedRating?: number;
  confidence?: number;
};

export type InstitutionReportVisionVerification = {
  ratingRows: InstitutionReportVisionRatingRow[];
  stampDetected: boolean;
  stampConfidence: number;
  signatureDetected: boolean;
  signatureConfidence: number;
  visionConfidence: number;
};

export const visionRatingValue = (row: InstitutionReportVisionRatingRow | undefined) =>
  row?.rowStatus === "VALID" ? row.selectedRating : undefined;

export const visionRowIsMultiple = (row: InstitutionReportVisionRatingRow | undefined) =>
  row?.rowStatus === "MULTIPLE";

export const visionRowIsValid = (row: InstitutionReportVisionRatingRow | undefined) =>
  row?.rowStatus === "VALID";
