import type { INewsPost } from "@/models/NewsPost";

export type PublicNewsListItem = {
  slug: string;
  title: string;
  subtitle?: string;
  summary?: string;
  coverImage?: string;
  publishedAt: string;
  category?: string;
  locale: string;
};

export type PublicNewsDetail = PublicNewsListItem & {
  websiteBody?: string;
  hashtags: string[];
  eventDate?: string | null;
  location?: string;
};

const iso = (d: unknown): string | null => {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString();
  return null;
};

export const toPublicNewsListItem = (doc: INewsPost | Record<string, unknown>): PublicNewsListItem => {
  const r = doc as Record<string, unknown>;
  return {
    slug: String(r.slug || ""),
    title: String(r.title || ""),
    subtitle: r.subtitle ? String(r.subtitle) : undefined,
    summary: r.summary ? String(r.summary) : undefined,
    coverImage: r.coverImage ? String(r.coverImage) : undefined,
    publishedAt: iso(r.publishedAt) || iso(r.updatedAt) || new Date().toISOString(),
    category: r.category ? String(r.category) : undefined,
    locale: String(r.locale || "ar"),
  };
};

export const toPublicNewsDetail = (doc: INewsPost | Record<string, unknown>): PublicNewsDetail => {
  const base = toPublicNewsListItem(doc);
  const r = doc as Record<string, unknown>;
  return {
    ...base,
    websiteBody: r.websiteBody ? String(r.websiteBody) : undefined,
    hashtags: Array.isArray(r.hashtags) ? (r.hashtags as string[]).map(String) : [],
    eventDate: iso(r.eventDate),
    location: r.location ? String(r.location) : undefined,
  };
};
