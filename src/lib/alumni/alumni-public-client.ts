"use client";

import type {
  AlumniFieldsResponse,
  AlumniSummaryResponse,
  AlumniUniversitiesResponse,
  FeaturedAlumniResponse,
} from "@/lib/alumni/alumni-public-types";
import type { AlumniStoryListItem } from "@/lib/alumni/alumni-ecosystem-types";

type AlumniPublicClientData = {
  summary: AlumniSummaryResponse["stats"] | null;
  featured: FeaturedAlumniResponse["items"];
  universities: AlumniUniversitiesResponse["items"];
  fields: AlumniFieldsResponse["items"];
  stories: AlumniStoryListItem[];
};

const fetchJson = async <T>(url: string): Promise<T | null> => {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
};

export const fetchAlumniPublicClientData = async (): Promise<AlumniPublicClientData> => {
  const [summaryRes, featuredRes, universitiesRes, fieldsRes, storiesRes] = await Promise.all([
    fetchJson<AlumniSummaryResponse>("/api/public/alumni-summary"),
    fetchJson<FeaturedAlumniResponse>("/api/public/featured-alumni"),
    fetchJson<AlumniUniversitiesResponse>("/api/public/alumni-universities"),
    fetchJson<AlumniFieldsResponse>("/api/public/alumni-fields"),
    fetchJson<{ ok: true; items: AlumniStoryListItem[] }>("/api/public/alumni-stories?featured=1&limit=6"),
  ]);

  return {
    summary: summaryRes?.ok ? summaryRes.stats : null,
    featured: featuredRes?.ok ? featuredRes.items : [],
    universities: universitiesRes?.ok ? universitiesRes.items : [],
    fields: fieldsRes?.ok ? fieldsRes.items : [],
    stories: storiesRes?.ok && Array.isArray(storiesRes.items) ? storiesRes.items : [],
  };
};
