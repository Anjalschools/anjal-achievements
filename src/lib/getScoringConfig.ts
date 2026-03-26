import connectDB from "@/lib/mongodb";
import PlatformSettings from "@/models/PlatformSettings";
import { DEFAULT_SCORING_CONFIG, type ScoringConfig } from "@/constants/default-scoring";

const deepMerge = <T extends Record<string, unknown>>(base: T, partial: Record<string, unknown>): T => {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(partial || {})) {
    const prev = out[k];
    if (
      v &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      prev &&
      typeof prev === "object" &&
      !Array.isArray(prev)
    ) {
      out[k] = deepMerge(prev as Record<string, unknown>, v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out as T;
};

export const getScoringConfig = async (autoSeed = true): Promise<ScoringConfig> => {
  await connectDB();
  const singletonKey = "default";
  const doc = await PlatformSettings.findOne({ singletonKey }).lean();
  const stored = ((doc as unknown as Record<string, unknown> | null)?.scoring || {}) as Record<string, unknown>;
  const merged = deepMerge(DEFAULT_SCORING_CONFIG as unknown as Record<string, unknown>, stored) as ScoringConfig;

  const shouldSeed = !doc || Object.keys(stored || {}).length === 0;
  if (autoSeed && shouldSeed) {
    await PlatformSettings.findOneAndUpdate(
      { singletonKey },
      { $set: { scoring: merged } },
      { upsert: true }
    );
  }
  return merged;
};

