import { createHash } from "crypto";
import { readdir, readFile } from "fs/promises";
import { join } from "path";

import { parseBsonCollectionFile } from "@/lib/disaster-recovery-v2/restore/parse-bson-collection";

const isBareR2Key = (value: string): boolean => {
  const key = value.trim().replace(/^\/+/, "");
  if (!key || /^https?:\/\//i.test(key)) return false;
  return (
    key.startsWith("achievements/attachments/") ||
    key.startsWith("partnerships/") ||
    key.startsWith("training/") ||
    key.startsWith("backups/")
  );
};

const classifyR2StringReference = (raw: string): string | null => {
  const value = raw.trim();
  if (!value || /^data:/i.test(value)) return null;
  if (/^https?:\/\//i.test(value)) return null;
  if (!isBareR2Key(value)) return null;
  return value.replace(/^\/+/, "");
};

export type DiscoveredR2Object = {
  key: string;
  bucket: string;
  mimeType: string;
  size?: number;
  sha256?: string;
  collection: string;
  documentId: string;
};

const DEFAULT_MIME_TYPE = "application/octet-stream";

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

const resolveR2Key = (record: Record<string, unknown>): string | null => {
  const key =
    typeof record.key === "string"
      ? record.key.trim()
      : typeof record.storageKey === "string"
        ? record.storageKey.trim()
        : "";
  if (!key) return null;
  if (/^https?:\/\//i.test(key)) return null;
  return key.replace(/^\/+/, "");
};

const isR2ObjectRecord = (record: Record<string, unknown>): boolean => {
  if (String(record.provider || "").trim().toLowerCase() === "r2") return true;
  if (typeof record.bucket === "string" && record.bucket.trim()) return true;
  return Boolean(resolveR2Key(record));
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

const visitValue = (
  value: unknown,
  input: {
    collection: string;
    documentId: string;
    defaultBucket: string;
    discovered: Map<string, DiscoveredR2Object>;
  }
): void => {
  if (typeof value === "string") {
    const storageKey = classifyR2StringReference(value);
    if (!storageKey) return;

    const object = mapDiscoveredR2Object({
      record: { key: storageKey, provider: "r2" },
      collection: input.collection,
      documentId: input.documentId,
      defaultBucket: input.defaultBucket,
    });
    if (!object) return;
    input.discovered.set(buildDiscoveryKey(object.bucket, object.key), object);
    return;
  }

  if (!value || typeof value !== "object") return;

  if (Array.isArray(value)) {
    for (const item of value) {
      visitValue(item, input);
    }
    return;
  }

  const record = value as Record<string, unknown>;
  if (isR2ObjectRecord(record)) {
    const object = mapDiscoveredR2Object({
      record,
      collection: input.collection,
      documentId: input.documentId,
      defaultBucket: input.defaultBucket,
    });
    if (object) {
      input.discovered.set(buildDiscoveryKey(object.bucket, object.key), object);
    }
    return;
  }

  for (const nested of Object.values(record)) {
    visitValue(nested, input);
  }
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
