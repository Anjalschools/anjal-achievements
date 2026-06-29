import {
  formatLocalizedResultLine,
  getAchievementDisplayName,
  getAchievementLevelLabel,
  labelAchievementCategory,
} from "@/lib/achievementDisplay";
import {
  getSpecialAchievementHighlightBadge,
  resolveStoredAchievementReportCategory,
  stripEntrepreneurshipMetaFromDescription,
} from "@/lib/achievement-report-category";
import { resolveCertificateUiStatus } from "@/lib/certificate-eligibility";
import { normalizeAttachmentsArray } from "@/lib/achievement-attachments";
import { buildPublicPortfolioEvidenceItems, isAttachmentPublicPortfolioVisible } from "@/lib/portfolio/portfolio-evidence-policy";
import {
  createPortfolioFaultContext,
  logPortfolioFault,
  type PortfolioFaultContext,
} from "@/lib/portfolio/portfolio-fault-diagnostics";
import type { PortfolioRequestDiagnostics } from "@/lib/portfolio/portfolio-request-diagnostics";
import type { PublicPortfolioAchievementItem } from "@/lib/public-portfolio-service";

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

export const buildPublicPortfolioAchievementItemFromRow = (
  row: Record<string, unknown>,
  faultCtx?: PortfolioFaultContext
): PublicPortfolioAchievementItem => {
  const id = String(row._id ?? "");
  const titleAr = getAchievementDisplayName(row, "ar");
  const titleEn = getAchievementDisplayName(row, "en");
  const reportCat = resolveStoredAchievementReportCategory({
    achievementType: String(row.achievementType || ""),
    achievementCategory: String(row.achievementCategory || ""),
    achievementName: String(row.achievementName || ""),
    description: String(row.description || ""),
  });
  const catAr = labelAchievementCategory(reportCat, "ar");
  const catEn = labelAchievementCategory(reportCat, "en");
  const highlight = getSpecialAchievementHighlightBadge({
    achievementType: String(row.achievementType || ""),
    achievementCategory: String(row.achievementCategory || ""),
    achievementName: String(row.achievementName || ""),
    description: String(row.description || ""),
  });
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
  const descSource = stripEntrepreneurshipMetaFromDescription(
    String(row.description || row.title || "")
  );
  const certUi = resolveCertificateUiStatus(
    row as Parameters<typeof resolveCertificateUiStatus>[0]
  );
  const vTok =
    typeof row.certificateVerificationToken === "string"
      ? row.certificateVerificationToken.trim()
      : "";
  const hasCert = certUi === "issued" && Boolean(vTok);
  const certPath = hasCert ? `/verify/certificate/${encodeURIComponent(vTok)}` : null;

  let evidence = buildPublicPortfolioEvidenceItems({
    achievementId: id,
    attachmentsRaw: row.attachments,
    faultCtx,
    achievementTitle: titleAr || titleEn || null,
  });

  return {
    id,
    titleAr,
    titleEn,
    highlightBadgeAr: highlight?.labelAr ?? null,
    highlightBadgeEn: highlight?.labelEn ?? null,
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
    evidence,
  };
};

export const buildPublicPortfolioAchievementItemsResilient = (
  rows: Record<string, unknown>[],
  input: {
    studentId: string;
    portfolioSlug: string;
    diagnostics?: PortfolioRequestDiagnostics | null;
  }
): PublicPortfolioAchievementItem[] => {
  const faultCtx = createPortfolioFaultContext({
    studentId: input.studentId,
    portfolioSlug: input.portfolioSlug,
    diagnostics: input.diagnostics,
  });
  const items: PublicPortfolioAchievementItem[] = [];

  if (input.diagnostics) {
    input.diagnostics.achievementsLoaded = rows.length;
  }

  input.diagnostics?.startStage("BUILD_PUBLIC_ACHIEVEMENT");

  for (const row of rows) {
    const achievementId = String(row._id ?? "");
    const startedAt = Date.now();
    const attachments = normalizeAttachmentsArray(row.attachments);
    const publicAttachmentCount = attachments.filter((attachment) =>
      isAttachmentPublicPortfolioVisible(attachment)
    ).length;
    const createdAt =
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : typeof row.createdAt === "string"
          ? row.createdAt
          : null;

    input.diagnostics?.logAchievementStart({
      achievementId,
      achievementTitle: String(row.nameAr || row.nameEn || "").trim() || null,
      achievementType: String(row.achievementType || "").trim() || null,
      attachmentCount: attachments.length,
      publicAttachmentCount,
      createdAt,
    });

    try {
      items.push(buildPublicPortfolioAchievementItemFromRow(row, faultCtx));
      input.diagnostics?.logAchievementSuccess(achievementId, Date.now() - startedAt);
    } catch (error) {
      logPortfolioFault(faultCtx, "achievement", error, {
        achievementId,
        achievementTitle: String(row.nameAr || row.nameEn || "").trim() || null,
        phase: "achievement_item",
      });
      input.diagnostics?.logAchievementFailed(achievementId, error, {
        achievementTitle: String(row.nameAr || row.nameEn || "").trim() || null,
      });
    }
  }

  input.diagnostics?.successStage("BUILD_PUBLIC_ACHIEVEMENT");

  return items;
};

export { createPortfolioFaultContext, logPortfolioFault };
