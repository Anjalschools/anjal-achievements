import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import {
  auditTrainingPartnershipModelIndexes,
  findDuplicateFieldIndexIssues,
  loadTrainingPartnershipModels,
} from "@/lib/partnerships/training-model-index-audit";

describe("phase T.2.5.D — training & partnership index hygiene", () => {
  const duplicateWarnings: string[] = [];
  let originalWarn: typeof console.warn;

  beforeEach(() => {
    duplicateWarnings.length = 0;
    originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      const message = args.map(String).join(" ");
      if (message.includes("Duplicate schema index")) {
        duplicateWarnings.push(message);
      }
      originalWarn(...args);
    };
  });

  afterEach(() => {
    console.warn = originalWarn;
  });

  it("loads all training/partnership models without duplicate schema index warnings", async () => {
    const models = await loadTrainingPartnershipModels();
    expect(models.length).toBeGreaterThanOrEqual(24);
    expect(duplicateWarnings).toEqual([]);
  });

  it("has no field-level index declarations conflicting with schema.index()", async () => {
    const { duplicates } = await auditTrainingPartnershipModelIndexes();
    expect(duplicates).toEqual([]);
  });

  it("retains required compound and unique indexes in inventory", async () => {
    const { inventory } = await auditTrainingPartnershipModelIndexes();

    const hasIndex = (model: string, fragment: string) =>
      inventory.some((row) => row.model === model && row.index.includes(fragment));

    expect(hasIndex("TrainingCompletionRecord", '"applicationId":1')).toBe(true);
    expect(hasIndex("TrainingCompletionRecord", '"status":1')).toBe(true);
    expect(hasIndex("StudentTrainingApplication", '"studentId":1')).toBe(true);
    expect(hasIndex("PartnershipThread", '"applicationId":1')).toBe(true);
    expect(hasIndex("TrainingOutcomeRecord", '"studentId":1')).toBe(true);
    expect(hasIndex("PartnerOrganization", '"institutionUserId":1')).toBe(true);
  });

  it("documents index inventory shape for production audit", async () => {
    const { inventory, modelCount } = await auditTrainingPartnershipModelIndexes();
    expect(modelCount).toBeGreaterThanOrEqual(24);
    expect(inventory.every((row) => row.model && row.index && row.status)).toBe(true);

    const statusCounts = inventory.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = (acc[row.status] ?? 0) + 1;
      return acc;
    }, {});

    expect((statusCounts.Active ?? 0) + (statusCounts.Compound ?? 0) + (statusCounts.Unique ?? 0)).toBeGreaterThan(0);
  });

  it("detects duplicate issues when both index:true and schema.index exist (guard)", () => {
    const probeSchema = new mongoose.Schema({
      sampleField: { type: String, index: true },
    });
    probeSchema.index({ sampleField: 1 });
    const ProbeModel = mongoose.model(`ProbeModel_${Date.now()}`, probeSchema);

    const issues = findDuplicateFieldIndexIssues(ProbeModel.modelName, ProbeModel.schema);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.field).toBe("sampleField");
  });
});
