/**
 * Central Cloudflare R2 (S3-compatible) configuration and validation.
 *
 * Credential priority (R2 S3 API tokens only — NOT Cloudflare Global API Key / zone tokens):
 * 1) R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY
 * 2) AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY (fallback for hosts that export AWS_* only;
 *    values must still be the R2 pair from the R2 dashboard “Manage R2 API Tokens”.)
 *
 * Endpoint:
 * - R2_ENDPOINT if set (trimmed), else https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com when R2_ACCOUNT_ID is a 32-hex account id.
 *
 * Bucket:
 * - R2_BUCKET_NAME, else R2_BUCKET (alias).
 */

import { S3Client, type S3ClientConfig } from "@aws-sdk/client-s3";

/** Cloudflare R2 S3 API access key IDs are 32 chars (AWS SDK enforces this for R2). */
export const R2_S3_ACCESS_KEY_ID_LENGTH = 32;

const R2_ACCOUNT_ID_HEX = /^[0-9a-f]{32}$/i;

const trimEnv = (key: string): string | undefined => {
  const raw = process.env[key];
  if (raw === undefined || raw === null) return undefined;
  const t = String(raw).trim();
  return t.length ? t : undefined;
};

export type R2AccessKeySource = "R2_ACCESS_KEY_ID" | "AWS_ACCESS_KEY_ID";
export type R2SecretKeySource = "R2_SECRET_ACCESS_KEY" | "AWS_SECRET_ACCESS_KEY";

export type ResolvedR2S3Settings = {
  endpoint: string;
  credentials: { accessKeyId: string; secretAccessKey: string };
  bucket: string;
  publicBaseUrl: string;
  accessKeySource: R2AccessKeySource;
  secretKeySource: R2SecretKeySource;
};

/** Safe log line: length + first4…last4 (never full secret). */
export const safeCredentialPreview = (value: string, label: string): string => {
  const t = value.trim();
  if (!t) return `${label}: (empty)`;
  if (t.length <= 8) return `${label}: length=${t.length}`;
  return `${label}: length=${t.length}, preview=${t.slice(0, 4)}…${t.slice(-4)}`;
};

const resolveEndpoint = (): string | undefined => {
  const explicit = trimEnv("R2_ENDPOINT");
  if (explicit) return explicit.replace(/\/+$/, "");
  const accountId = trimEnv("R2_ACCOUNT_ID");
  if (accountId && R2_ACCOUNT_ID_HEX.test(accountId)) {
    return `https://${accountId}.r2.cloudflarestorage.com`;
  }
  return undefined;
};

const resolveBucket = (): string | undefined => trimEnv("R2_BUCKET_NAME") ?? trimEnv("R2_BUCKET");

const resolveCredentials = (): {
  accessKeyId: string;
  secretAccessKey: string;
  accessKeySource: R2AccessKeySource;
  secretKeySource: R2SecretKeySource;
} | null => {
  const r2Access = trimEnv("R2_ACCESS_KEY_ID");
  const r2Secret = trimEnv("R2_SECRET_ACCESS_KEY");
  if (r2Access && r2Secret) {
    return {
      accessKeyId: r2Access,
      secretAccessKey: r2Secret,
      accessKeySource: "R2_ACCESS_KEY_ID",
      secretKeySource: "R2_SECRET_ACCESS_KEY",
    };
  }
  const awsAccess = trimEnv("AWS_ACCESS_KEY_ID");
  const awsSecret = trimEnv("AWS_SECRET_ACCESS_KEY");
  if (awsAccess && awsSecret) {
    return {
      accessKeyId: awsAccess,
      secretAccessKey: awsSecret,
      accessKeySource: "AWS_ACCESS_KEY_ID",
      secretKeySource: "AWS_SECRET_ACCESS_KEY",
    };
  }
  return null;
};

