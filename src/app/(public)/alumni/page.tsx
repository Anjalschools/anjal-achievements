"use client";

import { useEffect, useMemo, useState } from "react";
import { initLocale } from "@/lib/i18n";
import type { AlumniLocale } from "@/content/alumni-landing";
import { fetchAlumniPublicClientData } from "@/lib/alumni/alumni-public-client";
import type {
  AlumniFieldCountItem,
  AlumniPublicSummaryStats,
  AlumniUniversityCountItem,
  FeaturedAlumniItem,
} from "@/lib/alumni/alumni-public-types";
import type { AlumniStoryListItem } from "@/lib/alumni/alumni-ecosystem-types";
import { AlumniHero } from "@/components/alumni/AlumniHero";
import { AlumniStatsSection } from "@/components/alumni/AlumniStatsSection";
import { AlumniFeaturedSection } from "@/components/alumni/AlumniFeaturedSection";
import { AlumniStoriesSection } from "@/components/alumni/AlumniStoriesSection";
import { AlumniUniversitiesSection } from "@/components/alumni/AlumniUniversitiesSection";
import { AlumniFieldsSection } from "@/components/alumni/AlumniFieldsSection";
import { AlumniCooperationSection } from "@/components/alumni/AlumniCooperationSection";
import { AlumniJoinCta } from "@/components/alumni/AlumniJoinCta";

export default function AlumniLandingPage() {
  const [locale, setLocale] = useState<AlumniLocale>("ar");
  const [summaryStats, setSummaryStats] = useState<AlumniPublicSummaryStats | null>(null);
  const [featuredAlumni, setFeaturedAlumni] = useState<FeaturedAlumniItem[]>([]);
  const [universities, setUniversities] = useState<AlumniUniversityCountItem[]>([]);
  const [fields, setFields] = useState<AlumniFieldCountItem[]>([]);
  const [stories, setStories] = useState<AlumniStoryListItem[]>([]);

  useEffect(() => {
    initLocale();
    const saved =
      typeof window !== "undefined"
        ? (localStorage.getItem("platform-locale") as AlumniLocale | null)
        : null;
    if (saved === "ar" || saved === "en") setLocale(saved);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("platform-locale", locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      const result = await fetchAlumniPublicClientData();
      if (!isMounted) return;
      setSummaryStats(result.summary);
      setFeaturedAlumni(result.featured);
      setUniversities(result.universities);
      setFields(result.fields);
      setStories(result.stories);
    };
    void loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const isAr = locale === "ar";

  const sections = useMemo(
    () => [
      <AlumniHero key="hero" locale={locale} />,
      <AlumniStatsSection key="stats" locale={locale} stats={summaryStats} />,
      <AlumniFeaturedSection key="featured" locale={locale} featured={featuredAlumni} />,
      <AlumniStoriesSection key="stories" locale={locale} stories={stories} />,
      <AlumniUniversitiesSection key="uni" locale={locale} universities={universities} />,
      <AlumniFieldsSection key="fields" locale={locale} fields={fields} />,
      <AlumniCooperationSection key="coop" locale={locale} />,
      <AlumniJoinCta key="join" locale={locale} />,
    ],
    [locale, summaryStats, featuredAlumni, universities, fields, stories]
  );

  return (
    <main className="min-w-0 bg-white" dir={isAr ? "rtl" : "ltr"}>
      {sections}
    </main>
  );
}
