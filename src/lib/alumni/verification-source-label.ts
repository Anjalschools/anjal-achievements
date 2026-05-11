type Locale = "ar" | "en";

const LABELS: Record<string, { ar: string; en: string }> = {
  manual_admin: { ar: "موثّق يدويًا", en: "Manually verified" },
  verification_request: { ar: "موثّق عبر طلب", en: "Verified via request" },
  imported: { ar: "بيانات مستوردة", en: "Imported data" },
  legacy: { ar: "بيانات قديمة", en: "Legacy data" },
  admin: { ar: "موثّق يدويًا", en: "Admin verified" },
  linkedin: { ar: "توثيق مهني (لينكدإن)", en: "Professional (LinkedIn)" },
  university_email: { ar: "بريد جامعي", en: "University email" },
  career: { ar: "مسار مهني", en: "Career path" },
  manual: { ar: "موثّق يدويًا", en: "Manual entry" },
};

/** Human-readable label for `User.alumniProfile.verificationSource` (never raw keys in UI). */
export const getVerificationSourceLabel = (raw: string | null | undefined, locale: Locale): string => {
  const k = String(raw || "")
    .trim()
    .toLowerCase();
  if (!k) return locale === "ar" ? "غير محدد" : "Unspecified";
  const row = LABELS[k];
  if (row) return locale === "ar" ? row.ar : row.en;
  return locale === "ar" ? "مصدر توثيق آخر" : "Other verification source";
};
