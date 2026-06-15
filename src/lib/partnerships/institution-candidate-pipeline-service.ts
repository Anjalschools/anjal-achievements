import "server-only";
import mongoose from "mongoose";
import type { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit-log-service";
import ApplicationRequirement from "@/models/ApplicationRequirement";
import InstitutionCandidateTag from "@/models/InstitutionCandidateTag";
import InstitutionPrivateNote from "@/models/InstitutionPrivateNote";
import InstitutionReview from "@/models/InstitutionReview";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingAssessment from "@/models/TrainingAssessment";
import TrainingInterview from "@/models/TrainingInterview";
import TrainingOpportunity from "@/models/TrainingOpportunity";
import {
  CANDIDATE_TIMELINE_ACTIONS,
  type InstitutionPipelineStage,
  INSTITUTION_PIPELINE_STAGES,
  STANDARD_DOCUMENT_KEYS,
  STANDARD_DOCUMENT_LABELS,
  type InstitutionPrivateNoteCategory,
} from "@/lib/partnerships/institution-candidate-pipeline-constants";
import { mapRequirementToParentConsentDisplay, PARENT_CONSENT_REQUIREMENT_TYPE } from "@/lib/partnerships/parent-consent-constants";
import { buildInstitutionStudentProfileSummary } from "@/lib/partnerships/institution-student-profile-service";
import { assertInstitutionApplicationAccess } from "@/lib/partnerships/institution-scope";
import { appendTimelineEvent } from "@/lib/partnerships/partnerships-application-workflow";

export type CandidateScorecard = {
  overallScore: number;
  achievementIndicator: number;
  achievementCount: number;
  certificateCount: number;
  volunteerHours: number;
  careerReadiness: number;
  documentCompleteness: number;
  interviewStatus: string;
  assessmentScore: number;
};

export type DocumentTrackerRow = {
  id: string;
  key: string;
  titleAr: string;
  titleEn: string;
  status: "required" | "uploaded" | "under_review" | "accepted" | "rejected";
  required: boolean;
  submittedAt: string | null;
};

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(n)));

const matchDocKey = (title: string): string => {
  const t = title.toLowerCase();
  if (t.includes("سيرة") || t.includes("cv") || t.includes("resume")) return "cv";
  if (t.includes("فيديو") || t.includes("video")) return "intro_video";
  if (t.includes("دافع") || t.includes("motivation")) return "motivation_letter";
  if (t.includes("أعمال") || t.includes("portfolio")) return "portfolio";
  return "custom";
};

const mapRequirementDisplayStatus = (
  status: string
): "required" | "uploaded" | "under_review" | "accepted" | "rejected" => {
  if (status === "accepted" || status === "waived") return "accepted";
  if (status === "rejected") return "rejected";
  if (status === "submitted") return "under_review";
  if (status === "overdue") return "required";
  return "required";
};

type PipelineContext = {
  requirements: Array<{ applicationId: mongoose.Types.ObjectId; status: string }>;
  interviews: Array<{ applicationId: mongoose.Types.ObjectId; status: string }>;
  assessments: Array<{ applicationId: mongoose.Types.ObjectId; status: string }>;
  evaluations: Set<string>;
};

export const derivePipelineStage = (input: {
  status: string;
  institutionStatus: string;
  applicationId: string;
  ctx: PipelineContext;
}): InstitutionPipelineStage => {
  const { status, institutionStatus, applicationId, ctx } = input;
  const appId = applicationId;

  if (status === "completed") return "completed";
  if (status === "rejected") return "rejected";

  if (status === "awaiting_school_approval") return "inTraining";

  if (status === "accepted") {
    if (ctx.evaluations.has(appId)) return "inTraining";
    return "accepted";
  }

  if (status === "interview_requested") return "awaitingInterview";

  const reqs = ctx.requirements.filter((r) => String(r.applicationId) === appId);
  const pendingDocs = reqs.some((r) => r.status === "pending" || r.status === "overdue");
  const ints = ctx.interviews.filter((i) => String(i.applicationId) === appId);
  const scheduledInterview = ints.some((i) => i.status === "scheduled" || i.status === "rescheduled");

  if (status === "institution_review") {
    if (institutionStatus === "institution_pending") return "new";
    if (pendingDocs) return "awaitingDocuments";
    if (scheduledInterview) return "awaitingInterview";
    if (institutionStatus === "institution_interview") return "awaitingInterview";
    return "awaitingDecision";
  }

  if (pendingDocs) return "awaitingDocuments";
  if (scheduledInterview) return "awaitingInterview";

  return "inReview";
};

