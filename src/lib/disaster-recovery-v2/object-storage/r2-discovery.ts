import { createHash } from "crypto";
import { readdir, readFile } from "fs/promises";
import { join } from "path";

import { parseBsonCollectionFile } from "@/lib/disaster-recovery-v2/restore/parse-bson-collection";
import { logDrV2, logDrV2Debug } from "@/lib/disaster-recovery-v2/utils/logging";

export type DiscoveredR2Object = {
  key: string;
  bucket: string;
  mimeType: string;
  size?: number;
  sha256?: string;
  collection: string;
  documentId: string;
};

export type R2DiscoveryMethod =
  | "provider-r2"
  | "bucket-key"
  | "storage-key"
  | "storage-object"
  | "legacy-field";

const DEFAULT_MIME_TYPE = "application/octet-stream";

const LEGACY_R2_KEY_FIELD_NAMES = new Set([
  "imageKey",
  "storageKey",
  "objectKey",
  "attachmentKey",
]);

const normalizeObjectId = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object" && "$oid" in (value as Record<string, unknown>)) {
    return String((value as { $oid?: string }).$oid || "").trim();
  }
  return "";
};

const resolveMimeType = (record: Record<string, unknown>): string => {
  const candidates = [record.mimeType, record.contentType, record.type];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().includes("/")) {
      return candidate.trim();
    }
  }
  return DEFAULT_MIME_TYPE;
};

const normalizeR2KeyString = (raw: string): string | null => {
  const value = raw.trim();
  if (!value || /^https?:\/\//i.test(value) || /^data:/i.test(value)) {
    return null;
  }
  return value.replace(/^\/+/, "");
};

export const resolveR2Key = (record: Record<string, unknown>): string | null => {
  const key =
    typeof record.key === "string"
      ? record.key.trim()
      : typeof record.storageKey === "string"
        ? record.storageKey.trim()
        : typeof record.objectKey === "string"
          ? record.objectKey.trim()
          : typeof record.attachmentKey === "string"
            ? record.attachmentKey.trim()
            : "";
  if (!key) return null;
  return normalizeR2KeyString(key);
};

const hasStorageObjectSignals = (record: Record<string, unknown>): boolean => {
  const signals = [
    record.provider,
    record.bucket,
    record.mimeType,
    record.contentType,
    record.url,
    record.publicId,
    record.sha256,
    record.size,
    record.relativePath,
    record.uploadedAt,
  ];

  return signals.some((signal) => {
    if (signal === undefined || signal === null) return false;
    if (typeof signal === "string") return signal.trim().length > 0;
    if (typeof signal === "number") return Number.isFinite(signal);
    return true;
  });
};

export const detectR2StorageReference = (
  record: Record<string, unknown>
): R2DiscoveryMethod | null => {
  const provider = String(record.provider ?? "")
    .trim()
    .toLowerCase();
  const hasBucket = typeof record.bucket === "string" && record.bucket.trim().length > 0;
  const key = resolveR2Key(record);
  const hasDedicatedStorageKey =
    typeof record.storageKey === "string" && record.storageKey.trim().length > 0;

  if (provider === "r2" && key) {
    return "provider-r2";
  }

  if (hasBucket && key) {
    return "bucket-key";
  }

  if (hasDedicatedStorageKey && key) {
    return "storage-key";
  }

  if (key && hasStorageObjectSignals(record)) {
    return "storage-object";
  }

  return null;
};

const buildDiscoveryKey = (bucket: string, key: string): string => `${bucket}::${key}`;

export const mapDiscoveredR2Object = (input: {
  record: Record<string, unknown>;
  collection: string;
  documentId: string;
  defaultBucket: string;
}): DiscoveredR2Object | null => {
  const key = resolveR2Key(input.record);
  if (!key) return null;

  const bucket =
    typeof input.record.bucket === "string" && input.record.bucket.trim()
      ? input.record.bucket.trim()
      : input.defaultBucket;

  const sizeRaw = input.record.size;
  const size =
    typeof sizeRaw === "number" && Number.isFinite(sizeRaw) && sizeRaw >= 0
      ? sizeRaw
      : undefined;

  const sha256 =
    typeof input.record.sha256 === "string" && input.record.sha256.trim()
      ? input.record.sha256.trim()
      : undefined;

  return {
    key,
    bucket,
    mimeType: resolveMimeType(input.record),
    size,
    sha256,
    collection: input.collection,
    documentId: input.documentId,
  };
};

const registerDiscoveredObject = (
  input: {
    collection: string;
    documentId: string;
    defaultBucket: string;
    discovered: Map<string, DiscoveredR2Object>;
  },
  record: Record<string, unknown>,
  detectionMethod: R2DiscoveryMethod
): void => {
  const object = mapDiscoveredR2Object({
    record,
    collection: input.collection,
    documentId: input.documentId,
    defaultBucket: input.defaultBucket,
  });
  if (!object) return;

  input.discovered.set(buildDiscoveryKey(object.bucket, object.key), object);

  logDrV2("R2_DISCOVERY_REFERENCE_FOUND", {
    collection: input.collection,
    documentId: input.documentId,
    provider: String(record.provider ?? "r2"),
    bucket: object.bucket,
    key: object.key,
    detectionMethod,
  });
};

