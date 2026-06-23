import { describe, expect, it } from "vitest";
import { hashContent } from "@/lib/backup/backup-manifest";
import { buildBackupManifest, serializeManifest } from "@/lib/backup/backup-manifest";
import {
  buildArchivePath,
  classifyStorageReference,
} from "@/lib/disaster-recovery/storage-reference-utils";
import { isHttpDownloadAllowed } from "@/lib/disaster-recovery/http-download-policy";
import {
  buildCertifications,
  computeRecoveryReadinessScore,
  validateObjectStoragePackage,
} from "@/lib/disaster-recovery/dr-validation";
import { RETENTION_WINDOWS_DAYS, isBackupExpired } from "@/lib/disaster-recovery/retention-policy";
import type { ExtractedBackupPackage } from "@/lib/backup/backup-zip";

describe("phase 11.2 — disaster recovery object backup", () => {
  it("classifies R2, Cloudinary, HTTP, and inline references", () => {
    expect(classifyStorageReference("achievements/attachments/2025/a.pdf")?.provider).toBe("r2");
    expect(
      classifyStorageReference("https://res.cloudinary.com/demo/image/upload/v1/x")?.provider
    ).toBe("cloudinary");
    expect(classifyStorageReference("data:image/png;base64,AAAA")?.provider).toBe("inline");
  });

  it("builds archive paths under objects/r2 and objects/cloudinary", () => {
    expect(buildArchivePath("r2", "training/report.pdf")).toBe("objects/r2/training/report.pdf");
    expect(buildArchivePath("cloudinary", "cloudinary://image/sample")).toContain(
      "objects/cloudinary/"
    );
  });

  it("validates object checksums and detects corruption", () => {
    const content = Buffer.from("pdf-bytes");
    const checksum = hashContent(content);
    const extracted: ExtractedBackupPackage = {
      manifest: buildBackupManifest({
        backupModule: "full",
        collections: ["achievements"],
        recordCounts: { achievements: 1 },
        includesObjectStorage: true,
      }),
      collections: {},
      storageManifest: Buffer.from(
        JSON.stringify({
          version: "11.2",
          createdAt: new Date().toISOString(),
          objectCount: 1,
          exportedCount: 1,
          missingCount: 0,
          failedCount: 0,
          totalBytes: content.byteLength,
          entries: [
            {
              id: "e1",
              provider: "r2",
              storageKey: "training/a.pdf",
              archivePath: "objects/r2/training/a.pdf",
              fileSize: content.byteLength,
              checksum,
              sourceCollection: "trainingattachments",
              sourceDocumentId: "1",
              sourceField: "storageKey",
              status: "exported",
            },
          ],
        }),
        "utf8"
      ),
      objects: {
        "objects/r2/training/a.pdf": content,
      },
    };

    const pass = validateObjectStoragePackage(extracted);
    expect(pass.status).toBe("PASS");

    const corrupted: ExtractedBackupPackage = {
      ...extracted,
      objects: { "objects/r2/training/a.pdf": Buffer.from("bad") },
    };
    const fail = validateObjectStoragePackage(corrupted);
    expect(fail.status).toBe("FAIL");
    expect(fail.corruptedCount).toBeGreaterThan(0);
  });

  it("computes recovery readiness score and certifications", () => {
    const score = computeRecoveryReadinessScore({
      databasePass: true,
      objectPass: true,
      includesObjectStorage: true,
      exportedObjectRatio: 1,
    });
    expect(score).toBeGreaterThanOrEqual(90);
    const certs = buildCertifications(score, true);
    expect(certs).toContain("DISASTER_RECOVERY_READY");
    expect(certs).toContain("FULL_PLATFORM_RECOVERY_READY");
  });

  it("restricts HTTP downloads to allowed hosts", () => {
    expect(isHttpDownloadAllowed("https://res.cloudinary.com/demo/x.pdf")).toBe(true);
    expect(isHttpDownloadAllowed("https://evil.example.com/x.pdf")).toBe(false);
  });

  it("applies retention windows", () => {
    expect(RETENTION_WINDOWS_DAYS.daily).toBe(30);
    const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    expect(isBackupExpired({ createdAt: old, retentionTier: "daily" })).toBe(true);
  });

  it("generates stable object checksums", () => {
    const a = hashContent(Buffer.from("same"));
    const b = hashContent(Buffer.from("same"));
    expect(a).toBe(b);
  });

  it("serializes DR manifest with object storage flags", () => {
    const manifest = buildBackupManifest({
      backupModule: "full",
      collections: ["users"],
      recordCounts: { users: 1 },
      includesObjectStorage: true,
      objectCount: 5,
      objectSizeBytes: 1024,
    });
    const raw = serializeManifest(manifest);
    expect(raw).toContain("includesObjectStorage");
    expect(raw).toContain("objectCount");
  });
});