export const buildCandidateScorecard = async (
  applicationId: string,
  organizationId: string,
  locale: "ar" | "en" = "ar"
): Promise<CandidateScorecard | null> => {
  await connectDB();
  const access = await assertInstitutionApplicationAccess(applicationId, organizationId);
  if (!access.ok) return null;

  const application = await StudentTrainingApplication.findById(applicationId).lean();
  if (!application) return null;

  const [profile, requirements, interviews, assessments] = await Promise.all([
    buildInstitutionStudentProfileSummary(String(application.studentId), application.studentSnapshot, locale),
    ApplicationRequirement.find({ applicationId }).select("status required").lean(),
    TrainingInterview.find({ applicationId }).select("status").lean(),
    TrainingAssessment.find({ applicationId }).select("status").lean(),
  ]);

  const reqTotal = requirements.filter((r) => r.required !== false).length || 1;
  const reqDone = requirements.filter(
    (r) => r.status === "submitted" || r.status === "waived" || r.status === "accepted"
  ).length;
  const documentCompleteness = clamp((reqDone / reqTotal) * 100);

  const interviewCompleted = interviews.some((i) => i.status === "completed");
  const interviewScheduled = interviews.some((i) => i.status === "scheduled" || i.status === "rescheduled");
  const interviewStatus = interviewCompleted
    ? "completed"
    : interviewScheduled
      ? "scheduled"
      : interviews.length
        ? "pending"
        : "none";

  const assessTotal = assessments.length || 1;
  const assessDone = assessments.filter((a) => a.status === "reviewed" || a.status === "submitted").length;
  const assessmentScore = clamp((assessDone / assessTotal) * 100);

  const achievementIndicator = clamp(
    profile.achievements.totalCount * 4 +
      profile.achievements.highlights.length * 8 +
      profile.achievements.certificateCount * 3
  );

  const careerReadiness = clamp(profile.careerReadiness.careerReadinessScore);
  const volunteerComponent = clamp(Math.min(profile.volunteer.totalHours, 40) * 2.5);

  const overallScore = clamp(
    achievementIndicator * 0.25 +
      careerReadiness * 0.2 +
      documentCompleteness * 0.2 +
      assessmentScore * 0.15 +
      volunteerComponent * 0.1 +
      (interviewCompleted ? 100 : interviewScheduled ? 60 : 20) * 0.1
  );

  return {
    overallScore,
    achievementIndicator,
    achievementCount: profile.achievements.totalCount,
    certificateCount: profile.achievements.certificateCount,
    volunteerHours: profile.volunteer.totalHours,
    careerReadiness,
    documentCompleteness,
    interviewStatus,
    assessmentScore,
  };
};

