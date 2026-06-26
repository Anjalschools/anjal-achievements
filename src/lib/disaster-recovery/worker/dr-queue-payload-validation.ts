import "server-only";

import { BACKUP_MODULES, type BackupModuleId } from "@/lib/backup/backup-constants";
import type { RetentionTier } from "@/lib/disaster-recovery/retention-policy";
import type { BackupJobQueuePayload } from "@/lib/disaster-recovery/worker/dr-job-queue-types";

const VALID_STORAGE_PROVIDERS = new Set(["local", "r2"]);
const VALID_RETENTION_TIERS = new Set<RetentionTier>(["daily", "weekly", "monthly"]);
const VALID_MODULE_IDS = new Set(BACKUP_MODULES.map((row) => row.id));

export type DrQueuePayloadValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

export const validateDrQueuePayload = (
  payload: BackupJobQueuePayload | null | undefined
): DrQueuePayloadValidationResult => {
  if (!payload || typeof payload !== "object") {
    return { valid: false, reason: "payload_missing" };
  }

  if (!payload.recordId || typeof payload.recordId !== "string") {
    return { valid: false, reason: "record_id_missing" };
  }

  if (!payload.input || typeof payload.input !== "object") {
    return { valid: false, reason: "input_missing" };
  }

  const { input } = payload;
  if (!input.moduleId || typeof input.moduleId !== "string") {
    return { valid: false, reason: "module_id_missing" };
  }
  if (!VALID_MODULE_IDS.has(input.moduleId as BackupModuleId)) {
    return { valid: false, reason: `unknown_module:${input.moduleId}` };
  }

  if (!input.storageProvider || typeof input.storageProvider !== "string") {
    return { valid: false, reason: "storage_provider_missing" };
  }
  if (!VALID_STORAGE_PROVIDERS.has(input.storageProvider)) {
    return { valid: false, reason: `unknown_storage_provider:${input.storageProvider}` };
  }

  if (!input.createdByUserId || typeof input.createdByUserId !== "string") {
    return { valid: false, reason: "created_by_user_id_missing" };
  }

  if (input.retentionTier !== undefined && input.retentionTier !== null) {
    if (!VALID_RETENTION_TIERS.has(input.retentionTier as RetentionTier)) {
      return { valid: false, reason: `unknown_retention_tier:${input.retentionTier}` };
    }
  }

  return { valid: true };
};
