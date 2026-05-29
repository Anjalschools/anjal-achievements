import "server-only";

import type { ExecutiveFilterSnapshot } from "@/lib/competition-intelligence-persistence";
import { buildParticipationFilterSearchParams } from "@/lib/analytics/participation-filter-params";
import { parseParticipationFiltersFromSearchParams } from "@/lib/achievement-participation-analytics";
import { fingerprintFromParticipationFilters } from "@/lib/analytics/server/analytics-snapshot-fingerprint";

export const fingerprintFromExecutiveFilter = (f: ExecutiveFilterSnapshot): string => {
  const sp = buildParticipationFilterSearchParams(f);
  const parsed = parseParticipationFiltersFromSearchParams(sp);
  return fingerprintFromParticipationFilters(parsed);
};
