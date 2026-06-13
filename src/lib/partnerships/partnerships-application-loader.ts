import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import PartnerOrganization from "@/models/PartnerOrganization";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingOpportunity from "@/models/TrainingOpportunity";
import { buildStudentAchievementSummary } from "@/lib/partnerships/build-student-achievement-summary";
import { serializeTrainingApplication } from "@/lib/partnerships/partnerships-application-serialize";
import { getPartnershipStudentPortfolioAccess } from "@/lib/partnerships/partnerships-portfolio-access";

export const loadPartnershipApplicationDetail = async (
  applicationId: string,
  options?: { includeReviewContext?: boolean; locale?: "ar" | "en" }
) => {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(applicationId)) return null;

  const row = await StudentTrainingApplication.findById(applicationId).lean();
  if (!row) return null;

  const opportunity = await TrainingOpportunity.findById(row.opportunityId).lean();
  const organization = opportunity
    ? await PartnerOrganization.findById(opportunity.organizationId).lean()
    : null;

  let achievementSummary;
  let publicPortfolio;
  if (options?.includeReviewContext) {
    const locale = options.locale || "ar";
    [achievementSummary, publicPortfolio] = await Promise.all([
      buildStudentAchievementSummary(String(row.studentId), locale),
      getPartnershipStudentPortfolioAccess(String(row.studentId)),
    ]);
  }

  return await serializeTrainingApplication(row, {
    opportunityTitle: opportunity?.title || "",
    organizationName: organization?.name || "",
    organizationId: opportunity ? String(opportunity.organizationId) : "",
    achievementSummary,
    publicPortfolio,
  });
};
