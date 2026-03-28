import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import Achievement from "@/models/Achievement";
import User from "@/models/User";
import { getGradeLabel } from "@/constants/grades";
import {
  formatLocalizedResultLine,
  getAchievementScoreDisplay,
} from "@/lib/achievementDisplay";
import {
  getAchievementLevelLabel,
  getAchievementTypeLabel,
  getParticipationTypeLabel,
  getResultTypeLabel,
  getStudentAchievementCardFieldDisplay,
} from "@/lib/achievement-display-labels";
import { resolveAchievementTitle } from "@/lib/achievement-title-resolver";
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

/** Mirrors `StudentAchievementSummaryContent` for hall API payload (no import from client modules). */
export type HallAchievementCardSummary = {
  typeLabel: string;
  fieldLabel: string;
  resultTypeLabel: string;
  resultLine: string;
  levelLabel: string;
  participationLabel: string;
  yearLabel: string;
  scoreLabel: string;
};

export type HallAchievementCard = {
  id: string;
  title: string;
  levelTier: HallTier;
  year: number;
  dateLabel: string;
  section: 1 | 2 | 3 | 4 | 5;
  summary: HallAchievementCardSummary;
  levelBadgeKey: string;
  medalType: string;
  resultType: string;
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

const snapshotDisplayName = (snap: Record<string, unknown>, loc: "ar" | "en"): string => {
  const ar = safeStr(snap.fullNameAr);
  const en = safeStr(snap.fullNameEn);
  if (loc === "ar") return ar || en || "—";
  return en || ar || "—";
};

const buildHallProfilePayloadFromData = (
  studentId: string,
  u: Record<string, unknown>,
  list: Record<string, unknown>[],
  locale: "ar" | "en"
): StudentHallProfilePayload => {
  const levelTiers: HallTier[] =
    list.length > 0
      ? list.map((a) => hallTierFromLevelsOnly(String(a.achievementLevel || a.level || "")))
      : ["school" as HallTier];
  const hi = list.length > 0 ? highestTier(levelTiers) : "school";

  const cards: HallAchievementCard[] = list.length
    ? list.map((a) => {
        const id = String(a._id ?? "");
        const title = resolveAchievementTitle(a, locale);
        const rawLevel = String(a.achievementLevel || a.level || "");
        const tier = normalizeRawLevelToTier(rawLevel);
        const isParticipationResult = String(a.resultType || "") === "participation";
        const levelTierForUi: HallTier = isParticipationResult ? "participation" : tier;
        const section = getAchievementHallSection(a);
        const typeKey = safeStr(a.achievementType);
        const typeLabel = typeKey
          ? getAchievementTypeLabel(typeKey, locale)
          : locale === "ar"
            ? "غير محدد"
            : "Not specified";

        const fieldRaw = safeStr(a.inferredField) || safeStr(a.domain);
        const fieldLabel = getStudentAchievementCardFieldDisplay(fieldRaw || undefined, locale);

        const rt = String(a.resultType || "");
        const resultTypeLabel = getResultTypeLabel(rt || undefined, locale);

        const scoreNum = typeof a.score === "number" ? a.score : undefined;
        let resultLine = formatLocalizedResultLine(
          rt,
          String(a.medalType || ""),
          String(a.rank || ""),
          locale,
          scoreNum
        );
        if (!resultLine || resultLine === "—") {
          const rv = safeStr(a.resultValue);
          resultLine = rv || (locale === "ar" ? "غير محدد" : "Not specified");
        }

        const levelLabel = rawLevel
          ? getAchievementLevelLabel(rawLevel, locale)
          : locale === "ar"
            ? "غير محدد"
            : "Not specified";

        let participationLabel = getParticipationTypeLabel(a.participationType, locale);
        if (participationLabel === "—") {
          participationLabel = locale === "ar" ? "غير محدد" : "Not specified";
        }

        const y = Number(a.achievementYear);
        const year = Number.isFinite(y) ? y : new Date().getFullYear();
        const yearLabel =
          Number.isFinite(y) && y > 0
            ? String(y)
            : locale === "ar"
              ? "غير محدد"
              : "Not specified";

        const scoreNumeric = getAchievementScoreDisplay(a, locale);
        const scoreLabel =
          scoreNumeric !== "—"
            ? locale === "ar"
              ? `${scoreNumeric} نقطة`
              : `${scoreNumeric} pts`
            : "";

        const d = a.date instanceof Date ? a.date : a.createdAt instanceof Date ? (a.createdAt as Date) : null;
        const dateLabel = d
          ? d.toLocaleDateString(locale === "ar" ? "ar-SA" : "en-GB", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : "—";

        const summary: HallAchievementCardSummary = {
          typeLabel,
          fieldLabel,
          resultTypeLabel,
          resultLine,
          levelLabel,
          participationLabel,
          yearLabel,
          scoreLabel,
        };

        return {
          id,
          title,
          levelTier: levelTierForUi,
          year,
          dateLabel,
          section,
          summary,
          levelBadgeKey: rawLevel.trim(),
          medalType: String(a.medalType || ""),
          resultType: rt,
        };
      })
    : [];

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

const buildExternalStudentHallProfile = async (
  profileKey: mongoose.Types.ObjectId,
  locale: "ar" | "en"
): Promise<StudentHallProfilePayload | null> => {
  const approved = hallOfFameApprovedAchievementFilter();
  const andArr = Array.isArray((approved as { $and?: unknown[] }).$and)
    ? (approved as { $and: Record<string, unknown>[] }).$and
    : [approved];

  const achievements = await Achievement.find({
    $and: [
      ...andArr,
      { studentProfileKey: profileKey },
      { studentSourceType: { $in: ["external_student", "alumni_student"] } },
    ],
  })
    .sort({ achievementYear: -1, createdAt: -1 })
    .lean();

  const list = (achievements as unknown as Record<string, unknown>[]) || [];
  if (list.length === 0) return null;

  const snap = (list[0].studentSnapshot || {}) as Record<string, unknown>;
  const syntheticUser: Record<string, unknown> = {
    fullNameAr: snap.fullNameAr,
    fullNameEn: snap.fullNameEn,
    fullName: snap.fullNameAr || snap.fullNameEn,
    profilePhoto: "",
    grade: snap.grade || "g12",
    gender: safeStr(snap.gender).toLowerCase() === "female" ? "female" : "male",
  };

  return buildHallProfilePayloadFromData(String(profileKey), syntheticUser, list, locale);
};

export const buildHallOfFameStudents = async (q: HallOfFameQuery): Promise<HallOfFameListResult> => {
  await connectDB();

  const page = Math.max(1, q.page ?? 1);
  const pageSize = Math.min(48, Math.max(6, q.pageSize ?? 24));

  const achFilter = hallOfFameApprovedAchievementFilter();
  const achievements = await Achievement.find(achFilter)
    .select(
      "userId studentSourceType studentProfileKey studentSnapshot achievementLevel level score resultType achievementYear achievementType achievementCategory nameAr nameEn achievementName customAchievementName title description date createdAt"
    )
    .lean();

  const byKey = new Map<string, Record<string, unknown>[]>();
  for (const raw of achievements) {
    const a = raw as unknown as Record<string, unknown>;
    if (!yearFilter(q.academicYear, a.achievementYear)) continue;
    const st = String(a.studentSourceType || "linked_user");
    let key: string;
    if (st === "linked_user" || !a.studentProfileKey) {
      const uid = safeStr(a.userId);
      if (!uid) continue;
      key = uid;
    } else {
      key = `ext:${safeStr(a.studentProfileKey)}`;
    }
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(a);
  }

  const linkedIds = [...byKey.keys()].filter((k) => !k.startsWith("ext:"));
  const users =
    linkedIds.length > 0
      ? await User.find({
          _id: { $in: linkedIds.filter((id) => mongoose.Types.ObjectId.isValid(id)).map((id) => new mongoose.Types.ObjectId(id)) },
          role: "student",
          status: "active",
        })
          .select("fullName fullNameAr fullNameEn profilePhoto grade gender")
          .lean()
      : [];

  const loc = q.locale;
  const rows: HallOfFameStudentRow[] = [];

  for (const rawU of users) {
    const u = rawU as unknown as Record<string, unknown>;
    const id = String(u._id);
    const list = byKey.get(id);
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

  for (const k of [...byKey.keys()].filter((x) => x.startsWith("ext:"))) {
    const list = byKey.get(k);
    if (!list || list.length === 0) continue;
    const first = list[0];
    const snap = (first.studentSnapshot || {}) as Record<string, unknown>;
    const profileId = k.replace(/^ext:/, "");
    const g = safeStr(snap.gender).toLowerCase() === "female" ? "female" : "male";
    if (q.gender && q.gender !== "all" && q.gender !== g) continue;

    const gradeVal = safeStr(snap.grade) || "g12";
    const stage = getStageByGrade(gradeVal);
    if (q.stage && q.stage !== "all" && stage !== q.stage && stage !== "unknown") continue;
    if (q.stage && q.stage !== "all" && stage === "unknown") continue;

    if (q.grade && q.grade !== "all" && gradeVal !== q.grade) continue;

    const name = snapshotDisplayName(snap, loc);
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
      studentId: profileId,
      studentName: name,
      studentPhoto: null,
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

  if (!user) {
    return buildExternalStudentHallProfile(uid, locale);
  }

  const u = user as unknown as Record<string, unknown>;
  const achievements = await Achievement.find({
    $and: [{ userId: uid }, hallOfFameApprovedAchievementFilter()],
  })
    .sort({ achievementYear: -1, createdAt: -1 })
    .lean();

  const list = (achievements as unknown as Record<string, unknown>[]) || [];

  return buildHallProfilePayloadFromData(studentId, u, list, locale);
};
