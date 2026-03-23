"use client";

import { useEffect } from "react";
import { initLocale, getLocale, localeDirections } from "@/lib/i18n";

export default function LocaleProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    initLocale();
    const locale = getLocale();
    const dir = localeDirections[locale];
    
    // Update HTML attributes
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, []);

  return <>{children}</>;
}
