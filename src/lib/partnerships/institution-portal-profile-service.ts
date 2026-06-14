import "server-only";
import connectDB from "@/lib/mongodb";
import PartnerOrganization from "@/models/PartnerOrganization";
import PartnershipMessage from "@/models/PartnershipMessage";
import PartnershipThread from "@/models/PartnershipThread";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingInterview from "@/models/TrainingInterview";
import TrainingOpportunity from "@/models/TrainingOpportunity";
import {
  PARTNER_ORGANIZATION_CATEGORY_LABELS,
  type PartnerOrganizationCategory,
} from "@/lib/partnerships/institution-analytics-constants";
import { buildOrganizationPerformanceStats } from "@/lib/partnerships/institution-analytics-service";
import {
  DEFAULT_INSTITUTION_NOTIFICATION_SETTINGS,
  type InstitutionNotificationSettings,
} from "@/lib/partnerships/institution-portal-constants";

const mergeNotificationSettings = (
  raw?: Partial<InstitutionNotificationSettings> | null
): InstitutionNotificationSettings => ({
  ...DEFAULT_INSTITUTION_NOTIFICATION_SETTINGS,
  ...raw,
});

export const buildInstitutionPortalProfile = async (organizationId: string) => {
  await connectDB();
  const organization = await PartnerOrganization.findById(organizationId).lean();
  if (!organization) return null;

  const opportunities = await TrainingOpportunity.find({ organizationId }).select("_id academicYear createdAt").lean();
  const opportunityIds = opportunities.map((row) => row._id);

  const [stats, applications, interviewCount] = await Promise.all([
    buildOrganizationPerformanceStats(organizationId),
    StudentTrainingApplication.find({ opportunityId: { $in: opportunityIds } })
      .select("academicYear _id")
      .lean(),
    TrainingInterview.countDocuments({ organizationId }),
  ]);

  const applicationIds = applications.map((row) => row._id);
  const threadIds =
    applicationIds.length > 0
      ? await PartnershipThread.find({ applicationId: { $in: applicationIds } }).distinct("_id")
      : [];

  const messageCount =
    threadIds.length > 0 ? await PartnershipMessage.countDocuments({ threadId: { $in: threadIds } }) : 0;

  const academicYears = new Set<string>();
  for (const row of [...opportunities, ...applications]) {
    const year = String((row as { academicYear?: string }).academicYear || "").trim();
    if (year) academicYears.add(year);
  }

  const category = organization.category as PartnerOrganizationCategory | undefined;
  const categoryLabel = category ? PARTNER_ORGANIZATION_CATEGORY_LABELS[category] : null;

  return {
    organization: {
      id: String(organization._id),
      name: organization.name,
      logo: organization.logo || "",
      sector: organization.sector || "",
      city: organization.city || "",
      category: organization.category || "",
      subCategory: organization.subCategory || "",
      categoryLabelAr: categoryLabel?.ar || "",
      categoryLabelEn: categoryLabel?.en || "",
      contactName: organization.contactName || "",
      contactEmail: organization.contactEmail || "",
      contactPhone: organization.contactPhone || "",
      partnershipStartedAt: organization.createdAt
        ? new Date(organization.createdAt).toISOString()
        : null,
      active: organization.active !== false,
      averageRating: Number(organization.averageRating || 0),
      ratingCount: Number(organization.ratingCount || 0),
    },
    metrics: {
      nominatedStudents: stats.nominatedStudents,
      acceptedStudents: stats.acceptedStudents,
      rejectedStudents: stats.rejectedStudents,
      completedStudents: stats.completedStudents,
      interviewCount,
      messageCount,
      partnershipYears: academicYears.size,
      historicallyTrainedStudents: stats.completedStudents,
    },
    notificationSettings: mergeNotificationSettings(organization.institutionNotificationSettings),
  };
};

export const updateInstitutionNotificationSettings = async (
  organizationId: string,
  settings: Partial<InstitutionNotificationSettings>
) => {
  await connectDB();
  const organization = await PartnerOrganization.findById(organizationId);
  if (!organization) return { ok: false as const, error: "Organization not found" };

  organization.institutionNotificationSettings = mergeNotificationSettings({
    ...organization.institutionNotificationSettings,
    ...settings,
  });
  await organization.save();

  return {
    ok: true as const,
    settings: mergeNotificationSettings(organization.institutionNotificationSettings),
  };
};

export type InstitutionRecentActivityItem = {
  id: string;
  kind:
    | "new_nomination"
    | "document_uploaded"
    | "intro_video_uploaded"
    | "interview_scheduled"
    | "new_message"
    | "awaiting_evaluation"
    | "awaiting_school_approval";
  labelAr: string;
  labelEn: string;
  at: string | null;
  applicationId?: string;
  studentName?: string;
  opportunityTitle?: string;
};

