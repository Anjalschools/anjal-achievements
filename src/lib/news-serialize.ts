import type { INewsPost } from "@/models/NewsPost";

export type NewsPostApi = {
  id: string;
  title: string;
  subtitle?: string;
  slug: string;
  sourceType: string;
  sourceIds: string[];
  locale: string;
  tone?: string;
  audience?: string;
  category?: string;
  schoolSection?: string;
  namesOrEntities?: string;
  summary?: string;
  rawNotes?: string;
  eventDate?: string | null;
  location?: string;
  websiteBody?: string;
  instagramCaption?: string;
  xPostText?: string;
  snapchatText?: string;
  tiktokCaption?: string;
  bilingualBody?: string;
  hashtags: string[];
  coverImage?: string;
  attachments: string[];
  status: string;
  publishTargets: string[];
  publishResults: Array<{
    target: string;
    success: boolean;
    at?: string;
    errorMessage?: string;
    externalId?: string;
  }>;
  aiGenerationMeta?: Record<string, unknown> | null;
  createdBy?: string;
  approvedBy?: string;
  publishedBy?: string;
  scheduledFor?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

const iso = (d: unknown): string | null => {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString();
  return null;
};

export const serializeNewsPost = (doc: INewsPost | Record<string, unknown>): NewsPostApi => {
  const r = doc as Record<string, unknown>;
  const id = String(r._id ?? "");
  const src = (r.sourceIds as unknown[]) || [];
  return {
    id,
    title: String(r.title || ""),
    subtitle: r.subtitle ? String(r.subtitle) : undefined,
    slug: String(r.slug || ""),
    sourceType: String(r.sourceType || "manual"),
    sourceIds: src.map((x) => String(x)),
    locale: String(r.locale || "ar"),
    tone: r.tone ? String(r.tone) : undefined,
    audience: r.audience ? String(r.audience) : undefined,
    category: r.category ? String(r.category) : undefined,
    schoolSection: r.schoolSection ? String(r.schoolSection) : undefined,
    namesOrEntities: r.namesOrEntities ? String(r.namesOrEntities) : undefined,
    summary: r.summary ? String(r.summary) : undefined,
    rawNotes: r.rawNotes ? String(r.rawNotes) : undefined,
    eventDate: iso(r.eventDate),
    location: r.location ? String(r.location) : undefined,
    websiteBody: r.websiteBody ? String(r.websiteBody) : undefined,
    instagramCaption: r.instagramCaption ? String(r.instagramCaption) : undefined,
    xPostText: r.xPostText ? String(r.xPostText) : undefined,
    snapchatText: r.snapchatText ? String(r.snapchatText) : undefined,
    tiktokCaption: r.tiktokCaption ? String(r.tiktokCaption) : undefined,
    bilingualBody: r.bilingualBody ? String(r.bilingualBody) : undefined,
    hashtags: Array.isArray(r.hashtags) ? (r.hashtags as string[]).map(String) : [],
    coverImage: r.coverImage ? String(r.coverImage) : undefined,
    attachments: Array.isArray(r.attachments) ? (r.attachments as string[]).map(String) : [],
    status: String(r.status || "draft"),
    publishTargets: Array.isArray(r.publishTargets) ? (r.publishTargets as string[]).map(String) : [],
    publishResults: Array.isArray(r.publishResults)
      ? (r.publishResults as Record<string, unknown>[]).map((p) => ({
          target: String(p.target || ""),
          success: p.success === true,
          at: p.at instanceof Date ? p.at.toISOString() : undefined,
          errorMessage: p.errorMessage ? String(p.errorMessage) : undefined,
          externalId: p.externalId ? String(p.externalId) : undefined,
        }))
      : [],
    aiGenerationMeta:
      r.aiGenerationMeta && typeof r.aiGenerationMeta === "object"
        ? (r.aiGenerationMeta as Record<string, unknown>)
        : null,
    createdBy: r.createdBy ? String(r.createdBy) : undefined,
    approvedBy: r.approvedBy ? String(r.approvedBy) : undefined,
    publishedBy: r.publishedBy ? String(r.publishedBy) : undefined,
    scheduledFor: iso(r.scheduledFor),
    publishedAt: iso(r.publishedAt),
    createdAt: iso(r.createdAt) || new Date().toISOString(),
    updatedAt: iso(r.updatedAt) || new Date().toISOString(),
  };
};
