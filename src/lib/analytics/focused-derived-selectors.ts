import type { FocusedActivityParticipantRow, FocusedActivityReportPayload } from "@/types/focused-activity-report";

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u064B-\u065F]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export const selectFocusedCharts = (
  payload: FocusedActivityReportPayload | null | undefined,
  isAr: boolean
) => {
  if (!payload) {
    return {
      resultDonut: [] as Array<{ key: string; name: string; value: number; fill?: string }>,
      yoyBars: [] as Array<{ year: string; participants: number; medals: number; excellence: number }>,
      sectionGender: [] as Array<{ name: string; male: number; female: number }>,
      mawhibaGender: [] as Array<{ name: string; male: number; female: number }>,
      stageBars: [] as Array<{ name: string; n: number }>,
    };
  }
  return {
    resultDonut: payload.charts.resultBars.map((x) => ({
      key: x.key,
      name: isAr ? x.labelAr : x.labelEn,
      value: x.count,
      fill: x.fill,
    })),
    yoyBars: payload.executive.yearComparison.map((y) => ({
      year: String(y.year),
      participants: y.distinctStudents,
      medals: y.totalMedals,
      excellence: y.excellenceRatePct,
    })),
    sectionGender: payload.executive.demographicStacks.sectionGender.map((r) => ({
      name: isAr ? r.labelAr : r.labelEn,
      male: r.male,
      female: r.female,
    })),
    mawhibaGender: payload.executive.demographicStacks.mawhibaGender.map((r) => ({
      name: isAr ? r.labelAr : r.labelEn,
      male: r.male,
      female: r.female,
    })),
    stageBars: payload.executive.demographicStacks.stageBreakdown.map((r) => ({
      name: isAr ? r.labelAr : r.labelEn,
      n: r.count,
    })),
  };
};

export const selectFocusedParticipants = ({
  participants,
  isAr,
  query,
  sortKey,
  sortDir,
}: {
  participants: FocusedActivityParticipantRow[];
  isAr: boolean;
  query: string;
  sortKey: "name" | "year" | "score" | "level" | "result" | "";
  sortDir: "asc" | "desc";
}) => {
  const q = normalize(query);
  const filtered =
    q.length === 0
      ? participants
      : participants.filter((r) =>
          normalize(
            `${r.studentNameAr} ${r.studentNameEn} ${r.resultLineAr} ${r.resultLineEn} ${r.levelLabelAr} ${r.schoolOrOrganization}`
          ).includes(q)
        );

  const mul = sortDir === "asc" ? 1 : -1;
  const sorted = [...filtered];
  sorted.sort((a, b) => {
    if (sortKey === "year") return mul * ((a.year ?? -1) - (b.year ?? -1));
    if (sortKey === "score") return mul * ((a.scoreNumeric ?? -1e9) - (b.scoreNumeric ?? -1e9));
    if (sortKey === "level") return mul * (isAr ? a.levelLabelAr : a.levelLabelEn).localeCompare(isAr ? b.levelLabelAr : b.levelLabelEn);
    if (sortKey === "result") return mul * (isAr ? a.resultLineAr : a.resultLineEn).localeCompare(isAr ? b.resultLineAr : b.resultLineEn);
    return mul * (isAr ? a.studentNameAr : a.studentNameEn).localeCompare(isAr ? b.studentNameAr : b.studentNameEn);
  });
  return sorted;
};

export const selectFocusedTrends = (payload: FocusedActivityReportPayload | null | undefined) =>
  payload?.executive?.yearComparison ?? [];

export const selectFocusedInsights = (payload: FocusedActivityReportPayload | null | undefined) =>
  payload?.decisionPlatform ?? null;

