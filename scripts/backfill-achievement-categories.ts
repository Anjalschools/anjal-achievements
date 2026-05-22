/**
 * Backfill achievementCategory for legacy program/other rows.
 *
 * Recommended rollout:
 *   npm run backfill:achievement-categories -- --dry-run --limit=50 --verbose
 *   npm run backfill:achievement-categories -- --dry-run --limit=500
 *   npm run backfill:achievement-categories -- --apply --batch=50
 *
 * Usage:
 *   npx tsx scripts/backfill-achievement-categories.ts --dry-run
 *   npx tsx scripts/backfill-achievement-categories.ts --apply
 *   npx tsx scripts/backfill-achievement-categories.ts --apply --limit=500
 *   npx tsx scripts/backfill-achievement-categories.ts --apply --batch=50
 *   npx tsx scripts/backfill-achievement-categories.ts --dry-run --fix-university-levels
 *   npx tsx scripts/backfill-achievement-categories.ts --apply --fix-university-levels
 *   npx tsx scripts/backfill-achievement-categories.ts --apply --force-category-only
 *
 * Preview (no DB): GET /api/admin/achievement-backfill-preview or /admin/achievement-backfill-preview
 *
 * Requires MONGODB_URI in .env.local or .env
 */

import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

import { BACKFILL_BATCH_DEFAULT, safeBulkFlush } from "../src/lib/achievement-backfill-runner";
import { CLASSIFIER_VERSION } from "../src/lib/achievement-legacy-classification";

type Args = {
  dryRun: boolean;
  apply: boolean;
  limit: number;
  batch: number;
  verbose: boolean;
  fixUniversityLevels: boolean;
  forceCategoryOnly: boolean;
};

const parseArgs = (): Args => {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const apply = argv.includes("--apply");
  if (!dryRun && !apply) {
    console.error("Specify exactly one mode: --dry-run or --apply");
    process.exit(1);
  }
  if (dryRun && apply) {
    console.error("Use only one of --dry-run or --apply");
    process.exit(1);
  }

  let limit = 0;
  let batch = BACKFILL_BATCH_DEFAULT;
  let verbose = argv.includes("--verbose");
  const fixUniversityLevels = argv.includes("--fix-university-levels");
  const forceCategoryOnly = argv.includes("--force-category-only");

  for (const a of argv) {
    if (a.startsWith("--limit=")) {
      limit = Math.max(0, parseInt(a.split("=")[1] || "0", 10) || 0);
    }
    if (a.startsWith("--batch=")) {
      batch = Math.max(10, parseInt(a.split("=")[1] || String(BACKFILL_BATCH_DEFAULT), 10) || BACKFILL_BATCH_DEFAULT);
    }
  }

  return { dryRun, apply, limit, batch, verbose, fixUniversityLevels, forceCategoryOnly };
};

const rowToLegacyInput = (
  row: Record<string, unknown>
): import("../src/lib/achievement-legacy-classification").LegacyAchievementInput => ({
  achievementType: String(row.achievementType || ""),
  achievementCategory: String(row.achievementCategory || ""),
  achievementName: String(row.achievementName || ""),
  title: String(row.title || ""),
  nameAr: String(row.nameAr || ""),
  nameEn: String(row.nameEn || ""),
  customAchievementName: String(row.customAchievementName || ""),
  description: String(row.description || ""),
  organization: String(row.organization || ""),
  achievementLevel: String(row.achievementLevel || ""),
  participationType: String(row.participationType || ""),
  resultType: String(row.resultType || ""),
  resultValue: String(row.resultValue || ""),
  nominationText: String(row.nominationText || ""),
  inferredField: String(row.inferredField || ""),
  evidenceUrl: String(row.evidenceUrl || ""),
  evidenceFileName: String(row.evidenceFileName || ""),
  aiSummary: String(row.aiSummary || ""),
  status: String(row.status || ""),
  approved: row.approved === true,
  featured: row.featured === true,
  isFeatured: row.isFeatured === true,
  showInHallOfFame: row.showInHallOfFame !== false,
  lastEditedByRole: String(row.lastEditedByRole || ""),
  evidenceExtractedData:
    row.evidenceExtractedData && typeof row.evidenceExtractedData === "object"
      ? (row.evidenceExtractedData as Record<string, unknown>)
      : null,
});

