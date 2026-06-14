import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import PartnerOrganization from "@/models/PartnerOrganization";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingOpportunity from "@/models/TrainingOpportunity";
import { ACTIVE_TRAINING_APPLICATION_STATUSES } from "@/lib/partnerships/partnerships-constants";
import { requireSession } from "@/lib/auth-guard";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import {
  evaluateApplicationEligibility,
  matchesStudentProfile,
  resolveRegistrationStatus,
} from "@/lib/partnerships/partnerships-eligibility";
import { serializeTrainingOpportunity } from "@/lib/partnerships/partnerships-serialize";
import { loadStudentApplicationForOpportunity } from "@/lib/partnerships/partnerships-student-application-service";
import { loadStudentOpportunityCommunication } from "@/lib/partnerships/partnerships-student-communication-context";
import {
  resolveStudentInstitutionContactView,
} from "@/lib/partnerships/institution-contact-access-service";
import { stripOrganizationContactForStudent } from "@/lib/partnerships/institution-contact-access-constants";
import { getOpportunityQuotaStats } from "@/lib/partnerships/partnerships-quotas";
import {
  createFallbackStudentTrainingDashboardContext,
  getStudentApplicationForOpportunity,
  loadStudentTrainingDashboardContext,
} from "@/lib/partnerships/partnerships-student-dashboard-context";
import { trainingApplicationBlocksReapply } from "@/lib/partnerships/partnerships-application-status-ui";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const buildApplyMeta = async (
  opportunity: {
    _id: unknown;
    visible: boolean;
    active: boolean;
    targetGender: string;
    targetStages: string[];
    targetGrades: string[];
    registrationStart?: Date | null;
    registrationEnd?: Date | null;
  },
  user: { _id?: mongoose.Types.ObjectId; gender?: string; grade?: string; section?: string; role?: string; accountType?: string }
) => {
  const isStudentApplicant =
    String(user.role || "").trim() === "student" &&
    String(user.accountType || "student").trim().toLowerCase() !== "alumni";

  const registrationStatus = resolveRegistrationStatus(opportunity);
  if (!isStudentApplicant || !user._id) {
    return { registrationStatus, canApply: false, applyCode: "not_student" };
  }

  const activeApplication = await StudentTrainingApplication.findOne({
    studentId: user._id,
    status: { $in: [...ACTIVE_TRAINING_APPLICATION_STATUSES] },
  })
    .select("_id opportunityId status")
    .lean();

  const eligibility = evaluateApplicationEligibility(
    {
      visible: opportunity.visible === true,
      active: opportunity.active !== false,
      targetGender: opportunity.targetGender,
      targetStages: opportunity.targetStages || [],
      targetGrades: opportunity.targetGrades || [],
      registrationStart: opportunity.registrationStart,
      registrationEnd: opportunity.registrationEnd,
    },
    {
      gender: user.gender,
      grade: user.grade,
      section: user.section,
    },
    Boolean(activeApplication && String(activeApplication.opportunityId) !== String(opportunity._id))
  );

  const existingForOpportunity = await StudentTrainingApplication.findOne({
    studentId: user._id,
    opportunityId: new mongoose.Types.ObjectId(String(opportunity._id)),
    archived: { $ne: true },
  })
    .select("status")
    .sort({ submittedAt: -1, createdAt: -1 })
    .lean();

  const existingStatus = existingForOpportunity?.status ? String(existingForOpportunity.status) : null;
  const blocksReapply = existingStatus != null && trainingApplicationBlocksReapply(existingStatus);
  const quota = await getOpportunityQuotaStats(String(opportunity._id));
  const seatsFull = quota?.isFull === true;

  return {
    registrationStatus,
    canApply: eligibility.ok && !blocksReapply && !seatsFull,
    seatsFull,
    quota: quota
      ? {
          seats: quota.seats,
          remainingSeats: quota.remainingSeats,
          acceptedCount: quota.acceptedCount,
          candidateCount: quota.candidateCount,
          isFull: quota.isFull,
        }
      : null,
    applyCode: seatsFull
      ? "seats_full"
      : blocksReapply
        ? "existing_application"
        : eligibility.ok
          ? null
          : eligibility.code,
    applyMessageAr: blocksReapply
      ? null
      : eligibility.ok
        ? null
        : eligibility.messageAr,
    applyMessageEn: blocksReapply
      ? null
      : eligibility.ok
        ? null
        : eligibility.messageEn,
    existingApplicationStatus: existingStatus,
  };
};

