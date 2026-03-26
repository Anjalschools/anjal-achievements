"use client";

import { useEffect } from "react";
import { initLocale, getLocale, localeDirections } from "@/lib/i18n";
import { AppSessionProvider } from "@/contexts/AppSessionContext";

export default function LocaleProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    initLocale();
    const locale = getLocale();
    const dir = localeDirections[locale];

    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, []);

  return <AppSessionProvider>{children}</AppSessionProvider>;
}
