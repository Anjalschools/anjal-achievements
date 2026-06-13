import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import PartnerOrganization from "@/models/PartnerOrganization";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingOpportunity from "@/models/TrainingOpportunity";
import { actorFromUser, logAuditEvent } from "@/lib/audit-log-service";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { ACTIVE_TRAINING_APPLICATION_STATUSES } from "@/lib/partnerships/partnerships-constants";
import { serializeTrainingApplication } from "@/lib/partnerships/partnerships-application-serialize";
import { requireStudentApplicant } from "@/lib/partnerships/partnerships-auth";
import { evaluateApplicationEligibility } from "@/lib/partnerships/partnerships-eligibility";
import { appendTimelineEvent } from "@/lib/partnerships/partnerships-application-workflow";
import { buildTrainingStudentSnapshot } from "@/lib/partnerships/partnerships-student-snapshot";
import { applyAcademicYearCreateFields } from "@/lib/academic-years/academic-year-integration";
import { getCurrentAcademicYear } from "@/lib/academic-years/current-academic-year";
import {
  getPartnershipProgramSettings,
  isPartnershipArchiveModeActive,
} from "@/lib/partnerships/partnerships-settings-service";
import { computeSlaDueDates } from "@/lib/partnerships/partnerships-sla";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const gate = await requireStudentApplicant();
  if (!gate.ok) return gate.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const opportunityId = String(body.opportunityId || "").trim();
    if (!mongoose.Types.ObjectId.isValid(opportunityId)) {
      return NextResponse.json({ error: "Valid opportunityId is required" }, { status: 400 });
    }

    await connectDB();
    const settings = await getPartnershipProgramSettings();
    const currentYear = await getCurrentAcademicYear();
    const academicYear = currentYear?.name || "—";
    if (currentYear && (await isPartnershipArchiveModeActive(academicYear))) {
      return NextResponse.json(
        { error: "Applications are frozen for this academic year.", code: "archive_mode" },
        { status: 403 }
      );
    }
    const opportunity = await TrainingOpportunity.findById(opportunityId).lean();
    if (!opportunity) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }

    const organization = await PartnerOrganization.findById(opportunity.organizationId).lean();
    if (!organization || organization.active === false) {
      return NextResponse.json({ error: "Partner organization is not available" }, { status: 400 });
    }

    const activeApplication = settings.allowMultipleApplications
      ? null
      : await StudentTrainingApplication.findOne({
          studentId: gate.user._id,
          status: { $in: [...ACTIVE_TRAINING_APPLICATION_STATUSES] },
          archived: { $ne: true },
        }).lean();

    const yearApplicationCount = await StudentTrainingApplication.countDocuments({
      studentId: gate.user._id,
      academicYear,
      archived: { $ne: true },
      status: { $nin: ["withdrawn", "rejected"] },
    });
    if (yearApplicationCount >= settings.maxOpportunitiesPerStudent) {
      return NextResponse.json(
        {
          error: "Maximum applications for this academic year reached.",
          code: "max_opportunities_reached",
          messageAr: "وصلت للحد الأقصى من طلبات التدريب لهذا العام.",
          messageEn: "Maximum applications for this academic year reached.",
        },
        { status: 400 }
      );
    }

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
        gender: gate.user.gender,
        grade: gate.user.grade,
        section: gate.user.section,
      },
      Boolean(activeApplication && String(activeApplication.opportunityId) !== opportunityId)
    );

    if (!eligibility.ok) {
      return NextResponse.json(
        {
          error: eligibility.messageEn,
          code: eligibility.code,
          messageAr: eligibility.messageAr,
          messageEn: eligibility.messageEn,
        },
        { status: 400 }
      );
    }

    const studentSnapshot = buildTrainingStudentSnapshot(gate.user);
    const applicationMessage = String(body.applicationMessage || "").trim().slice(0, 6000) || undefined;
    const studentNotes = String(body.studentNotes || "").trim().slice(0, 4000) || undefined;
    const submittedAt = new Date();
    const sla = computeSlaDueDates({ status: "submitted", submittedAt, settings });
    const actorName = String(gate.user.fullNameAr || gate.user.fullName || gate.user.email || "").trim();

    const yearFields: {
      academicYear: string;
      academicYearId?: mongoose.Types.ObjectId;
      academicYearLabel?: string;
    } = { academicYear };
    try {
      await applyAcademicYearCreateFields(yearFields);
    } catch {
      if (currentYear) {
        yearFields.academicYear = currentYear.name;
        yearFields.academicYearLabel = currentYear.label;
        yearFields.academicYearId = new mongoose.Types.ObjectId(currentYear.id);
      }
    }

    const existingForOpportunity = await StudentTrainingApplication.findOne({
      studentId: gate.user._id,
      opportunityId,
    });

    let saved;
    if (existingForOpportunity) {
      if (ACTIVE_TRAINING_APPLICATION_STATUSES.includes(existingForOpportunity.status as (typeof ACTIVE_TRAINING_APPLICATION_STATUSES)[number])) {
        return NextResponse.json(
          {
            error: "You already have an active application for this opportunity.",
            code: "duplicate_opportunity_application",
          },
          { status: 409 }
        );
      }
      existingForOpportunity.status = "submitted";
      existingForOpportunity.academicYear = yearFields.academicYear;
      existingForOpportunity.academicYearId = yearFields.academicYearId;
      existingForOpportunity.academicYearLabel = yearFields.academicYearLabel;
      existingForOpportunity.studentSnapshot = studentSnapshot;
      existingForOpportunity.submittedAt = submittedAt;
      existingForOpportunity.reviewedAt = undefined;
      existingForOpportunity.reviewedBy = undefined;
      existingForOpportunity.rejectionReason = undefined;
      if (applicationMessage !== undefined) existingForOpportunity.applicationMessage = applicationMessage;
      if (studentNotes !== undefined) existingForOpportunity.studentNotes = studentNotes;
      existingForOpportunity.slaReviewDueAt = sla.slaReviewDueAt;
      existingForOpportunity.slaInstitutionDueAt = sla.slaInstitutionDueAt;
      existingForOpportunity.slaCompletionDueAt = sla.slaCompletionDueAt;
      existingForOpportunity.timeline = appendTimelineEvent(existingForOpportunity.timeline, {
        at: submittedAt,
        action: "submitted",
        toStatus: "submitted",
        actorId: String(gate.user._id),
        actorName,
      });
      saved = await existingForOpportunity.save();
    } else {
      saved = await StudentTrainingApplication.create({
        studentId: gate.user._id,
        opportunityId,
        status: "submitted",
        academicYear: yearFields.academicYear,
        academicYearId: yearFields.academicYearId,
        academicYearLabel: yearFields.academicYearLabel,
        studentSnapshot,
        submittedAt,
        slaReviewDueAt: sla.slaReviewDueAt,
        slaInstitutionDueAt: sla.slaInstitutionDueAt,
        slaCompletionDueAt: sla.slaCompletionDueAt,
        applicationMessage,
        studentNotes,
        timeline: [
          {
            at: submittedAt,
            action: "submitted",
            toStatus: "submitted",
            actorId: String(gate.user._id),
            actorName,
          },
        ],
      });
    }

    await logAuditEvent({
      actionType: "training_application_submitted",
      entityType: "StudentTrainingApplication",
      entityId: String(saved._id),
      entityTitle: opportunity.title,
      descriptionAr: `تقديم طالب على فرصة: ${opportunity.title}`,
      actor: actorFromUser(gate.user),
      request,
      outcome: "success",
      metadata: {
        opportunityId,
        academicYear: yearFields.academicYear,
        studentGrade: studentSnapshot.grade,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        item: await serializeTrainingApplication(saved.toObject(), {
          opportunityTitle: opportunity.title,
          organizationName: organization.name,
        }),
      },
      { status: 201 }
    );
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && (error as { code?: number }).code === 11000) {
      return NextResponse.json(
        {
          error: "You already have an active application.",
          code: "active_application_exists",
        },
        { status: 409 }
      );
    }
    console.error("[POST /api/partnerships/applications]", error);
    return jsonInternalServerError(error);
  }
}