export const buildInstitutionRecentActivity = async (
  organizationId: string,
  limit = 12
): Promise<InstitutionRecentActivityItem[]> => {
  await connectDB();
  const opportunities = await TrainingOpportunity.find({ organizationId }).select("_id title").lean();
  const opportunityIds = opportunities.map((row) => row._id);
  const oppMap = new Map(opportunities.map((row) => [String(row._id), row.title || ""]));

  const applications = await StudentTrainingApplication.find({
    opportunityId: { $in: opportunityIds },
  })
    .select("_id status studentSnapshot opportunityId timeline submittedAt")
    .sort({ updatedAt: -1 })
    .limit(40)
    .lean();

  const items: InstitutionRecentActivityItem[] = [];

  for (const app of applications) {
    const studentName = app.studentSnapshot?.fullName || "";
    const opportunityTitle = oppMap.get(String(app.opportunityId)) || "";
    const appId = String(app._id);

    if (app.status === "institution_review" && app.timeline?.length === 0) {
      items.push({
        id: `new-${appId}`,
        kind: "new_nomination",
        labelAr: `طالب جديد مرشح: ${studentName}`,
        labelEn: `New nominated student: ${studentName}`,
        at: app.submittedAt ? new Date(app.submittedAt).toISOString() : null,
        applicationId: appId,
        studentName,
        opportunityTitle,
      });
    }

    if (app.status === "awaiting_school_approval") {
      items.push({
        id: `school-${appId}`,
        kind: "awaiting_school_approval",
        labelAr: `بانتظار اعتماد المدرسة — ${studentName}`,
        labelEn: `Awaiting school approval — ${studentName}`,
        at: null,
        applicationId: appId,
        studentName,
        opportunityTitle,
      });
    }

    if (app.status === "accepted") {
      items.push({
        id: `eval-${appId}`,
        kind: "awaiting_evaluation",
        labelAr: `تدريب جارٍ — ${studentName}`,
        labelEn: `Training in progress — ${studentName}`,
        at: null,
        applicationId: appId,
        studentName,
        opportunityTitle,
      });
    }

    for (const event of app.timeline || []) {
      const action = String(event.action || "");
      const at = event.at ? new Date(event.at).toISOString() : null;
      if (action === "institution_requirement_submitted") {
        const note = String(event.note || "").toLowerCase();
        const isVideo = note.includes("فيديو") || note.includes("video");
        items.push({
          id: `${action}-${appId}-${at}`,
          kind: isVideo ? "intro_video_uploaded" : "document_uploaded",
          labelAr: isVideo ? `رفع فيديو تعريفي — ${studentName}` : `رفع مستند — ${studentName}`,
          labelEn: isVideo ? `Introduction video uploaded — ${studentName}` : `Document uploaded — ${studentName}`,
          at,
          applicationId: appId,
          studentName,
          opportunityTitle,
        });
      }
      if (action === "institution_message_sent" || action === "message_interview_invite") {
        items.push({
          id: `${action}-${appId}-${at}`,
          kind: "new_message",
          labelAr: `رسالة جديدة — ${studentName}`,
          labelEn: `New message — ${studentName}`,
          at,
          applicationId: appId,
          studentName,
          opportunityTitle,
        });
      }
    }
  }

  const interviews = await TrainingInterview.find({ organizationId })
    .sort({ scheduledAt: 1 })
    .limit(10)
    .lean();

  for (const interview of interviews) {
    const app = applications.find((row) => String(row._id) === String(interview.applicationId));
    items.push({
      id: `interview-${String(interview._id)}`,
      kind: "interview_scheduled",
      labelAr: `موعد مقابلة — ${app?.studentSnapshot?.fullName || ""}`,
      labelEn: `Interview scheduled — ${app?.studentSnapshot?.fullName || ""}`,
      at: interview.scheduledAt ? new Date(interview.scheduledAt).toISOString() : null,
      applicationId: String(interview.applicationId),
      studentName: app?.studentSnapshot?.fullName || "",
      opportunityTitle: app ? oppMap.get(String(app.opportunityId)) || "" : "",
    });
  }

  return items
    .sort((a, b) => {
      const ta = a.at ? new Date(a.at).getTime() : 0;
      const tb = b.at ? new Date(b.at).getTime() : 0;
      return tb - ta;
    })
    .slice(0, limit);
};

export const buildInstitutionPortalDashboard = async (organizationId: string) => {
  const [profile, recentActivity] = await Promise.all([
    buildInstitutionPortalProfile(organizationId),
    buildInstitutionRecentActivity(organizationId),
  ]);

  return {
    profile,
    recentActivity,
    measuredAt: new Date().toISOString(),
  };
};
