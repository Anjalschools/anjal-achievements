import type { StudentIntelligencePayload } from "@/lib/student-intelligence-analytics";
import type { CiTrustLevel } from "@/lib/competition-intelligence-consistency";

export type StudentIntelGovernanceIssue = {
  code: string;
  severity: "info" | "warn" | "critical";
  pool?: string;
};

export type StudentIntelGovernanceReport = {
  level: CiTrustLevel;
  issues: StudentIntelGovernanceIssue[];
  duplicateParticipationInflation: number;
  growthAnomalies: number;
  rankingFairnessFlags: number;
  staleProfileRisk: boolean;
  yearConsistencyFlags: number;
};

const checkPool = (
  rows: {
    participantId: string;
    recordCount: number;
    medalCount: number;
    growthIndex?: number;
    yearSpan?: number;
  }[],
  pool: string,
  issues: StudentIntelGovernanceIssue[]
): { dup: number; growth: number; ranking: number } => {
  const seen = new Set<string>();
  let dup = 0;
  let growth = 0;
  let ranking = 0;
  for (const r of rows) {
    if (seen.has(r.participantId)) {
      dup += 1;
      issues.push({
        code: "duplicate_participation_inflation",
        severity: "critical",
        pool,
      });
    }
    seen.add(r.participantId);
    if (r.recordCount < r.medalCount) {
      ranking += 1;
      issues.push({ code: "ranking_fairness_medals_gt_records", severity: "warn", pool });
    }
    if (typeof r.growthIndex === "number" && r.growthIndex > r.recordCount * 3 && (r.yearSpan ?? 0) >= 2) {
      growth += 1;
      issues.push({ code: "growth_anomaly_spike", severity: "warn", pool });
    }
  }
  return { dup, growth, ranking };
};

export const runStudentIntelGovernance = (
  payload: StudentIntelligencePayload | null,
  cacheAgeMs?: number
): StudentIntelGovernanceReport => {
  const issues: StudentIntelGovernanceIssue[] = [];
  if (!payload) {
    return {
      level: "synced",
      issues: [],
      duplicateParticipationInflation: 0,
      growthAnomalies: 0,
      rankingFairnessFlags: 0,
      staleProfileRisk: false,
      yearConsistencyFlags: 0,
    };
  }

  let dupTotal = 0;
  let growthTotal = 0;
  let rankingTotal = 0;

  for (const [pool, rows] of [
    ["byParticipation", payload.byParticipation],
    ["byMedals", payload.byMedals],
    ["byFastestGrowth", payload.byFastestGrowth],
  ] as const) {
    const r = checkPool(rows, pool, issues);
    dupTotal += r.dup;
    growthTotal += r.growth;
    rankingTotal += r.ranking;
  }

  const staleProfileRisk = typeof cacheAgeMs === "number" && cacheAgeMs > 120_000;
  if (staleProfileRisk) {
    issues.push({ code: "stale_cached_profiles", severity: "info" });
  }

  const filters = payload.filters as { academicYear?: string };
  let yearConsistencyFlags = 0;
  if (filters?.academicYear && filters.academicYear !== "all") {
    const y = parseInt(String(filters.academicYear).match(/20\d{2}/)?.[0] ?? "", 10);
    if (Number.isFinite(y)) {
      for (const row of payload.byFastestGrowth) {
        if (row.yearSpan && row.yearSpan > 0 && row.recordCount === 0) {
          yearConsistencyFlags += 1;
          issues.push({ code: "year_consistency_empty_growth_row", severity: "warn" });
        }
      }
    }
  }

  const level: CiTrustLevel =
    issues.some((i) => i.severity === "critical") ? "mismatch"
    : issues.some((i) => i.severity === "warn") ? "partial"
    : "synced";

  return {
    level,
    issues,
    duplicateParticipationInflation: dupTotal,
    growthAnomalies: growthTotal,
    rankingFairnessFlags: rankingTotal,
    staleProfileRisk,
    yearConsistencyFlags,
  };
};
