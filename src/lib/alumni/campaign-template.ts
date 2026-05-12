export const CAMPAIGN_TEMPLATE_VARIABLES = [
  { key: "name", token: "{{name}}", descriptionAr: "اسم الخريج" },
  { key: "graduationYear", token: "{{graduationYear}}", descriptionAr: "سنة التخرج" },
  { key: "university", token: "{{university}}", descriptionAr: "الجامعة" },
  { key: "major", token: "{{major}}", descriptionAr: "التخصص" },
] as const;

export type CampaignPreviewSample = Record<(typeof CAMPAIGN_TEMPLATE_VARIABLES)[number]["key"], string>;

export const DEFAULT_CAMPAIGN_PREVIEW_SAMPLE: CampaignPreviewSample = {
  name: "أحمد محمد",
  graduationYear: "2023",
  university: "جامعة الملك سعود",
  major: "هندسة البرمجيات",
};

/**
 * Replace {{ tokens }} for preview only (not for outbound merge).
 */
export const applyCampaignPreviewPlaceholders = (html: string, sample: CampaignPreviewSample): string => {
  let out = String(html || "");
  for (const row of CAMPAIGN_TEMPLATE_VARIABLES) {
    const val = sample[row.key] ?? "";
    const re = new RegExp(`\\{\\{\\s*${row.key}\\s*\\}\\}`, "gi");
    out = out.replace(re, val);
  }
  return out;
};