export const buildDocumentTracker = async (
  applicationId: string,
  organizationId: string
): Promise<DocumentTrackerRow[]> => {
  await connectDB();
  const access = await assertInstitutionApplicationAccess(applicationId, organizationId);
  if (!access.ok) return [];

  const requirements = await ApplicationRequirement.find({ applicationId }).sort({ createdAt: 1 }).lean();
  const rows: DocumentTrackerRow[] = [];

  for (const key of STANDARD_DOCUMENT_KEYS) {
    const match = requirements.find((r) => matchDocKey(r.title) === key);
    if (match) {
      rows.push({
        id: String(match._id),
        key,
        titleAr: STANDARD_DOCUMENT_LABELS[key].ar,
        titleEn: STANDARD_DOCUMENT_LABELS[key].en,
        status: match.status === "submitted" ? "uploaded" : mapRequirementDisplayStatus(match.status),
        required: match.required !== false,
        submittedAt: match.submittedAt ? new Date(match.submittedAt).toISOString() : null,
      });
    } else {
      rows.push({
        id: `std-${key}`,
        key,
        titleAr: STANDARD_DOCUMENT_LABELS[key].ar,
        titleEn: STANDARD_DOCUMENT_LABELS[key].en,
        status: "required",
        required: false,
        submittedAt: null,
      });
    }
  }

  for (const req of requirements) {
    const key = matchDocKey(req.title);
    if (STANDARD_DOCUMENT_KEYS.includes(key as (typeof STANDARD_DOCUMENT_KEYS)[number])) continue;
    const isParentConsent = req.requirementType === PARENT_CONSENT_REQUIREMENT_TYPE;
    const status =
      isParentConsent && req.status === "submitted"
        ? "under_review"
        : req.status === "submitted"
          ? "uploaded"
          : mapRequirementDisplayStatus(req.status);
    rows.push({
      id: String(req._id),
      key: isParentConsent ? "parent_consent" : "custom",
      titleAr: isParentConsent ? "موافقة ولي الأمر" : req.title,
      titleEn: isParentConsent ? "Parent consent" : req.title,
      status,
      required: req.required !== false,
      submittedAt: req.submittedAt ? new Date(req.submittedAt).toISOString() : null,
    });
  }

  return rows;
};

const appendCandidateTimeline = async (
  applicationId: string,
  action: string,
  actor: { id: string; name: string },
  note?: string
) => {
  const application = await StudentTrainingApplication.findById(applicationId);
  if (!application) return;
  application.timeline = appendTimelineEvent(application.timeline, {
    at: new Date(),
    action,
    actorId: actor.id,
    actorName: actor.name,
    note,
  });
  await application.save();
};

export const listInstitutionCandidatePipeline = async (organizationId: string) => {
  await connectDB();
  const opportunities = await TrainingOpportunity.find({ organizationId }).select("_id title").lean();
  const opportunityIds = opportunities.map((o) => o._id);
  const oppMap = new Map(opportunities.map((o) => [String(o._id), o.title || ""]));

  const applications = await StudentTrainingApplication.find({
    opportunityId: { $in: opportunityIds },
    status: {
      $in: [
        "institution_review",
        "interview_requested",
        "accepted",
        "rejected",
        "awaiting_school_approval",
        "completed",
      ],
    },
  })
    .sort({ submittedAt: -1 })
    .lean();

  const appIds = applications.map((a) => a._id);

  const [requirements, interviews, assessments, evaluations, tags] = await Promise.all([
    ApplicationRequirement.find({ applicationId: { $in: appIds } }).select("applicationId status").lean(),
    TrainingInterview.find({ applicationId: { $in: appIds } }).select("applicationId status").lean(),
    TrainingAssessment.find({ applicationId: { $in: appIds } }).select("applicationId status").lean(),
    InstitutionReview.find({
      applicationId: { $in: appIds },
      reviewKind: "completion_evaluation",
    })
      .select("applicationId")
      .lean(),
    InstitutionCandidateTag.find({ organizationId }).select("applicationId tag").lean(),
  ]);

  const ctx: PipelineContext = {
    requirements,
    interviews,
    assessments,
    evaluations: new Set(evaluations.map((e) => String(e.applicationId))),
  };

  const tagsByApp = new Map<string, string[]>();
  for (const row of tags) {
    const id = String(row.applicationId);
    const list = tagsByApp.get(id) || [];
    list.push(row.tag);
    tagsByApp.set(id, list);
  }

  const stageCounts = Object.fromEntries(
    INSTITUTION_PIPELINE_STAGES.map((s) => [s, 0])
  ) as Record<InstitutionPipelineStage, number>;

  const parentConsentRows = await ApplicationRequirement.find({
    applicationId: { $in: appIds },
    requirementType: PARENT_CONSENT_REQUIREMENT_TYPE,
  }).lean();
  const parentConsentByApp = new Map(
    parentConsentRows.map((row) => [String(row.applicationId), row])
  );

  const items = await Promise.all(
    applications.map(async (app) => {
      const id = String(app._id);
      const pipelineStage = derivePipelineStage({
        status: String(app.status),
        institutionStatus: String(app.institutionStatus || "institution_pending"),
        applicationId: id,
        ctx,
      });
      stageCounts[pipelineStage] += 1;

      const scorecard = await buildCandidateScorecard(id, organizationId);
      const parentConsentRow = parentConsentByApp.get(id) || null;

      return {
        id,
        status: app.status,
        institutionStatus: app.institutionStatus || "institution_pending",
        pipelineStage,
        opportunityTitle: oppMap.get(String(app.opportunityId)) || "",
        opportunityId: String(app.opportunityId),
        studentName: app.studentSnapshot?.fullName || "",
        studentGrade: app.studentSnapshot?.grade || "",
        submittedAt: app.submittedAt ? new Date(app.submittedAt).toISOString() : null,
        rejectionReason: app.rejectionReason || "",
        tags: tagsByApp.get(id) || [],
        scorecard,
        parentConsentStatus: mapRequirementToParentConsentDisplay(parentConsentRow),
      };
    })
  );

  return { items, stageCounts };
};

