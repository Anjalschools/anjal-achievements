import type { StudentIntelRow, StudentIntelligencePayload } from "@/lib/student-intelligence-analytics";

const LITE_LIST_CAP = 8;

const slimRow = (row: StudentIntelRow): StudentIntelRow => ({
  participantId: row.participantId,
  nameAr: row.nameAr,
  nameEn: row.nameEn,
  avatarUrl: "",
  school: row.school,
  stageKey: row.stageKey,
  stageLabelAr: row.stageLabelAr,
  stageLabelEn: row.stageLabelEn,
  sectionKey: row.sectionKey,
  mawhiba: row.mawhiba,
  recordCount: row.recordCount,
  medalCount: row.medalCount,
  medalRatioPct: row.medalRatioPct,
  distinctActivityCount: row.distinctActivityCount,
  ...(row.growthIndex != null ? { growthIndex: row.growthIndex, yearSpan: row.yearSpan } : {}),
});

const cap = (rows: StudentIntelRow[]) => rows.slice(0, LITE_LIST_CAP).map(slimRow);

/** Server-side trim for lite intelScope responses — cuts multi-MB payloads. */
export const slimStudentIntelligenceLitePayload = (
  payload: StudentIntelligencePayload
): StudentIntelligencePayload => ({
  ok: true,
  generatedAt: payload.generatedAt,
  filters: { intelScope: "lite" },
  ciObservability: payload.ciObservability,
  byWeightedScore: cap(payload.byWeightedScore),
  byParticipation: cap(payload.byParticipation),
  byMedals: cap(payload.byMedals),
  bySuccessRate: cap(payload.bySuccessRate),
  byActivityDiversity: [],
  byFastestGrowth: [],
});
