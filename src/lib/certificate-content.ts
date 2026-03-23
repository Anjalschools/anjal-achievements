import { getGradeLabel } from "@/constants/grades";
import {
  OLYMPIAD_EVENT_OTHER_VALUE,
  OLYMPIAD_UI_EVENT_OPTIONS,
  QUDRAT_EVENT_OPTIONS,
} from "@/constants/achievement-ui-categories";
import {
  getAchievementCardDisplayName,
  isLikelyTechnicalSlug,
  labelMedal,
  labelRank,
  resolveAchievementEventSlug,
  safeTrim,
} from "@/lib/achievementDisplay";

export const CERTIFICATE_SNAPSHOT_SCHEMA_VERSION = 3 as const;

/** v2 snapshots remain valid; v3 adds optional footer strings and richer text rules. */
export type AppreciationCertificateSnapshot = {
  schemaVersion: 2 | typeof CERTIFICATE_SNAPSHOT_SCHEMA_VERSION;
  achievementId: string;
  userId: string;
  studentNameAr: string;
  studentNameEn: string;
  gradeAr: string;
  gradeEn: string;
  achievementTitleAr: string;
  achievementTitleEn: string;
  achievementTypeKey: string;
  resultSummaryAr: string;
  resultSummaryEn: string;
  levelAr: string;
  levelEn: string;
  dateAr: string;
  dateEn: string;
  certificateVersion: number;
  issuedAtIso: string;
  footerAdminAr?: string;
  footerAdminEn?: string;
};

type Loc = "ar" | "en";

const FOOTER_ADMIN_AR = "إدارة مدارس الأنجال الأهلية";
const FOOTER_ADMIN_EN = "Al-Anjal Schools Administration";

const slugKey = (s: string) => safeTrim(s).toLowerCase().replace(/\s+/g, "_");

/** Olympiad UI events (Nesmo stages, camps) + Qudrat tiers — not all exist in achievement-options slug map. */
const CERTIFICATE_EVENT_SLUGS: Record<string, { ar: string; en: string }> = (() => {
  const m: Record<string, { ar: string; en: string }> = {};
  for (const o of OLYMPIAD_UI_EVENT_OPTIONS) {
    if (o.value === OLYMPIAD_EVENT_OTHER_VALUE) continue;
    m[slugKey(o.value)] = { ar: o.ar, en: o.en };
  }
  for (const o of QUDRAT_EVENT_OPTIONS) {
    m[slugKey(o.value)] = { ar: o.ar, en: o.en };
  }
  return m;
})();

const lookupCertificateEventSlug = (raw: string, loc: Loc): string | null => {
  const k = slugKey(raw);
  const hit = CERTIFICATE_EVENT_SLUGS[k];
  if (hit) return loc === "ar" ? hit.ar : hit.en;
  const hitQ = CERTIFICATE_EVENT_SLUGS[`qudrat_${k}`];
  if (hitQ) return loc === "ar" ? hitQ.ar : hitQ.en;
  return null;
};

const achievementCardInput = (ach: Record<string, unknown>) => ({
  titleAr: safeTrim(ach.nameAr) || undefined,
  nameAr: safeTrim(ach.nameAr) || undefined,
  nameEn: safeTrim(ach.nameEn) || undefined,
  title: safeTrim(ach.title) || undefined,
  achievementName: safeTrim(ach.achievementName) || undefined,
  customAchievementName: safeTrim(ach.customAchievementName) || undefined,
});

const pickDate = (ach: Record<string, unknown>): Date | null => {
  const d = ach.date;
  if (d instanceof Date && !Number.isNaN(d.getTime())) return d;
  const issued = ach.certificateIssuedAt;
  if (issued instanceof Date && !Number.isNaN(issued.getTime())) return issued;
  const y = typeof ach.achievementYear === "number" ? ach.achievementYear : Number(ach.achievementYear);
  if (Number.isFinite(y)) return new Date(`${y}-01-01`);
  return null;
};

const formatCertificateDate = (date: Date | null, loc: Loc): string => {
  if (!date || Number.isNaN(date.getTime())) {
    return loc === "ar" ? "غير محدد" : "Not specified";
  }
  if (loc === "ar") {
    return `${date.toLocaleDateString("ar-SA-u-nu-arab", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })} م`;
  }
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
};

