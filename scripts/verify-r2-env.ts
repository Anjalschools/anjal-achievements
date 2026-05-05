/**
 * Quick local check: R2 S3 env shape (length + safe preview only — never prints full secrets).
 *
 *   npx tsx scripts/verify-r2-env.ts
 *   npm run verify:r2-env
 */

import path from "path";
import dotenv from "dotenv";
import {
  R2_S3_ACCESS_KEY_ID_LENGTH,
  safeCredentialPreview,
  validateR2S3CredentialsOrThrow,
} from "../src/lib/storage/r2-config";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

try {
  const s = validateR2S3CredentialsOrThrow();
  console.log("R2 S3 configuration is valid (format checks only; no network call).");
  console.log("endpoint:", s.endpoint);
  console.log("bucket:", s.bucket);
  console.log("publicBaseUrl:", s.publicBaseUrl);
  console.log("credential sources:", s.accessKeySource, "/", s.secretKeySource);
  console.log(
    "accessKeyId length:",
    s.credentials.accessKeyId.length,
    `(expected ${R2_S3_ACCESS_KEY_ID_LENGTH})`
  );
  console.log(safeCredentialPreview(s.credentials.accessKeyId, "accessKeyId"));
  console.log(safeCredentialPreview(s.credentials.secretAccessKey, "secretAccessKey"));
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
