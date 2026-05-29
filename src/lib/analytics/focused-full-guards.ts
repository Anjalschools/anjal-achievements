/**
 * Hard guards for scope=full / export bundle assembly (Node-side, post-segment).
 */

import { estimateFocusedPayloadBytes } from "@/lib/analytics/focused-payload-governor";

/** Aligned with facet full budget — never approach Mongo 16MB BSON. */
export const MAX_RESPONSE_BYTES = 14 * 1024 * 1024;

export const MAX_PARTICIPANTS_PER_REQUEST = 50;

export const MAX_INSIGHT_ITEMS = 12;

export const MAX_CHART_SERIES_POINTS = 32;

export type FocusedFullGuardResult = {
  bytes: number;
  exceeded: boolean;
  degraded: boolean;
};

export const clampFocusedFullPageSize = (requested?: number): number =>
  Math.min(MAX_PARTICIPANTS_PER_REQUEST, Math.max(5, requested ?? 25));

export const assessFocusedFullPayload = (payload: unknown): FocusedFullGuardResult => {
  const bytes = estimateFocusedPayloadBytes(payload);
  return {
    bytes,
    exceeded: bytes > MAX_RESPONSE_BYTES,
    degraded: bytes > MAX_RESPONSE_BYTES * 0.85,
  };
};