const labelAchievementLevelCert = (key: string | undefined, loc: Loc): string => {
  const raw = safeTrim(key);
  if (!raw) return loc === "ar" ? "غير محدد" : "Not specified";
  const k = slugKey(raw);
  const LEVEL: Record<string, { ar: string; en: string }> = {
    school: { ar: "المدرسة", en: "School" },
    province: { ar: "المحافظة", en: "Province" },
    governorate: { ar: "المحافظة", en: "Province" },
    district: { ar: "الإدارة / المنطقة", en: "District" },
    regional: { ar: "المنطقة", en: "Regional" },
    local: { ar: "محلي", en: "Local" },
    admin: { ar: "الإدارة التعليمية", en: "Education office" },
    administration: { ar: "الإدارة التعليمية", en: "Administration" },
    local_authority: { ar: "الجهة المحلية", en: "Local authority" },
    kingdom: { ar: "المملكة", en: "Kingdom" },
    national: { ar: "المملكة", en: "Kingdom" },
    international: { ar: "العالم", en: "International" },
    global: { ar: "العالم", en: "Global" },
    world: { ar: "العالم", en: "World" },
  };
  const row = LEVEL[k];
  if (row) return loc === "ar" ? row.ar : row.en;
  if (!isLikelyTechnicalSlug(raw)) return raw;
  return loc === "ar" ? "غير محدد" : "Not specified";
};

/**
 * Certificate-grade bilingual achievement title: custom names first, then known slugs (incl. Nesmo / Qudrat UI),
 * then achievement-options resolution, then readable free text.
 */
export const getCertificateAchievementTitle = (ach: Record<string, unknown>, loc: Loc): string => {
  const customCandidates = [
    safeTrim(ach.customAchievementName),
    safeTrim(ach.customProgramName),
    safeTrim(ach.customCompetitionName),
    safeTrim(ach.customExhibitionName),
    safeTrim(ach.customExcellenceProgramName),
  ];
  for (const c of customCandidates) {
    if (c && !isLikelyTechnicalSlug(c)) return c;
  }

  const slugCandidates = [
    safeTrim(ach.achievementName),
    safeTrim(ach.olympiadMeeting),
    safeTrim(ach.programName),
    safeTrim(ach.competitionName),
    safeTrim(ach.exhibitionName),
    safeTrim(ach.excellenceProgramName),
    safeTrim(ach.qudratScore),
    safeTrim(ach.mawhibaAnnualSubject),
    safeTrim(ach.mawhibaAnnualRank),
  ];

  for (const s of slugCandidates) {
    if (!s) continue;
    const extra = lookupCertificateEventSlug(s, loc);
    if (extra) return extra;
    const resolved = resolveAchievementEventSlug(s);
    if (resolved) return loc === "ar" ? resolved.ar : resolved.en;
    if (!isLikelyTechnicalSlug(s)) return s;
  }

  return getAchievementCardDisplayName(achievementCardInput(ach), loc);
};

export const getCertificateAchievementTitleAr = (ach: Record<string, unknown>) =>
  getCertificateAchievementTitle(ach, "ar");
export const getCertificateAchievementTitleEn = (ach: Record<string, unknown>) =>
  getCertificateAchievementTitle(ach, "en");

const medalCertificateLine = (medalType: string | undefined, loc: Loc): string => {
  const m = slugKey(String(medalType || ""));
  const ar: Record<string, string> = {
    gold: "ميدالية ذهبية",
    silver: "ميدالية فضية",
    bronze: "ميدالية برونزية",
  };
  const en: Record<string, string> = {
    gold: "Gold Medal",
    silver: "Silver Medal",
    bronze: "Bronze Medal",
  };
  if (loc === "ar") return ar[m] || `ميدالية ${labelMedal(medalType, loc)}`;
  return en[m] || `${labelMedal(medalType, loc)} Medal`;
};

