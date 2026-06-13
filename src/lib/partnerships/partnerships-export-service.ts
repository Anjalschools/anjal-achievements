import connectDB from "@/lib/mongodb";
import PartnerOrganization from "@/models/PartnerOrganization";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingCompletionRecord from "@/models/TrainingCompletionRecord";
import TrainingOpportunity from "@/models/TrainingOpportunity";

export type PartnershipExportReport = "organizations" | "trainees" | "hours" | "approvals";

type ExportRow = Record<string, string | number>;

const csvEscape = (value: string) => `"${String(value).replace(/"/g, '""')}"`;

export const rowsToCsv = (headers: string[], rows: ExportRow[]) => {
  const lines = [headers.map((h) => csvEscape(h)).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(String(row[h] ?? ""))).join(","));
  }
  return `\uFEFF${lines.join("\n")}`;
};

export const buildPartnershipExport = async (
  report: PartnershipExportReport,
  filters?: { academicYear?: string; organizationId?: string }
): Promise<{ headers: string[]; rows: ExportRow[]; titleAr: string; titleEn: string }> => {
  await connectDB();
  const academicYear = String(filters?.academicYear || "").trim();
  const organizationId = String(filters?.organizationId || "").trim();

  if (report === "organizations") {
    const orgs = await PartnerOrganization.find().sort({ name: 1 }).lean();
    const opportunities = await TrainingOpportunity.find().lean();
    const applications = await StudentTrainingApplication.find(
      academicYear ? { academicYear } : {}
    ).lean();

    const headers = [
      "name",
      "sector",
      "city",
      "category",
      "subCategory",
      "averageRating",
      "ratingCount",
      "active",
      "opportunityCount",
      "candidateCount",
      "acceptedCount",
    ];
    const rows = orgs.map((org) => {
      const orgOpps = opportunities.filter((o) => String(o.organizationId) === String(org._id));
      const oppIds = new Set(orgOpps.map((o) => String(o._id)));
      const apps = applications.filter((a) => oppIds.has(String(a.opportunityId)));
      return {
        name: org.name,
        sector: org.sector || "",
        city: org.city || "",
        category: org.category || "",
        subCategory: org.subCategory || "",
        averageRating: Number(org.averageRating || 0),
        ratingCount: Number(org.ratingCount || 0),
        active: org.active !== false ? "yes" : "no",
        opportunityCount: orgOpps.length,
        candidateCount: apps.filter((a) =>
          ["submitted", "under_review", "interview_requested", "institution_review"].includes(String(a.status))
        ).length,
        acceptedCount: apps.filter((a) => String(a.status) === "accepted").length,
      };
    });
    return {
      headers,
      rows,
      titleAr: "تقرير المؤسسات الشريكة",
      titleEn: "Partner organizations report",
    };
  }

  if (report === "trainees") {
    const query: Record<string, unknown> = {};
    if (academicYear) query.academicYear = academicYear;
    const applications = await StudentTrainingApplication.find(query).sort({ submittedAt: -1 }).limit(2000).lean();
    const opportunityIds = [...new Set(applications.map((a) => String(a.opportunityId)))];
    const opportunities = await TrainingOpportunity.find({ _id: { $in: opportunityIds } }).lean();
    const orgIds = [...new Set(opportunities.map((o) => String(o.organizationId)))];
    const orgs = await PartnerOrganization.find({ _id: { $in: orgIds } }).lean();
    const oppMap = new Map(opportunities.map((o) => [String(o._id), o]));
    const orgMap = new Map(orgs.map((o) => [String(o._id), o]));

    const headers = [
      "studentName",
      "grade",
      "stage",
      "gender",
      "organization",
      "opportunity",
      "status",
      "academicYear",
      "submittedAt",
    ];
    const rows = applications
      .filter((app) => {
        if (!organizationId) return true;
        const opp = oppMap.get(String(app.opportunityId));
        return opp && String(opp.organizationId) === organizationId;
      })
      .map((app) => {
        const opp = oppMap.get(String(app.opportunityId));
        const org = opp ? orgMap.get(String(opp.organizationId)) : undefined;
        return {
          studentName: app.studentSnapshot?.fullName || "",
          grade: app.studentSnapshot?.grade || "",
          stage: app.studentSnapshot?.stage || "",
          gender: app.studentSnapshot?.gender || "",
          organization: org?.name || "",
          opportunity: opp?.title || "",
          status: String(app.status),
          academicYear: app.academicYear || "",
          submittedAt: app.submittedAt ? new Date(app.submittedAt).toISOString() : "",
        };
      });
    return { headers, rows, titleAr: "تقرير المتدربين", titleEn: "Trainees report" };
  }

  if (report === "hours") {
    const query: Record<string, unknown> = { status: "approved" };
    if (academicYear) query.academicYear = academicYear;
    const records = await TrainingCompletionRecord.find(query).sort({ submittedAt: -1 }).limit(2000).lean();
    const applicationIds = records.map((r) => r.applicationId);
    const applications = await StudentTrainingApplication.find({ _id: { $in: applicationIds } }).lean();
    const appMap = new Map(applications.map((a) => [String(a._id), a]));

    const headers = [
      "studentName",
      "organization",
      "volunteerHours",
      "trainingStart",
      "trainingEnd",
      "academicYear",
      "approvedAt",
    ];
    const rows = records.map((record) => {
      const app = appMap.get(String(record.applicationId));
      return {
        studentName: app?.studentSnapshot?.fullName || "",
        organization: record.organizationName || "",
        volunteerHours: Number(record.volunteerHours || 0),
        trainingStart: record.trainingStartDate
          ? new Date(record.trainingStartDate).toISOString().slice(0, 10)
          : "",
        trainingEnd: record.trainingEndDate
          ? new Date(record.trainingEndDate).toISOString().slice(0, 10)
          : "",
        academicYear: record.academicYear || "",
        approvedAt: record.reviewedAt ? new Date(record.reviewedAt).toISOString() : "",
      };
    });
    return { headers, rows, titleAr: "تقرير ساعات التطوع", titleEn: "Volunteer hours report" };
  }

  const query: Record<string, unknown> = {};
  if (academicYear) query.academicYear = academicYear;
  const applications = await StudentTrainingApplication.find({
    ...query,
    status: { $in: ["accepted", "completed", "rejected"] },
  })
    .sort({ reviewedAt: -1 })
    .limit(2000)
    .lean();
  const opportunityIds = [...new Set(applications.map((a) => String(a.opportunityId)))];
  const opportunities = await TrainingOpportunity.find({ _id: { $in: opportunityIds } }).lean();
  const orgIds = [...new Set(opportunities.map((o) => String(o.organizationId)))];
  const orgs = await PartnerOrganization.find({ _id: { $in: orgIds } }).lean();
  const oppMap = new Map(opportunities.map((o) => [String(o._id), o]));
  const orgMap = new Map(orgs.map((o) => [String(o._id), o]));

  const headers = [
    "studentName",
    "organization",
    "opportunity",
    "decision",
    "reviewedAt",
    "reviewerNote",
    "academicYear",
  ];
  const rows = applications
    .filter((app) => {
      if (!organizationId) return true;
      const opp = oppMap.get(String(app.opportunityId));
      return opp && String(opp.organizationId) === organizationId;
    })
    .map((app) => {
      const opp = oppMap.get(String(app.opportunityId));
      const org = opp ? orgMap.get(String(opp.organizationId)) : undefined;
      return {
        studentName: app.studentSnapshot?.fullName || "",
        organization: org?.name || "",
        opportunity: opp?.title || "",
        decision: String(app.status),
        reviewedAt: app.reviewedAt ? new Date(app.reviewedAt).toISOString() : "",
        reviewerNote: app.reviewNotes || app.rejectionReason || "",
        academicYear: app.academicYear || "",
      };
    });

  return { headers, rows, titleAr: "تقرير الاعتمادات والقرارات", titleEn: "Approvals report" };
};