export const buildInstitutionRecruitmentAnalytics = async (organizationId: string) => {
  const { items, stageCounts } = await listInstitutionCandidatePipeline(organizationId);

  const totalCandidates = items.length;
  const acceptedCount = stageCounts.accepted + stageCounts.inTraining + stageCounts.completed;
  const rejectedCount = stageCounts.rejected;
  const decisionPool = acceptedCount + rejectedCount;
  const acceptanceRatePct = decisionPool > 0 ? Math.round((acceptedCount / decisionPool) * 1000) / 10 : 0;
  const rejectionRatePct = decisionPool > 0 ? Math.round((rejectedCount / decisionPool) * 1000) / 10 : 0;

  const appIds = items.map((i) => new mongoose.Types.ObjectId(i.id));
  const [interviewCount, requirementCount, finalReports] = await Promise.all([
    TrainingInterview.countDocuments({ organizationId }),
    ApplicationRequirement.countDocuments({ organizationId }),
    InstitutionReview.countDocuments({
      applicationId: { $in: appIds },
      reviewKind: "completion_evaluation",
    }),
  ]);

  return {
    totalCandidates,
    acceptanceRatePct,
    rejectionRatePct,
    interviewCount,
    documentsRequested: requirementCount,
    finalReportsCount: finalReports,
    stageCounts,
    measuredAt: new Date().toISOString(),
  };
};

export const compareInstitutionCandidates = async (
  applicationIds: string[],
  organizationId: string,
  locale: "ar" | "en" = "ar"
) => {
  await connectDB();
  const uniqueIds = [...new Set(applicationIds.map((id) => id.trim()).filter(Boolean))].slice(0, 6);
  if (uniqueIds.length < 2) {
    return { ok: false as const, error: "At least two candidates required", code: "min_two" };
  }

  const rows = await Promise.all(
    uniqueIds.map(async (applicationId) => {
      const access = await assertInstitutionApplicationAccess(applicationId, organizationId);
      if (!access.ok) return null;

      const application = await StudentTrainingApplication.findById(applicationId).lean();
      if (!application) return null;

      const [profile, scorecard, documents, interviews, assessments, tags, notes] = await Promise.all([
        buildInstitutionStudentProfileSummary(String(application.studentId), application.studentSnapshot, locale),
        buildCandidateScorecard(applicationId, organizationId, locale),
        buildDocumentTracker(applicationId, organizationId),
        TrainingInterview.find({ applicationId }).sort({ scheduledAt: -1 }).lean(),
        TrainingAssessment.find({ applicationId }).lean(),
        InstitutionCandidateTag.find({ applicationId, organizationId }).lean(),
        InstitutionPrivateNote.find({ applicationId, organizationId }).sort({ createdAt: -1 }).limit(5).lean(),
      ]);

      return {
        applicationId,
        studentName: application.studentSnapshot?.fullName || "",
        studentGrade: application.studentSnapshot?.grade || "",
        status: application.status,
        scorecard,
        achievements: profile.achievements,
        careerReadiness: profile.careerReadiness,
        volunteer: profile.volunteer,
        documents,
        interviews: interviews.map((i) => ({
          id: String(i._id),
          scheduledAt: new Date(i.scheduledAt).toISOString(),
          status: i.status,
          attendance: i.attendance || "pending",
          notes: i.notes || "",
          recordingUrl: i.recordingUrl || "",
        })),
        assessments: assessments.map((a) => ({
          id: String(a._id),
          title: a.title,
          status: a.status,
          type: a.type,
        })),
        tags: tags.map((t) => t.tag),
        recentNotesCount: notes.length,
      };
    })
  );

  const candidates = rows.filter((r): r is NonNullable<typeof r> => Boolean(r));
  if (candidates.length < 2) {
    return { ok: false as const, error: "Invalid candidate selection", code: "invalid_selection" };
  }

  return { ok: true as const, candidates };
};

