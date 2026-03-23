export type Locale = "ar" | "en";

export const locales: Locale[] = ["ar", "en"];

export const defaultLocale: Locale = "ar";

export const localeNames: Record<Locale, string> = {
  ar: "العربية",
  en: "English",
};

export const localeFlags: Record<Locale, string> = {
  ar: "🇸🇦",
  en: "🇺🇸",
};

export const localeDirections: Record<Locale, "rtl" | "ltr"> = {
  ar: "rtl",
  en: "ltr",
};

// Get locale from localStorage or default
export function getLocale(): Locale {
  if (typeof window === "undefined") return defaultLocale;
  const stored = localStorage.getItem("locale") as Locale | null;
  return stored && locales.includes(stored) ? stored : defaultLocale;
}

// Set locale in localStorage
export function setLocale(locale: Locale): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("locale", locale);
  // Update HTML attributes
  document.documentElement.lang = locale;
  document.documentElement.dir = localeDirections[locale];
}

// Initialize locale on client side
export function initLocale(): void {
  if (typeof window === "undefined") return;
  const locale = getLocale();
  setLocale(locale);
}
