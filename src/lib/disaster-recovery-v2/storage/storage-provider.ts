import type { BackupContext } from "@/lib/disaster-recovery-v2/types/backup-context";
import type { StorageDiscoveryAsset } from "@/lib/disaster-recovery-v2/storage/storage-manifest-types";

export type StorageDiscoveryResult = {
  provider: string;
  assets: StorageDiscoveryAsset[];
};

export interface StorageProvider {
  readonly id: string;
  readonly required: boolean;
  discover(context: BackupContext): Promise<StorageDiscoveryResult>;
}
