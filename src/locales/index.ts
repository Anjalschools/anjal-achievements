import { ar } from "./ar";
import { en } from "./en";
import type { Locale } from "@/lib/i18n";

export const translations = {
  ar,
  en,
} as const;

export type TranslationKey = keyof typeof ar;

export function getTranslation(locale: Locale) {
  return translations[locale];
}
