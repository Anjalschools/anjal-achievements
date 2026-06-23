import { hashContent } from "@/lib/backup/backup-manifest";
import type { ExtractedBackupPackage } from "@/lib/backup/backup-zip";
import { validateExtractedBackupPackage } from "@/lib/backup/restore-validation";
import {
  parseStorageManifest,
  type StorageManifest,
  type StorageManifestEntry,
} from "@/lib/disaster-recovery/storage-manifest-types";

export type ObjectValidationIssue = {
  entryId: string;
  archivePath: string;
  reason: string;
};

export type ObjectStorageValidationReport = {
  status: "PASS" | "FAIL";
  reasons: string[];
  manifest?: StorageManifest;
  exportedCount: number;
  missingCount: number;
  corruptedCount: number;
  issues: ObjectValidationIssue[];
};

export const validateObjectStoragePackage = (
  extracted: ExtractedBackupPackage
): ObjectStorageValidationReport => {
  const reasons: string[] = [];
  const issues: ObjectValidationIssue[] = [];

  if (!extracted.storageManifest) {
    if (extracted.manifest.includesObjectStorage) {
      return {
        status: "FAIL",
        reasons: ["storage-manifest.json مفقود في نسخة الكوارث الكاملة."],
        exportedCount: 0,
        missingCount: 0,
        corruptedCount: 0,
        issues: [],
      };
    }
    return {
      status: "PASS",
      reasons: [],
      exportedCount: 0,
      missingCount: 0,
      corruptedCount: 0,
      issues: [],
    };
  }

  let manifest: StorageManifest;
  try {
    manifest = parseStorageManifest(extracted.storageManifest.toString("utf8"));
  } catch {
    return {
      status: "FAIL",
      reasons: ["storage-manifest.json غير صالح."],
      exportedCount: 0,
      missingCount: 0,
      corruptedCount: 0,
      issues: [],
    };
  }

  let missingCount = 0;
  let corruptedCount = 0;
  let exportedCount = 0;

  for (const entry of manifest.entries) {
    if (entry.status === "missing" || entry.status === "failed") {
      missingCount += 1;
      issues.push({
        entryId: entry.id,
        archivePath: entry.archivePath,
        reason: entry.errorMessage || `حالة الكائن: ${entry.status}`,
      });
      continue;
    }

    const content = extracted.objects[entry.archivePath];
    if (!content) {
      missingCount += 1;
      issues.push({
        entryId: entry.id,
        archivePath: entry.archivePath,
        reason: "ملف الكائن مفقود داخل الحزمة",
      });
      continue;
    }

    if (entry.fileSize && content.byteLength !== entry.fileSize) {
      corruptedCount += 1;
      issues.push({
        entryId: entry.id,
        archivePath: entry.archivePath,
        reason: `عدم تطابق الحجم: متوقع ${entry.fileSize} / فعلي ${content.byteLength}`,
      });
    }

    if (entry.checksum) {
      const actual = hashContent(content);
      if (actual !== entry.checksum) {
        corruptedCount += 1;
        issues.push({
          entryId: entry.id,
          archivePath: entry.archivePath,
          reason: "فحص SHA-256 فشل",
        });
      }
    }

    exportedCount += 1;
  }

  if (missingCount > 0) {
    reasons.push(`${missingCount} ملف(ات) مفقودة في حزمة التخزين.`);
  }
  if (corruptedCount > 0) {
    reasons.push(`${corruptedCount} ملف(ات) تالفة أو غير متطابقة.`);
  }

  return {
    status: reasons.length ? "FAIL" : "PASS",
    reasons,
    manifest,
    exportedCount,
    missingCount,
    corruptedCount,
    issues,
  };
};

export type DisasterRecoveryValidationReport = {
  database: ReturnType<typeof import("@/lib/backup/restore-validation").validateExtractedBackupPackage>;
  objects: ObjectStorageValidationReport;
  recoveryReadinessScore: number;
  certifications: string[];
  status: "PASS" | "FAIL";
};

export const computeRecoveryReadinessScore = (input: {
  databasePass: boolean;
  objectPass: boolean;
  includesObjectStorage: boolean;
  exportedObjectRatio: number;
}): number => {
  let score = 0;
  if (input.databasePass) score += 50;
  if (!input.includesObjectStorage) {
    return input.databasePass ? 50 : 0;
  }
  score += Math.round(50 * Math.max(0, Math.min(1, input.exportedObjectRatio)));
  if (input.objectPass) score = Math.max(score, 90);
  return Math.min(100, score);
};

export const buildCertifications = (score: number, includesObjects: boolean): string[] => {
  const certs: string[] = [];
  if (score >= 50) certs.push("DATABASE_BACKUP_READY");
  if (includesObjects && score >= 75) certs.push("OBJECT_STORAGE_BACKUP_READY");
  if (score >= 90) certs.push("DISASTER_RECOVERY_READY");
  if (score >= 95) certs.push("FULL_PLATFORM_RECOVERY_READY");
  if (score >= 95) certs.push("FULLY_CERTIFIED_PRODUCTION_PLATFORM");
  return certs;
};

export const validateDisasterRecoveryPackage = (
  extracted: ExtractedBackupPackage
): DisasterRecoveryValidationReport => {
  const database = validateExtractedBackupPackage(extracted);
  const objects = validateObjectStoragePackage(extracted);

  const includesObjectStorage = Boolean(extracted.manifest.includesObjectStorage);
  const totalObjects = objects.manifest?.entries.length || 0;
  const exportedObjectRatio = totalObjects ? objects.exportedCount / totalObjects : 1;

  const recoveryReadinessScore = computeRecoveryReadinessScore({
    databasePass: database.status === "PASS",
    objectPass: objects.status === "PASS",
    includesObjectStorage,
    exportedObjectRatio,
  });

  const certifications = buildCertifications(recoveryReadinessScore, includesObjectStorage);
  const status =
    database.status === "PASS" && (!includesObjectStorage || objects.status === "PASS")
      ? "PASS"
      : "FAIL";

  return {
    database,
    objects,
    recoveryReadinessScore,
    certifications,
    status,
  };
};

export const summarizeStorageManifest = (entries: StorageManifestEntry[]) => ({
  objectCount: entries.length,
  exportedCount: entries.filter((entry) => entry.status === "exported").length,
  missingCount: entries.filter((entry) => entry.status === "missing").length,
  failedCount: entries.filter((entry) => entry.status === "failed").length,
  totalBytes: entries.reduce((sum, entry) => sum + (entry.fileSize || 0), 0),
});
