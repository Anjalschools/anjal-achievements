import mongoose from "mongoose";
import TrainingOpportunity from "@/models/TrainingOpportunity";
import type { StudentTrainingApplicationStatus } from "@/lib/partnerships/partnerships-constants";
import { ADMINISTRATIVELY_CANCELLED_STATUS } from "@/lib/partnerships/partnerships-admin-cancel-constants";

export type PartnershipApplicationsListFilters = {
  status?: string;
  organizationId?: string;
  opportunityId?: string;
  grade?: string;
  gender?: string;
  academicYear?: string;
};

export const buildPartnershipApplicationsMongoFilter = async (
  filters: PartnershipApplicationsListFilters
): Promise<Record<string, unknown>> => {
  const query: Record<string, unknown> = {};

  if (filters.status === ADMINISTRATIVELY_CANCELLED_STATUS) {
    query.status = ADMINISTRATIVELY_CANCELLED_STATUS;
  } else if (filters.status && filters.status !== "all") {
    query.status = filters.status;
  } else {
    query.status = { $ne: ADMINISTRATIVELY_CANCELLED_STATUS };
  }

  if (filters.academicYear) {
    query.academicYear = filters.academicYear;
  }

  if (filters.grade) {
    query["studentSnapshot.grade"] = filters.grade;
  }

  if (filters.gender) {
    query["studentSnapshot.gender"] = filters.gender;
  }

  if (filters.opportunityId && mongoose.Types.ObjectId.isValid(filters.opportunityId)) {
    query.opportunityId = new mongoose.Types.ObjectId(filters.opportunityId);
  } else if (filters.organizationId && mongoose.Types.ObjectId.isValid(filters.organizationId)) {
    const opportunityIds = await TrainingOpportunity.find({
      organizationId: new mongoose.Types.ObjectId(filters.organizationId),
    })
      .select("_id")
      .lean();
    query.opportunityId = { $in: opportunityIds.map((row) => row._id) };
  }

  return query;
};

export type PartnershipApplicationsDashboard = {
  total: number;
  underReview: number;
  institutionReview: number;
  accepted: number;
  rejected: number;
};

export const computePartnershipApplicationsDashboard = (
  rows: Array<{ status?: string }>
): PartnershipApplicationsDashboard => {
  let underReview = 0;
  let institutionReview = 0;
  let accepted = 0;
  let rejected = 0;

  for (const row of rows) {
    const status = String(row.status || "");
    if (["submitted", "under_review", "interview_requested"].includes(status)) underReview += 1;
    if (status === "institution_review") institutionReview += 1;
    if (status === "accepted") accepted += 1;
    if (status === "rejected") rejected += 1;
  }

  return {
    total: rows.length,
    underReview,
    institutionReview,
    accepted,
    rejected,
  };
};

export const isPartnershipApplicationStatus = (
  value: string
): value is StudentTrainingApplicationStatus =>
  [
    "submitted",
    "under_review",
    "interview_requested",
    "institution_review",
    "accepted",
    "rejected",
    "withdrawn",
    "completed",
    "awaiting_final_evaluation_review",
    "final_evaluation_approved",
    "final_evaluation_rejected",
    ADMINISTRATIVELY_CANCELLED_STATUS,
  ].includes(value);
