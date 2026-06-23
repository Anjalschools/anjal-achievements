import { describe, expect, it } from "vitest";
import {
  buildTrainingCompletionStudentEvaluationAverages,
  buildTrainingCompletionSupervisorRatingAverage,
} from "@/lib/partnerships/training-completion-analytics";
import { validateTrainingReportSubmitPayload } from "@/lib/partnerships/training-completion-validation";

const validPayload = () => ({
  organizationNameFromApplication: "مدرسة النور",
  supervisorName: "أحمد",
  trainingStartDate: "2025-06-01",
  trainingEndDate: "2025-08-01",
  volunteerHours: 120,
  studentBenefitRating: 5,
  positionTitle: "متدرب إداري",
  assignedTasks: "أرشفة الملفات ومتابعة المراسلات",
  studentReflection: "تعلمت التعامل مع الأنظمة الإدارية",
  supervisorCooperationRating: 5,
  practicalBenefitRating: 4,
  workEnvironmentRating: 4,
  recommendInstitutionToPeers: true,
  biggestChallenge: "ضيق الوقت في البداية",
  challengeResponse: "رتبت أولوياتي مع المشرف",
  wishedToLearn: "المزيد من المشاريع الميدانية",
  futureImpact: "سأطبق مهارات التنظيم في دراستي",
});

describe("phase T.2 — final report validation", () => {
  it("accepts a complete submit payload", () => {
    expect(validateTrainingReportSubmitPayload(validPayload())).toEqual([]);
  });

  it("requires organization name from application, not client input", () => {
    const errors = validateTrainingReportSubmitPayload({
      ...validPayload(),
      organizationNameFromApplication: "",
    });
    expect(errors).toContain("organizationName is required");
  });

  it("rejects end date before start date", () => {
    const errors = validateTrainingReportSubmitPayload({
      ...validPayload(),
      trainingStartDate: "2025-08-01",
      trainingEndDate: "2025-06-01",
    });
    expect(errors).toContain("trainingEndDate must be on or after trainingStartDate");
  });

  it("requires volunteer hours greater than zero", () => {
    const errors = validateTrainingReportSubmitPayload({
      ...validPayload(),
      volunteerHours: 0,
    });
    expect(errors).toContain("volunteerHours must be greater than zero");
  });

  it("requires position, tasks, learning outcomes, org ratings, recommendation, and reflection", () => {
    const errors = validateTrainingReportSubmitPayload({
      organizationNameFromApplication: "مدرسة",
      supervisorName: "مشرف",
      trainingStartDate: "2025-06-01",
      trainingEndDate: "2025-08-01",
      volunteerHours: 10,
      studentBenefitRating: 5,
    });
    expect(errors).toEqual(
      expect.arrayContaining([
        "positionTitle is required",
        "assignedTasks is required",
        "studentReflection is required",
        "supervisorCooperationRating must be 1-5",
        "practicalBenefitRating must be 1-5",
        "workEnvironmentRating must be 1-5",
        "recommendInstitutionToPeers is required",
        "biggestChallenge is required",
        "challengeResponse is required",
        "wishedToLearn is required",
        "futureImpact is required",
      ])
    );
  });

  it("defaults student benefit rating to valid 1–5 scale", () => {
    expect(validateTrainingReportSubmitPayload({ ...validPayload(), studentBenefitRating: 5 })).toEqual(
      []
    );
    expect(
      validateTrainingReportSubmitPayload({ ...validPayload(), studentBenefitRating: 0 })
    ).toContain("studentBenefitRating must be 1-5");
  });

  it("validates supported video URL hosts on submit", () => {
    expect(
      validateTrainingReportSubmitPayload({
        ...validPayload(),
        videoUrl: "https://www.youtube.com/watch?v=abc",
      })
    ).toEqual([]);
    expect(
      validateTrainingReportSubmitPayload({
        ...validPayload(),
        videoUrl: "https://example.com/video",
      })
    ).toContain("videoUrl must be YouTube, Vimeo, Google Drive, or OneDrive");
  });
});

describe("phase T.2 — training completion analytics", () => {
  it("aggregates student evaluation scores and recommendation rate", () => {
    const result = buildTrainingCompletionStudentEvaluationAverages([
      {
        studentBenefitRating: 5,
        supervisorCooperationRating: 4,
        practicalBenefitRating: 4,
        workEnvironmentRating: 5,
        recommendInstitutionToPeers: true,
        volunteerHours: 80,
      },
      {
        studentBenefitRating: 3,
        supervisorCooperationRating: 2,
        practicalBenefitRating: 3,
        workEnvironmentRating: 3,
        recommendInstitutionToPeers: false,
        volunteerHours: 60,
      },
    ]);
    expect(result.avgStudentBenefitRating).toBe(4);
    expect(result.avgSupervisorCooperationRating).toBe(3);
    expect(result.recommendInstitutionToPeersPct).toBe(50);
    expect(result.totalTrainingHours).toBe(140);
  });

  it("prefers new student org ratings over legacy institution fields", () => {
    const avg = buildTrainingCompletionSupervisorRatingAverage({
      supervisorCooperationRating: 5,
      practicalBenefitRating: 4,
      workEnvironmentRating: 3,
      attendanceCommitment: 1,
      professionalEthics: 1,
      overallRecommendation: 1,
    });
    expect(avg).toBe(4);
  });

  it("falls back to legacy institution ratings when student org ratings are absent", () => {
    const avg = buildTrainingCompletionSupervisorRatingAverage({
      attendanceCommitment: 4,
      professionalEthics: 4,
      overallRecommendation: 4,
    });
    expect(avg).toBe(4);
  });
});
