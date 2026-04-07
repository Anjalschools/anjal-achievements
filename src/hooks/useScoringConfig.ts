"use client";

import { useEffect, useState } from "react";
import type { ScoringConfig } from "@/constants/default-scoring";

let cached: ScoringConfig | null = null;
let inflight: Promise<ScoringConfig> | null = null;

const fetchScoringConfig = async (): Promise<ScoringConfig> => {
  const res = await fetch("/api/public/scoring-config", { credentials: "same-origin" });
  if (!res.ok) throw new Error("scoring-config");
  const j = (await res.json()) as { ok?: boolean; data?: ScoringConfig };
  if (!j?.ok || !j.data) throw new Error("scoring-config");
  return j.data;
};

/**
 * Public scoring table for client-side score breakdown (matches server when cache is fresh).
 */
export const useScoringConfig = (): ScoringConfig | null => {
  const [cfg, setCfg] = useState<ScoringConfig | null>(cached);

  useEffect(() => {
    if (cached) {
      setCfg(cached);
      return;
    }
    if (!inflight) {
      inflight = fetchScoringConfig()
        .then((c) => {
          cached = c;
          return c;
        })
        .finally(() => {
          inflight = null;
        });
    }
    void inflight.then(setCfg).catch(() => setCfg(null));
  }, []);

  return cfg;
};
