export type DatabaseCollectionExportRecord = {
  name: string;
  documentCount: number;
  exportedFile: string;
  sha256: string;
  sizeBytes: number;
  durationMs: number;
};

export type DatabaseCollectionFailureRecord = {
  name: string;
  errorCode: string;
  message: string;
  durationMs: number;
};

export type DatabaseManifest = {
  version: 2;
  database: {
    collectionCount: number;
    documentCount: number;
    exportedCollections: DatabaseCollectionExportRecord[];
    failedCollections: DatabaseCollectionFailureRecord[];
  };
};

export const DATABASE_MANIFEST_VERSION = 2 as const;

export const createEmptyDatabaseManifest = (): DatabaseManifest => ({
  version: DATABASE_MANIFEST_VERSION,
  database: {
    collectionCount: 0,
    documentCount: 0,
    exportedCollections: [],
    failedCollections: [],
  },
});