const rankCertificateLine = (rank: string | undefined, loc: Loc): string => {
  const r = slugKey(String(rank || ""));
  const ar: Record<string, string> = {
    first: "المركز الأول",
    second: "المركز الثاني",
    third: "المركز الثالث",
    fourth: "المركز الرابع",
    fifth: "المركز الخامس",
    rank_first: "المركز الأول",
    rank_second: "المركز الثاني",
    rank_third: "المركز الثالث",
  };
  const en: Record<string, string> = {
    first: "First Place",
    second: "Second Place",
    third: "Third Place",
    fourth: "Fourth Place",
    fifth: "Fifth Place",
    rank_first: "First Place",
    rank_second: "Second Place",
    rank_third: "Third Place",
  };
  if (loc === "ar") return ar[r] || labelRank(rank, loc);
  return en[r] || labelRank(rank, loc);
};

const isNextStageText = (raw: string): boolean => {
  const t = raw.toLowerCase();
  return (
    t.includes("next") ||
    t.includes("stage") ||
    t.includes("qualif") ||
    raw.includes("المرحلة التالية") ||
    raw.includes("التأهل") ||
    t === "next_stage" ||
    t === "advanced" ||
    t === "advance"
  );
};

const buildCertificateResultSummary = (ach: Record<string, unknown>, loc: Loc): string => {
  const rt = String(ach.resultType || "");
  const medal = String(ach.medalType || "");
  const rank = String(ach.rank || "");
  const rv = safeTrim(ach.resultValue);
  const qudrat = safeTrim(ach.qudratScore);
  const nom = safeTrim(ach.nominationText);
  const spec = safeTrim(ach.specialAwardText);
  const rec = safeTrim(ach.recognitionText);
  const other = safeTrim(ach.otherResultText);
  const gifted =
    typeof ach.giftedDiscoveryScore === "number" && Number.isFinite(ach.giftedDiscoveryScore)
      ? ach.giftedDiscoveryScore
      : null;

  if (rt === "participation") {
    return loc === "ar" ? "مشاركة فعالة" : "Active Participation";
  }
  if (rt === "medal") {
    return medalCertificateLine(medal, loc);
  }
  if (rt === "rank") {
    return rankCertificateLine(rank, loc);
  }
  if (rt === "nomination") {
    if (nom) return nom;
    return loc === "ar" ? "ترشيح" : "Nomination";
  }
  if (rt === "special_award") {
    if (spec) return loc === "ar" ? `جائزة ${spec}` : `Award: ${spec}`;
    return loc === "ar" ? "جائزة تقديرية" : "Recognition Award";
  }
  if (rt === "recognition") {
    if (rec) return rec;
    return loc === "ar" ? "تكريم" : "Recognition";
  }
  if (rt === "other") {
    if (other && slugKey(other) !== "other") return other;
    return loc === "ar" ? "مشاركة فعالة" : "Active Participation";
  }
  if (rt === "score") {
    if (qudrat) {
      const q = qudrat;
      const display = /%/.test(q) ? q : /^\d+(\.\d+)?$/.test(q) ? `${q}%` : q;
      return loc === "ar" ? `حصل على ${display}` : `Achieved ${display}`;
    }
    if (rv) {
      return loc === "ar" ? `حصل على ${rv}` : `Achieved ${rv}`;
    }
    return loc === "ar" ? "نتيجة مسجلة" : "Recorded result";
  }
  if (rt === "completion") {
    if (rv && slugKey(rv) !== "other") {
      if (isNextStageText(rv)) {
        return loc === "ar" ? "التأهل للمرحلة التالية" : "Qualified for the Next Stage";
      }
      return loc === "ar" ? `إكمال: ${rv}` : `Program completion: ${rv}`;
    }
    return loc === "ar" ? "التأهل للمرحلة التالية" : "Qualified for the Next Stage";
  }
  if (String(ach.achievementType || "") === "gifted_discovery" && gifted !== null) {
    return loc === "ar"
      ? `درجة اختبار الكشف عن الموهوبين: ${gifted}`
      : `Gifted screening score: ${gifted}`;
  }
  if (rv) {
    if (isNextStageText(rv)) {
      return loc === "ar" ? "التأهل للمرحلة التالية" : "Qualified for the Next Stage";
    }
    return loc === "ar" ? `نتيجة: ${rv}` : `Outcome: ${rv}`;
  }
  return loc === "ar" ? "مشاركة فعالة" : "Active Participation";
};

