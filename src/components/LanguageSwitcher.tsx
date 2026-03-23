"use client";

import { useState, useEffect } from "react";
import { getLocale, setLocale, localeNames, localeFlags, type Locale } from "@/lib/i18n";
import { Languages } from "lucide-react";

export default function LanguageSwitcher() {
  const [currentLocale, setCurrentLocale] = useState<Locale>("ar");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const locale = getLocale();
    setCurrentLocale(locale);
  }, []);

  const handleLocaleChange = (locale: Locale) => {
    setLocale(locale);
    setCurrentLocale(locale);
    setIsOpen(false);
    // Reload page to apply changes
    window.location.reload();
  };

  const locales: Locale[] = ["ar", "en"];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-text transition-colors hover:border-primary hover:text-primary"
        aria-label="Change language"
      >
        <Languages className="h-4 w-4" />
        <span className="hidden sm:inline">
          {localeFlags[currentLocale]} {localeNames[currentLocale]}
        </span>
        <span className="sm:hidden">
          {localeFlags[currentLocale]} {currentLocale.toUpperCase()}
        </span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className={`absolute top-full z-20 mt-2 w-40 rounded-lg border border-gray-200 bg-white shadow-lg ${
            currentLocale === "ar" ? "left-0" : "right-0"
          }`}>
            {locales.map((locale) => (
              <button
                key={locale}
                onClick={() => handleLocaleChange(locale)}
                className={`w-full px-4 py-2.5 text-sm transition-colors first:rounded-t-lg last:rounded-b-lg ${
                  currentLocale === "ar" ? "text-right" : "text-left"
                } ${
                  currentLocale === locale
                    ? "bg-primary/10 font-semibold text-primary"
                    : "text-text hover:bg-gray-50"
                }`}
              >
                <div className={`flex items-center gap-2 ${
                  currentLocale === "ar" ? "flex-row-reverse" : "flex-row"
                }`}>
                  <span>{localeFlags[locale]}</span>
                  <span className="flex-1">{localeNames[locale]}</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
