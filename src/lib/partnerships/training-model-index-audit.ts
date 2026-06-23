import type { Schema } from "mongoose";

export type IndexInventoryStatus = "Active" | "Redundant" | "Unique" | "Compound";

export type IndexInventoryRow = {
  model: string;
  index: string;
  status: IndexInventoryStatus;
};

export type DuplicateFieldIndexIssue = {
  model: string;
  field: string;
  fieldFlags: string[];
  conflictingIndex: string;
};

type FieldIndexFlags = {
  explicitIndex: boolean;
  unique: boolean;
};

const serializeIndexSpec = (spec: Record<string, number | string>): string => {
  const entries = Object.entries(spec).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(Object.fromEntries(entries));
};

export const collectFieldLevelIndexFlags = (schema: Schema): Map<string, FieldIndexFlags> => {
  const flags = new Map<string, FieldIndexFlags>();

  for (const [path, schemaType] of Object.entries(schema.paths)) {
    if (path === "_id" || path === "__v") continue;

    const options = (schemaType as { options?: { index?: boolean; unique?: boolean } }).options;
    const explicitIndex = options?.index === true;
    const unique = options?.unique === true;

    if (explicitIndex || unique) {
      flags.set(path, { explicitIndex, unique });
    }
  }

  return flags;
};

export const buildIndexInventory = (modelName: string, schema: Schema): IndexInventoryRow[] => {
  const fieldFlags = collectFieldLevelIndexFlags(schema);
  const declared = schema.indexes() as [Record<string, number | string>, Record<string, unknown>?][];

  const rows: IndexInventoryRow[] = [];
  const seen = new Set<string>();

  for (const [spec, options] of declared) {
    const serialized = serializeIndexSpec(spec);
    if (seen.has(serialized)) continue;
    seen.add(serialized);

    const keys = Object.keys(spec);
    const isCompound = keys.length > 1;
    const isUnique = Boolean(options?.unique);

    let status: IndexInventoryStatus = "Active";
    if (isUnique) {
      status = "Unique";
    } else if (isCompound) {
      status = "Compound";
    }

    rows.push({
      model: modelName,
      index: serialized,
      status,
    });
  }

  for (const [field, flag] of fieldFlags.entries()) {
    const single = serializeIndexSpec({ [field]: 1 });
    if (!seen.has(single)) {
      rows.push({
        model: modelName,
        index: single,
        status: flag.unique ? "Unique" : "Active",
      });
    }
  }

  return rows.sort((a, b) => a.index.localeCompare(b.index));
};

export const findDuplicateFieldIndexIssues = (
  modelName: string,
  schema: Schema
): DuplicateFieldIndexIssue[] => {
  const fieldFlags = collectFieldLevelIndexFlags(schema);
  const declared = schema.indexes() as [Record<string, number | string>, Record<string, unknown>?][];
  const singleFieldCounts = new Map<string, { field: string; count: number }>();
  const issues: DuplicateFieldIndexIssue[] = [];

  for (const [spec] of declared) {
    const keys = Object.keys(spec);
    if (keys.length !== 1) continue;
    const field = keys[0];
    if (!field) continue;

    const serialized = serializeIndexSpec(spec);
    const current = singleFieldCounts.get(serialized);
    if (current) {
      current.count += 1;
    } else {
      singleFieldCounts.set(serialized, { field, count: 1 });
    }
  }

  for (const { field, count } of singleFieldCounts.values()) {
    if (count <= 1) continue;

    const flag = fieldFlags.get(field);
    const fieldFlagsList: string[] = [];
    if (flag?.unique) fieldFlagsList.push("unique: true");
    if (flag?.explicitIndex) fieldFlagsList.push("index: true");
    if (!fieldFlagsList.length) fieldFlagsList.push("duplicate single-field index");

    issues.push({
      model: modelName,
      field,
      fieldFlags: fieldFlagsList,
      conflictingIndex: serializeIndexSpec({ [field]: 1 }),
    });
  }

  return issues;
};

export const TRAINING_PARTNERSHIP_MODEL_IMPORTS = [
  () => import("@/models/PartnershipThread"),
  () => import("@/models/PartnershipMessage"),
  () => import("@/models/PartnershipMessageAudit"),
  () => import("@/models/PartnershipProgramSettings"),
  () => import("@/models/TrainingCompletionRecord"),
  () => import("@/models/TrainingAttachment"),
  () => import("@/models/TrainingFinalStudentEvaluation"),
  () => import("@/models/TrainingFinalInstitutionEvaluation"),
  () => import("@/models/InstitutionReview"),
  () => import("@/models/StudentTrainingApplication"),
  () => import("@/models/PartnerAccessToken"),
  () => import("@/models/PartnerOrganization"),
  () => import("@/models/InstitutionCandidateTag"),
  () => import("@/models/ApplicationRequirement"),
  () => import("@/models/TrainingAssessment"),
  () => import("@/models/TrainingInterview"),
  () => import("@/models/InstitutionPrivateNote"),
  () => import("@/models/TrainingOpportunity"),
  () => import("@/models/VolunteerRecord"),
  () => import("@/models/TrainingOutcomeRecord"),
  () => import("@/models/InstitutionTalentRecommendation"),
  () => import("@/models/InstitutionSupervisorFeedback"),
  () => import("@/models/InstitutionAnnualReview"),
  () => import("@/models/InstitutionPerformanceSnapshot"),
  () => import("@/models/StudentInstitutionContactAccess"),
  () => import("@/models/StudentCareerProfile"),
] as const;

export const loadTrainingPartnershipModels = async (): Promise<
  { modelName: string; schema: Schema }[]
> => {
  const loaded: { modelName: string; schema: Schema }[] = [];

  for (const importModel of TRAINING_PARTNERSHIP_MODEL_IMPORTS) {
    const mod = await importModel();
    const model = mod.default;
    loaded.push({ modelName: model.modelName, schema: model.schema });
  }

  return loaded;
};

export const auditTrainingPartnershipModelIndexes = async () => {
  const models = await loadTrainingPartnershipModels();
  const inventory: IndexInventoryRow[] = [];
  const duplicates: DuplicateFieldIndexIssue[] = [];

  for (const { modelName, schema } of models) {
    inventory.push(...buildIndexInventory(modelName, schema));
    duplicates.push(...findDuplicateFieldIndexIssues(modelName, schema));
  }

  return { inventory, duplicates, modelCount: models.length };
};
