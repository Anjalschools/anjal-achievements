import type { Locale } from "@/lib/i18n";
import { defaultLocale, locales } from "@/lib/i18n";
import type { PublicPortfolioAchievementItem } from "@/lib/public-portfolio-service";

export const parsePublicPortfolioLang = (
  raw: string | string[] | undefined
): Locale => {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const s = String(v || "").trim().toLowerCase();
  return locales.includes(s as Locale) ? (s as Locale) : defaultLocale;
};

export const buildPublicPortfolioHref = (
  slug: string,
  token: string,
  lang: Locale
): string => {
  const sp = new URLSearchParams();
  sp.set("token", token);
  sp.set("lang", lang);
  return `/portfolio/${encodeURIComponent(slug)}?${sp.toString()}`;
};

export const appendLangToPortfolioUrl = (portfolioUrl: string, lang: Locale): string => {
  const u = portfolioUrl.trim();
  if (!u) return u;
  const joiner = u.includes("?") ? "&" : "?";
  return `${u}${joiner}lang=${encodeURIComponent(lang)}`;
};

export const portfolioDateLocale = (lang: Locale): string =>
  lang === "en" ? "en-GB" : "ar-SA";

export const portfolioNumberLocale = (lang: Locale): string =>
  lang === "en" ? "en-GB" : "ar-SA";

export const formatPortfolioDate = (iso: string | null, lang: Locale): string => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(portfolioDateLocale(lang), {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "—";
  }
};

export const formatPortfolioNumber = (n: number, lang: Locale): string =>
  Number.isFinite(n) ? n.toLocaleString(portfolioNumberLocale(lang)) : "—";

/** Prefer locale string; fall back to the other language; never empty. */
export const pickLocalizedText = (lang: Locale, ar: string, en: string): string => {
  const a = String(ar ?? "").trim();
  const e = String(en ?? "").trim();
  if (lang === "en") {
    if (e) return e;
    if (a) return a;
    return "—";
  }
  if (a) return a;
  if (e) return e;
  return "—";
};

/**
 * Body text: for English, avoid showing duplicate Arabic-only blurbs when an English title exists.
 */
export const pickAchievementDescription = (
  lang: Locale,
  a: PublicPortfolioAchievementItem
): string => {
  const ar = String(a.descriptionShortAr ?? "").trim();
  const en = String(a.descriptionShortEn ?? "").trim();
  const titleEn = String(a.titleEn ?? "").trim();
  const titleAr = String(a.titleAr ?? "").trim();
  if (lang === "en") {
    if (en && en !== ar) return en;
    if (titleEn) return titleEn;
    if (en) return en;
    if (ar) return ar;
    return "—";
  }
  if (ar) return ar;
  if (en) return en;
  if (titleAr) return titleAr;
  return "—";
};

export const achievementSecondaryTitle = (
  lang: Locale,
  a: PublicPortfolioAchievementItem
): string | null => {
  const primary = pickLocalizedText(lang, a.titleAr, a.titleEn);
  const alt = lang === "ar" ? String(a.titleEn ?? "").trim() : String(a.titleAr ?? "").trim();
  if (!alt || alt === primary) return null;
  return alt;
};
