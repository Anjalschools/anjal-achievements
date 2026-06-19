import "server-only";
import connectDB, { pingMongo } from "@/lib/mongodb";
import { recordIntelligenceRecoveryEvent } from "@/lib/school-improvement/intelligence-recovery-events";
import type { EnvironmentHealthCheck } from "@/lib/school-improvement/intelligence-diagnostics-types";

const readEnv = (key: string): string | undefined => {
  const raw = process.env[key];
  if (raw == null) return undefined;
  const trimmed = String(raw).trim();
  return trimmed.length ? trimmed : undefined;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const checkMongo = async (): Promise<EnvironmentHealthCheck> => {
  const started = Date.now();
  try {
    await connectDB();
    const ok = await pingMongo();
    return {
      key: "mongodb",
      labelAr: "MongoDB",
      labelEn: "MongoDB",
      status: ok ? "healthy" : "failed",
      detail: ok ? "Connected" : "Ping failed",
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    return {
      key: "mongodb",
      labelAr: "MongoDB",
      labelEn: "MongoDB",
      status: "failed",
      detail: error instanceof Error ? error.message : "Connection failed",
      latencyMs: Date.now() - started,
    };
  }
};

const checkOpenAi = (): EnvironmentHealthCheck => ({
  key: "openai",
  labelAr: "OpenAI",
  labelEn: "OpenAI",
  status: readEnv("OPENAI_API_KEY") ? "healthy" : "warning",
  detail: readEnv("OPENAI_API_KEY") ? "API key configured" : "OPENAI_API_KEY not set (optional for this dashboard)",
});

const checkRedis = (): EnvironmentHealthCheck => ({
  key: "redis",
  labelAr: "Redis / Upstash",
  labelEn: "Redis / Upstash",
  status: readEnv("UPSTASH_REDIS_REST_URL") && readEnv("UPSTASH_REDIS_REST_TOKEN") ? "healthy" : "warning",
  detail:
    readEnv("UPSTASH_REDIS_REST_URL") && readEnv("UPSTASH_REDIS_REST_TOKEN")
      ? "Upstash REST configured"
      : "Redis cache not configured (optional)",
});

const checkR2 = (): EnvironmentHealthCheck => {
  const access = readEnv("R2_ACCESS_KEY_ID") || readEnv("AWS_ACCESS_KEY_ID");
  const secret = readEnv("R2_SECRET_ACCESS_KEY") || readEnv("AWS_SECRET_ACCESS_KEY");
  const bucket = readEnv("R2_BUCKET_NAME") || readEnv("R2_BUCKET");
  const endpoint = readEnv("R2_ENDPOINT");
  const accountId = readEnv("R2_ACCOUNT_ID");
  const publicBase = readEnv("R2_PUBLIC_BASE_URL");
  if (!access || !secret) {
    return { key: "r2", labelAr: "Cloudflare R2", labelEn: "Cloudflare R2", status: "warning", detail: "R2 credentials not configured" };
  }
  if (!bucket || (!endpoint && !accountId) || !publicBase) {
    return { key: "r2", labelAr: "Cloudflare R2", labelEn: "Cloudflare R2", status: "warning", detail: "R2 configuration incomplete" };
  }
  return { key: "r2", labelAr: "Cloudflare R2", labelEn: "Cloudflare R2", status: "healthy", detail: "R2 configuration present" };
};

const retryCheck = async (
  check: () => Promise<EnvironmentHealthCheck> | EnvironmentHealthCheck,
  retries = 3
): Promise<EnvironmentHealthCheck> => {
  let last: EnvironmentHealthCheck | null = null;
  for (let attempt = 0; attempt < retries; attempt++) {
    if (attempt > 0) await sleep(attempt === 1 ? 2000 : 5000);
    last = await check();
    if (last.status !== "failed") return last;
  }
  return last!;
};

export const validateIntelligenceEnvironmentWithRecovery = async (): Promise<EnvironmentHealthCheck[]> => {
  const started = Date.now();
  const [mongodb, openai, r2, redis] = await Promise.all([
    retryCheck(checkMongo),
    Promise.resolve(checkOpenAi()),
    Promise.resolve(checkR2()),
    Promise.resolve(checkRedis()),
  ]);

  const checks = [mongodb, openai, r2, redis];
  const recovered = mongodb.status === "healthy";
  if (recovered && Date.now() - started > 500) {
    await recordIntelligenceRecoveryEvent({
      domain: "school_improvement",
      service: "mongodb",
      outcome: "environment_recovered",
      retryCount: mongodb.status === "healthy" ? 1 : 0,
      recoveredAfterRetry: true,
      snapshotFallback: false,
      durationMs: Date.now() - started,
      message: mongodb.detail,
    });
  }

  return checks;
};
