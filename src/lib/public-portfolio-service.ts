import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import Achievement from "@/models/Achievement";
import PlatformSettings from "@/models/PlatformSettings";
import {
  buildPublicPortfolioUrl,
  publicPortfolioAchievementMatch,
  publicPortfolioTokensEqual,
} from "@/lib/public-portfolio";
import { ensureStudentPublicPortfolioReady } from "@/lib/public-portfolio-bootstrap";
import { getGradeLabel } from "@/constants/grades";
import { getStageByGrade, reportStageLabel } from "@/lib/report-stage-mapping";
import {
  formatLocalizedResultLine,
  getAchievementDisplayName,
  getAchievementLevelLabel,
  labelLegacyAchievementType,
} from "@/lib/achievementDisplay";
import { resolveCertificateUiStatus } from "@/lib/certificate-eligibility";
import { tokenPreviewForLogs } from "@/lib/get-base-url";

const MAX_ACHIEVEMENTS = 60;

export type PublicPortfolioBranding = {
  schoolNameAr: string;
  schoolNameEn: string;
  mainLogo: string | null;
  secondaryLogo: string | null;
  reportHeaderImage: string | null;
};

export type PublicPortfolioAchievementItem = {
  id: string;
  titleAr: string;
  titleEn: string;
  categoryLabelAr: string;
  categoryLabelEn: string;
  levelLabelAr: string;
  levelLabelEn: string;
  resultLabelAr: string;
  resultLabelEn: string;
  participationLabelAr: string;
  participationLabelEn: string;
  achievementDate: string | null;
  academicYear: number;
  descriptionShortAr: string;
  descriptionShortEn: string;
  isFeatured: boolean;
  hasCertificate: boolean;
  certificateVerificationPath: string | null;
  colorKey: "school" | "province" | "kingdom" | "international" | "other";
};

export type PublicPortfolioSuccess = {
  ok: true;
  branding: PublicPortfolioBranding;
  student: {
    fullNameAr: string;
    fullNameEn: string;
    profilePhoto: string | null;
    gradeLabelAr: string;
    gradeLabelEn: string;
    stageLabelAr: string;
    stageLabelEn: string;
    trackLabelAr: string;
    trackLabelEn: string;
    sectionOrGenderAr: string;
    sectionOrGenderEn: string;
    publicPortfolioPublishedAt: string | null;
    lastUpdatedAt: string | null;
  };
  stats: {
    totalPublishedAchievements: number;
    totalFeaturedAchievements: number;
    totalCertificates: number;
    totalPoints: number;
  };
  achievements: PublicPortfolioAchievementItem[];
  portfolioUrl: string;
};

export type PublicPortfolioFailure =
  | { ok: false; error: "not_found" | "forbidden" }
  | { ok: false; error: "moved"; canonicalSlug: string; token: string };

export type PublicPortfolioResult = PublicPortfolioSuccess | PublicPortfolioFailure;

const participationLabels = (pt: string | undefined) => {
  const p = String(pt || "").toLowerCase();
  if (p === "team") return { ar: "فريق", en: "Team" };
  return { ar: "فردي", en: "Individual" };
};

const levelColorKey = (
  level: string | undefined
): PublicPortfolioAchievementItem["colorKey"] => {
  const k = String(level || "").toLowerCase();
  if (k === "school") return "school";
  if (k === "province") return "province";
  if (k === "kingdom") return "kingdom";
  if (k === "international") return "international";
  return "other";
};

const truncate = (s: string, max: number) => {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
};

const USER_PUBLIC_SELECT =
  "+publicPortfolioToken publicPortfolioEnabled publicPortfolioSlug publicPortfolioPublishedAt fullName fullNameAr fullNameEn profilePhoto gender section grade updatedAt createdAt";

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const logPublicPortfolioResolve = (payload: Record<string, unknown>) => {
  console.info("[public-portfolio] resolve", payload);
};

const findStudentByPortfolioSlug = async (normalizedSlug: string) => {
  if (!normalizedSlug) return null;
  const exact = await User.findOne({
    role: "student",
    publicPortfolioSlug: normalizedSlug,
  })
    .select(USER_PUBLIC_SELECT)
    .lean();
  if (exact) return exact;
  return User.findOne({
    role: "student",
    publicPortfolioSlug: { $regex: new RegExp(`^${escapeRegex(normalizedSlug)}$`, "i") },
  })
    .select(USER_PUBLIC_SELECT)
    .lean();
};

const findStudentByPublicToken = async (secretToken: string) => {
  const t = String(secretToken || "").trim();
  if (!t) return null;
  return User.findOne({
    role: "student",
    publicPortfolioToken: t,
  })
    .select(USER_PUBLIC_SELECT)
    .lean();
};

