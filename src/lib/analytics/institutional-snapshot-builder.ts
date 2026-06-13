import "server-only";
import connectDB from "@/lib/mongodb";
import Achievement from "@/models/Achievement";
import User from "@/models/User";
import { resolveCanonicalActivity } from "@/lib/analytics/activity-name-normalizer";
import { getStageByGrade } from "@/lib/report-stage-mapping";
import {
  buildStudentIntelligence,
  type StudentIntelligencePayload,
} from "@/lib/student-intelligence-analytics";
import type {
  ActivityMetrics,
  InstitutionalSnapshot,
  SchoolMetrics,
  StageMetrics,
  StudentSample,
  YearOverYearMetrics,
} from "@/lib/analytics/ai/executive-intelligence/executive-insight-types";

const currentYear = () => new Date().getFullYear();

const approvedFilter = {
  $or: [{ status: "approved" }, { approved: true }],
  status: { $ne: "rejected" },
};

const mapIntelToStudentSample = (rows: StudentIntelligencePayload): StudentSample[] => {
  const growth = rows.byFastestGrowth || [];
  const weighted = rows.byWeightedScore || [];
  const pool = new Map<string, StudentSample>();

  for (const row of weighted) {
    const medalRatio = row.medalRatioPct || 0;
    const quality = Math.min(100, Math.round(medalRatio * 0.6 + row.distinctActivityCount * 8 + row.recordCount * 2));
    pool.set(row.participantId, {
      userId: row.participantId,
      displayName: row.nameAr || row.nameEn || row.participantId,
      recentTrend: "stable",
      momentum: quality >= 70 ? "high" : quality >= 45 ? "medium" : "low",
      peakQuality: quality,
      recentQuality: quality,
      olympiadTrajectory: row.mawhiba ? "building" : "none",
    });
  }

  for (const row of growth) {
    const existing = pool.get(row.participantId);
    const growthIdx = row.growthIndex ?? 0;
    const trend =
      growthIdx >= 1.5 ? "accelerating" : growthIdx >= 0.5 ? "improving" : growthIdx <= -0.5 ? "declining" : "stable";
    const momentum = growthIdx >= 1 ? "high" : growthIdx >= 0.3 ? "medium" : "low";
    if (existing) {
      existing.recentTrend = trend;
      existing.momentum = momentum;
      existing.recentQuality = Math.min(100, existing.recentQuality + Math.round(growthIdx * 10));
    } else {
      pool.set(row.participantId, {
        userId: row.participantId,
        displayName: row.nameAr || row.nameEn || row.participantId,
        recentTrend: trend,
        momentum,
        peakQuality: Math.round((row.medalRatioPct || 0) * 0.8),
        recentQuality: Math.round((row.medalRatioPct || 0) * 0.8),
        olympiadTrajectory: "none",
      });
    }
  }

  return [...pool.values()].slice(0, 500);
};

