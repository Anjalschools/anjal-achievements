import "server-only";
import { createHash } from "crypto";
import connectDB from "@/lib/mongodb";
import mongoose from "mongoose";
import { extractAttachmentUrl } from "@/lib/achievement-attachments";
import {
  buildArchivePath,
  classifyStorageReference,
} from "@/lib/disaster-recovery/storage-reference-utils";
import type { StorageManifestEntry, StorageProviderKind } from "@/lib/disaster-recovery/storage-manifest-types";

export type InventoryScanOptions = {
  moduleCollectionKeys?: string[];
};

const makeEntryId = (input: {
  provider: StorageProviderKind;
  storageKey: string;
  sourceCollection: string;
  sourceDocumentId: string;
  sourceField: string;
}): string =>
  createHash("sha256")
    .update(
      `${input.provider}|${input.storageKey}|${input.sourceCollection}|${input.sourceDocumentId}|${input.sourceField}`
    )
    .digest("hex")
    .slice(0, 24);

const pushEntry = (
  entries: Map<string, StorageManifestEntry>,
  input: {
    raw: string;
    mimeType?: string;
    fileSize?: number;
    sourceCollection: string;
    sourceDocumentId: string;
    sourceField: string;
  }
) => {
  const classified = classifyStorageReference(input.raw);
  if (!classified) return;

  const id = makeEntryId({
    provider: classified.provider,
    storageKey: classified.storageKey,
    sourceCollection: input.sourceCollection,
    sourceDocumentId: input.sourceDocumentId,
    sourceField: input.sourceField,
  });

  if (entries.has(id)) return;

  entries.set(id, {
    id,
    provider: classified.provider,
    storageKey: classified.storageKey,
    archivePath: buildArchivePath(classified.provider, classified.storageKey),
    fileSize: input.fileSize,
    mimeType: input.mimeType,
    sourceCollection: input.sourceCollection,
    sourceDocumentId: input.sourceDocumentId,
    sourceField: input.sourceField,
    status: "pending",
  });
};

const scanTrainingAttachments = async (entries: Map<string, StorageManifestEntry>) => {
  const rows = await mongoose.connection
    .collection("trainingattachments")
    .find({})
    .project({ storageKey: 1, mimeType: 1, fileSize: 1, storageProvider: 1 })
    .toArray();

  for (const row of rows) {
    pushEntry(entries, {
      raw: String(row.storageKey || ""),
      mimeType: row.mimeType ? String(row.mimeType) : undefined,
      fileSize: typeof row.fileSize === "number" ? row.fileSize : undefined,
      sourceCollection: "trainingattachments",
      sourceDocumentId: String(row._id),
      sourceField: "storageKey",
    });
  }
};

const scanAchievements = async (entries: Map<string, StorageManifestEntry>) => {
  const rows = await mongoose.connection
    .collection("achievements")
    .find({})
    .project({ attachments: 1, image: 1, imagePublicId: 1 })
    .toArray();

  for (const row of rows) {
    const docId = String(row._id);
    if (row.image) {
      pushEntry(entries, {
        raw: String(row.image),
        sourceCollection: "achievements",
        sourceDocumentId: docId,
        sourceField: "image",
      });
    }
    if (row.imagePublicId) {
      pushEntry(entries, {
        raw: `cloudinary://image/${String(row.imagePublicId)}`,
        sourceCollection: "achievements",
        sourceDocumentId: docId,
        sourceField: "imagePublicId",
      });
    }
    const attachments = Array.isArray(row.attachments) ? row.attachments : [];
    attachments.forEach((attachment, index) => {
      const url = extractAttachmentUrl(attachment);
      const key =
        attachment && typeof attachment === "object" && "key" in attachment
          ? String((attachment as { key?: string }).key || "")
          : "";
      const raw = key || url || "";
      pushEntry(entries, {
        raw,
        mimeType:
          attachment && typeof attachment === "object" && "mimeType" in attachment
            ? String((attachment as { mimeType?: string }).mimeType || "")
            : undefined,
        sourceCollection: "achievements",
        sourceDocumentId: docId,
        sourceField: `attachments[${index}]`,
      });
    });
  }
};