const defaultBranding = (): PublicPortfolioBranding => ({
  schoolNameAr: "مدارس الأنجال الأهلية",
  schoolNameEn: "Al-Anjal National Schools",
  mainLogo: null,
  secondaryLogo: null,
  reportHeaderImage: null,
});

export const loadPublicPortfolioPayload = async (
  slug: string,
  requestToken: string,
  options?: { baseUrl?: string }
): Promise<PublicPortfolioResult> => {
  const requestSlug = String(slug || "").trim().toLowerCase();
  const token = String(requestToken || "").trim();
  if (!token) {
    logPublicPortfolioResolve({
      inputSlug: requestSlug || "(empty)",
      hasToken: false,
      tokenPreview: null,
      matchedBySlug: false,
      matchedByToken: false,
      userFound: false,
      outcome: "not_found",
      reason: "missing_token",
    });
    return { ok: false, error: "not_found" };
  }

  await connectDB();

  let user =
    requestSlug.length > 0 ? await findStudentByPortfolioSlug(requestSlug) : null;
  const matchedBySlug = Boolean(user);
  let matchedByToken = false;
  if (!user) {
    user = await findStudentByPublicToken(token);
    matchedByToken = Boolean(user);
  }

  if (!user) {
    logPublicPortfolioResolve({
      inputSlug: requestSlug || "(empty)",
      hasToken: true,
      tokenPreview: tokenPreviewForLogs(token),
      matchedBySlug: false,
      matchedByToken: false,
      userFound: false,
      outcome: "not_found",
      reason: "no_student_for_slug_or_token",
    });
    return { ok: false, error: "not_found" };
  }

  const userIdStr = String((user as { _id?: unknown })._id ?? "");
  await ensureStudentPublicPortfolioReady(userIdStr);

  const refreshed = await User.findById(userIdStr).select(USER_PUBLIC_SELECT).lean();
  if (!refreshed) {
    logPublicPortfolioResolve({
      inputSlug: requestSlug || "(empty)",
      hasToken: true,
      tokenPreview: tokenPreviewForLogs(token),
      matchedBySlug,
      matchedByToken,
      userFound: false,
      outcome: "not_found",
      reason: "user_missing_after_bootstrap",
    });
    return { ok: false, error: "not_found" };
  }

  const u = refreshed as unknown as Record<string, unknown>;
  const storedToken = typeof u.publicPortfolioToken === "string" ? u.publicPortfolioToken.trim() : "";
  const storedSlug = typeof u.publicPortfolioSlug === "string" ? u.publicPortfolioSlug.trim().toLowerCase() : "";
  const enabledFlag = u.publicPortfolioEnabled;

  const explicitAdminDisable =
    enabledFlag === false && (Boolean(storedSlug) || Boolean(storedToken));
  if (explicitAdminDisable) {
    logPublicPortfolioResolve({
      inputSlug: requestSlug || "(empty)",
      canonicalSlug: storedSlug || null,
      hasToken: true,
      tokenPreview: tokenPreviewForLogs(token),
      matchedBySlug,
      matchedByToken,
      userFound: true,
      enabled: false,
      tokenMatched: false,
      outcome: "forbidden",
      reason: "admin_disabled",
    });
    return { ok: false, error: "forbidden" };
  }

  if (!storedToken) {
    logPublicPortfolioResolve({
      inputSlug: requestSlug || "(empty)",
      canonicalSlug: storedSlug || null,
      hasToken: true,
      tokenPreview: tokenPreviewForLogs(token),
      matchedBySlug,
      matchedByToken,
      userFound: true,
      enabled: enabledFlag === true,
      tokenMatched: false,
      outcome: "forbidden",
      reason: "missing_stored_token",
    });
    return { ok: false, error: "forbidden" };
  }

  const tokenMatched = publicPortfolioTokensEqual(storedToken, token);
  if (!tokenMatched) {
    logPublicPortfolioResolve({
      inputSlug: requestSlug || "(empty)",
      canonicalSlug: storedSlug || null,
      hasToken: true,
      tokenPreview: tokenPreviewForLogs(token),
      matchedBySlug,
      matchedByToken,
      userFound: true,
      enabled: enabledFlag === true,
      tokenMatched: false,
      outcome: "forbidden",
      reason: "token_mismatch",
    });
    return { ok: false, error: "forbidden" };
  }

  if (!storedSlug) {
    logPublicPortfolioResolve({
      inputSlug: requestSlug || "(empty)",
      hasToken: true,
      tokenPreview: tokenPreviewForLogs(token),
      matchedBySlug,
      matchedByToken,
      userFound: true,
      tokenMatched: true,
      outcome: "not_found",
      reason: "missing_stored_slug_after_bootstrap",
    });
    return { ok: false, error: "not_found" };
  }

  if (requestSlug !== storedSlug) {
    logPublicPortfolioResolve({
      inputSlug: requestSlug || "(empty)",
      canonicalSlug: storedSlug,
      hasToken: true,
      tokenPreview: tokenPreviewForLogs(token),
      matchedBySlug,
      matchedByToken,
      userFound: true,
      enabled: enabledFlag === true,
      tokenMatched: true,
      outcome: "moved",
      reason: "slug_not_canonical",
    });
    return { ok: false, error: "moved", canonicalSlug: storedSlug, token };
  }

  const userId = u._id as mongoose.Types.ObjectId;
  const match = publicPortfolioAchievementMatch(userId);

  const settingsDoc = await PlatformSettings.findOne({ singletonKey: "default" })
    .select("branding")
    .lean();
  const brandingRaw = (settingsDoc?.branding || {}) as Record<string, unknown>;
  const branding: PublicPortfolioBranding = {
    schoolNameAr:
      typeof brandingRaw.schoolNameAr === "string" && brandingRaw.schoolNameAr.trim()
        ? brandingRaw.schoolNameAr.trim()
        : defaultBranding().schoolNameAr,
    schoolNameEn:
      typeof brandingRaw.schoolNameEn === "string" && brandingRaw.schoolNameEn.trim()
        ? brandingRaw.schoolNameEn.trim()
        : defaultBranding().schoolNameEn,
    mainLogo:
      typeof brandingRaw.mainLogo === "string" && brandingRaw.mainLogo.trim()
        ? brandingRaw.mainLogo.trim()
        : null,
    secondaryLogo:
      typeof brandingRaw.secondaryLogo === "string" && brandingRaw.secondaryLogo.trim()
        ? brandingRaw.secondaryLogo.trim()
        : null,
    reportHeaderImage:
      typeof brandingRaw.reportHeaderImage === "string" && brandingRaw.reportHeaderImage.trim()
        ? brandingRaw.reportHeaderImage.trim()
        : null,
  };

  const achFields =
    "achievementType achievementCategory achievementName nameAr nameEn customAchievementName title description achievementLevel participationType resultType medalType rank score date achievementYear isFeatured featured certificateIssued certificateVerificationToken certificateRevokedAt certificateIssuedAt pendingReReview status certificateApprovedByRole certificateApprovedAt createdAt";

  const [achRows, agg] = await Promise.all([
    Achievement.find(match)
      .select(achFields)
      .sort({ date: -1, createdAt: -1 })
      .limit(MAX_ACHIEVEMENTS)
      .lean(),
    Achievement.aggregate([
      { $match: match as Record<string, unknown> },
      {
        $group: {
          _id: null,
          n: { $sum: 1 },
          featured: {
            $sum: {
              $cond: [
                {
                  $or: [{ $eq: ["$isFeatured", true] }, { $eq: ["$featured", true] }],
                },
                1,
                0,
              ],
            },
          },
          certs: {
            $sum: {
              $cond: [{ $eq: ["$certificateIssued", true] }, 1, 0],
            },
          },
          points: { $sum: { $ifNull: ["$score", 0] } },
        },
      },
    ]).exec(),
  ]);

  const aggRow = agg[0] as { n?: number; featured?: number; certs?: number; points?: number } | undefined;
  const stats = {
    totalPublishedAchievements: typeof aggRow?.n === "number" ? aggRow.n : 0,
    totalFeaturedAchievements: typeof aggRow?.featured === "number" ? aggRow.featured : 0,
    totalCertificates: typeof aggRow?.certs === "number" ? aggRow.certs : 0,
    totalPoints: typeof aggRow?.points === "number" ? Math.round(aggRow.points) : 0,
  };

  const achievements: PublicPortfolioAchievementItem[] = (achRows as unknown as Record<string, unknown>[]).map(
    (row) => {
      const id = String(row._id);
      const titleAr = getAchievementDisplayName(row, "ar");
      const titleEn = getAchievementDisplayName(row, "en");
      const typeSlug = String(row.achievementType || "");
      const catAr = labelLegacyAchievementType(typeSlug, "ar");
      const catEn = labelLegacyAchievementType(typeSlug, "en");
      const levelRaw = row.achievementLevel || row.level;
      const levelAr = getAchievementLevelLabel(levelRaw, "ar");
      const levelEn = getAchievementLevelLabel(levelRaw, "en");
      const scoreNum =
        typeof row.score === "number" && Number.isFinite(row.score) ? row.score : undefined;
      const resAr = formatLocalizedResultLine(
        String(row.resultType || ""),
        row.medalType ? String(row.medalType) : undefined,
        row.rank ? String(row.rank) : undefined,
        "ar",
        scoreNum
      );
      const resEn = formatLocalizedResultLine(
        String(row.resultType || ""),
        row.medalType ? String(row.medalType) : undefined,
        row.rank ? String(row.rank) : undefined,
        "en",
        scoreNum
      );
      const part = participationLabels(String(row.participationType || ""));
      const d = row.date instanceof Date ? row.date : null;
      const descSource = String(row.description || row.title || "").trim();
      const certUi = resolveCertificateUiStatus(
        row as Parameters<typeof resolveCertificateUiStatus>[0]
      );
      const vTok =
        typeof row.certificateVerificationToken === "string"
          ? row.certificateVerificationToken.trim()
          : "";
      const hasCert = certUi === "issued" && Boolean(vTok);
      const certPath = hasCert ? `/verify/certificate/${encodeURIComponent(vTok)}` : null;

      return {
        id,
        titleAr,
        titleEn,
        categoryLabelAr: catAr,
        categoryLabelEn: catEn,
        levelLabelAr: levelAr,
        levelLabelEn: levelEn,
        resultLabelAr: resAr,
        resultLabelEn: resEn,
        participationLabelAr: part.ar,
        participationLabelEn: part.en,
        achievementDate: d ? d.toISOString() : null,
        academicYear: typeof row.achievementYear === "number" ? row.achievementYear : 0,
        descriptionShortAr: truncate(descSource, 220) || (titleAr ? truncate(titleAr, 120) : "—"),
        descriptionShortEn:
          (titleEn ? truncate(titleEn, 220) : "") ||
          truncate(descSource, 220) ||
          (titleAr ? truncate(titleAr, 120) : "—"),
        isFeatured: row.isFeatured === true || row.featured === true,
        hasCertificate: Boolean(hasCert),
        certificateVerificationPath: certPath,
        colorKey: levelColorKey(String(levelRaw || "")),
      };
    }
  );

  const gradeVal = String(u.grade || "");
  const section = u.section === "international" ? "international" : "arabic";
  const gender = u.gender === "female" ? "female" : "male";
  const stage = getStageByGrade(gradeVal);

  const fullNameAr = String(u.fullNameAr || u.fullName || "").trim() || "—";
  const fullNameEn = String(u.fullNameEn || "").trim();

  const portfolioSlug = String(u.publicPortfolioSlug || requestSlug);
  const portfolioUrl = buildPublicPortfolioUrl({
    slug: portfolioSlug,
    token,
    baseUrl: options?.baseUrl,
  });

  const updatedAt = u.updatedAt instanceof Date ? u.updatedAt : null;
  const publishedAtOut =
    u.publicPortfolioPublishedAt instanceof Date ? u.publicPortfolioPublishedAt.toISOString() : null;

  logPublicPortfolioResolve({
    inputSlug: requestSlug || "(empty)",
    canonicalSlug: storedSlug,
    hasToken: true,
    tokenPreview: tokenPreviewForLogs(token),
    matchedBySlug,
    matchedByToken,
    userFound: true,
    enabled: enabledFlag === true,
    tokenMatched: true,
    publishedAchievementsCount: achievements.length,
    outcome: achievements.length > 0 ? "ok" : "empty_state",
  });

  return {
    ok: true,
    branding,
    student: {
      fullNameAr,
      fullNameEn: fullNameEn || fullNameAr,
      profilePhoto:
        typeof u.profilePhoto === "string" && u.profilePhoto.trim() ? u.profilePhoto.trim() : null,
      gradeLabelAr: getGradeLabel(gradeVal, "ar"),
      gradeLabelEn: getGradeLabel(gradeVal, "en"),
      stageLabelAr: reportStageLabel(stage, true),
      stageLabelEn: reportStageLabel(stage, false),
      trackLabelAr: section === "international" ? "المسار الدولي" : "المسار العربي",
      trackLabelEn: section === "international" ? "International track" : "Arabic track",
      sectionOrGenderAr: section === "international" ? "قسم دولي" : gender === "female" ? "طالبة" : "طالب",
      sectionOrGenderEn:
        section === "international" ? "International section" : gender === "female" ? "Female student" : "Male student",
      publicPortfolioPublishedAt: publishedAtOut,
      lastUpdatedAt: updatedAt ? updatedAt.toISOString() : null,
    },
    stats,
    achievements,
    portfolioUrl,
  };
};
