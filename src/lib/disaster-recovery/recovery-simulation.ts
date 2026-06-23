import "server-only";
import { extractBackupZipPackage } from "@/lib/backup/backup-zip";
import { validateDisasterRecoveryPackage } from "@/lib/disaster-recovery/dr-validation";
import { parseStorageManifest } from "@/lib/disaster-recovery/storage-manifest-types";

export type RecoverySimulationReport = {
  status: "PASS" | "FAIL";
  phases: {
    validation: "PASS" | "FAIL";
    databaseDryRun: "PASS" | "FAIL";
    objectDryRun: "PASS" | "FAIL";
    objectRestoreSimulation: "PASS" | "FAIL";
  };
  recoveryReadinessScore: number;
  certifications: string[];
  reasons: string[];
  simulatedObjectRestores: number;
};

export const runRecoverySimulation = async (zipBuffer: Buffer): Promise<RecoverySimulationReport> => {
  const extracted = await extractBackupZipPackage(zipBuffer);
  const validation = validateDisasterRecoveryPackage(extracted);
  const reasons = [...validation.database.reasons, ...validation.objects.reasons];

  let simulatedObjectRestores = 0;
  let objectRestoreSimulation: "PASS" | "FAIL" = "PASS";

  if (extracted.manifest.includesObjectStorage) {
    if (!extracted.storageManifest) {
      objectRestoreSimulation = "FAIL";
      reasons.push("storage-manifest.json مفقود في محاكاة الاستعادة.");
    } else {
      const storageManifest = parseStorageManifest(extracted.storageManifest.toString("utf8"));
      const restorable = storageManifest.entries.filter(
        (entry) =>
          (entry.provider === "r2" || entry.provider === "cloudinary") && entry.status === "exported"
      );
      simulatedObjectRestores = restorable.filter((entry) => Boolean(extracted.objects[entry.archivePath]))
        .length;
      const missing = restorable.length - simulatedObjectRestores;
      if (missing > 0) {
        objectRestoreSimulation = "FAIL";
        reasons.push(`${missing} كائن(ات) قابلة للاستعادة لكن ملفاتها مفقودة من الحزمة.`);
      }
    }
  }

  const status =
    validation.status === "PASS" && objectRestoreSimulation === "PASS" ? "PASS" : "FAIL";

  return {
    status,
    phases: {
      validation: validation.status,
      databaseDryRun: validation.database.status,
      objectDryRun: validation.objects.status,
      objectRestoreSimulation,
    },
    recoveryReadinessScore: validation.recoveryReadinessScore,
    certifications: validation.certifications,
    reasons,
    simulatedObjectRestores,
  };
};