const visitValue = (
  value: unknown,
  input: {
    collection: string;
    documentId: string;
    defaultBucket: string;
    discovered: Map<string, DiscoveredR2Object>;
  }
): void => {
  if (value === null || value === undefined) return;

  if (Array.isArray(value)) {
    for (const item of value) {
      visitValue(item, input);
    }
    return;
  }

  if (typeof value === "string") {
    return;
  }

  if (typeof value !== "object") return;

  const record = value as Record<string, unknown>;
  const detectionMethod = detectR2StorageReference(record);
  if (detectionMethod) {
    registerDiscoveredObject(input, record, detectionMethod);
    return;
  }

  for (const [fieldName, nested] of Object.entries(record)) {
    if (LEGACY_R2_KEY_FIELD_NAMES.has(fieldName) && typeof nested === "string") {
      const legacyKey = normalizeR2KeyString(nested);
      if (legacyKey) {
        registerDiscoveredObject(
          input,
          { key: legacyKey, provider: "r2" },
          "legacy-field"
        );
      }
      continue;
    }

    visitValue(nested, input);
  }
};

const logSkippedPathLikeString = (value: string, input: { collection: string; documentId: string }): void => {
  const trimmed = value.trim();
  if (!trimmed.includes("/")) return;
  if (/^https?:\/\//i.test(trimmed) || /^data:/i.test(trimmed)) return;

  logDrV2Debug("R2_DISCOVERY_SKIPPED_STRING", {
    collection: input.collection,
    documentId: input.documentId,
    value: trimmed,
  });
};

export const discoverR2ObjectsInDocument = (input: {
  document: Record<string, unknown>;
  collection: string;
  defaultBucket: string;
}): DiscoveredR2Object[] => {
  const discovered = new Map<string, DiscoveredR2Object>();
  const documentId = normalizeObjectId(input.document._id) || "unknown";

  visitValue(input.document, {
    collection: input.collection,
    documentId,
    defaultBucket: input.defaultBucket,
    discovered,
  });

  if (process.env.DR_DEBUG === "1") {
    const collectStrings = (value: unknown): void => {
      if (typeof value === "string") {
        logSkippedPathLikeString(value, { collection: input.collection, documentId });
        return;
      }
      if (!value || typeof value !== "object") return;
      if (Array.isArray(value)) {
        for (const item of value) collectStrings(item);
        return;
      }
      for (const nested of Object.values(value as Record<string, unknown>)) {
        collectStrings(nested);
      }
    };
    collectStrings(input.document);
  }

  return [...discovered.values()].sort((left, right) =>
    `${left.collection}:${left.key}`.localeCompare(`${right.collection}:${right.key}`)
  );
};

export const discoverR2ObjectsFromBsonFile = async (input: {
  collectionName: string;
  bsonFilePath: string;
  defaultBucket: string;
  readFile?: (filePath: string) => Promise<Buffer>;
}): Promise<DiscoveredR2Object[]> => {
  const read = input.readFile ?? ((filePath: string) => readFile(filePath));
  const content = await read(input.bsonFilePath);
  if (!content.byteLength) return [];

  const documents = parseBsonCollectionFile(content);
  const discovered = new Map<string, DiscoveredR2Object>();

  for (const document of documents) {
    for (const object of discoverR2ObjectsInDocument({
      document,
      collection: input.collectionName,
      defaultBucket: input.defaultBucket,
    })) {
      discovered.set(buildDiscoveryKey(object.bucket, object.key), object);
    }
  }

  return [...discovered.values()];
};

export const discoverR2ObjectsFromDatabaseExport = async (input: {
  collectionsDir: string;
  defaultBucket: string;
  readFile?: (filePath: string) => Promise<Buffer>;
  listFiles?: (directoryPath: string) => Promise<string[]>;
}): Promise<DiscoveredR2Object[]> => {
  const listFiles = input.listFiles ?? ((directoryPath: string) => readdir(directoryPath));
  const discovered = new Map<string, DiscoveredR2Object>();

  let fileNames: string[] = [];
  try {
    fileNames = (await listFiles(input.collectionsDir)).filter((name) => name.endsWith(".bson"));
  } catch {
    return [];
  }

  for (const fileName of fileNames.sort()) {
    const collectionName = fileName.replace(/\.bson$/i, "");
    const objects = await discoverR2ObjectsFromBsonFile({
      collectionName,
      bsonFilePath: join(input.collectionsDir, fileName),
      defaultBucket: input.defaultBucket,
      readFile: input.readFile,
    });

    for (const object of objects) {
      discovered.set(buildDiscoveryKey(object.bucket, object.key), object);
    }
  }

  return [...discovered.values()];
};

export const hashUtf8 = (value: string): string =>
  createHash("sha256").update(value, "utf8").digest("hex");