export async function GET(request: NextRequest) {
  const gate = await requireSession(request);
  if (!gate.ok) return gate.response;

  try {
    await connectDB();
    const id = new URL(request.url).searchParams.get("id")?.trim();

    if (id) {
      const row = await TrainingOpportunity.findOne({ _id: id, visible: true, active: true }).lean();
      if (!row || !matchesStudentProfile(row, gate.user)) {
        return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
      }
      const organization = await PartnerOrganization.findById(row.organizationId).lean();
      const applyMeta = await buildApplyMeta(row, gate.user);
      let trainingContext = createFallbackStudentTrainingDashboardContext();
      try {
        trainingContext = await loadStudentTrainingDashboardContext(gate.user._id);
      } catch (contextError) {
        console.error("[GET /api/partnerships/student-opportunities] training context", contextError);
      }
      const [application, communication] = await Promise.all([
        loadStudentApplicationForOpportunity(gate.user._id, id),
        loadStudentOpportunityCommunication({
          studentId: gate.user._id,
          opportunityId: id,
          locale: "ar",
        }),
      ]);
      const studentApplication = getStudentApplicationForOpportunity(trainingContext, id);
      const certificate =
        trainingContext.certificates.find((row) => row.opportunityId === id) || null;

      const serialized = serializeTrainingOpportunity(row, organization);
      let institutionContact = null;
      if (application?.id) {
        institutionContact = await resolveStudentInstitutionContactView(application.id, String(gate.user._id));
      }
      const safeOrganization = stripOrganizationContactForStudent(
        serialized.organization,
        institutionContact
      );

      return NextResponse.json({
        ok: true,
        item: {
          ...serialized,
          organization: safeOrganization,
          institutionContact,
          ...applyMeta,
          studentApplication,
          application,
          communication,
          certificate,
        },
      });
    }

    const rows = await TrainingOpportunity.find({ visible: true, active: true })
      .sort({ registrationEnd: -1, createdAt: -1 })
      .lean();

    const filtered = rows.filter((row) => matchesStudentProfile(row, gate.user));
    const orgIds = [...new Set(filtered.map((row) => String(row.organizationId)))];
    const orgs = await PartnerOrganization.find({ _id: { $in: orgIds }, active: true }).lean();
    const orgMap = new Map(orgs.map((org) => [String(org._id), org]));

    const isStudentApplicant =
      String(gate.user.role || "").trim() === "student" &&
      String(gate.user.accountType || "student").trim().toLowerCase() !== "alumni";

    const trainingContext = isStudentApplicant
      ? await loadStudentTrainingDashboardContext(gate.user._id).catch((contextError) => {
          console.error("[GET /api/partnerships/student-opportunities] training context", contextError);
          return createFallbackStudentTrainingDashboardContext();
        })
      : null;

    const activeApplication = await StudentTrainingApplication.findOne({
      studentId: gate.user._id,
      status: { $in: [...ACTIVE_TRAINING_APPLICATION_STATUSES] },
    })
      .select("opportunityId status")
      .lean();

    const items = await Promise.all(
      filtered
        .filter((row) => orgMap.has(String(row.organizationId)))
        .map(async (row) => {
          const oppId = String(row._id);
          const studentApplication = trainingContext
            ? getStudentApplicationForOpportunity(trainingContext, oppId)
            : null;
          const eligibility = evaluateApplicationEligibility(
            {
              visible: row.visible === true,
              active: row.active !== false,
              targetGender: row.targetGender,
              targetStages: row.targetStages || [],
              targetGrades: row.targetGrades || [],
              registrationStart: row.registrationStart,
              registrationEnd: row.registrationEnd,
            },
            {
              gender: gate.user.gender,
              grade: gate.user.grade,
              section: gate.user.section,
            },
            Boolean(activeApplication && String(activeApplication.opportunityId) !== oppId)
          );
          const quota = await getOpportunityQuotaStats(oppId);
          const seatsFull = quota?.isFull === true;
          const blocksReapply = Boolean(studentApplication?.blocksReapply);
          return {
            ...serializeTrainingOpportunity(row, orgMap.get(String(row.organizationId)) || null),
            registrationStatus: resolveRegistrationStatus(row),
            canApply: eligibility.ok && !seatsFull && !blocksReapply,
            applyCode: blocksReapply
              ? "existing_application"
              : seatsFull
                ? "seats_full"
                : eligibility.ok
                  ? null
                  : eligibility.code,
            seatsFull,
            existingApplicationStatus: studentApplication?.status || null,
            studentApplication,
            quota: quota
              ? {
                  seats: quota.seats,
                  remainingSeats: quota.remainingSeats,
                  acceptedCount: quota.acceptedCount,
                  candidateCount: quota.candidateCount,
                  isFull: quota.isFull,
                }
              : null,
          };
        })
    );

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    console.error("[GET /api/partnerships/student-opportunities]", error);
    return jsonInternalServerError(error);
  }
}
