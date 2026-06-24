import "server-only";
import type { BackupStorageProviderId } from "@/lib/backup/backup-constants";
import { resolveBackupStorageProvider } from "@/lib/backup/backup-storage";
import { isR2Configured } from "@/lib/r2";
import { DisasterRecoveryBackupError } from "@/lib/disaster-recovery/dr-backup-logging";

export type DrStorageProviderResolution = {
  requested: BackupStorageProviderId;
  resolved: BackupStorageProviderId;
  source: string;
  includeObjects: boolean;
  usesStreamingUpload: boolean;
  r2Configured: boolean;
};

const logStorageProviderResolved = (resolution: DrStorageProviderResolution): void => {
  console.log("[DR] STORAGE_PROVIDER_RESOLVED", resolution);
};

const isR2StreamingAvailable = (): boolean => {
  if (!isR2Configured()) return false;
  const provider = resolveBackupStorageProvider("r2");
  return Boolean(provider.storeStream);
};

export const resolveDisasterRecoveryStorageProvider = (input: {
  requested: BackupStorageProviderId;
  includeObjects: boolean;
  source: string;
}): DrStorageProviderResolution => {
  const r2Configured = isR2Configured();
  const r2StreamingAvailable = isR2StreamingAvailable();

  if (input.includeObjects) {
    if (!r2StreamingAvailable) {
      const resolution: DrStorageProviderResolution = {
        requested: input.requested,
        resolved: input.requested,
        source: input.source,
        includeObjects: true,
        usesStreamingUpload: false,
        r2Configured,
      };
      logStorageProviderResolved(resolution);
      throw new DisasterRecoveryBackupError("object-export", "R2_NOT_CONFIGURED", {
        details: {
          reason: "disaster_recovery_object_export_requires_r2_streaming",
          requested: input.requested,
          r2Configured,
        },
      });
    }

    if (input.requested !== "r2") {
      const resolution: DrStorageProviderResolution = {
        requested: input.requested,
        resolved: "r2",
        source: input.source,
        includeObjects: true,
        usesStreamingUpload: true,
        r2Configured,
      };
      logStorageProviderResolved(resolution);
      throw new DisasterRecoveryBackupError(
        "object-export",
        "DISASTER_RECOVERY_STREAMING_STORAGE_REQUIRED",
        {
          details: {
            requested: input.requested,
            required: "r2",
            reason: "local_and_buffered_zip_paths_are_disabled_for_disaster_recovery_exports",
          },
        }
      );
    }

    const resolution: DrStorageProviderResolution = {
      requested: input.requested,
      resolved: "r2",
      source: input.source,
      includeObjects: true,
      usesStreamingUpload: true,
      r2Configured,
    };
    logStorageProviderResolved(resolution);
    return resolution;
  }

  const usesStreamingUpload = input.requested === "r2" && r2StreamingAvailable;
  const resolution: DrStorageProviderResolution = {
    requested: input.requested,
    resolved: input.requested,
    source: input.source,
    includeObjects: false,
    usesStreamingUpload,
    r2Configured,
  };
  logStorageProviderResolved(resolution);
  return resolution;
};

export const assertDisasterRecoveryStreamingUpload = (input: {
  storageProvider: BackupStorageProviderId;
  source: string;
}): void => {
  const provider = resolveBackupStorageProvider(input.storageProvider);
  if (input.storageProvider !== "r2" || !provider.storeStream) {
    throw new DisasterRecoveryBackupError(
      "object-export",
      "DISASTER_RECOVERY_STREAMING_STORAGE_REQUIRED",
      {
        details: {
          storageProvider: input.storageProvider,
          source: input.source,
          hasStoreStream: Boolean(provider.storeStream),
        },
      }
    );
  }
};
