#!/usr/bin/env node
/**
 * Dedicated Disaster Recovery backup worker.
 * Run independently from the Next.js Web Service:
 *   npm run dr:worker
 */
import { runDrPersistentWorker } from "../src/lib/disaster-recovery/worker/dr-persistent-worker";

runDrPersistentWorker().catch((error) => {
  console.error("[DR] WORKER_FATAL", {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exit(1);
});
