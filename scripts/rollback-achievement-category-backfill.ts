/**
 * Soft rollback for legacy category backfill (uses audit metadata only).
 *
 * Usage:
 *   npx tsx scripts/rollback-achievement-category-backfill.ts --dry-run
 *   npx tsx scripts/rollback-achievement-category-backfill.ts --apply
 *   npx tsx scripts/rollback-achievement-category-backfill.ts --apply --limit=100 --batch=50
 */

import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

import { BACKFILL_BATCH_DEFAULT, safeBulkFlush } from "../src/lib/achievement-backfill-runner";

type Args = {
  dryRun: boolean;
  apply: boolean;
  limit: number;
  batch: number;
  verbose: boolean;
};

const parseArgs = (): Args => {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const apply = argv.includes("--apply");
  if (!dryRun && !apply) {
    console.error("Specify --dry-run or --apply");
    process.exit(1);
  }
  if (dryRun && apply) {
    console.error("Use only one of --dry-run or --apply");
    process.exit(1);
  }
  let limit = 0;
  let batch = BACKFILL_BATCH_DEFAULT;
  const verbose = argv.includes("--verbose");
  for (const a of argv) {
    if (a.startsWith("--limit=")) {
      limit = Math.max(0, parseInt(a.split("=")[1] || "0", 10) || 0);
    }
    if (a.startsWith("--batch=")) {
      batch = Math.max(10, parseInt(a.split("=")[1] || String(BACKFILL_BATCH_DEFAULT), 10) || BACKFILL_BATCH_DEFAULT);
    }
  }
  return { dryRun, apply, limit, batch, verbose };
};

type BackfillAudit = {
  previousAchievementCategory?: string | null;
  previousValues?: Record<string, unknown> | null;
  rolledBackAt?: string;
};

const main = async () => {
  const args = parseArgs();
  const connectDB = (await import("../src/lib/mongodb")).default;
  const Achievement = (await import("../src/models/Achievement")).default;

  await connectDB();

  const query = {
    "evidenceExtractedData.legacyCategoryBackfill": { $exists: true },
    "evidenceExtractedData.legacyCategoryBackfill.rolledBackAt": { $exists: false },
  };

  const total = await Achievement.countDocuments(query);
  console.log(`[rollback] rows with backfill audit (not yet rolled back): ${total}`);

  const stats = { scanned: 0, wouldRollback: 0, applied: 0, skipped: 0, batchErrors: 0 };
  let batchIndex = 0;

  const cursor = Achievement.find(query)
    .select("_id achievementCategory achievementName customAchievementName achievementLevel participationType resultType resultValue nominationText inferredField evidenceExtractedData")
    .sort({ createdAt: -1 })
    .lean()
    .cursor();

  const bulkOps: Parameters<typeof Achievement.bulkWrite>[0] = [];

  const flush = async () => {
    if (bulkOps.length === 0) return;
    batchIndex += 1;
    const flushResult = await safeBulkFlush(Achievement, bulkOps, {
      dryRun: args.dryRun,
      batchIndex,
    });
    console.log(
      `[rollback] batch #${batchIndex} ops=${flushResult.opCount} modified=${flushResult.modifiedCount} ok=${flushResult.ok}`
    );
    if (!flushResult.ok) {
      stats.batchErrors += 1;
      flushResult.errors.forEach((e) => console.error(`[rollback] batch error: ${e}`));
    } else {
      stats.applied += flushResult.modifiedCount;
    }
    bulkOps.length = 0;
  };

  for await (const doc of cursor) {
    if (args.limit > 0 && stats.scanned >= args.limit) break;
    stats.scanned += 1;

    const row = doc as unknown as Record<string, unknown>;
    const ev = row.evidenceExtractedData as Record<string, unknown> | undefined;
    const audit = (ev?.legacyCategoryBackfill ?? null) as BackfillAudit | null;
    if (!audit) {
      stats.skipped += 1;
      continue;
    }

    const prev = audit.previousValues && typeof audit.previousValues === "object"
      ? audit.previousValues
      : {};
    const prevCat =
      audit.previousAchievementCategory ??
      (typeof prev.achievementCategory === "string" ? prev.achievementCategory : null);

    const $set: Record<string, unknown> = {};
    if (prevCat !== null && prevCat !== undefined) {
      $set.achievementCategory = prevCat || "";
    }
    const restoreKeys = [
      "achievementName",
      "customAchievementName",
      "achievementLevel",
      "participationType",
      "resultType",
      "resultValue",
      "nominationText",
      "inferredField",
    ] as const;
    for (const key of restoreKeys) {
      if (key in prev) {
        $set[key] = prev[key] ?? "";
      }
    }

    const nextEv = { ...(ev || {}) };
    nextEv.legacyCategoryBackfill = {
      ...audit,
      rolledBackAt: new Date().toISOString(),
    };
    $set.evidenceExtractedData = nextEv;

    if (Object.keys($set).length <= 1 && !prevCat) {
      stats.skipped += 1;
      continue;
    }

    stats.wouldRollback += 1;

    if (args.verbose || args.dryRun) {
      console.log(
        JSON.stringify({
          id: String(row._id),
          toCategory: $set.achievementCategory,
          restoreKeys: Object.keys($set).filter((k) => k !== "evidenceExtractedData"),
        })
      );
    }

    if (args.apply) {
      bulkOps.push({
        updateOne: {
          filter: { _id: row._id },
          update: { $set },
        },
      });
      if (bulkOps.length >= args.batch) await flush();
    }
  }

  await flush();

  console.log("\n[rollback] summary");
  console.log(JSON.stringify({ mode: args.dryRun ? "dry-run" : "apply", ...stats }, null, 2));
  process.exit(stats.batchErrors > 0 ? 1 : 0);
};

main().catch((e) => {
  console.error("[rollback] failed", e);
  process.exit(1);
});
