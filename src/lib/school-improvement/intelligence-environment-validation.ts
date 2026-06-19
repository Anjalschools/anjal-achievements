import "server-only";
import connectDB, { pingMongo } from "@/lib/mongodb";
import type { EnvironmentHealthCheck } from "@/lib/school-improvement/intelligence-diagnostics-types";

const readEnv = (key: string): string | undefined => {
  const raw = process.env[key];
  if (raw == null) return undefined;
  const trimmed = String(raw).trim();
  return trimmed.length ? trimmed : undefined;
};

const hasOpenAiKey = (): boolean => Boolean(process.env.OPENAI_API_KEY?.trim());

const hasRedisConfig = (): boolean =>
  Boolean(process.env.UPSTASH_REDIS_REST_URL?.trim() && process.env.UPSTASH_REDIS_REST_TOKEN?.trim());

const checkR2Config = (): { status: EnvironmentHealthCheck["status"]; detail: string } => {
  const access = readEnv("R2_ACCESS_KEY_ID") || readEnv("AWS_ACCESS_KEY_ID");
  const secret = readEnv("R2_SECRET_ACCESS_KEY") || readEnv("AWS_SECRET_ACCESS_KEY");
  const bucket = readEnv("R2_BUCKET_NAME") || readEnv("R2_BUCKET");
  const endpoint = readEnv("R2_ENDPOINT");
  const accountId = readEnv("R2_ACCOUNT_ID");
  const publicBase = readEnv("R2_PUBLIC_BASE_URL");

  if (!access || !secret) {
    return { status: "warning", detail: "R2 credentials not configured" };
  }
  if (!bucket) {
    return { status: "warning", detail: "R2 bucket not configured" };
  }
  if (!endpoint && !accountId) {
    return { status: "warning", detail: "R2 endpoint/account id not configured" };
  }
  if (!publicBase) {
    return { status: "warning", detail: "R2_PUBLIC_BASE_URL not configured" };
  }
  return { status: "healthy", detail: "R2 configuration present" };
};

export const validateIntelligenceEnvironment = async (): Promise<EnvironmentHealthCheck[]> => {
  const checks: EnvironmentHealthCheck[] = [];

  const mongoStarted = Date.now();
  try {
    await connectDB();
    const ok = await pingMongo();
    checks.push({
      key: "mongodb",
      labelAr: "MongoDB",
      labelEn: "MongoDB",
      status: ok ? "healthy" : "failed",
      detail: ok ? "Connected" : "Ping failed",
      latencyMs: Date.now() - mongoStarted,
    });
  } catch (error) {
    checks.push({
      key: "mongodb",
      labelAr: "MongoDB",
      labelEn: "MongoDB",
      status: "failed",
      detail: error instanceof Error ? error.message : "Connection failed",
      latencyMs: Date.now() - mongoStarted,
    });
  }

  checks.push({
    key: "openai",
    labelAr: "OpenAI",
    labelEn: "OpenAI",
    status: hasOpenAiKey() ? "healthy" : "warning",
    detail: hasOpenAiKey() ? "API key configured" : "OPENAI_API_KEY not set (optional for this dashboard)",
  });

  const r2 = checkR2Config();
  checks.push({
    key: "r2",
    labelAr: "Cloudflare R2",
    labelEn: "Cloudflare R2",
    status: r2.status,
    detail: r2.detail,
  });

  checks.push({
    key: "redis",
    labelAr: "Redis / Upstash",
    labelEn: "Redis / Upstash",
    status: hasRedisConfig() ? "healthy" : "warning",
    detail: hasRedisConfig() ? "Upstash REST configured" : "Redis cache not configured (optional)",
  });

  return checks;
};
