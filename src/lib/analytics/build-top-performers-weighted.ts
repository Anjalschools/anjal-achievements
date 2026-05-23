import {
  buildWeightedStudentRankings,
  type RankingAchievementInput,
} from "@/lib/analytics/achievement-ranking-engine";
import type { FocusedTopPerformerRow } from "@/types/focused-activity-report";

export type RankingPoolRow = RankingAchievementInput & {
  participantId: string;
  nameAr?: string;
  nameEn?: string;
  school?: string;
  stage?: string;
  avatarUrl?: string;
};

const stageLabel = (key: string, loc: "ar" | "en"): string => {
  if (key === "primary") return loc === "ar" ? "ابتدائي" : "Primary";
  if (key === "middle") return loc === "ar" ? "متوسط" : "Middle";
  if (key === "secondary") return loc === "ar" ? "ثانوي" : "Secondary";
  return loc === "ar" ? "غير محدد" : "N/A";
};

const levelToRank = (lvl: string | undefined): number => {
  const l = String(lvl || "").trim();
  if (l === "international") return 6;
  if (l === "kingdom") return 5;
  if (l === "province") return 3;
  return 2;
};

export const mapWeightedToTopPerformerRows = (
  pool: RankingPoolRow[],
  metaById: Map<
    string,
  Pick<FocusedTopPerformerRow, "participantId" | "nameAr" | "nameEn" | "school" | "stageKey" | "stageLabelAr" | "stageLabelEn" | "avatarUrl">
  >
): FocusedTopPerformerRow[] => {
  const ranked = buildWeightedStudentRankings(pool, { limit: 8 });
  return ranked.map((r) => {
    const meta = metaById.get(r.participantId);
    const st = meta?.stageKey ?? "unknown";
    const maxLevelRank = 2;
    return {
      participantId: r.participantId,
      nameAr: meta?.nameAr ?? "—",
      nameEn: meta?.nameEn ?? "—",
      recordCount: r.recordCount,
      medalCount: r.medalCount,
      maxLevelRank,
      school: meta?.school ?? "—",
      stageKey: st,
      stageLabelAr: meta?.stageLabelAr ?? stageLabel(st, "ar"),
      stageLabelEn: meta?.stageLabelEn ?? stageLabel(st, "en"),
      avatarUrl: meta?.avatarUrl ?? "",
    };
  });
};

export const buildTopPerformersFromRankingPool = (
  pool: RankingPoolRow[]
): {
  byWeighted: FocusedTopPerformerRow[];
  byParticipation: FocusedTopPerformerRow[];
  byMedals: FocusedTopPerformerRow[];
  byLevel: FocusedTopPerformerRow[];
} => {
  type MetaPick = Pick<
    FocusedTopPerformerRow,
    "participantId" | "nameAr" | "nameEn" | "school" | "stageKey" | "stageLabelAr" | "stageLabelEn" | "avatarUrl"
  >;
  const metaById = new Map<string, MetaPick>();
  const agg = new Map<
    string,
    { recordCount: number; medalCount: number; maxLevelRank: number; meta: RankingPoolRow }
  >();

  for (const row of pool) {
    const pid = String(row.participantId || "").trim();
    if (!pid) continue;
    let hit = agg.get(pid);
    if (!hit) {
      hit = {
        recordCount: 0,
        medalCount: 0,
        maxLevelRank: 2,
        meta: row,
      };
      agg.set(pid, hit);
    }
    hit.recordCount += 1;
    if (row.resultType === "medal") hit.medalCount += 1;
    hit.maxLevelRank = Math.max(hit.maxLevelRank, levelToRank(row.achievementLevel));
  }

  for (const [pid, hit] of agg) {
    const m = hit.meta;
    const st = String(m.stage || "unknown");
    metaById.set(pid, {
      participantId: pid,
      nameAr: String(m.nameAr || "").trim() || "—",
      nameEn: String(m.nameEn || "").trim() || "—",
      school: String(m.school || "").trim() || "—",
      stageKey: st,
      stageLabelAr: stageLabel(st, "ar"),
      stageLabelEn: stageLabel(st, "en"),
      avatarUrl: String(m.avatarUrl || "").trim(),
    });
  }

  const byWeighted = mapWeightedToTopPerformerRows(pool, metaById);

  const byParticipation = [...agg.entries()]
    .sort((a, b) => b[1].recordCount - a[1].recordCount)
    .slice(0, 8)
    .map(([pid, hit]) => {
      const meta = metaById.get(pid)!;
      return {
        ...meta,
        recordCount: hit.recordCount,
        medalCount: hit.medalCount,
        maxLevelRank: hit.maxLevelRank,
      };
    });

  const byMedals = [...agg.entries()]
    .sort((a, b) => b[1].medalCount - a[1].medalCount || b[1].recordCount - a[1].recordCount)
    .slice(0, 8)
    .map(([pid, hit]) => {
      const meta = metaById.get(pid)!;
      return {
        ...meta,
        recordCount: hit.recordCount,
        medalCount: hit.medalCount,
        maxLevelRank: hit.maxLevelRank,
      };
    });

  const byLevel = [...agg.entries()]
    .sort(
      (a, b) =>
        b[1].maxLevelRank - a[1].maxLevelRank ||
        b[1].medalCount - a[1].medalCount ||
        b[1].recordCount - a[1].recordCount
    )
    .slice(0, 8)
    .map(([pid, hit]) => {
      const meta = metaById.get(pid)!;
      return {
        ...meta,
        recordCount: hit.recordCount,
        medalCount: hit.medalCount,
        maxLevelRank: hit.maxLevelRank,
      };
    });

  return { byWeighted, byParticipation, byMedals, byLevel };
};
