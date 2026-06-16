import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingOpportunity from "@/models/TrainingOpportunity";
import {
  INSTITUTION_ADMIN_CANCELLED_MESSAGE,
  isAdministrativelyCancelledApplication,
} from "@/lib/partnerships/partnerships-admin-cancel-constants";

export type InstitutionApplicationScope = {
  applicationId: string;
  organizationId: string;
  studentId: string;
  opportunityId: string;
  status: string;
};

export const resolveInstitutionApplicationScope = async (
  applicationId: string,
  organizationId: string
): Promise<InstitutionApplicationScope | null> => {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(applicationId) || !mongoose.Types.ObjectId.isValid(organizationId)) {
    return null;
  }

  const application = await StudentTrainingApplication.findById(applicationId).lean();
  if (!application) return null;

  const opportunity = await TrainingOpportunity.findById(application.opportunityId).lean();
  if (!opportunity || String(opportunity.organizationId) !== String(organizationId)) return null;

  return {
    applicationId: String(application._id),
    organizationId,
    studentId: String(application.studentId),
    opportunityId: String(application.opportunityId),
    status: String(application.status || ""),
  };
};

export const assertInstitutionApplicationAccess = async (
  applicationId: string,
  organizationId: string
): Promise<{ ok: true; scope: InstitutionApplicationScope } | { ok: false; error: string; code: string }> => {
  const scope = await resolveInstitutionApplicationScope(applicationId, organizationId);
  if (!scope) {
    return { ok: false, error: "Application not found in institution scope", code: "forbidden" };
  }
  return { ok: true, scope };
};

export const assertInstitutionApplicationMutable = (
  status: string
): { ok: true } | { ok: false; error: string; errorEn: string; code: string } => {
  if (isAdministrativelyCancelledApplication(status)) {
    return {
      ok: false,
      error: INSTITUTION_ADMIN_CANCELLED_MESSAGE.ar,
      errorEn: INSTITUTION_ADMIN_CANCELLED_MESSAGE.en,
      code: "administratively_cancelled",
    };
  }
  return { ok: true };
};

export const assertInstitutionApplicationWritable = async (
  applicationId: string,
  organizationId: string
): Promise<
  | { ok: true; scope: InstitutionApplicationScope }
  | { ok: false; error: string; code: string }
> => {
  const access = await assertInstitutionApplicationAccess(applicationId, organizationId);
  if (!access.ok) return access;
  const mutable = assertInstitutionApplicationMutable(access.scope.status);
  if (!mutable.ok) {
    return { ok: false, error: mutable.error, code: mutable.code };
  }
  return access;
};
