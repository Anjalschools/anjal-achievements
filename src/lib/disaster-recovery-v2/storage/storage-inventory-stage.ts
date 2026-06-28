import type { BackupStage } from "@/lib/disaster-recovery-v2/types/stage";

export const STORAGE_INVENTORY_STAGE_ID = "storage-inventory" as const;

export type StorageInventoryStage = BackupStage & {
  readonly id: typeof STORAGE_INVENTORY_STAGE_ID;
};
