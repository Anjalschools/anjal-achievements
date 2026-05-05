/**
 * Migrate legacy achievement media (data URLs) from MongoDB to Cloudinary / R2.
 *
 * Default: dry-run (no writes). Use --apply for real migration.
 *
 *   npm run migrate:achievement-media:dry
 *   npm run migrate:achievement-media
 *
 * Options:
 *   --apply              Perform uploads + Mongo updates
 *   --dry-run            Explicit dry-run (default when --apply omitted)
 *   --mode=all|images|attachments
 */

import path from "path";
import fs from "fs";
import mongoose from "mongoose";
import dotenv from "dotenv";
import {
  decodeDataUrl,
  isLegacyAchievementImage,
  isLegacyAttachmentItem,
  migrateOneAttachmentItem,
  summarizeAttachmentArray,
  uploadLegacyImageToCloudinary,
  type MigrationMode,
} from "../src/lib/migrations/achievement-media-migration";
import { isCloudinaryConfigured } from "../src/lib/cloudinary";
import { isR2S3ConfigValid, validateR2S3CredentialsOrThrow } from "../src/lib/storage/r2-config";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

type RowReport = {
  achievementId: string;
  hadLegacyImage: boolean;
  hadLegacyAttachments: boolean;
  imageMigrated: boolean;
  attachmentsMigratedCount: number;
  mongoUpdated: boolean;
  imageError?: string;
  attachmentsError?: string;
};

type Summary = {
  scanned: number;
  docsWithLegacyImage: number;
  docsWithLegacyAttachments: number;
  migratedImages: number;
  migratedAttachmentItems: number;
  skippedNoLegacy: number;
  failedImageDocs: number;
  failedAttachmentDocs: number;
  mongoUpdates: number;
};

const parseArgs = (argv: string[]) => {
  const apply = argv.includes("--apply");
  let mode: MigrationMode = "all";
  for (const a of argv) {
    if (a.startsWith("--mode=")) {
      const v = a.slice("--mode=".length);
      if (v === "images" || v === "attachments" || v === "all") mode = v;
    }
  }
  return { apply, dryRun: !apply, mode };
};

const writeReport = (payload: Record<string, unknown>) => {
  const dir = path.join(process.cwd(), "logs");
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, "achievement-media-migration-report.json");
  fs.writeFileSync(out, JSON.stringify(payload, null, 2), "utf8");
  console.log(`\nReport written: ${out}`);
};

