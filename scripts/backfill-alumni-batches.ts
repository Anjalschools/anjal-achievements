/**
 * Backfill AlumniCohort documents from distinct alumniProfile.graduationYear on users.
 *
 * Run: npx tsx scripts/backfill-alumni-batches.ts
 * Requires: MONGODB_URI in .env.local or .env
 */

import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

async function main() {
  const { syncAlumniCohortsFromAlumniUsers } = await import("../src/lib/alumni/batch-service");
  const connectDB = (await import("../src/lib/mongodb")).default;
  await connectDB();
  const n = await syncAlumniCohortsFromAlumniUsers();
  console.log(`[backfill-alumni-batches] synced distinct graduation years: ${n}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
