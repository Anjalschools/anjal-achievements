import { extractAttachmentUrl } from "@/lib/achievement-attachments";
import {
  formatLocalizedResultLine,
  getAchievementDisplayName,
  getDisplayLabel,
  labelAchievementCategory,
  labelAchievementClassification,
  labelInferredField,
  labelLegacyAchievementType,
  getAchievementLevelLabel,
} from "@/lib/achievementDisplay";

export type AdminLabelLocale = "ar" | "en";

/** Safe placeholder for empty cells */
export const emptyCell = (_loc: AdminLabelLocale): string => "—";

export const emptyOrDash = (v: unknown, loc: AdminLabelLocale): string => {
  if (v === null || v === undefined) return emptyCell(loc);
  const s = String(v).trim();
  if (!s) return loc === "ar" ? "غير محدد" : "—";
  return s;
};

export const formatAchievementTypeLabel = (v: string | undefined, loc: AdminLabelLocale) =>
  labelLegacyAchievementType(v, loc);

export const formatAchievementCategoryLabel = (v: string | undefined, loc: AdminLabelLocale) => {
  const raw = labelAchievementCategory(v, loc);
  if (raw && raw !== "—") return raw;
  return v ? getDisplayLabel(v, loc) : loc === "ar" ? "غير محدد" : "—";
};

export const formatAchievementFieldLabel = (v: string | undefined, loc: AdminLabelLocale) =>
  labelInferredField(v, loc);

export const formatAchievementLevelLabel = (v: string | undefined, loc: AdminLabelLocale) =>
  getAchievementLevelLabel(v, loc);

export const formatAchievementClassificationLabel = (v: string | undefined, loc: AdminLabelLocale) =>
  labelAchievementClassification(v, loc);

export const formatOrgLabel = (raw: Record<string, unknown>, loc: AdminLabelLocale): string => {
  const org = String(raw.organization || "").trim();
  if (org) return org;
  const c =
    String(raw.customCompetitionName || raw.customProgramName || raw.customExhibitionName || "").trim();
  if (c) return c;
  const comp = String(raw.competitionName || raw.programName || raw.exhibitionName || "").trim();
  if (comp) return getDisplayLabel(comp, loc);
  const legacy = String(raw.competition || "").trim();
  return legacy ? getDisplayLabel(legacy, loc) : loc === "ar" ? "غير محدد" : "—";
};

export const formatResultLine = (raw: Record<string, unknown>, loc: AdminLabelLocale): string => {
  const rt = String(raw.resultType || "");
  const medal = String(raw.medalType || "");
  const rank = String(raw.rank || "");
  const scoreVal =
    typeof raw.resultValue === "number"
      ? raw.resultValue
      : Number(raw.resultValue) || undefined;
  return formatLocalizedResultLine(rt, medal, rank, loc, scoreVal);
};

export const formatParticipationLabel = (v: string | undefined, loc: AdminLabelLocale): string => {
  const k = String(v || "").toLowerCase();
  if (k === "individual") return loc === "ar" ? "فردي" : "Individual";
  if (k === "team") return loc === "ar" ? "فريق" : "Team";
  return loc === "ar" ? "غير محدد" : "—";
};

export const resolveAchievementTitleForAdmin = (raw: Record<string, unknown>, loc: AdminLabelLocale): string => {
  const title = getAchievementDisplayName(raw, loc);
  if (title && title !== "إنجاز" && title !== "Achievement") return title;
  const typeLabel = formatAchievementTypeLabel(String(raw.achievementType || ""), loc);
  return typeLabel || (loc === "ar" ? "إنجاز" : "Achievement");
};

export const attachmentSummary = (
  attachments: unknown[] | undefined,
  image: string | null | undefined,
  loc: AdminLabelLocale
): { count: number; hasPdf: boolean; label: string } => {
  const list = Array.isArray(attachments)
    ? attachments.map((x) => extractAttachmentUrl(x)).filter((x): x is string => Boolean(x))
    : [];
  const hasImg = Boolean(image && String(image).trim());
  const count = list.length + (hasImg ? 1 : 0);
  const hasPdf = list.some((u) => /\.pdf(\?|$)/i.test(u) || u.toLowerCase().includes("pdf"));
  if (count === 0) {
    return { count: 0, hasPdf: false, label: loc === "ar" ? "لا توجد مرفقات" : "No attachments" };
  }
  const pdfTag = hasPdf ? (loc === "ar" ? " · PDF" : " · PDF") : "";
  return {
    count,
    hasPdf,
    label:
      loc === "ar"
        ? `${count} مرفق/مرفقات${pdfTag}`
        : `${count} attachment(s)${pdfTag}`,
  };
};
