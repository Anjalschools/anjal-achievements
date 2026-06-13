import crypto from "crypto";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import PartnerAccessToken from "@/models/PartnerAccessToken";
import PartnerOrganization from "@/models/PartnerOrganization";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingOpportunity from "@/models/TrainingOpportunity";
import { buildStudentAchievementSummary } from "@/lib/partnerships/build-student-achievement-summary";
import { executeInstitutionReviewDecision } from "@/lib/partnerships/institution-portal-service";
import { getPartnershipStudentPortfolioAccess } from "@/lib/partnerships/partnerships-portfolio-access";
import { getPartnershipProgramSettings } from "@/lib/partnerships/partnerships-settings-service";

export const generatePartnerAccessTokenValue = (): string =>
  crypto.randomBytes(32).toString("base64url");

export const validatePartnerAccessToken = async (token: string) => {
  await connectDB();
  const row = await PartnerAccessToken.findOne({ token: String(token || "").trim(), active: true }).lean();
  if (!row) return null;
  if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) return null;
  const organization = await PartnerOrganization.findById(row.organizationId).lean();
  if (!organization || organization.active === false) return null;
  return { token: row, organization };
};

export const buildPartnerAccessPayload = async (token: string) => {
  const gate = await validatePartnerAccessToken(token);
  if (!gate) return null;

  const opportunities = await TrainingOpportunity.find({
    organizationId: gate.token.organizationId,
    active: { $ne: false },
  })
    .sort({ createdAt: -1 })
    .lean();

  const opportunityIds = opportunities.map((row) => row._id);
  const applications = await StudentTrainingApplication.find({
    opportunityId: { $in: opportunityIds },
    $or: [{ status: "institution_review" }, { institutionStatus: { $exists: true } }],
  })
    .sort({ submittedAt: -1 })
    .lean();

  const settings = await getPartnershipProgramSettings();
  const grouped = await Promise.all(
    opportunities.map(async (opportunity) => {
      const rows = applications.filter((app) => String(app.opportunityId) === String(opportunity._id));
      const candidates = await Promise.all(
        rows.map(async (app) => {
          const [summary, portfolio] = await Promise.all([
            buildStudentAchievementSummary(String(app.studentId), "ar"),
            settings.showPortfolioToInstitutions
              ? getPartnershipStudentPortfolioAccess(String(app.studentId))
              : Promise.resolve({ enabled: false, url: null, slug: null, publishedAt: null }),
          ]);
          return {
            applicationId: String(app._id),
            institutionStatus: app.institutionStatus || "institution_pending",
            student: {
              fullName: app.studentSnapshot?.fullName || "",
              grade: app.studentSnapshot?.grade || "",
              stage: app.studentSnapshot?.stage || "",
              school: app.studentSnapshot?.school || app.studentSnapshot?.schoolType || "",
            },
            excellenceScore: settings.showExcellenceScoreToInstitutions ? summary.excellenceScore : null,
            achievementSummary: settings.showExcellenceScoreToInstitutions ? summary.items : [],
            portfolioUrl: settings.showPortfolioToInstitutions ? portfolio.url : null,
          };
        })
      );
      return {
        opportunityId: String(opportunity._id),
        opportunityTitle: opportunity.title,
        candidateCount: candidates.length,
        candidates,
      };
    })
  );

  return {
    organization: {
      id: String(gate.organization._id),
      name: gate.organization.name,
      city: gate.organization.city || "",
      sector: gate.organization.sector || "",
    },
    expiresAt: gate.token.expiresAt ? new Date(gate.token.expiresAt).toISOString() : null,
    opportunities: grouped.filter((row) => row.candidateCount > 0),
    totalCandidates: applications.length,
  };
};

const mapTokenDecisionToAction = (
  decision: string
): "accept" | "reject" | "interview" | null => {
  if (decision === "institution_accepted") return "accept";
  if (decision === "institution_rejected") return "reject";
  if (decision === "institution_interview") return "interview";
  return null;
};

export const submitInstitutionDecision = async (input: {
  token: string;
  applicationId: string;
  decision: string;
  notes?: string;
}) => {
  const gate = await validatePartnerAccessToken(input.token);
  if (!gate) throw new Error("Invalid or expired access token");

  const action = mapTokenDecisionToAction(input.decision);
  if (!action) {
    throw new Error("Invalid decision");
  }

  const result = await executeInstitutionReviewDecision({
    applicationId: input.applicationId,
    organizationId: String(gate.token.organizationId),
    action,
    notes: input.notes,
    rejectionReason: input.notes,
    actorName: gate.organization.name,
    request: undefined,
  });

  if (!result.ok) {
    throw new Error(result.error);
  }

  return {
    applicationId: input.applicationId,
    decision: input.decision,
    reviewedAt: new Date().toISOString(),
  };
};

export const createPartnerAccessToken = async (input: {
  organizationId: string;
  createdBy: mongoose.Types.ObjectId;
  expiresInDays?: number;
}) => {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(input.organizationId)) throw new Error("Invalid organization id");

  const organization = await PartnerOrganization.findById(input.organizationId).lean();
  if (!organization) throw new Error("Organization not found");

  const days = Math.min(Math.max(input.expiresInDays ?? 30, 1), 180);
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const token = generatePartnerAccessTokenValue();

  const created = await PartnerAccessToken.create({
    organizationId: input.organizationId,
    token,
    expiresAt,
    active: true,
    createdBy: input.createdBy,
  });

  return {
    id: String(created._id),
    token: created.token,
    expiresAt: expiresAt.toISOString(),
    accessPath: `/partner-access/${created.token}`,
    organizationId: String(created.organizationId),
    organizationName: organization.name,
  };
};