export const listInstitutionPrivateNotes = async (applicationId: string, organizationId: string) => {
  await connectDB();
  const access = await assertInstitutionApplicationAccess(applicationId, organizationId);
  if (!access.ok) return { ok: false as const, error: access.error, code: access.code };

  const rows = await InstitutionPrivateNote.find({ applicationId, organizationId })
    .sort({ createdAt: -1 })
    .lean();

  return {
    ok: true as const,
    items: rows.map((row) => ({
      id: String(row._id),
      category: row.category,
      body: row.body,
      authorId: String(row.authorId),
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    })),
  };
};

export const addInstitutionPrivateNote = async (input: {
  applicationId: string;
  organizationId: string;
  authorId: string;
  authorName: string;
  category: InstitutionPrivateNoteCategory;
  body: string;
  request?: NextRequest;
}) => {
  await connectDB();
  const access = await assertInstitutionApplicationAccess(input.applicationId, input.organizationId);
  if (!access.ok) return { ok: false as const, error: access.error, code: access.code };

  const body = String(input.body || "").trim();
  if (!body) return { ok: false as const, error: "Note body is required", code: "empty_body" };

  const note = await InstitutionPrivateNote.create({
    applicationId: new mongoose.Types.ObjectId(input.applicationId),
    organizationId: new mongoose.Types.ObjectId(input.organizationId),
    authorId: new mongoose.Types.ObjectId(input.authorId),
    category: input.category,
    body,
  });

  await appendCandidateTimeline(input.applicationId, CANDIDATE_TIMELINE_ACTIONS.candidateNoteAdded, {
    id: input.authorId,
    name: input.authorName,
  }, body.slice(0, 120));

  await logAuditEvent({
    actionType: CANDIDATE_TIMELINE_ACTIONS.candidateNoteAdded,
    entityType: "institution_private_note",
    entityId: String(note._id),
    descriptionAr: "إضافة ملاحظة خاصة للمؤسسة على المرشح",
    actor: {
      id: new mongoose.Types.ObjectId(input.authorId),
      name: input.authorName,
      role: "trainingInstitution",
    },
    request: input.request,
    outcome: "success",
    metadata: { applicationId: input.applicationId, category: input.category },
  });

  return { ok: true as const, id: String(note._id) };
};

export const listInstitutionCandidateTags = async (applicationId: string, organizationId: string) => {
  await connectDB();
  const access = await assertInstitutionApplicationAccess(applicationId, organizationId);
  if (!access.ok) return { ok: false as const, error: access.error, code: access.code };

  const rows = await InstitutionCandidateTag.find({ applicationId, organizationId }).sort({ createdAt: 1 }).lean();
  return {
    ok: true as const,
    items: rows.map((row) => ({
      id: String(row._id),
      tag: row.tag,
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    })),
  };
};

