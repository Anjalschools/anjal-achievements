/**
 * Hit a secured /api/cron/* endpoint (Render manual run, local dev, or Render Cron Job startCommand).
 *
 *   CRON_ENDPOINT=/api/cron/competition-analytics-snapshots npm run cron:competition-snapshots
 *   APP_URL=https://your-render-domain.onrender.com CRON_SECRET=... npm run cron:competition-snapshots
 */

import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

const endpointFromArg = process.argv[2]?.trim();
const endpointFromEnv = process.env.CRON_ENDPOINT?.trim();
const endpoint = endpointFromArg || endpointFromEnv;

const main = async () => {
  if (!endpoint?.startsWith("/api/cron/")) {
    console.error("Set CRON_ENDPOINT or pass path, e.g. /api/cron/competition-analytics-snapshots");
    process.exit(1);
  }
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    console.error("CRON_SECRET is not set.");
    process.exit(1);
  }
  const base = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(
    /\/$/,
    ""
  );
  const url = `${base}${endpoint}`;
  console.log("[render-cron] GET", url);
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${secret}` },
  });
  const body = await res.text();
  console.log("[render-cron] status:", res.status);
  try {
    const json = JSON.parse(body) as Record<string, unknown>;
    console.log(JSON.stringify(json, null, 2));
    const obs = json.observability as { snapshotGenerationMs?: number; payloadBytesTotal?: number } | undefined;
    const integrity = json.integrity as { ok?: boolean; issues?: string[] } | undefined;
    if (obs) {
      console.log(
        "[render-cron] observability:",
        `durationMs=${obs.snapshotGenerationMs ?? json.durationMs ?? "?"}`,
        `payloadBytesTotal=${obs.payloadBytesTotal ?? "?"}`
      );
    }
    if (integrity) {
      console.log("[render-cron] integrity:", integrity.ok ? "OK" : `ISSUES: ${(integrity.issues || []).join(", ")}`);
    }
  } catch {
    console.log(body);
  }
  if (!res.ok) process.exit(1);
};

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
