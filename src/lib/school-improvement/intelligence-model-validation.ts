import "server-only";
import Achievement from "@/models/Achievement";
import User from "@/models/User";
import StudentCareerProfile from "@/models/StudentCareerProfile";
import TrainingCompletionRecord from "@/models/TrainingCompletionRecord";
import TrainingOpportunity from "@/models/TrainingOpportunity";
import PartnerOrganization from "@/models/PartnerOrganization";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import {
  getIntelligenceDiagnosticsContext,
  recordModelIssue,
} from "@/lib/school-improvement/intelligence-diagnostics-context";
import type { ModelValidationIssue } from "@/lib/school-improvement/intelligence-diagnostics-types";

type RequiredModel = {
  name: string;
  model: { modelName?: string; collection?: { name?: string } } | undefined;
};

const REQUIRED_MODELS: RequiredModel[] = [
  { name: "Achievement", model: Achievement },
  { name: "User", model: User },
  { name: "StudentCareerProfile", model: StudentCareerProfile },
  { name: "TrainingCompletionRecord", model: TrainingCompletionRecord },
  { name: "TrainingOpportunity", model: TrainingOpportunity },
  { name: "PartnerOrganization", model: PartnerOrganization },
  { name: "StudentTrainingApplication", model: StudentTrainingApplication },
];

export const validateIntelligenceModels = (): ModelValidationIssue[] => {
  const issues: ModelValidationIssue[] = [];

  for (const entry of REQUIRED_MODELS) {
    if (entry.model == null) {
      issues.push({
        kind: "missing_model",
        name: entry.name,
        message: `${entry.name} import is undefined`,
      });
      continue;
    }
    if (!entry.model.modelName) {
      issues.push({
        kind: "missing_model",
        name: entry.name,
        message: `${entry.name} is registered without modelName`,
      });
    }
  }

  return issues;
};

export const probeIntelligenceModelImports = async (): Promise<ModelValidationIssue[]> => {
  const issues = validateIntelligenceModels();

  const importProbes: Array<{ name: string; loader: () => Promise<unknown> }> = [
    {
      name: "buildStudentIntelligence",
      loader: () => import("@/lib/student-intelligence-analytics"),
    },
    {
      name: "buildPartnershipIntelligenceDashboard",
      loader: () => import("@/lib/partnerships/institution-performance-intelligence-service"),
    },
    {
      name: "buildExecutiveDecisionIntelligence",
      loader: () => import("@/lib/analytics/executive-decision-intelligence-service"),
    },
    {
      name: "getLeaderboard",
      loader: () => import("@/lib/leaderboard-service"),
    },
  ];

  for (const probe of importProbes) {
    try {
      await probe.loader();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const kind: ModelValidationIssue["kind"] = message.includes("Circular")
        ? "circular_dependency"
        : "undefined_import";
      issues.push({
        kind,
        name: probe.name,
        message,
      });
    }
  }

  const ctx = getIntelligenceDiagnosticsContext();
  if (ctx) {
    for (const issue of issues) {
      recordModelIssue(issue);
    }
  }

  return issues;
};
