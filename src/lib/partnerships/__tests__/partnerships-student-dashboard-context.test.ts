import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mongodb", () => ({ default: vi.fn(async () => undefined) }));

import { STUDENT_TRAINING_APPLICATION_STATUSES } from "@/lib/partnerships/partnerships-constants";
import { trainingApplicationStatusLabel } from "@/lib/partnerships/partnerships-application-status-ui";
import {
  createFallbackStudentTrainingDashboardContext,
  type StudentTrainingDashboardContext,
} from "@/lib/partnerships/partnerships-student-dashboard-context";
import {
  resolveStudentTrainingWidgetLabels,
  resolveStudentTrainingWidgetStatus,
  studentTrainingWidgetStatusLabel,
  STUDENT_TRAINING_WIDGET_LABELS,
  STUDENT_TRAINING_WIDGET_LABEL_DEFAULT,
} from "@/lib/partnerships/partnerships-student-dashboard-ui";

const assertLabelsNeverCrash = (status: string) => {
  const widgetStatus = resolveStudentTrainingWidgetStatus(status);
  const labels = resolveStudentTrainingWidgetLabels(widgetStatus);
  expect(labels).toBeDefined();
  expect(typeof labels.ar).toBe("string");
  expect(typeof labels.en).toBe("string");
  expect(labels.ar.length).toBeGreaterThan(0);
  expect(labels.en.length).toBeGreaterThan(0);
  expect(() => studentTrainingWidgetStatusLabel(status, true)).not.toThrow();
  expect(() => studentTrainingWidgetStatusLabel(status, false)).not.toThrow();
  expect(() => trainingApplicationStatusLabel(status, true)).not.toThrow();
};

const buildWidgetFromStatus = (status: string): StudentTrainingDashboardContext["widget"] => {
  const widgetStatus = resolveStudentTrainingWidgetStatus(status);
  const labels = resolveStudentTrainingWidgetLabels(widgetStatus);
  return {
    status: widgetStatus,
    applicationStatus: status as (typeof STUDENT_TRAINING_APPLICATION_STATUSES)[number],
    statusLabelAr: labels?.ar ?? STUDENT_TRAINING_WIDGET_LABEL_DEFAULT.ar,
    statusLabelEn: labels?.en ?? STUDENT_TRAINING_WIDGET_LABEL_DEFAULT.en,
    opportunityId: "507f1f77bcf86cd799439011",
    opportunityTitle: "Test Opportunity",
    organizationName: "Test Org",
    applicationId: "507f1f77bcf86cd799439012",
    submittedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
  };
};

describe("student training widget status labels — crash protection", () => {
  it("covers all official application statuses", () => {
    for (const status of STUDENT_TRAINING_APPLICATION_STATUSES) {
      assertLabelsNeverCrash(status);
      expect(STUDENT_TRAINING_WIDGET_LABELS[resolveStudentTrainingWidgetStatus(status)]).toBeDefined();
    }
  });

  it("handles rejected without undefined .ar access", () => {
    assertLabelsNeverCrash("rejected");
    const labels = resolveStudentTrainingWidgetLabels("rejected");
    expect(labels.ar).toBe("مرفوض");
    expect(labels.en).toBe("Rejected");
  });

  it("handles institution_rejected alias", () => {
    assertLabelsNeverCrash("institution_rejected");
    expect(resolveStudentTrainingWidgetStatus("institution_rejected")).toBe("rejected");
  });

  it("handles training_completed alias", () => {
    assertLabelsNeverCrash("training_completed");
    expect(resolveStudentTrainingWidgetStatus("training_completed")).toBe("completed");
  });

  it("handles completely unknown status with safe fallback", () => {
    assertLabelsNeverCrash("totally_unknown_status_xyz");
    const labels = resolveStudentTrainingWidgetLabels("totally_unknown_status_xyz");
    expect(labels.ar).toBe(STUDENT_TRAINING_WIDGET_LABEL_DEFAULT.ar);
    expect(labels.en).toBe(STUDENT_TRAINING_WIDGET_LABEL_DEFAULT.en);
  });

  it("builds widget labels for rejected student without throwing", () => {
    const widget = buildWidgetFromStatus("rejected");
    expect(widget.statusLabelAr).toBe("مرفوض");
    expect(widget.statusLabelEn).toBe("Rejected");
  });

  it("builds widget labels for each required lifecycle status", () => {
    const statuses = [
      "submitted",
      "under_review",
      "institution_review",
      "interview_requested",
      "accepted",
      "awaiting_school_approval",
      "rejected",
      "institution_rejected",
      "completed",
      "training_completed",
    ];
    for (const status of statuses) {
      const widget = buildWidgetFromStatus(status);
      expect(widget.statusLabelAr).toBeTruthy();
      expect(widget.statusLabelEn).toBeTruthy();
    }
  });
});

describe("student training dashboard fallback context", () => {
  it("returns safe defaults that never expose undefined labels", () => {
    const fallback = createFallbackStudentTrainingDashboardContext();
    expect(fallback.widget.statusLabelAr).toBe(STUDENT_TRAINING_WIDGET_LABEL_DEFAULT.ar);
    expect(fallback.widget.statusLabelEn).toBe(STUDENT_TRAINING_WIDGET_LABEL_DEFAULT.en);
    expect(fallback.quickActions.showApplicationStatus).toBe(false);
    expect(Array.isArray(fallback.certificates)).toBe(true);
  });
});

describe("API hardening contracts", () => {
  it("student-training-context route returns fallback instead of 500 on failure", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/app/api/partnerships/student-training-context/route.ts", "utf8");
    expect(src).toContain("createFallbackStudentTrainingDashboardContext");
    expect(src).not.toContain("jsonInternalServerError(error)");
  });

  it("student-opportunities route isolates training context failures", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/app/api/partnerships/student-opportunities/route.ts", "utf8");
    expect(src).toContain("createFallbackStudentTrainingDashboardContext");
    expect(src).toContain("training context");
  });

  it("user dashboard route isolates training context failures", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/app/api/user/dashboard/route.ts", "utf8");
    expect(src).toContain("createFallbackStudentTrainingDashboardContext");
    expect(src).toContain("training context");
  });
});
