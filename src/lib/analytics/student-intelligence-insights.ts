/**
 * Student Hall of Fame — ranking rules, badges, and intelligence narratives.
 */

import type { StudentIntelRow, StudentIntelligencePayload } from "@/lib/student-intelligence-analytics";
import type { AnalyticsLocale } from "@/lib/analytics/analytics-semantic-registry";
import { t } from "@/lib/analytics/analytics-semantic-registry";

export type StudentExcellenceBadge =
  | "top_performer"
  | "medal_leader"
  | "excellence_award"
  | "rising_talent"
  | "participation_champion"
  | "diversity_leader";

export type StudentHallOfFameEntry = {
  row: StudentIntelRow;
  rank: number;
  score: number;
  badges: StudentExcellenceBadge[];
  narrativeAr: string;
  narrativeEn: string;
  primaryBadge: StudentExcellenceBadge;
};

export type HallOfFameShowcase = {
  hero: StudentHallOfFameEntry | null;
  secondary: StudentHallOfFameEntry[];
  maxRank: number;
};

export type StudentInsightContext = {
  topActivityLabelAr: string;
  topActivityLabelEn: string;
  locale: AnalyticsLocale;
};

const badgeLabel = (badge: StudentExcellenceBadge, loc: AnalyticsLocale): string => {
  const map: Record<StudentExcellenceBadge, "hall.badge.topPerformer" | "hall.badge.medalLeader" | "hall.badge.excellenceAward" | "hall.badge.risingTalent" | "hall.badge.participationChampion"> = {
    top_performer: "hall.badge.topPerformer",
    medal_leader: "hall.badge.medalLeader",
    excellence_award: "hall.badge.excellenceAward",
    rising_talent: "hall.badge.risingTalent",
    participation_champion: "hall.badge.participationChampion",
    diversity_leader: "hall.badge.excellenceAward",
  };
  return t(map[badge] ?? "hall.badge.topPerformer", loc);
};

const idInTop = (rows: StudentIntelRow[], pid: string, limit = 3): boolean =>
  rows.slice(0, limit).some((r) => r.participantId === pid);

const resolveBadges = (
  row: StudentIntelRow,
  rank: number,
  data: StudentIntelligencePayload
): StudentExcellenceBadge[] => {
  const badges: StudentExcellenceBadge[] = [];
  if (rank === 0) badges.push("top_performer");
  if (idInTop(data.byMedals, row.participantId)) badges.push("medal_leader");
  if (idInTop(data.byParticipation, row.participantId)) badges.push("participation_champion");
  if (row.medalRatioPct >= 50 && row.recordCount >= 2) badges.push("excellence_award");
  if (idInTop(data.byActivityDiversity, row.participantId)) badges.push("diversity_leader");
  if (
    typeof row.growthIndex === "number" &&
    row.growthIndex > 0 &&
    idInTop(data.byFastestGrowth, row.participantId)
  ) {
    badges.push("rising_talent");
  }
  if (badges.length === 0) badges.push(rank === 0 ? "top_performer" : "excellence_award");
  return [...new Set(badges)];
};

