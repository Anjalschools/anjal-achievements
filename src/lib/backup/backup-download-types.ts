import type { Readable } from "stream";

import type { BackupStorageProviderId } from "@/lib/backup/backup-constants";

export type BackupRetrieveStreamResult = {
  stream: Readable;
  contentLength?: number;
  etag?: string;
};

export type BackupZipStreamResult = {
  stream: Readable;
  fileName: string;
  contentLength?: number;
  storageProvider: BackupStorageProviderId;
  storageKey?: string;
  etag?: string;
};