const validateAccessKeyFormat = (accessKeyId: string, source: string): void => {
  const len = accessKeyId.length;
  if (len !== R2_S3_ACCESS_KEY_ID_LENGTH) {
    throw new Error(
      [
        "Invalid R2 Access Key ID format. Expected R2 S3 credentials, not Cloudflare API token/global key.",
        `Actual access key length: ${len} (expected ${R2_S3_ACCESS_KEY_ID_LENGTH}).`,
        `Source: ${source}.`,
        safeCredentialPreview(accessKeyId, "accessKeyId"),
        "",
        "Create credentials from: Cloudflare Dashboard → R2 → Manage R2 API Tokens → Create API token (Permissions: Object Read & Write, specify bucket).",
        "Copy the **Access Key ID** (32 chars) and **Secret Access Key** — not the Global API Key or unrelated API tokens.",
      ].join("\n")
    );
  }
};

const validateSecretFormat = (secretAccessKey: string, source: string): void => {
  const len = secretAccessKey.length;
  if (len < 32) {
    throw new Error(
      `Invalid R2 secret access key (too short, length ${len}). Check ${source}. ${safeCredentialPreview(secretAccessKey, "secretAccessKey")}`
    );
  }
  if (len > 256) {
    throw new Error(`Invalid R2 secret access key (too long, length ${len}). Check ${source}.`);
  }
};

/**
 * Validates R2 S3 settings and throws a single clear error (fail-fast for migrations / startup).
 */
export const validateR2S3CredentialsOrThrow = (): ResolvedR2S3Settings => {
  const creds = resolveCredentials();
  if (!creds) {
    throw new Error(
      "[R2] Missing S3 credentials. Set R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY (preferred), or AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY with the **same R2 S3 token pair**."
    );
  }

  validateAccessKeyFormat(creds.accessKeyId, creds.accessKeySource);
  validateSecretFormat(creds.secretAccessKey, creds.secretKeySource);

  const endpoint = resolveEndpoint();
  if (!endpoint) {
    throw new Error(
      "[R2] Missing endpoint. Set R2_ENDPOINT (full URL), or set R2_ACCOUNT_ID (32 hex chars) to use https://<ACCOUNT_ID>.r2.cloudflarestorage.com"
    );
  }

  const bucket = resolveBucket();
  if (!bucket) {
    throw new Error("[R2] Missing bucket. Set R2_BUCKET_NAME (or alias R2_BUCKET).");
  }

  const publicBaseUrl = trimEnv("R2_PUBLIC_BASE_URL");
  if (!publicBaseUrl) {
    throw new Error("[R2] Missing R2_PUBLIC_BASE_URL.");
  }

  return {
    endpoint,
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
    },
    bucket,
    publicBaseUrl: publicBaseUrl.replace(/\/+$/, ""),
    accessKeySource: creds.accessKeySource,
    secretKeySource: creds.secretKeySource,
  };
};

/** True when all required pieces exist and pass length checks (no network I/O). */
export const isR2S3ConfigValid = (): boolean => {
  try {
    validateR2S3CredentialsOrThrow();
    return true;
  } catch {
    return false;
  }
};

export const buildR2PublicUrlFromResolved = (settings: ResolvedR2S3Settings, key: string): string => {
  const k = key.trim().replace(/^\/+/, "");
  return `${settings.publicBaseUrl}/${k}`;
};

let cachedClient: S3Client | null = null;
let cachedFingerprint = "";

const fingerprint = (s: ResolvedR2S3Settings): string =>
  `${s.endpoint}|${s.bucket}|${s.credentials.accessKeyId}|${s.publicBaseUrl}`;

/** Shared S3 client for R2 (same options as migration / API routes). */
export const createOrGetR2S3Client = (): { client: S3Client; settings: ResolvedR2S3Settings } => {
  const settings = validateR2S3CredentialsOrThrow();
  const fp = fingerprint(settings);
  if (!cachedClient || fp !== cachedFingerprint) {
    const cfg: S3ClientConfig = {
      region: "auto",
      endpoint: settings.endpoint,
      credentials: settings.credentials,
      forcePathStyle: true,
    };
    cachedClient = new S3Client(cfg);
    cachedFingerprint = fp;
  }
  return { client: cachedClient, settings };
};