const main = async () => {
  const args = parseArgs();
  const connectDB = (await import("../src/lib/mongodb")).default;
  const Achievement = (await import("../src/models/Achievement")).default;
  const {
    classifyLegacyAchievement,
    buildLegacyBackfillPatch,
    isEligibleForLegacyBackfill,
    getBackfillProtectionFlags,
  } = await import("../src/lib/achievement-legacy-classification");
  const { isManuallyProtectedAchievement } = await import(
    "../src/lib/achievement-backfill-protection"
  );
  type LegacyAchievementInput = import("../src/lib/achievement-legacy-classification").LegacyAchievementInput;

  await connectDB();

  console.log(
    `[backfill] classifierVersion=${CLASSIFIER_VERSION} batch=${args.batch} forceCategoryOnly=${args.forceCategoryOnly}`
  );

  const query = {
    achievementType: { $in: ["program", "other"] },
    achievementCategory: {
      $nin: [
        "early_university_admission",
        "entrepreneurship",
        "training_courses",
        "standardized_tests",
      ],
    },
  };

  const totalCandidates = await Achievement.countDocuments(query);
  console.log(`[backfill] candidate rows (program/other, not yet special category): ${totalCandidates}`);

  const stats = {
    scanned: 0,
    eligible: 0,
    classified: 0,
    wouldApply: 0,
    applied: 0,
    skippedLowConfidence: 0,
    protectedRows: 0,
    batchErrors: 0,
    byCategory: {
      training_courses: 0,
      early_university_admission: 0,
      entrepreneurship: 0,
    } as Record<string, number>,
  };

  let batchIndex = 0;
  const cursor = Achievement.find(query)
    .select(
      "_id achievementType achievementCategory achievementName title nameAr nameEn customAchievementName description organization achievementLevel participationType resultType resultValue nominationText inferredField evidenceUrl evidenceFileName evidenceExtractedData aiSummary status approved featured isFeatured showInHallOfFame lastEditedByRole"
    )
    .sort({ createdAt: 1 })
    .lean()
    .cursor();

  const bulkOps: Parameters<typeof Achievement.bulkWrite>[0] = [];

  const flushBulk = async () => {
    if (bulkOps.length === 0) return;
    batchIndex += 1;
    const flushResult = await safeBulkFlush(Achievement, bulkOps, {
      dryRun: args.dryRun,
      batchIndex,
    });
    console.log(
      `[backfill] batch #${batchIndex} ops=${flushResult.opCount} modified=${flushResult.modifiedCount} ok=${flushResult.ok}`
    );
    if (!flushResult.ok) {
      stats.batchErrors += 1;
      flushResult.errors.forEach((e) => console.error(`[backfill] ${e}`));
    } else {
      stats.applied += flushResult.modifiedCount;
    }
    bulkOps.length = 0;
  };

  for await (const doc of cursor) {
    if (args.limit > 0 && stats.scanned >= args.limit) break;
    stats.scanned += 1;

    const row = doc as unknown as Record<string, unknown>;
    const input: LegacyAchievementInput = rowToLegacyInput(row);

    if (isManuallyProtectedAchievement(getBackfillProtectionFlags(input))) {
      stats.protectedRows += 1;
    }

    if (!isEligibleForLegacyBackfill(input)) continue;
    stats.eligible += 1;

    const classification = classifyLegacyAchievement(input);
    if (!classification?.category) {
      stats.skippedLowConfidence += 1;
      continue;
    }
    stats.classified += 1;

    const applyOpts = args.forceCategoryOnly ? { forceCategoryOnly: true } : undefined;
    let patch = buildLegacyBackfillPatch(input, classification, applyOpts);
    if (
      !patch &&
      classification &&
      isManuallyProtectedAchievement(getBackfillProtectionFlags(input))
    ) {
      patch = buildLegacyBackfillPatch(input, classification, { forceCategoryOnly: true });
    }
    if (!patch) {
      stats.skippedLowConfidence += 1;
      continue;
    }

    stats.wouldApply += 1;
    stats.byCategory[patch.achievementCategory] =
      (stats.byCategory[patch.achievementCategory] || 0) + 1;

    if (args.verbose || args.dryRun) {
      console.log(
        JSON.stringify({
          id: String(row._id),
          from: input.achievementCategory || input.achievementType,
          to: patch.achievementCategory,
          confidence: classification.confidence,
          score: classification.score,
          matchedSignals: classification.matchedSignals,
          negativeSignals: classification.negativeSignals,
          reasons: classification.reasons,
          protected: isManuallyProtectedAchievement(getBackfillProtectionFlags(input)),
          patchKeys: Object.keys(patch).filter((k) => k !== "evidenceExtractedData"),
        })
      );
    }

    if (args.apply) {
      const { evidenceExtractedData, ...rest } = patch;
      const $set: Record<string, unknown> = { ...rest };
      if (evidenceExtractedData) $set.evidenceExtractedData = evidenceExtractedData;

      bulkOps.push({
        updateOne: {
          filter: { _id: row._id },
          update: { $set },
        },
      });

      if (bulkOps.length >= args.batch) {
        await flushBulk();
      }
    }
  }

  await flushBulk();

  console.log("\n[backfill] category summary");
  console.log(JSON.stringify({ mode: args.dryRun ? "dry-run" : "apply", ...stats }, null, 2));

  if (args.fixUniversityLevels) {
    const { buildEarlyUniversityLevelCorrectionPatch } = await import(
      "../src/lib/achievement-legacy-classification"
    );
    const levelQuery = {
      $or: [
        { achievementCategory: "early_university_admission" },
        {
          achievementName: {
            $in: [
              "uni_kfupm",
              "uni_aramco",
              "uni_ksu",
              "uni_kaust",
              "uni_pmf",
              "uni_alfaisal",
              "uni_mit",
              "uni_stanford",
              "uni_harvard",
              "uni_cmu",
              "uni_ucb",
              "uni_gatech",
              "uni_toronto",
              "uni_oxford",
              "uni_cambridge",
              "early_uni_other",
            ],
          },
        },
      ],
    };

    const levelStats = {
      scanned: 0,
      wouldFix: 0,
      applied: 0,
      kingdomToInternational: 0,
      emptyToResolved: 0,
      batchErrors: 0,
    };

    let levelBatchIndex = 0;
    const levelCursor = Achievement.find(levelQuery)
      .select(
        "_id achievementType achievementCategory achievementName customAchievementName description organization achievementLevel evidenceUrl evidenceFileName evidenceExtractedData aiSummary title nameAr nameEn status approved featured isFeatured showInHallOfFame lastEditedByRole"
      )
      .sort({ createdAt: 1 })
      .lean()
      .cursor();

    const levelBulk: Parameters<typeof Achievement.bulkWrite>[0] = [];

    const flushLevelBulk = async () => {
      if (levelBulk.length === 0) return;
      levelBatchIndex += 1;
      const flushResult = await safeBulkFlush(Achievement, levelBulk, {
        dryRun: args.dryRun,
        batchIndex: levelBatchIndex,
      });
      console.log(
        `[backfill] university-level batch #${levelBatchIndex} ops=${flushResult.opCount} modified=${flushResult.modifiedCount}`
      );
      if (!flushResult.ok) {
        levelStats.batchErrors += 1;
        flushResult.errors.forEach((e) => console.error(`[backfill] level ${e}`));
      } else {
        levelStats.applied += flushResult.modifiedCount;
      }
      levelBulk.length = 0;
    };

    for await (const doc of levelCursor) {
      if (args.limit > 0 && levelStats.scanned >= args.limit) break;
      levelStats.scanned += 1;

      const row = doc as unknown as Record<string, unknown>;
      const input = rowToLegacyInput(row);
      const patch = buildEarlyUniversityLevelCorrectionPatch(input);
      if (!patch) continue;

      levelStats.wouldFix += 1;
      const prev = String(input.achievementLevel || "").trim();
      if (!prev) levelStats.emptyToResolved += 1;
      if (prev === "kingdom" && patch.achievementLevel === "international") {
        levelStats.kingdomToInternational += 1;
      }

      if (args.verbose || args.dryRun) {
        console.log(
          JSON.stringify({
            phase: "university-level-fix",
            id: String(row._id),
            university: input.achievementName,
            fromLevel: prev || "(empty)",
            toLevel: patch.achievementLevel,
          })
        );
      }

      if (args.apply) {
        const $set: Record<string, unknown> = {
          achievementLevel: patch.achievementLevel,
        };
        if (patch.evidenceExtractedData) {
          $set.evidenceExtractedData = patch.evidenceExtractedData;
        }
        levelBulk.push({
          updateOne: {
            filter: { _id: row._id },
            update: { $set },
          },
        });
        if (levelBulk.length >= args.batch) {
          await flushLevelBulk();
        }
      }
    }

    await flushLevelBulk();
    console.log("\n[backfill] university level summary");
    console.log(JSON.stringify({ mode: args.dryRun ? "dry-run" : "apply", ...levelStats }, null, 2));
  }

  process.exit(stats.batchErrors > 0 ? 1 : 0);
};

main().catch((e) => {
  console.error("[backfill] failed", e);
  process.exit(1);
});
