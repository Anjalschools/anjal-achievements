import type { StorageDiscoveryAsset } from "@/lib/disaster-recovery-v2/storage/storage-manifest-types";
import type { RestoreContext } from "@/lib/disaster-recovery-v2/restore/restore-context";

export type AssetRestoreResult = {
  provider: string;
  publicId: string;
  storageKey: string;
};

export interface AssetRestoreProvider {
  readonly id: string;
  restore(input: {
    asset: StorageDiscoveryAsset;
    localFilePath: string;
    context: RestoreContext;
  }): Promise<AssetRestoreResult>;
}