const scanTrainingCompletionRecords = async (entries: Map<string, StorageManifestEntry>) => {
  const rows = await mongoose.connection
    .collection("trainingcompletionrecords")
    .find({})
    .project({ institutionReportFileKey: 1, videoUrl: 1 })
    .toArray();

  for (const row of rows) {
    const docId = String(row._id);
    if (row.institutionReportFileKey) {
      pushEntry(entries, {
        raw: String(row.institutionReportFileKey),
        sourceCollection: "trainingcompletionrecords",
        sourceDocumentId: docId,
        sourceField: "institutionReportFileKey",
      });
    }
    if (row.videoUrl) {
      pushEntry(entries, {
        raw: String(row.videoUrl),
        sourceCollection: "trainingcompletionrecords",
        sourceDocumentId: docId,
        sourceField: "videoUrl",
      });
    }
  }
};

const scanAttachmentRefArray = async (
  entries: Map<string, StorageManifestEntry>,
  collectionName: string,
  fieldName: string
) => {
  const rows = await mongoose.connection.collection(collectionName).find({}).toArray();
  for (const row of rows) {
    const docId = String(row._id);
    const refs = Array.isArray(row[fieldName]) ? row[fieldName] : [];
    refs.forEach((ref: Record<string, unknown>, index: number) => {
      if (!ref || typeof ref !== "object") return;
      pushEntry(entries, {
        raw: String(ref.storageKey || ""),
        mimeType: ref.mimeType ? String(ref.mimeType) : undefined,
        sourceCollection: collectionName,
        sourceDocumentId: docId,
        sourceField: `${fieldName}[${index}].storageKey`,
      });
    });
  }
};

const scanTrainingFinalInstitutionEvaluations = async (entries: Map<string, StorageManifestEntry>) => {
  const rows = await mongoose.connection
    .collection("trainingfinalinstitutionevaluations")
    .find({})
    .project({ reportFileKey: 1, generatedReportFileKey: 1 })
    .toArray();

  for (const row of rows) {
    const docId = String(row._id);
    for (const field of ["reportFileKey", "generatedReportFileKey"] as const) {
      if (row[field]) {
        pushEntry(entries, {
          raw: String(row[field]),
          sourceCollection: "trainingfinalinstitutionevaluations",
          sourceDocumentId: docId,
          sourceField: field,
        });
      }
    }
  }
};

const scanPartnerOrganizations = async (entries: Map<string, StorageManifestEntry>) => {
  const rows = await mongoose.connection
    .collection("partnerorganizations")
    .find({})
    .project({ logo: 1 })
    .toArray();

  for (const row of rows) {
    if (!row.logo) continue;
    pushEntry(entries, {
      raw: String(row.logo),
      sourceCollection: "partnerorganizations",
      sourceDocumentId: String(row._id),
      sourceField: "logo",
    });
  }
};

export const scanStorageInventory = async (
  _options: InventoryScanOptions = {}
): Promise<StorageManifestEntry[]> => {
  await connectDB();
  const entries = new Map<string, StorageManifestEntry>();

  await scanTrainingAttachments(entries);
  await scanAchievements(entries);
  await scanTrainingCompletionRecords(entries);
  await scanAttachmentRefArray(entries, "trainingfinalstudentevaluations", "imageAttachments");
  await scanAttachmentRefArray(entries, "trainingfinalstudentevaluations", "documentAttachments");
  await scanTrainingFinalInstitutionEvaluations(entries);
  await scanPartnerOrganizations(entries);

  return [...entries.values()].sort((a, b) => a.archivePath.localeCompare(b.archivePath));
};