export const addInstitutionCandidateTag = async (input: {
  applicationId: string;
  organizationId: string;
  tag: string;
  authorId: string;
  authorName: string;
  request?: NextRequest;
}) => {
  await connectDB();
  const access = await assertInstitutionApplicationAccess(input.applicationId, input.organizationId);
  if (!access.ok) return { ok: false as const, error: access.error, code: access.code };

  const tag = String(input.tag || "").trim().slice(0, 80);
  if (!tag) return { ok: false as const, error: "Tag is required", code: "empty_tag" };

  const existing = await InstitutionCandidateTag.findOne({
    applicationId: input.applicationId,
    organizationId: input.organizationId,
    tag,
  });
  if (existing) return { ok: true as const, id: String(existing._id) };

  const row = await InstitutionCandidateTag.create({
    applicationId: new mongoose.Types.ObjectId(input.applicationId),
    organizationId: new mongoose.Types.ObjectId(input.organizationId),
    tag,
    addedBy: new mongoose.Types.ObjectId(input.authorId),
  });

  await appendCandidateTimeline(input.applicationId, CANDIDATE_TIMELINE_ACTIONS.candidateTagAdded, {
    id: input.authorId,
    name: input.authorName,
  }, tag);

  await logAuditEvent({
    actionType: CANDIDATE_TIMELINE_ACTIONS.candidateTagAdded,
    entityType: "institution_candidate_tag",
    entityId: String(row._id),
    descriptionAr: "إضافة وسم للمرشح",
    actor: {
      id: new mongoose.Types.ObjectId(input.authorId),
      name: input.authorName,
      role: "trainingInstitution",
    },
    request: input.request,
    outcome: "success",
    metadata: { applicationId: input.applicationId, tag },
  });

  return { ok: true as const, id: String(row._id) };
};

export const removeInstitutionCandidateTag = async (input: {
  applicationId: string;
  organizationId: string;
  tagId: string;
}) => {
  await connectDB();
  const access = await assertInstitutionApplicationAccess(input.applicationId, input.organizationId);
  if (!access.ok) return { ok: false as const, error: access.error, code: access.code };

  await InstitutionCandidateTag.deleteOne({
    _id: input.tagId,
    applicationId: input.applicationId,
    organizationId: input.organizationId,
  });

  return { ok: true as const };
};

export const recordCandidateComparison = async (input: {
  applicationIds: string[];
  organizationId: string;
  actorId: string;
  actorName: string;
  request?: NextRequest;
}) => {
  if (input.applicationIds.length < 2) return;

  await appendCandidateTimeline(input.applicationIds[0], CANDIDATE_TIMELINE_ACTIONS.candidateCompared, {
    id: input.actorId,
    name: input.actorName,
  }, input.applicationIds.join(", "));

  await logAuditEvent({
    actionType: CANDIDATE_TIMELINE_ACTIONS.candidateCompared,
    entityType: "institution_candidate_comparison",
    entityId: input.organizationId,
    descriptionAr: "مقارنة بين مرشحين",
    actor: {
      id: new mongoose.Types.ObjectId(input.actorId),
      name: input.actorName,
      role: "trainingInstitution",
    },
    request: input.request,
    outcome: "success",
    metadata: { applicationIds: input.applicationIds },
  });
};

export const updateTrainingInterviewWorkspace = async (input: {
  interviewId: string;
  organizationId: string;
  actor: { id: string; name: string };
  recordingUrl?: string;
  attendance?: "pending" | "attended" | "no_show";
  resultNotes?: string;
  notes?: string;
  status?: "scheduled" | "completed" | "cancelled" | "rescheduled";
  request?: NextRequest;
}) => {
  await connectDB();
  const interview = await TrainingInterview.findById(input.interviewId);
  if (!interview || String(interview.organizationId) !== input.organizationId) {
    return { ok: false as const, error: "Interview not found", code: "not_found" };
  }

  const access = await assertInstitutionApplicationAccess(String(interview.applicationId), input.organizationId);
  if (!access.ok) return { ok: false as const, error: access.error, code: access.code };

  if (input.recordingUrl !== undefined) interview.recordingUrl = input.recordingUrl.trim();
  if (input.attendance) interview.attendance = input.attendance;
  if (input.resultNotes !== undefined) interview.resultNotes = input.resultNotes.trim();
  if (input.notes !== undefined) interview.notes = input.notes.trim();
  if (input.status) interview.status = input.status;

  await interview.save();

  if (input.status === "completed" || input.attendance === "attended" || input.attendance === "no_show") {
    await appendCandidateTimeline(
      String(interview.applicationId),
      CANDIDATE_TIMELINE_ACTIONS.interviewCompleted,
      input.actor,
      input.resultNotes || input.attendance
    );
  }

  return { ok: true as const };
};
