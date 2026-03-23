import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import Achievement from "@/models/Achievement";
import User from "@/models/User";
import { getGradeLabel } from "@/constants/grades";
import {
  formatLocalizedResultLine,
  getAchievementDisplayName,
  getAchievementLevelLabel,
  labelAchievementClassification,
  labelLegacyAchievementType,
} from "@/lib/achievementDisplay";
import { getStageByGrade, reportStageLabel } from "@/lib/report-stage-mapping";
import { hallOfFameApprovedAchievementFilter } from "@/lib/hall-of-fame-approved";
import {
  getAchievementHallSection,
  getDisplayLabelForTier,
  HALL_LEVEL_PRIORITY,
  hallTierFromLevelsOnly,
  highestTier,
  normalizeRawLevelToTier,
  type HallTier,
} from "@/lib/hall-of-fame-level";

const safeStr = (v: unknown) => String(v ?? "").trim();

export type HallOfFameStudentRow = {
  studentId: string;
  studentName: string;
  studentPhoto: string | null;
  grade: string;
  gradeLabel: string;
  stage: string;
  stageLabel: string;
  gender: "male" | "female";
  totalAchievements: number;
  totalScore: number;
  highestTier: HallTier;
  highestTierLabel: string;
  sortWeight: number;
};

export type HallOfFameQuery = {
  locale: "ar" | "en";
  academicYear?: string;
  gender?: "all" | "male" | "female";
  stage?: "all" | "primary" | "middle" | "secondary";
  grade?: string;
  minTier?: "all" | HallTier;
  search?: string;
  page?: number;
  pageSize?: number;
};

export type HallAchievementCard = {
  id: string;
  title: string;
  categoryLabel: string;
  levelLabel: string;
  levelTier: HallTier;
  resultLine: string;
  participationLabel: string;
  year: number;
  dateLabel: string;
  description: string;
  section: 1 | 2 | 3 | 4 | 5;
};

export type StudentHallProfilePayload = {
  student: {
    id: string;
    name: string;
    photo: string | null;
    grade: string;
    gradeLabel: string;
    stageLabel: string;
    gender: "male" | "female";
    totalAchievements: number;
    highestTier: HallTier;
    highestTierLabel: string;
  };
  sections: Array<{
    key: 1 | 2 | 3 | 4 | 5;
    title: string;
    items: HallAchievementCard[];
  }>;
};

const studentName = (u: Record<string, unknown>, loc: "ar" | "en"): string => {
  const ar = safeStr(u.fullNameAr);
  const en = safeStr(u.fullNameEn);
  const legacy = safeStr(u.fullName);
  if (loc === "ar") return ar || legacy || en || "—";
  return en || legacy || ar || "—";
};

const yearFilter = (year: string | undefined, achYear: unknown): boolean => {
  if (!year || year === "all") return true;
  return String(achYear ?? "") === year;
};

export type HallOfFameListResult = {
  items: HallOfFameStudentRow[];
  total: number;
  page: number;
  pageSize: number;
};

