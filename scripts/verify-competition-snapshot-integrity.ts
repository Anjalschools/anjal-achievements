/**
 * Post-cron integrity check for Competition Intelligence snapshots.
 *
 *   npm run verify:competition-snapshots
 *   CRON_SECRET=... curl -H "Authorization: Bearer $CRON_SECRET" \
 *     http://localhost:3000/api/cron/competition-analytics-snapshots
 */

import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

const main = async () => {
  const { verifyCompetitionSnapshotIntegrity } = await import(
    "../src/lib/competition/ops/snapshot-integrity"
  );
  const report = await verifyCompetitionSnapshotIntegrity();
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) {
    console.error("\nIntegrity issues:", report.issues.join(", "));
    process.exit(1);
  }
  console.log("\nCompetition snapshot integrity OK.");
};

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
