import "server-only";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingCompletionRecord from "@/models/TrainingCompletionRecord";
import TrainingOpportunity from "@/models/TrainingOpportunity";
import PartnerOrganization from "@/models/PartnerOrganization";
import {
  buildVerificationUrl,
  generateInstitutionBlankReportTemplatePdfBuffer,
  InstitutionReportPdfRenderError,
  type InstitutionBlankReportTemplateContext,
} from "@/lib/partnerships/institution-report-blank-template-pdf-generator";
import { getGradeLabel } from "@/constants/grades";

const LOG_PREFIX = "[institution-template-export]";

const logTemplateExport = (step: string, payload: Record<string, unknown>) => {
  console.info(LOG_PREFIX, step, payload);
};

const logTemplateExportError = (step: string, error: unknown, payload: Record<string, unknown> = {}) => {
  const base = error instanceof Error ? error : new Error(String(error));
  console.error(LOG_PREFIX, step, {
    ...payload,
    errorType: base.name,
    errorMessage: base.message,
    stack: base.stack,
  });
};

const formatDate = (value?: Date | string | null) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("ar-SA");
  } catch {
    return "—";
  }
};

const safeGradeLabel = (grade: string | undefined) => {
  try {
    const raw = String(grade || "").trim();
    if (!raw || raw === "—") return "_________________";
    const canon = raw.replace(/^G(\d{1,2})$/i, "g$1");
    return getGradeLabel(canon, "ar");
  } catch (error) {
    logTemplateExportError("grade-conversion", error, { grade });
    return String(grade || "_________________");
  }
};

const loadStudentTemplateContext = async (
  studentId: mongoose.Types.ObjectId,
  applicationId?: string
): Promise<InstitutionBlankReportTemplateContext | null> => {
  await connectDB();

  if (applicationId && !mongoose.Types.ObjectId.isValid(applicationId)) {
    logTemplateExport("application-lookup-invalid-id", { applicationId, studentId: String(studentId) });
    return null;
  }

  const application = applicationId
    ? await StudentTrainingApplication.findOne({
        _id: applicationId,
        studentId,
        status: { $in: ["accepted", "completed"] },
      }).lean()
    : await StudentTrainingApplication.findOne({
        studentId,
        status: { $in: ["accepted", "completed"] },
      })
        .sort({ submittedAt: -1, createdAt: -1 })
        .lean();

  logTemplateExport("application-lookup", {
    applicationId: applicationId || null,
    studentId: String(studentId),
    found: Boolean(application),
    applicationStatus: application?.status || null,
  });

  if (!application) return null;

  const [opportunity, record] = await Promise.all([
    application.opportunityId
      ? TrainingOpportunity.findById(application.opportunityId).lean()
      : Promise.resolve(null),
    TrainingCompletionRecord.findOne({ applicationId: application._id }).lean(),
  ]);

  const organization =
    opportunity?.organizationId != null
      ? await PartnerOrganization.findById(opportunity.organizationId).lean()
      : null;

  logTemplateExport("related-records-lookup", {
    applicationId: String(application._id),
    opportunityFound: Boolean(opportunity),
    trainingRecordFound: Boolean(record),
    organizationFound: Boolean(organization),
  });

  const context: InstitutionBlankReportTemplateContext = {
    studentName: application.studentSnapshot?.fullName || "",
    school: application.studentSnapshot?.school || "—",
    grade: application.studentSnapshot?.grade || "—",
    institutionName: organization?.name || record?.organizationName || "—",
    trainingStartDate: formatDate(record?.trainingStartDate || opportunity?.trainingStart),
    trainingEndDate: formatDate(record?.trainingEndDate || opportunity?.trainingEnd),
    generatedAt: new Date().toLocaleDateString("ar-SA"),
    applicationId: String(application._id),
    academicYear:
      (typeof record?.academicYear === "string" && record.academicYear.trim()) ||
      (typeof (opportunity as { academicYear?: string } | null)?.academicYear === "string"
        ? String((opportunity as { academicYear?: string }).academicYear).trim()
        : undefined),
  };

  logTemplateExport("template-context-ready", {
    applicationId: context.applicationId,
    studentName: context.studentName,
    institutionName: context.institutionName,
    grade: context.grade,
    gradeLabel: safeGradeLabel(context.grade),
    verificationUrl: buildVerificationUrl(context),
  });

  return context;
};

export const generateStudentInstitutionReportTemplatePdf = async (input: {
  studentId: mongoose.Types.ObjectId;
  applicationId?: string;
}): Promise<{ ok: true; buffer: Buffer; fileName: string } | { ok: false; error: string }> => {
  logTemplateExport("request-start", {
    applicationId: input.applicationId || null,
    studentId: String(input.studentId),
  });

  try {
    const context = await loadStudentTemplateContext(input.studentId, input.applicationId);
    if (!context) {
      return { ok: false, error: "Application not found" };
    }

    let buffer: Buffer;
    try {
      buffer = await generateInstitutionBlankReportTemplatePdfBuffer(context);
      logTemplateExport("pdf-generation-result", {
        applicationId: context.applicationId,
        bytes: buffer.length,
        verificationUrl: buildVerificationUrl(context),
      });
    } catch (error) {
      if (error instanceof InstitutionReportPdfRenderError) {
        logTemplateExportError("pdf-generation-failed", error, {
          applicationId: context.applicationId,
          stage: error.stage,
        });
        throw error;
      }
      logTemplateExportError("pdf-generation-failed", error, {
        applicationId: context.applicationId,
      });
      throw error;
    }

    const safeName = context.studentName.replace(/[^\w\u0600-\u06FF\s-]/g, "").trim() || "student";
    return {
      ok: true,
      buffer,
      fileName: `institution-final-report-template-${safeName}.pdf`,
    };
  } catch (error) {
    logTemplateExportError("request-failed", error, {
      applicationId: input.applicationId || null,
      studentId: String(input.studentId),
    });
    throw error;
  }
};