export const buildHallOfFameStudents = async (q: HallOfFameQuery): Promise<HallOfFameListResult> => {
  await connectDB();

  const page = Math.max(1, q.page ?? 1);
  const pageSize = Math.min(48, Math.max(6, q.pageSize ?? 24));

  const achFilter = hallOfFameApprovedAchievementFilter();
  const achievements = await Achievement.find(achFilter)
    .select(
      "userId achievementLevel level score resultType achievementYear achievementType achievementCategory nameAr nameEn achievementName customAchievementName title description date createdAt"
    )
    .lean();

  const byUser = new Map<string, Record<string, unknown>[]>();
  for (const raw of achievements) {
    const a = raw as unknown as Record<string, unknown>;
    const uid = safeStr(a.userId);
    if (!uid) continue;
    if (!yearFilter(q.academicYear, a.achievementYear)) continue;
    if (!byUser.has(uid)) byUser.set(uid, []);
    byUser.get(uid)!.push(a);
  }

  const userIds = [...byUser.keys()].filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (userIds.length === 0) {
    return { items: [], total: 0, page, pageSize };
  }

  const users = await User.find({
    _id: { $in: userIds.map((id) => new mongoose.Types.ObjectId(id)) },
    role: "student",
    status: "active",
  })
    .select("fullName fullNameAr fullNameEn profilePhoto grade gender")
    .lean();

  const loc = q.locale;
  const rows: HallOfFameStudentRow[] = [];

  for (const rawU of users) {
    const u = rawU as unknown as Record<string, unknown>;
    const id = String(u._id);
    const list = byUser.get(id);
    if (!list || list.length === 0) continue;

    const g = u.gender === "female" ? "female" : "male";
    if (q.gender && q.gender !== "all" && q.gender !== g) continue;

    const gradeVal = safeStr(u.grade) || "g12";
    const stage = getStageByGrade(gradeVal);
    if (q.stage && q.stage !== "all" && stage !== q.stage && stage !== "unknown") continue;
    if (q.stage && q.stage !== "all" && stage === "unknown") continue;

    if (q.grade && q.grade !== "all" && gradeVal !== q.grade) continue;

    const name = studentName(u, loc);
    if (q.search) {
      const needle = q.search.trim().toLowerCase();
      if (needle && !name.toLowerCase().includes(needle)) continue;
    }

    let totalScore = 0;
    const levelTiers: HallTier[] = [];
    for (const a of list) {
      const sc = a.score;
      if (typeof sc === "number" && Number.isFinite(sc)) totalScore += sc;
      levelTiers.push(hallTierFromLevelsOnly(String(a.achievementLevel || a.level || "")));
    }

    const hi = highestTier(levelTiers);
    if (q.minTier && q.minTier !== "all") {
      if ((HALL_LEVEL_PRIORITY[hi] ?? 0) < (HALL_LEVEL_PRIORITY[q.minTier] ?? 0)) continue;
    }

    const sortWeight =
      (HALL_LEVEL_PRIORITY[hi] ?? 0) * 1_000_000 +
      totalScore * 100 +
      list.length * 10;

    rows.push({
      studentId: id,
      studentName: name,
      studentPhoto: typeof u.profilePhoto === "string" && u.profilePhoto.trim() ? u.profilePhoto.trim() : null,
      grade: gradeVal,
      gradeLabel: getGradeLabel(gradeVal, loc),
      stage,
      stageLabel: reportStageLabel(stage, loc === "ar"),
      gender: g,
      totalAchievements: list.length,
      totalScore,
      highestTier: hi,
      highestTierLabel: getDisplayLabelForTier(hi, loc),
      sortWeight,
    });
  }

  rows.sort((a, b) => b.sortWeight - a.sortWeight || a.studentName.localeCompare(b.studentName));

  const total = rows.length;
  const start = (page - 1) * pageSize;
  return {
    items: rows.slice(start, start + pageSize),
    total,
    page,
    pageSize,
  };
};

