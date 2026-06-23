import {
  BACKUP_COLLECTION_REGISTRY,
  BACKUP_MANIFEST_VERSION,
  LEGACY_BACKUP_MANIFEST_VERSION,
  resolveCollectionFileName,
  resolveMongoCollectionName,
} from "@/lib/backup/backup-constants";
import { hashContent, type BackupManifest } from "@/lib/backup/backup-manifest";
import type { ExtractedBackupPackage } from "@/lib/backup/backup-package";

export type BackupValidationStatus = "PASS" | "FAIL";

export type BackupValidationReport = {
  status: BackupValidationStatus;
  reasons: string[];
  manifest?: BackupManifest;
  collectionSummary?: Record<string, number>;
};

const findCollectionKeyByMongoName = (mongoName: string): string | null => {
  for (const [key, name] of Object.entries(BACKUP_COLLECTION_REGISTRY)) {
    if (name === mongoName) return key;
  }
  return null;
};

export const validateExtractedBackupPackage = (
  extracted: ExtractedBackupPackage
): BackupValidationReport => {
  const reasons: string[] = [];
  const { manifest, collections } = extracted;

  if (!manifest) {
    return { status: "FAIL", reasons: ["ملف manifest.json غير موجود."] };
  }

  if (
    manifest.version !== BACKUP_MANIFEST_VERSION &&
    manifest.version !== LEGACY_BACKUP_MANIFEST_VERSION
  ) {
    reasons.push(`إصدار النسخة الاحتياطية غير مدعوم: ${manifest.version}`);
  }

  if (!manifest.createdAt || !manifest.platformVersion) {
    reasons.push("بيانات manifest الأساسية ناقصة (createdAt / platformVersion).");
  }

  if (!Array.isArray(manifest.collections) || manifest.collections.length === 0) {
    reasons.push("قائمة المجموعات في manifest فارغة.");
  }

  const collectionSummary: Record<string, number> = {};

  for (const collectionKey of manifest.collections || []) {
    const fileName = resolveCollectionFileName(collectionKey).replace(/^collections\//, "");
    const mongoName = resolveMongoCollectionName(collectionKey);
    const content = collections[mongoName];

    if (!content) {
      reasons.push(`ملف المجموعة مفقود: collections/${fileName}`);
      continue;
    }

    const expectedCount = manifest.recordCounts?.[collectionKey];
    if (typeof expectedCount !== "number") {
      reasons.push(`عدد السجلات غير معرّف في manifest للمجموعة: ${collectionKey}`);
    }

    const checksum = manifest.checksums?.[collectionKey];
    if (checksum) {
      const actual = hashContent(content);
      if (actual !== checksum) {
        reasons.push(`فحص سلامة الملف فشل للمجموعة: ${collectionKey}`);
      }
    }

    try {
      const raw = content.toString("utf8").trim();
      if (raw && raw !== "[]") {
        JSON.parse(raw);
      }
      collectionSummary[collectionKey] = expectedCount ?? 0;
    } catch {
      reasons.push(`ملف JSON غير صالح للمجموعة: ${collectionKey}`);
    }
  }

  for (const mongoName of Object.keys(collections)) {
    const key = findCollectionKeyByMongoName(mongoName);
    if (!key || !manifest.collections.includes(key)) {
      reasons.push(`ملف غير متوقع داخل الحزمة: collections/${mongoName}.json`);
    }
  }

  return {
    status: reasons.length ? "FAIL" : "PASS",
    reasons,
    manifest,
    collectionSummary,
  };
};

export type DryRunRestoreReport = {
  status: BackupValidationStatus;
  reasons: string[];
  counts: Record<string, number>;
  labelsAr: Record<string, string>;
};

const DRY_RUN_LABELS_AR: Record<string, string> = {
  users: "المستخدمون",
  achievements: "الإنجازات",
  schoolYears: "أعوام المدرسة",
  academicYears: "الأعوام الأكاديمية",
  academicSnapshots: "لقطات أكاديمية",
  studentTrainingApplications: "طلبات التدريب",
  trainingCompletionRecords: "سجلات إتمام التدريب",
  siteSettings: "إعدادات الموقع",
  platformSettings: "إعدادات المنصة",
  auditLogs: "سجلات التدقيق",
  notifications: "الإشعارات",
};

export const buildDryRunRestoreReport = (
  validation: BackupValidationReport
): DryRunRestoreReport => {
  if (validation.status !== "PASS" || !validation.manifest) {
    return {
      status: "FAIL",
      reasons: validation.reasons,
      counts: {},
      labelsAr: {},
    };
  }

  const counts = validation.manifest.recordCounts || {};
  const labelsAr = Object.fromEntries(
    Object.keys(counts).map((key) => [key, DRY_RUN_LABELS_AR[key] || key])
  );

  return {
    status: "PASS",
    reasons: [],
    counts,
    labelsAr,
  };
};
