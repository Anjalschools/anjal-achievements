const isValidWebsiteUrl = (raw: string): boolean => {
  const t = raw.trim();
  if (!t) return true;
  const withProto = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(withProto);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^(\+966|0)?5\d{8}$/;

const isValidEmail = (raw: string): boolean => {
  const v = raw.trim();
  if (!v) return false;
  return EMAIL_RE.test(v);
};

const isValidPhone = (raw: string): boolean => {
  const v = raw.replace(/\s+/g, "").trim();
  if (!v) return false;
  return PHONE_RE.test(v);
};

const extractIframeSrc = (raw: string): string | null => {
  const m = raw.match(/src\s*=\s*["']([^"']+)["']/i);
  return m?.[1]?.trim() || null;
};

const sanitizeMapEmbedInput = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/<iframe/i.test(trimmed)) {
    const src = extractIframeSrc(trimmed);
    return src || "";
  }
  return trimmed;
};

const isValidMapEmbedUrl = (raw: string): boolean => {
  const v = raw.trim();
  if (!v) return true;
  try {
    const u = new URL(v);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    if (!(host.includes("google.com") || host.includes("google.co"))) return false;
    const path = u.pathname.toLowerCase();
    return path.includes("/maps/embed") || path.includes("/maps");
  } catch {
    return false;
  }
};

export type SettingsPatchInput = Partial<{
  schoolYearPolicy: Record<string, unknown>;
  branding: Record<string, unknown>;
  ai: Record<string, unknown>;
  certificate: Record<string, unknown>;
  workflow: Record<string, unknown>;
}>;

export type ValidationResult =
  | { ok: true }
  | { ok: false; messageAr: string; messageEn: string };

export const sanitizeBrandingPatch = (
  branding: Record<string, unknown> | undefined
): Record<string, unknown> | undefined => {
  if (!branding) return undefined;
  const next = { ...branding } as Record<string, unknown>;
  if ("mapEmbedUrl" in next) {
    next.mapEmbedUrl = sanitizeMapEmbedInput(String(next.mapEmbedUrl || ""));
  }
  const trimKeys = [
    "contactEmailPrimary",
    "contactEmailSecondary",
    "contactPhonePrimary",
    "contactPhoneSecondary",
    "contactAddressAr",
    "contactAddressEn",
    "contactInfoTitleAr",
    "contactInfoTitleEn",
    "contactPageIntroAr",
    "contactPageIntroEn",
    "mapTitleAr",
    "mapTitleEn",
    "mapLocationLabelAr",
    "mapLocationLabelEn",
  ];
  for (const k of trimKeys) {
    if (k in next) next[k] = String(next[k] || "").trim();
  }
  return next;
};

/** Validates merged state after applying patch (partial saves OK). */
export const validatePlatformSettingsPatch = (
  current: {
    branding: Record<string, unknown>;
    certificate: Record<string, unknown>;
  },
  patch: SettingsPatchInput
): ValidationResult => {
  if (patch.branding) {
    const merged = { ...current.branding, ...sanitizeBrandingPatch(patch.branding) };
    const url = String(merged.websiteUrl ?? "").trim();
    if (url && !isValidWebsiteUrl(url)) {
      return {
        ok: false,
        messageAr: "رابط الموقع غير صالح — استخدم عنوانًا كاملاً (مثال: https://school.edu.sa)",
        messageEn: "Invalid website URL — use a full address (e.g. https://school.edu.sa)",
      };
    }

    const cEmail1 = String(merged.contactEmailPrimary ?? "").trim();
    if (cEmail1 && !isValidEmail(cEmail1)) {
      return {
        ok: false,
        messageAr: "البريد الإلكتروني الأساسي للتواصل غير صالح.",
        messageEn: "Primary contact email is invalid.",
      };
    }
    const cEmail2 = String(merged.contactEmailSecondary ?? "").trim();
    if (cEmail2 && !isValidEmail(cEmail2)) {
      return {
        ok: false,
        messageAr: "البريد الإلكتروني الثانوي للتواصل غير صالح.",
        messageEn: "Secondary contact email is invalid.",
      };
    }
    const cPhone1 = String(merged.contactPhonePrimary ?? "").trim();
    if (cPhone1 && !isValidPhone(cPhone1)) {
      return {
        ok: false,
        messageAr: "رقم الهاتف الأساسي غير صالح (مثال: 05xxxxxxxx).",
        messageEn: "Primary contact phone is invalid (example: 05xxxxxxxx).",
      };
    }
    const cPhone2 = String(merged.contactPhoneSecondary ?? "").trim();
    if (cPhone2 && !isValidPhone(cPhone2)) {
      return {
        ok: false,
        messageAr: "رقم الهاتف الثانوي غير صالح.",
        messageEn: "Secondary contact phone is invalid.",
      };
    }

    const mapEmbedUrl = String(merged.mapEmbedUrl ?? "").trim();
    if (mapEmbedUrl && !isValidMapEmbedUrl(mapEmbedUrl)) {
      return {
        ok: false,
        messageAr:
          "رابط تضمين الخريطة غير صالح. استخدم Google Maps Embed URL فقط (رابط src وليس iframe كامل).",
        messageEn:
          "Invalid map embed URL. Use a Google Maps embed src URL only (not a full iframe).",
      };
    }
  }

  if (patch.certificate) {
    const merged = { ...current.certificate, ...patch.certificate };
    const prefix = String(merged.certificatePrefix ?? "").trim();
    if (!prefix) {
      return {
        ok: false,
        messageAr: "بادئة الشهادة مطلوبة (حتى 10 أحرف)",
        messageEn: "Certificate prefix is required (max 10 characters)",
      };
    }
    if (prefix.length > 10) {
      return {
        ok: false,
        messageAr: "بادئة الشهادة يجب ألا تتجاوز 10 أحرف",
        messageEn: "Certificate prefix must be at most 10 characters",
      };
    }
  }

  return { ok: true };
};
