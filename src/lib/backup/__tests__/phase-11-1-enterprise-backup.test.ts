import { describe, expect, it } from "vitest";
import {
  BACKUP_MANIFEST_VERSION,
  BACKUP_MODULES,
  getBackupModule,
  resolveCollectionFileName,
} from "@/lib/backup/backup-constants";
import { buildBackupManifest, parseManifest, serializeManifest } from "@/lib/backup/backup-manifest";
import {
  buildDryRunRestoreReport,
  validateExtractedBackupPackage,
} from "@/lib/backup/restore-validation";
import { buildRestoreAuditMetadata } from "@/lib/backup/restore-audit";
import {
  buildZipFromEntries,
  createPackageEntry,
  extractBackupZipPackage,
} from "@/lib/backup/backup-zip";

const buildSampleZip = async (): Promise<Buffer> => {
  const manifest = buildBackupManifest({
    backupModule: "achievements",
    collections: ["achievements"],
    recordCounts: { achievements: 2 },
    academicYear: "2025/2026",
  });
  const achievementsJson = Buffer.from(
    '[{"_id":{"$oid":"507f1f77bcf86cd799439011"},"title":"A"}]\n',
    "utf8"
  );
  const entry = createPackageEntry({
    collectionKey: "achievements",
    content: achievementsJson,
    recordCount: 2,
  });
  return buildZipFromEntries({ manifest, entries: [entry] });
};

describe("phase 11.1 — enterprise backup & restore", () => {
  it("defines backup modules including full and selective scopes", () => {
    expect(BACKUP_MODULES.length).toBeGreaterThanOrEqual(8);
    const full = getBackupModule("full");
    expect(full.collectionKeys).toContain("users");
    expect(full.collectionKeys).toContain("achievements");
    expect(full.collectionKeys).toContain("schoolYears");
    expect(full.collectionKeys).toContain("studentTrainingApplications");
    expect(resolveCollectionFileName("users")).toBe("users.json");
  });

  it("generates manifest with required metadata fields", () => {
    const manifest = buildBackupManifest({
      backupModule: "full",
      collections: ["users", "achievements"],
      recordCounts: { users: 10, achievements: 20 },
      academicYear: "2025/2026",
    });
    expect(manifest.version).toBe(BACKUP_MANIFEST_VERSION);
    expect(manifest.platformVersion).toBeTruthy();
    expect(manifest.createdAt).toBeTruthy();
    expect(manifest.collections).toEqual(["users", "achievements"]);
    expect(manifest.recordCounts.users).toBe(10);

    const parsed = parseManifest(serializeManifest(manifest));
    expect(parsed.backupModule).toBe("full");
  });

  it("validates backup package integrity (PASS)", async () => {
    const zipBuffer = await buildSampleZip();
    const extracted = await extractBackupZipPackage(zipBuffer);
    const report = validateExtractedBackupPackage(extracted);
    expect(report.status).toBe("PASS");
    expect(report.reasons).toEqual([]);
  });

  it("fails validation when manifest version mismatches", () => {
    const report = validateExtractedBackupPackage({
      manifest: {
        version: "0.0",
        createdAt: new Date().toISOString(),
        platformVersion: "1.0.0",
        academicYear: null,
        backupModule: "full",
        collections: ["users"],
        recordCounts: { users: 1 },
      },
      collections: {},
      objects: {},
    });
    expect(report.status).toBe("FAIL");
    expect(report.reasons.some((reason) => reason.includes("غير مدعوم"))).toBe(true);
  });

  it("builds dry-run restore preview without writes", async () => {
    const zipBuffer = await buildSampleZip();
    const extracted = await extractBackupZipPackage(zipBuffer);
    const validation = validateExtractedBackupPackage(extracted);
    const dryRun = buildDryRunRestoreReport(validation);
    expect(dryRun.status).toBe("PASS");
    expect(dryRun.counts.achievements).toBe(2);
  });

  it("builds restore audit metadata for compliance trail", () => {
    const metadata = buildRestoreAuditMetadata({
      backupIdentifier: "backup-2026",
      mode: "merge",
      collections: ["achievements"],
      recordCounts: { achievements: 2 },
      preRestoreBackupId: "pre-1",
      manifest: buildBackupManifest({
        backupModule: "achievements",
        collections: ["achievements"],
        recordCounts: { achievements: 2 },
      }),
    });
    expect(metadata.mode).toBe("merge");
    expect(metadata.collectionsRestored).toEqual(["achievements"]);
    expect(metadata.recordCounts.achievements).toBe(2);
    expect(metadata.preRestoreBackupId).toBe("pre-1");
  });

  it("uses batch-oriented restore constants for large datasets", async () => {
    const { BACKUP_EXPORT_BATCH_SIZE, BACKUP_RESTORE_BATCH_SIZE } = await import(
      "@/lib/backup/backup-constants"
    );
    expect(BACKUP_EXPORT_BATCH_SIZE).toBeGreaterThanOrEqual(100);
    expect(BACKUP_RESTORE_BATCH_SIZE).toBeGreaterThanOrEqual(100);
  });

  it("detects checksum tampering (FAIL)", async () => {
    const zipBuffer = await buildSampleZip();
    const extracted = await extractBackupZipPackage(zipBuffer);
    if (!extracted.manifest.checksums) throw new Error("missing checksum");
    extracted.manifest.checksums.achievements = "bad-checksum";
    const report = validateExtractedBackupPackage(extracted);
    expect(report.status).toBe("FAIL");
    expect(report.reasons.some((reason) => reason.includes("سلامة"))).toBe(true);
  });
});
