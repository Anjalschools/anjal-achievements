import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import Achievement from "@/models/Achievement";
import { getAchievementDisplayName } from "@/lib/achievementDisplay";
import { studentFormatResultLine } from "@/lib/student-achievement-details-display";
import { normalizeAchievementLevelForScoring } from "@/lib/achievement-scoring";

export type StudentAchievementSummaryItem = {
  title: string;
  outcome: string;
  year: string;
  level?: string;
  resultType?: string;
};

export type StudentAchievementSummary = {
  items: StudentAchievementSummaryItem[];
  totalAchievements: number;
  medalCount: number;
  participationCount: number;
  excellenceScore: number;
};

const approvedAchievementFilter = (studentId: mongoose.Types.ObjectId) => ({
  userId: studentId,
  $or: [{ status: "approved" }, { approved: true }],
  status: { $ne: "rejected" },
});

const extractAchievementYear = (row: Record<string, unknown>): string => {
  const y = row.achievementYear;
  if (typeof y === "number" && Number.isFinite(y)) return String(y);
  if (typeof y === "string" && y.trim()) return y.trim().slice(0, 4);
  const date = row.date instanceof Date ? row.date : row.createdAt instanceof Date ? row.createdAt : null;
  if (date) return String(date.getFullYear());
  return "";
};

const levelWeight = (level: string | undefined): number => {
  const key = normalizeAchievementLevelForScoring(String(level || ""));
  if (key === "international") return 15;
  if (key === "national") return 12;
  if (key === "province") return 8;
  if (key === "school") return 5;
  return 4;
};

const trainingExcellenceBonus = (row: Record<string, unknown>): number => {
  const type = String(row.achievementType || "").toLowerCase();
  const name = String(row.achievementName || "").toLowerCase();
  if (type !== "summer_training" && name !== "summer_training") return 0;
  const description = String(row.description || "");
  const resultValue = String(row.resultValue || "");
  if (description.includes("training_high_excellence:1") || resultValue.includes("تميز مرتفع")) {
    return 10;
  }
  if (description.includes("training_weight:10")) return 10;
  return 5;
};

export const computeStudentExcellenceScore = (
  achievements: Array<Record<string, unknown>>
): number => {
  let score = 0;
  for (const row of achievements) {
    const trainingBonus = trainingExcellenceBonus(row);
    if (trainingBonus > 0) {
      score += trainingBonus;
      continue;
    }
    const base = levelWeight(String(row.achievementLevel || row.level || ""));
    const resultType = String(row.resultType || "").toLowerCase();
    const medal = String(row.medalType || "").toLowerCase();

    if (resultType === "medal") {
      const medalBonus = medal === "gold" ? 10 : medal === "silver" ? 7 : medal === "bronze" ? 5 : 4;
      score += base + medalBonus;
      continue;
    }
    if (resultType === "rank") {
      const rank = String(row.rank || "").toLowerCase();
      const rankBonus = rank === "first" || rank === "1" ? 8 : rank === "second" || rank === "2" ? 6 : 4;
      score += base + rankBonus;
      continue;
    }
    if (resultType === "nomination") {
      score += base + 6;
      continue;
    }
    if (resultType === "participation") {
      score += 3;
      continue;
    }
    score += base;
  }
  return Math.min(100, Math.round(score));
};

export const buildStudentAchievementSummary = async (
  studentId: string,
  locale: "ar" | "en" = "ar"
): Promise<StudentAchievementSummary> => {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(studentId)) {
    return {
      items: [],
      totalAchievements: 0,
      medalCount: 0,
      participationCount: 0,
      excellenceScore: 0,
    };
  }

  const rows = await Achievement.find(approvedAchievementFilter(new mongoose.Types.ObjectId(studentId)))
    .sort({ achievementYear: -1, date: -1, createdAt: -1 })
    .limit(40)
    .lean();

  const achievements = rows as unknown as Array<Record<string, unknown>>;
  let medalCount = 0;
  let participationCount = 0;

  const items: StudentAchievementSummaryItem[] = achievements.map((row) => {
    const resultType = String(row.resultType || "").toLowerCase();
    if (resultType === "medal") medalCount += 1;
    if (resultType === "participation") participationCount += 1;

    return {
      title: getAchievementDisplayName(row, locale),
      outcome: studentFormatResultLine(
        {
          resultType: String(row.resultType || ""),
          medalType: String(row.medalType || ""),
          rank: String(row.rank || ""),
          resultValue: String(row.resultValue || ""),
        },
        locale
      ),
      year: extractAchievementYear(row),
      level: String(row.achievementLevel || row.level || ""),
      resultType: String(row.resultType || ""),
    };
  });

  return {
    items,
    totalAchievements: items.length,
    medalCount,
    participationCount,
    excellenceScore: computeStudentExcellenceScore(achievements),
  };
};