export const buildStudentHallProfile = async (
  studentId: string,
  locale: "ar" | "en"
): Promise<StudentHallProfilePayload | null> => {
  if (!mongoose.Types.ObjectId.isValid(studentId)) return null;
  await connectDB();

  const uid = new mongoose.Types.ObjectId(studentId);
  const user = await User.findOne({
    _id: uid,
    role: "student",
    status: "active",
  })
    .select("fullName fullNameAr fullNameEn profilePhoto grade gender")
    .lean();

  if (!user) return null;

  const u = user as unknown as Record<string, unknown>;
  const achievements = await Achievement.find({
    $and: [{ userId: uid }, hallOfFameApprovedAchievementFilter()],
  })
    .sort({ achievementYear: -1, createdAt: -1 })
    .lean();

  const list = (achievements as unknown as Record<string, unknown>[]) || [];

  const levelTiers: HallTier[] =
    list.length > 0
      ? list.map((a) => hallTierFromLevelsOnly(String(a.achievementLevel || a.level || "")))
      : ["school" as HallTier];
  const hi = list.length > 0 ? highestTier(levelTiers) : "school";

  let totalScore = 0;
  for (const a of list) {
    const sc = a.score;
    if (typeof sc === "number" && Number.isFinite(sc)) totalScore += sc;
  }

  const categoryLabelFor = (a: Record<string, unknown>) => {
    const cls = safeStr(a.achievementClassification);
    if (cls) return labelAchievementClassification(cls, locale);
    return labelLegacyAchievementType(String(a.achievementType || ""), locale);
  };

  const cards: HallAchievementCard[] = list.length ? list.map((a) => {
    const id = String(a._id ?? "");
    const title = getAchievementDisplayName(a, locale);
    const cat = categoryLabelFor(a);
    const rawLevel = String(a.achievementLevel || a.level || "");
    const tier = normalizeRawLevelToTier(rawLevel);
    const isParticipationResult = String(a.resultType || "") === "participation";
    const levelTierForUi: HallTier = isParticipationResult ? "participation" : tier;
    const section = getAchievementHallSection(a);
    const resultLine = formatLocalizedResultLine(
      String(a.resultType || ""),
      String(a.medalType || ""),
      String(a.rank || ""),
      locale,
      typeof a.score === "number" ? a.score : undefined
    );
    const pt = String(a.participationType || "");
    const participationLabel =
      pt === "team" ? (locale === "ar" ? "فريق" : "Team") : locale === "ar" ? "فردي" : "Individual";

    const y = Number(a.achievementYear);
    const d = a.date instanceof Date ? a.date : a.createdAt instanceof Date ? (a.createdAt as Date) : null;
    const dateLabel = d
      ? d.toLocaleDateString(locale === "ar" ? "ar-SA" : "en-GB", { year: "numeric", month: "short", day: "numeric" })
      : "—";

    const desc = safeStr(a.description) || safeStr(a.title) || "";

    return {
      id,
      title,
      categoryLabel: cat,
      levelLabel: getAchievementLevelLabel(rawLevel, locale),
      levelTier: levelTierForUi,
      resultLine,
      participationLabel,
      year: Number.isFinite(y) ? y : new Date().getFullYear(),
      dateLabel,
      description: desc.length > 220 ? `${desc.slice(0, 217)}…` : desc,
      section,
    };
  }) : [];

  const sectionMeta: Array<{ key: 1 | 2 | 3 | 4 | 5; title: { ar: string; en: string } }> = [
    { key: 1, title: { ar: "الإنجازات الدولية", en: "International achievements" } },
    { key: 2, title: { ar: "إنجازات المملكة", en: "National achievements" } },
    { key: 3, title: { ar: "إنجازات المحافظة / الإدارة / المنطقة", en: "Regional / district achievements" } },
    { key: 4, title: { ar: "إنجازات المدرسة", en: "School-level achievements" } },
    { key: 5, title: { ar: "المشاركات", en: "Participation" } },
  ];

  const sections = sectionMeta.map((s) => ({
    key: s.key,
    title: locale === "ar" ? s.title.ar : s.title.en,
    items: cards
      .filter((c) => c.section === s.key)
      .sort((a, b) => b.year - a.year || a.title.localeCompare(b.title)),
  }));

  const gradeVal = safeStr(u.grade) || "g12";
  const stage = getStageByGrade(gradeVal);

  return {
    student: {
      id: studentId,
      name: studentName(u, locale),
      photo: typeof u.profilePhoto === "string" && u.profilePhoto.trim() ? u.profilePhoto.trim() : null,
      grade: gradeVal,
      gradeLabel: getGradeLabel(gradeVal, locale),
      stageLabel: reportStageLabel(stage, locale === "ar"),
      gender: u.gender === "female" ? "female" : "male",
      totalAchievements: list.length,
      highestTier: hi,
      highestTierLabel: getDisplayLabelForTier(hi, locale),
    },
    sections: sections.filter((sec) => sec.items.length > 0),
  };
};