const resolveNarrative = (
  row: StudentIntelRow,
  badges: StudentExcellenceBadge[],
  ctx: StudentInsightContext,
  data: StudentIntelligencePayload
): { ar: string; en: string; primary: StudentExcellenceBadge } => {
  const activityAr = ctx.topActivityLabelAr || "النشاط المحدد";
  const activityEn = ctx.topActivityLabelEn || "the selected activity";
  const sectionAr = row.sectionKey === "international" ? "القسم الدولي" : "القسم العربي";
  const sectionEn = row.sectionKey === "international" ? "the international section" : "the Arabic section";
  const mawhibaAr = row.mawhiba ? "طلاب الموهبة" : "الطلاب";
  const mawhibaEn = row.mawhiba ? "Mawhiba students" : "students";

  let primary = badges[0] ?? "top_performer";

  if (badges.includes("medal_leader") && idInTop(data.byMedals, row.participantId, 1)) {
    primary = "medal_leader";
    return {
      primary,
      ar: `حقق أعلى عدد ميداليات (${row.medalCount}) في ${activityAr} ضمن الفلاتر الحالية.`,
      en: `Earned the most medals (${row.medalCount}) in ${activityEn} under current filters.`,
    };
  }

  if (badges.includes("participation_champion") && idInTop(data.byParticipation, row.participantId, 1)) {
    primary = "participation_champion";
    return {
      primary,
      ar: `الأكثر مشاركة (${row.recordCount} مشاركة) بين ${mawhibaAr} في النطاق المفلتر.`,
      en: `Most participations (${row.recordCount}) among ${mawhibaEn} in the filtered scope.`,
    };
  }

  if (badges.includes("excellence_award") && row.medalRatioPct >= 40) {
    primary = "excellence_award";
    return {
      primary,
      ar: `حقق أفضل معدل تحويل للميداليات (${row.medalRatioPct}%) مع ${row.medalCount} ميدالية.`,
      en: `Achieved a leading medal conversion rate (${row.medalRatioPct}%) with ${row.medalCount} medals.`,
    };
  }

  if (badges.includes("rising_talent") && typeof row.growthIndex === "number") {
    primary = "rising_talent";
    return {
      primary,
      ar: `أسرع تطور سنوي (مؤشر ${row.growthIndex}) ضمن الفلاتر الحالية.`,
      en: `Fastest year-over-year momentum (index ${row.growthIndex}) under current filters.`,
    };
  }

  if (row.mawhiba && row.medalCount > 0) {
    return {
      primary: "excellence_award",
      ar: `من أبرز طلاب الموهبة بـ ${row.medalCount} ميدالية و${row.recordCount} مشاركة.`,
      en: `Among top Mawhiba achievers with ${row.medalCount} medals across ${row.recordCount} participations.`,
    };
  }

  if (row.sectionKey) {
    return {
      primary,
      ar: `من أبرز الطلاب في ${sectionAr} بمعدل تميز ${row.medalRatioPct}%.`,
      en: `A leading performer in ${sectionEn} with ${row.medalRatioPct}% medal success.`,
    };
  }

  return {
    primary,
    ar: `ضمن أبرز ${row.recordCount} مشاركة و${row.medalCount} ميدالية في ${activityAr}.`,
    en: `Among top performers with ${row.recordCount} participations and ${row.medalCount} medals in ${activityEn}.`,
  };
};

export const buildHallOfFameShowcase = (
  data: StudentIntelligencePayload | null,
  ctx: StudentInsightContext,
  maxTotal = 12
): HallOfFameShowcase => {
  if (!data) return { hero: null, secondary: [], maxRank: 0 };

  const seen = new Set<string>();
  const merged: Array<{ row: StudentIntelRow; score: number }> = [];
  const push = (rows: StudentIntelRow[], weight: number) => {
    for (const row of rows) {
      if (seen.has(row.participantId)) continue;
      seen.add(row.participantId);
      merged.push({
        row,
        score: weight * row.medalCount * 10 + row.recordCount + row.medalRatioPct * 0.5,
      });
    }
  };
  push(data.byMedals, 4);
  push(data.byParticipation, 3);
  push(data.byWeightedScore, 3);
  push(data.bySuccessRate, 2);
  push(data.byActivityDiversity, 1);
  push(data.byFastestGrowth, 2);

  const sorted = merged.sort((a, b) => b.score - a.score).slice(0, maxTotal);

  const entries: StudentHallOfFameEntry[] = sorted.map(({ row, score }, rank) => {
    const badges = resolveBadges(row, rank, data);
    const narrative = resolveNarrative(row, badges, ctx, data);
    return {
      row,
      rank,
      score,
      badges,
      narrativeAr: narrative.ar,
      narrativeEn: narrative.en,
      primaryBadge: narrative.primary,
    };
  });

  return {
    hero: entries[0] ?? null,
    secondary: entries.slice(1),
    maxRank: entries.length,
  };
};

export const getBadgeLabel = badgeLabel;