const studentName = (user: Record<string, unknown>, loc: Loc): string => {
  const ar = safeTrim(user.fullNameAr) || safeTrim(user.fullName);
  const en = safeTrim(user.fullNameEn) || safeTrim(user.fullName) || safeTrim(user.name);
  if (loc === "ar") return ar || en || "الطالب";
  return en || ar || "Student";
};

export const buildCertificateSnapshot = (
  achievement: Record<string, unknown>,
  user: Record<string, unknown>,
  certificateVersion: number
): AppreciationCertificateSnapshot => {
  const achId = String(achievement._id ?? achievement.id ?? "");
  const userId = String(achievement.userId ?? user._id ?? user.id ?? "");
  const levelKey = String(achievement.achievementLevel || achievement.level || "");
  const date = pickDate(achievement);
  const now = new Date();

  return {
    schemaVersion: CERTIFICATE_SNAPSHOT_SCHEMA_VERSION,
    achievementId: achId,
    userId,
    studentNameAr: studentName(user, "ar"),
    studentNameEn: studentName(user, "en"),
    gradeAr: getGradeLabel(String(user.grade || ""), "ar"),
    gradeEn: getGradeLabel(String(user.grade || ""), "en"),
    achievementTitleAr: getCertificateAchievementTitle(achievement, "ar"),
    achievementTitleEn: getCertificateAchievementTitle(achievement, "en"),
    achievementTypeKey: String(achievement.achievementType || ""),
    resultSummaryAr: buildCertificateResultSummary(achievement, "ar"),
    resultSummaryEn: buildCertificateResultSummary(achievement, "en"),
    levelAr: labelAchievementLevelCert(levelKey, "ar"),
    levelEn: labelAchievementLevelCert(levelKey, "en"),
    dateAr: formatCertificateDate(date, "ar"),
    dateEn: formatCertificateDate(date, "en"),
    certificateVersion,
    issuedAtIso: now.toISOString(),
    footerAdminAr: FOOTER_ADMIN_AR,
    footerAdminEn: FOOTER_ADMIN_EN,
  };
};

const str = (v: unknown): string => (v === undefined || v === null ? "" : String(v).trim());

/**
 * Maps frozen DB snapshot → props for `AppreciationCertificate`.
 * Accepts strict snapshot shape or loose records (legacy / partial) and coalesces field aliases.
 */
export const snapshotToCertificateProps = (
  s: AppreciationCertificateSnapshot | Record<string, unknown>
) => {
  const x = s as Record<string, unknown>;
  return {
    studentNameAr: str(x.studentNameAr) || str(x.studentName),
    studentNameEn: str(x.studentNameEn) || str(x.studentName),
    gradeAr: str(x.gradeLabelAr) || str(x.gradeAr),
    gradeEn: str(x.gradeLabelEn) || str(x.gradeEn),
    achievementTitleAr: str(x.achievementTitleAr) || str(x.achievement_title_ar),
    achievementTitleEn: str(x.achievementTitleEn) || str(x.achievement_title_en),
    resultAr: str(x.resultSummaryAr) || str(x.resultAr) || str(x.result_summary_ar),
    resultEn: str(x.resultSummaryEn) || str(x.resultEn) || str(x.result_summary_en),
    levelAr: str(x.levelLabelAr) || str(x.levelAr) || str(x.level_label_ar),
    levelEn: str(x.levelLabelEn) || str(x.levelEn) || str(x.level_label_en),
    dateAr: str(x.dateLabelAr) || str(x.dateAr) || str(x.date_label_ar),
    dateEn: str(x.dateLabelEn) || str(x.dateEn) || str(x.date_label_en),
    certificateVersion:
      typeof x.certificateVersion === "number" && Number.isFinite(x.certificateVersion)
        ? x.certificateVersion
        : Number(x.certificateVersion) || 1,
    issuedAtIso: str(x.issuedAtIso),
  };
};
