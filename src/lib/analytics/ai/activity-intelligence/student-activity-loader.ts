/**
 * student-activity-loader.ts
 * Server-only Mongo loader — fetches full achievement history per student or cohort.
 * Uses lean projections + compound indexes; caches results in-process.
 */
import "server-only";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import Achievement from "@/models/Achievement";
import { CiRouteMemoryCache } from "@/lib/competition/cache/cache-lifecycle";
import { resolveCanonicalActivity } from "@/lib/analytics/activity-name-normalizer";
import { resolveAchievementOutcome } from "@/lib/analytics/achievement-outcome-resolver";
import { extractActivityYearFromAchievement } from "@/lib/analytics/activity-year-resolver";

/* ─── shape ─────────────────────────────────────────────────────────────── */

export type RawActivityRecord = {
  id: string;
  userId: string;
  achievementYear: number;
  canonicalActivityKey: string;
  activityLabelAr: string;
  activityLabelEn: string;
  achievementType: string;
  achievementClassification: string;
  resultType: string;
  outcomeKey: string;   // e.g. "medal:gold" | "rank:first" | "nomination"
  medalType: string | null;
  rank: string | null;
  achievementLevel: string;
  grade: string;
  section: string;
  stage: string;
  mawhiba: boolean;
  olympiadMeeting: string;
  olympiadField: string;
  standardizedScore: number | null;
  status: string;
};

export type StudentActivityBundle = {
  userId: string;
  records: RawActivityRecord[];
  fetchedAt: string;
};

/* ─── cache ──────────────────────────────────────────────────────────────── */

const _cache = new CiRouteMemoryCache<StudentActivityBundle>({
  softTtlMs: 10 * 60_000,
  staleTtlMs: 30 * 60_000,
  maxEntries: 200,
});

const APPROVED = ["approved", "verified"];

/* ─── projection ─────────────────────────────────────────────────────────── */

const PROJECTION = {
  userId: 1,
  achievementType: 1,
  achievementClassification: 1,
  achievementName: 1,
  customAchievementName: 1,
  competitionName: 1,
  customCompetitionName: 1,
  programName: 1,
  customProgramName: 1,
  olympiadMeeting: 1,
  olympiadField: 1,
  resultType: 1,
  medalType: 1,
  rank: 1,
  achievementLevel: 1,
  achievementYear: 1,
  activityYear: 1,
  status: 1,
  studentSnapshot: 1,
  "standardizedTest.normalizedScore": 1,
} as const;

/* ─── row mapper ─────────────────────────────────────────────────────────── */

const mapRow = (r: Record<string, unknown>): RawActivityRecord => {
  const snap = r.studentSnapshot as Record<string, unknown> | undefined;
  const { year } = extractActivityYearFromAchievement({
    achievementYear: r.achievementYear as number | undefined,
    activityYear: r.activityYear as string | undefined,
  });
  const canonical = resolveCanonicalActivity({
    achievementType: String(r.achievementType ?? ""),
    achievementName: String(r.achievementName ?? ""),
    customAchievementName: String(r.customAchievementName ?? ""),
    competitionName: String(r.competitionName ?? ""),
    customCompetitionName: String(r.customCompetitionName ?? ""),
    programName: String(r.programName ?? ""),
    customProgramName: String(r.customProgramName ?? ""),
  });
  const outcome = resolveAchievementOutcome({
    resultType: String(r.resultType ?? ""),
    medalType: String(r.medalType ?? ""),
    rank: String(r.rank ?? ""),
  });
  const stdTest = r.standardizedTest as Record<string, unknown> | undefined;
  return {
    id: String((r._id as mongoose.Types.ObjectId | undefined)?.toString() ?? ""),
    userId: String(r.userId ?? ""),
    achievementYear: year ?? (new Date().getFullYear()),
    canonicalActivityKey: canonical.canonicalKey,
    activityLabelAr: canonical.displayNameAr,
    activityLabelEn: canonical.displayNameEn,
    achievementType: String(r.achievementType ?? ""),
    achievementClassification: String(r.achievementClassification ?? ""),
    resultType: outcome.resultType,
    outcomeKey: outcome.outcomeKey,
    medalType: outcome.medalType,
    rank: outcome.rank,
    achievementLevel: String(r.achievementLevel ?? ""),
    grade: String(snap?.grade ?? ""),
    section: String(snap?.section ?? "").toLowerCase(),
    stage: String(snap?.stage ?? "").toLowerCase(),
    mawhiba: snap?.isMawhibaStudent === true,
    olympiadMeeting: String(r.olympiadMeeting ?? ""),
    olympiadField: String(r.olympiadField ?? ""),
    standardizedScore: stdTest?.normalizedScore != null
      ? Number(stdTest.normalizedScore)
      : null,
    status: String(r.status ?? ""),
  };
};

/* ─── public API ─────────────────────────────────────────────────────────── */

export const loadStudentActivityBundle = async (
  userId: string,
  opts?: { bypassCache?: boolean }
): Promise<StudentActivityBundle> => {
  const cacheKey = `student-activity-${userId}`;
  if (!opts?.bypassCache) {
    const cached = _cache.get(cacheKey);
    if (cached.hit && cached.payload) return cached.payload;
  }

  await connectDB();
  const raw = await Achievement.find(
    { userId: new mongoose.Types.ObjectId(userId), status: { $in: APPROVED } },
    PROJECTION
  )
    .sort({ achievementYear: 1 })
    .limit(500)
    .lean();

  const records = (raw as unknown as Record<string, unknown>[]).map(mapRow);
  const bundle: StudentActivityBundle = {
    userId,
    records,
    fetchedAt: new Date().toISOString(),
  };
  _cache.set(cacheKey, bundle);
  return bundle;
};

/** Load bundles for up to 50 students in a single query (batched). */
export const loadCohortActivityBundles = async (
  userIds: string[],
  opts?: { bypassCache?: boolean }
): Promise<Map<string, StudentActivityBundle>> => {
  const result = new Map<string, StudentActivityBundle>();
  const missing: string[] = [];

  for (const uid of userIds.slice(0, 50)) {
    if (!opts?.bypassCache) {
      const cached = _cache.get(`student-activity-${uid}`);
      if (cached.hit && cached.payload) {
        result.set(uid, cached.payload);
        continue;
      }
    }
    missing.push(uid);
  }

  if (missing.length > 0) {
    await connectDB();
    const raw = await Achievement.find(
      {
        userId: { $in: missing.map((id) => new mongoose.Types.ObjectId(id)) },
        status: { $in: APPROVED },
      },
      PROJECTION
    )
      .sort({ achievementYear: 1 })
      .limit(5000)
      .lean();

    const byUser = new Map<string, Record<string, unknown>[]>();
    for (const r of raw as unknown as Record<string, unknown>[]) {
      const uid = String(r.userId ?? "");
      if (!byUser.has(uid)) byUser.set(uid, []);
      byUser.get(uid)!.push(r);
    }

    for (const uid of missing) {
      const records = (byUser.get(uid) ?? []).map(mapRow);
      const bundle: StudentActivityBundle = {
        userId: uid,
        records,
        fetchedAt: new Date().toISOString(),
      };
      _cache.set(`student-activity-${uid}`, bundle);
      result.set(uid, bundle);
    }
  }

  return result;
};
