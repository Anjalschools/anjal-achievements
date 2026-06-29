/**
 * Phase P.1.0.1 — Legacy approved evidence visibility backfill (one-time).
 *
 * Recommended rollout:
 *   npm run backfill:legacy-portfolio-evidence -- --dry-run --verbose
 *   npm run backfill:legacy-portfolio-evidence -- --dry-run --limit=100
 *   npm run backfill:legacy-portfolio-evidence -- --apply --batch=50
 *
 * Set PORTFOLIO_EVIDENCE_P1_LAUNCH_AT to the exact P.1 deploy timestamp (ISO-8601).
 * Achievements created at or after that time are excluded (new post-P.1 uploads stay hidden).
 *
 * Requires MONGODB_URI in .env.local or .env
 */

import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

import { safeBulkFlush } from "../src/lib/achievement-backfill-runner";
import {
  buildLegacyEvidenceBackfillQuery,
  createEmptyLegacyEvidenceBackfillStats,
  LEGACY_EVIDENCE_BACKFILL_BATCH_DEFAULT,
  planLegacyEvidenceBackfillForAchievement,
  resolvePortfolioEvidenceP1LaunchAt,
} from "../src/lib/migrations/legacy-portfolio-evidence-backfill";

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
    console.error("Specify exactly one mode: --dry-run or --apply");
    process.exit(1);
  }
  if (dryRun && apply) {
    console.error("Use only one of --dry-run or --apply");
    process.exit(1);
  }

  let limit = 0;
  let batch = LEGACY_EVIDENCE_BACKFILL_BATCH_DEFAULT;
  const verbose = argv.includes("--verbose");

  for (const arg of argv) {
    if (arg.startsWith("--limit=")) {
      limit = Math.max(0, parseInt(arg.split("=")[1] || "0", 10) || 0);
    }
    if (arg.startsWith("--batch=")) {
      batch = Math.max(
        10,
        parseInt(arg.split("=")[1] || String(LEGACY_EVIDENCE_BACKFILL_BATCH_DEFAULT), 10) ||
          LEGACY_EVIDENCE_BACKFILL_BATCH_DEFAULT
      );
    }
  }

  return { dryRun, apply, limit, batch, verbose };
};

const main = async () => {
  const args = parseArgs();
  const launchAt = resolvePortfolioEvidenceP1LaunchAt();
  const connectDB = (await import("../src/lib/mongodb")).default;
  const Achievement = (await import("../src/models/Achievement")).default;

  await connectDB();

  const query = buildLegacyEvidenceBackfillQuery(launchAt);
  const totalCandidates = await Achievement.countDocuments(query);

  console.log("Legacy Evidence Backfill Started");
  console.log(
    JSON.stringify({
      mode: args.dryRun ? "dry-run" : "apply",
      launchAt: launchAt.toISOString(),
      batch: args.batch,
      limit: args.limit || null,
      candidateAchievements: totalCandidates,
    })
  );

  const stats = createEmptyLegacyEvidenceBackfillStats();
  let batchIndex = 0;
  const bulkOps: Parameters<typeof Achievement.bulkWrite>[0] = [];

  const flushBulk = async () => {
    if (bulkOps.length === 0) return;
    batchIndex += 1;
    const flushResult = await safeBulkFlush(Achievement, bulkOps, {
      dryRun: args.dryRun,
      batchIndex,
    });
    console.log(
      `[legacy-evidence-backfill] batch #${batchIndex} ops=${flushResult.opCount} modified=${flushResult.modifiedCount} ok=${flushResult.ok}`
    );
    if (!flushResult.ok) {
      stats.batchErrors += 1;
      flushResult.errors.forEach((error) => console.error(`[legacy-evidence-backfill] ${error}`));
    } else {
      stats.achievementsUpdated += flushResult.modifiedCount;
    }
    bulkOps.length = 0;
  };

  const cursor = Achievement.find(query)
    .select("_id status approved pendingReReview showInPublicPortfolio attachments createdAt")
    .sort({ createdAt: 1 })
    .lean()
    .cursor();

  for await (const doc of cursor) {
    if (args.limit > 0 && stats.achievementsScanned >= args.limit) break;

    stats.achievementsScanned += 1;
    const row = doc as unknown as Record<string, unknown>;
    const plan = planLegacyEvidenceBackfillForAchievement(row, launchAt);

    if (plan.action === "skip") {
      stats.achievementsSkipped += 1;
      if (args.verbose) {
        console.log(
          JSON.stringify({
            id: String(row._id),
            action: "skip",
            reason: plan.reason,
          })
        );
      }
      continue;
    }

    stats.attachmentsUpdated += plan.attachmentsUpdated;

    if (args.verbose || args.dryRun) {
      console.log(
        JSON.stringify({
          id: String(row._id),
          action: "update",
          attachmentsUpdated: plan.attachmentsUpdated,
        })
      );
    }

    if (args.apply) {
      bulkOps.push({
        updateOne: {
          filter: { _id: row._id },
          update: { $set: { attachments: plan.attachments } },
        },
      });

      if (bulkOps.length >= args.batch) {
        await flushBulk();
      }
    } else if (!args.dryRun) {
      stats.achievementsUpdated += 1;
    }
  }

  await flushBulk();

  if (args.dryRun) {
    stats.achievementsUpdated = stats.achievementsScanned - stats.achievementsSkipped;
  }

  console.log(`Achievements scanned: ${stats.achievementsScanned}`);
  console.log(`Attachments updated: ${stats.attachmentsUpdated}`);
  console.log(`Achievements skipped: ${stats.achievementsSkipped}`);
  console.log("Legacy Evidence Backfill Completed");
  console.log(JSON.stringify({ mode: args.dryRun ? "dry-run" : "apply", ...stats }, null, 2));

  process.exit(stats.batchErrors > 0 ? 1 : 0);
};

main().catch((error) => {
  console.error("[legacy-evidence-backfill] failed", error);
  process.exit(1);
});
