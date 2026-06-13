import "server-only";
import connectDB from "@/lib/mongodb";
import Achievement from "@/models/Achievement";
import User from "@/models/User";
import StudentCareerProfile from "@/models/StudentCareerProfile";
import { getMemorySnapshot } from "@/lib/resilience/memory-metrics";
import type { PerformanceMetric } from "@/lib/certification/platform-certification-types";

const BSON_DOC_LIMIT_BYTES = 16 * 1024 * 1024;

const timedAggregation = async (
  key: string,
  labelAr: string,
  labelEn: string,
  limitMs: number,
  fn: () => Promise<{ count?: number; payloadBytes?: number }>
): Promise<PerformanceMetric> => {
  const t0 = Date.now();
  try {
    const result = await fn();
    const durationMs = Date.now() - t0;
    return {
      key,
      labelAr,
      labelEn,
      durationMs,
      resultCount: result.count,
      payloadBytes: result.payloadBytes,
      withinLimit: durationMs <= limitMs,
      limitMs,
    };
  } catch {
    const durationMs = Date.now() - t0;
    return {
      key,
      labelAr,
      labelEn,
      durationMs,
      withinLimit: false,
      limitMs,
    };
  }
};

export const runPerformanceCertification = async (): Promise<{
  metrics: PerformanceMetric[];
  memoryMb: { heapUsed: number; heapTotal: number; rss: number };
  bsonLimitNote: string;
}> => {
  await connectDB();
  const mem = getMemorySnapshot();

  const metrics: PerformanceMetric[] = [];

  metrics.push(
    await timedAggregation(
      "achievements_by_status",
      "تجميع الإنجازات حسب الحالة",
      "Achievements by status aggregation",
      3000,
      async () => {
        const rows = await Achievement.aggregate([
          { $group: { _id: "$status", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]);
        return {
          count: rows.length,
          payloadBytes: Buffer.byteLength(JSON.stringify(rows), "utf8"),
        };
      }
    )
  );

  metrics.push(
    await timedAggregation(
      "students_by_grade",
      "تجميع الطلاب حسب الصف",
      "Students by grade aggregation",
      3000,
      async () => {
        const rows = await User.aggregate([
          { $match: { role: "student" } },
          { $group: { _id: "$grade", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 20 },
        ]);
        return {
          count: rows.length,
          payloadBytes: Buffer.byteLength(JSON.stringify(rows), "utf8"),
        };
      }
    )
  );

  metrics.push(
    await timedAggregation(
      "career_readiness_avg",
      "متوسط الجاهزية المهنية",
      "Career readiness average",
      3000,
      async () => {
        const rows = await StudentCareerProfile.aggregate([
          {
            $group: {
              _id: null,
              avgCareer: { $avg: "$careerReadinessScore" },
              avgUniversity: { $avg: "$universityReadinessScore" },
              total: { $sum: 1 },
            },
          },
        ]);
        return {
          count: rows[0]?.total ?? 0,
          payloadBytes: Buffer.byteLength(JSON.stringify(rows), "utf8"),
        };
      }
    )
  );

  metrics.push(
    await timedAggregation(
      "approved_achievements_sample",
      "عينة إنجازات معتمدة",
      "Approved achievements sample payload",
      2000,
      async () => {
        const rows = await Achievement.find({ status: "approved" })
          .select("achievementType achievementYear userId achievementName")
          .limit(100)
          .lean();
        return {
          count: rows.length,
          payloadBytes: Buffer.byteLength(JSON.stringify(rows), "utf8"),
        };
      }
    )
  );

  return {
    metrics,
    memoryMb: {
      heapUsed: mem.heapUsedMb,
      heapTotal: mem.heapTotalMb,
      rss: mem.rssMb,
    },
    bsonLimitNote: `MongoDB BSON document limit: ${BSON_DOC_LIMIT_BYTES / (1024 * 1024)}MB per document`,
  };
};