export const buildInstitutionalSnapshot = async (): Promise<InstitutionalSnapshot> => {
  await connectDB();
  const year = currentYear();
  const prevYear = year - 1;

  const [achievements, studentCount, intel] = await Promise.all([
    Achievement.find(approvedFilter)
      .select(
        "achievementYear activityYear achievementType achievementName competitionName customCompetitionName programName studentSnapshot resultType medalType userId"
      )
      .limit(15000)
      .lean(),
    User.countDocuments({ role: "student", status: "active" }),
    buildStudentIntelligence({}, { lite: true }),
  ]);

  const activityMap = new Map<string, ActivityMetrics>();
  const yearMap = new Map<number, YearOverYearMetrics>();
  const stageMap = new Map<string, StageMetrics>();

  for (const row of achievements) {
    const r = row as unknown as Record<string, unknown>;
    const y =
      typeof r.achievementYear === "number"
        ? r.achievementYear
        : typeof r.activityYear === "number"
          ? r.activityYear
          : year;
    const canonical = resolveCanonicalActivity({
      achievementType: String(r.achievementType || ""),
      achievementName: String(r.achievementName || ""),
      competitionName: String(r.competitionName || ""),
      customCompetitionName: String(r.customCompetitionName || ""),
      programName: String(r.programName || ""),
    });

    const key = canonical.canonicalKey || "other";
    const existingAct = activityMap.get(key) || {
      activityKey: key,
      activityLabelAr: canonical.displayNameAr || key,
      domain: canonical.category || "other",
      participations: 0,
      currentYear: 0,
      previousYear: 0,
      growthRatePct: 0,
      awardCount: 0,
    };
    existingAct.participations += 1;
    if (y === year) existingAct.currentYear += 1;
    if (y === prevYear) existingAct.previousYear += 1;
    if (String(r.resultType || "") === "medal" || String(r.resultType || "") === "rank") {
      existingAct.awardCount += 1;
    }
    activityMap.set(key, existingAct);

    const yy = yearMap.get(y) || {
      year: y,
      totalParticipations: 0,
      totalAwards: 0,
      medalCount: 0,
      activeSchools: 1,
    };
    yy.totalParticipations += 1;
    if (String(r.resultType || "") === "medal") yy.medalCount += 1;
    if (String(r.resultType || "") === "medal" || String(r.resultType || "") === "rank") yy.totalAwards += 1;
    yearMap.set(y, yy);

    const snap = r.studentSnapshot as { grade?: string; section?: string } | undefined;
    const grade = String(snap?.grade || "");
    const section = snap?.section === "international" ? "international" : "arabic";
    const stage = getStageByGrade(grade) || "middle";
    const stageKey = `${stage}-${section}`;
    const stageRow = stageMap.get(stageKey) || {
      stage: stage as StageMetrics["stage"],
      section,
      totalStudents: 0,
      totalParticipations: 0,
      participationRatePct: 0,
      medalCount: 0,
      awardCount: 0,
    };
    stageRow.totalParticipations += 1;
    if (String(r.resultType || "") === "medal") stageRow.medalCount += 1;
    if (String(r.resultType || "") === "medal" || String(r.resultType || "") === "rank") stageRow.awardCount += 1;
    stageMap.set(stageKey, stageRow);
  }

  for (const act of activityMap.values()) {
    if (act.previousYear > 0) {
      act.growthRatePct = Math.round(((act.currentYear - act.previousYear) / act.previousYear) * 1000) / 10;
    } else if (act.currentYear > 0) {
      act.growthRatePct = 100;
    }
  }

  const stageBreakdown = [...stageMap.values()].map((s) => ({
    ...s,
    totalStudents: Math.max(1, Math.round(studentCount / Math.max(stageMap.size, 1))),
    participationRatePct:
      studentCount > 0
        ? Math.round((s.totalParticipations / Math.max(studentCount / Math.max(stageMap.size, 1), 1)) * 1000) / 10
        : 0,
  }));

  const schoolBreakdown: SchoolMetrics[] = [
    {
      schoolId: "anjal",
      schoolName: "مدارس الأنجال الأهلية",
      totalStudents: studentCount,
      totalParticipations: achievements.length,
      medalCount: achievements.filter((a) => String((a as { resultType?: string }).resultType) === "medal").length,
      awardCount: achievements.filter((a) => {
        const rt = String((a as { resultType?: string }).resultType || "");
        return rt === "medal" || rt === "rank";
      }).length,
      currentYear: achievements.filter((a) => {
        const y = (a as { achievementYear?: number }).achievementYear;
        return y === year;
      }).length,
      previousYear: achievements.filter((a) => {
        const y = (a as { achievementYear?: number }).achievementYear;
        return y === prevYear;
      }).length,
      growthRatePct: 0,
      activityCount: activityMap.size,
    },
  ];

  const sb = schoolBreakdown[0];
  if (sb.previousYear > 0) {
    sb.growthRatePct = Math.round(((sb.currentYear - sb.previousYear) / sb.previousYear) * 1000) / 10;
  }

  return {
    schoolBreakdown,
    stageBreakdown,
    activityBreakdown: [...activityMap.values()].sort((a, b) => b.participations - a.participations),
    yearOverYear: [...yearMap.values()].sort((a, b) => a.year - b.year),
    studentSamples: mapIntelToStudentSample(intel),
  };
};
