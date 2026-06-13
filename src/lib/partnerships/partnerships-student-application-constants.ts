import type { StudentTrainingApplicationStatus } from "@/lib/partnerships/partnerships-constants";

/** Student may edit notes/message while application is in these statuses. */
export const STUDENT_EDITABLE_APPLICATION_STATUSES: StudentTrainingApplicationStatus[] = [
  "submitted",
  "under_review",
  "interview_requested",
];

export const STUDENT_WITHDRAWABLE_STATUSES: StudentTrainingApplicationStatus[] = [
  "submitted",
  "under_review",
  "interview_requested",
];

export const STUDENT_INQUIRY_TYPES = [
  "general_inquiry",
  "opportunity_inquiry",
  "application_inquiry",
  "interview_inquiry",
  "acceptance_inquiry",
] as const;

export type StudentInquiryType = (typeof STUDENT_INQUIRY_TYPES)[number];
