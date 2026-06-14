import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CANDIDATE_TIMELINE_ACTIONS,
  INSTITUTION_PIPELINE_STAGES,
  PREDEFINED_CANDIDATE_TAGS,
} from "@/lib/partnerships/institution-candidate-pipeline-constants";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/mongodb", () => ({ default: vi.fn(async () => undefined) }));

const readSrc = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

describe("Phase 10.2.7 — institution candidate pipeline", () => {
  it("registers InstitutionPrivateNote model with institution-only fields", () => {
    const src = readSrc("src/models/InstitutionPrivateNote.ts");
    expect(src).toContain("applicationId");
    expect(src).toContain("organizationId");
    expect(src).toContain("authorId");
    expect(src).toContain("category");
    expect(src).toContain("body");
  });

  it("registers InstitutionCandidateTag model with unique application+tag index", () => {
    const src = readSrc("src/models/InstitutionCandidateTag.ts");
    expect(src).toContain("applicationId");
    expect(src).toContain("organizationId");
    expect(src).toContain("tag");
    expect(src).toContain("addedBy");
    expect(src).toContain("unique: true");
  });

  it("defines nine pipeline stages without new workflow statuses", () => {
    expect(INSTITUTION_PIPELINE_STAGES).toHaveLength(9);
    expect(INSTITUTION_PIPELINE_STAGES).toEqual([
      "new",
      "inReview",
      "awaitingDocuments",
      "awaitingInterview",
      "awaitingDecision",
      "accepted",
      "rejected",
      "inTraining",
      "completed",
    ]);
  });

  it("defines predefined candidate tags", () => {
    expect(PREDEFINED_CANDIDATE_TAGS).toContain("talented");
    expect(PREDEFINED_CANDIDATE_TAGS).toContain("high_priority");
    expect(PREDEFINED_CANDIDATE_TAGS.length).toBe(8);
  });

  it("includes candidate timeline action labels", async () => {
    const { timelineActionLabel } = await import("@/lib/partnerships/partnerships-application-workflow");
    expect(timelineActionLabel(CANDIDATE_TIMELINE_ACTIONS.documentRequested, true)).toContain("مستند");
    expect(timelineActionLabel(CANDIDATE_TIMELINE_ACTIONS.documentUploaded, true)).toContain("رفع");
    expect(timelineActionLabel(CANDIDATE_TIMELINE_ACTIONS.interviewCompleted, true)).toBeTruthy();
    expect(timelineActionLabel(CANDIDATE_TIMELINE_ACTIONS.candidateTagAdded, true)).toBeTruthy();
    expect(timelineActionLabel(CANDIDATE_TIMELINE_ACTIONS.candidateNoteAdded, true)).toBeTruthy();
    expect(timelineActionLabel(CANDIDATE_TIMELINE_ACTIONS.candidateCompared, true)).toBeTruthy();
  });

  it("exports pipeline service helpers for scorecard, comparison, and analytics", () => {
    const src = readSrc("src/lib/partnerships/institution-candidate-pipeline-service.ts");
    expect(src).toContain("derivePipelineStage");
    expect(src).toContain("buildCandidateScorecard");
    expect(src).toContain("buildDocumentTracker");
    expect(src).toContain("listInstitutionCandidatePipeline");
    expect(src).toContain("buildInstitutionRecruitmentAnalytics");
    expect(src).toContain("compareInstitutionCandidates");
    expect(src).toContain("addInstitutionPrivateNote");
    expect(src).toContain("addInstitutionCandidateTag");
    expect(src).toContain("updateTrainingInterviewWorkspace");
    expect(src).toContain("recordCandidateComparison");
  });

  it("derives pipeline stages from status and context without new workflow states", async () => {
    const { derivePipelineStage } = await import(
      "@/lib/partnerships/institution-candidate-pipeline-service"
    );
    const emptyCtx = {
      requirements: [],
      interviews: [],
      assessments: [],
      evaluations: new Set<string>(),
    };

    expect(
      derivePipelineStage({
        status: "institution_review",
        institutionStatus: "institution_pending",
        applicationId: "a1",
        ctx: emptyCtx,
      })
    ).toBe("new");

    expect(
      derivePipelineStage({
        status: "institution_review",
        institutionStatus: "institution_reviewing",
        applicationId: "a1",
        ctx: {
          ...emptyCtx,
          requirements: [{ applicationId: "a1" as unknown as import("mongoose").Types.ObjectId, status: "pending" }],
        },
      })
    ).toBe("awaitingDocuments");

    expect(
      derivePipelineStage({
        status: "interview_requested",
        institutionStatus: "institution_interview",
        applicationId: "a1",
        ctx: emptyCtx,
      })
    ).toBe("awaitingInterview");

    expect(
      derivePipelineStage({
        status: "rejected",
        institutionStatus: "institution_rejected",
        applicationId: "a1",
        ctx: emptyCtx,
      })
    ).toBe("rejected");

    expect(
      derivePipelineStage({
        status: "completed",
        institutionStatus: "institution_accepted",
        applicationId: "a1",
        ctx: emptyCtx,
      })
    ).toBe("completed");
  });

  it("wires document timeline events on requirement create and submit", () => {
    const src = readSrc("src/lib/partnerships/institution-experience-service.ts");
    expect(src).toContain("CANDIDATE_TIMELINE_ACTIONS.documentRequested");
    expect(src).toContain("CANDIDATE_TIMELINE_ACTIONS.documentUploaded");
  });

  it("exposes institution candidate APIs", () => {
    expect(readSrc("src/app/api/institution/candidates/pipeline/route.ts")).toContain(
      "listInstitutionCandidatePipeline"
    );
    expect(readSrc("src/app/api/institution/candidates/compare/route.ts")).toContain(
      "compareInstitutionCandidates"
    );
    expect(readSrc("src/app/api/institution/training/applications/[id]/notes/route.ts")).toContain(
      "addInstitutionPrivateNote"
    );
    expect(readSrc("src/app/api/institution/training/applications/[id]/tags/route.ts")).toContain(
      "addInstitutionCandidateTag"
    );
  });

  it("extends institution dashboard with pipeline analytics", () => {
    const src = readSrc("src/app/api/institution/dashboard/route.ts");
    expect(src).toContain("listInstitutionCandidatePipeline");
    expect(src).toContain("buildInstitutionRecruitmentAnalytics");
    expect(src).toContain("stageCounts");
    expect(src).toContain("analytics");
  });

  it("extends application detail with scorecard and private institution data", () => {
    const src = readSrc("src/lib/partnerships/institution-portal-service.ts");
    expect(src).toContain("buildCandidateScorecard");
    expect(src).toContain("buildDocumentTracker");
    expect(src).toContain("listInstitutionCandidateTags");
    expect(src).toContain("listInstitutionPrivateNotes");
  });

  it("does not modify contact governance or core workflow engines", () => {
    const contactSrc = readSrc("src/lib/partnerships/institution-contact-access-service.ts");
    expect(contactSrc).not.toContain("InstitutionPrivateNote");
    expect(contactSrc).not.toContain("InstitutionCandidateTag");

    const workflowSrc = readSrc("src/lib/partnerships/partnerships-application-workflow.ts");
    expect(workflowSrc).not.toContain("institution_candidate_pipeline");
  });
});
