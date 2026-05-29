import { createHash } from "crypto";
import type { AiDecisionType, ExecutiveAiDecision } from "@/lib/analytics/ai/ai-decision-schema";

export const decisionContentFingerprint = (input: {
  decisionType: AiDecisionType;
  titleEn: string;
  sourceInsights: string[];
}): string => {
  const canonical = JSON.stringify({
    t: input.decisionType,
    title: input.titleEn.trim().toLowerCase(),
    sources: [...input.sourceInsights].sort(),
  });
  return createHash("sha256").update(canonical).digest("hex").slice(0, 24);
};

export const bundleFingerprint = (filterFingerprint: string, decisionIds: string[]): string => {
  const canonical = `${filterFingerprint}|${[...decisionIds].sort().join(",")}`;
  return createHash("sha256").update(canonical).digest("hex").slice(0, 32);
};

export const dedupeDecisions = (decisions: ExecutiveAiDecision[]): ExecutiveAiDecision[] => {
  const seen = new Set<string>();
  const out: ExecutiveAiDecision[] = [];
  for (const d of decisions) {
    const key = d.fingerprint;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(d);
  }
  return out;
};