async function main() {
  const { apply, dryRun, mode } = parseArgs(process.argv.slice(2));
  const startedAt = new Date().toISOString();

  console.log(
    JSON.stringify(
      { phase: "start", dryRun, apply, mode, startedAt },
      null,
      2
    )
  );

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is required");
    process.exit(1);
  }

  if (apply) {
    if ((mode === "all" || mode === "images") && !isCloudinaryConfigured()) {
      console.error("Cloudinary env missing; cannot migrate images. Aborting.");
      process.exit(1);
    }
    if (mode === "all" || mode === "attachments") {
      try {
        validateR2S3CredentialsOrThrow();
      } catch (e) {
        console.error(e instanceof Error ? e.message : e);
        process.exit(1);
      }
    }
  } else {
    if ((mode === "all" || mode === "images") && !isCloudinaryConfigured()) {
      console.warn("[dry-run] Cloudinary not fully configured — image migrations would fail if applied.");
    }
    if ((mode === "all" || mode === "attachments") && !isR2S3ConfigValid()) {
      console.warn("[dry-run] R2 not fully configured — attachment migrations would fail if applied.");
    }
  }

  await mongoose.connect(uri, { dbName: "anjal_achievements" });
  const coll = mongoose.connection.collection("achievements");

  const summary: Summary = {
    scanned: 0,
    docsWithLegacyImage: 0,
    docsWithLegacyAttachments: 0,
    migratedImages: 0,
    migratedAttachmentItems: 0,
    skippedNoLegacy: 0,
    failedImageDocs: 0,
    failedAttachmentDocs: 0,
    mongoUpdates: 0,
  };

  const rows: RowReport[] = [];

  const cursor = coll.find(
    {},
    { projection: { image: 1, imagePublicId: 1, attachments: 1 } }
  );

  for await (const doc of cursor) {
    summary.scanned += 1;
    if (apply && summary.scanned % 250 === 0) {
      console.log(`[progress] scanned=${summary.scanned} …`);
    }
    const achievementId = String(doc._id);
    const image = doc.image;
    const attachments = doc.attachments;

    const hadLegacyImage =
      (mode === "all" || mode === "images") && isLegacyAchievementImage(image);
    const attSummary =
      mode === "all" || mode === "attachments"
        ? summarizeAttachmentArray(attachments)
        : { legacyCount: 0, total: 0 };
    const hadLegacyAttachments = (mode === "all" || mode === "attachments") && attSummary.legacyCount > 0;

    if (hadLegacyImage) summary.docsWithLegacyImage += 1;
    if (hadLegacyAttachments) summary.docsWithLegacyAttachments += 1;

    const row: RowReport = {
      achievementId,
      hadLegacyImage,
      hadLegacyAttachments,
      imageMigrated: false,
      attachmentsMigratedCount: 0,
      mongoUpdated: false,
    };

    if (!hadLegacyImage && !hadLegacyAttachments) {
      summary.skippedNoLegacy += 1;
      rows.push(row);
      continue;
    }

    if (dryRun) {
      rows.push(row);
      continue;
    }

    if (hadLegacyImage) {
      try {
        const decoded = decodeDataUrl(String(image));
        if (!decoded) {
          throw new Error("decode_failed");
        }
        const up = await uploadLegacyImageToCloudinary(decoded.buffer, decoded.mimeType);
        const res = await coll.updateOne(
          { _id: doc._id },
          { $set: { image: up.secure_url, imagePublicId: up.public_id } }
        );
        if (res.modifiedCount === 1) {
          row.imageMigrated = true;
          summary.migratedImages += 1;
          summary.mongoUpdates += 1;
          row.mongoUpdated = true;
          const verify = await coll.findOne({ _id: doc._id }, { projection: { image: 1 } });
          if (verify && typeof verify.image === "string" && verify.image.startsWith("data:")) {
            console.error(`[verify-fail] ${achievementId}: image still data URL after update`);
          }
        }
      } catch (e) {
        row.imageError = e instanceof Error ? e.message : String(e);
        summary.failedImageDocs += 1;
        console.warn(`[image-fail] ${achievementId}: ${row.imageError}`);
      }
    }

    if (hadLegacyAttachments) {
      const rawList = Array.isArray(attachments) ? [...attachments] : [];
      const nextList: unknown[] = [];
      let migratedCount = 0;
      try {
        for (const item of rawList) {
          if (!isLegacyAttachmentItem(item)) {
            nextList.push(item);
            continue;
          }
          const result = await migrateOneAttachmentItem(item);
          if (result === "unchanged") {
            nextList.push(item);
            continue;
          }
          if (result === null) {
            throw new Error("attachment_decode_or_upload_unsupported");
          }
          nextList.push(result);
          migratedCount += 1;
        }
        if (migratedCount > 0) {
          const res = await coll.updateOne({ _id: doc._id }, { $set: { attachments: nextList } });
          if (res.modifiedCount === 1) {
            row.attachmentsMigratedCount = migratedCount;
            summary.migratedAttachmentItems += migratedCount;
            summary.mongoUpdates += 1;
            row.mongoUpdated = true;
          }
        }
      } catch (e) {
        row.attachmentsError = e instanceof Error ? e.message : String(e);
        summary.failedAttachmentDocs += 1;
        console.warn(`[attachments-fail] ${achievementId}: ${row.attachmentsError}`);
      }
    }

    rows.push(row);
  }

  await mongoose.disconnect();

  const finishedAt = new Date().toISOString();
  console.log(
    "\n--- summary ---\n" +
      JSON.stringify(
        {
          ...summary,
          dryRun,
          mode,
          finishedAt,
        },
        null,
        2
      )
  );

  writeReport({
    startedAt,
    finishedAt,
    dryRun,
    mode,
    summary,
    rows,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
