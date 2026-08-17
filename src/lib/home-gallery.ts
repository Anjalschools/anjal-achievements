export type GalleryImageRow = {
  id: string;
  imageUrl: string;
  titleAr: string;
  titleEn: string;
  altAr: string;
  altEn: string;
  displayOrder: number;
  isActive: boolean;
  isCover: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

const asTrimmed = (v: unknown, max = 2000): string => {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length > max ? s.slice(0, max) : s;
};

export const serializeGalleryImage = (row: {
  _id?: { toString(): string };
  imageUrl?: string;
  titleAr?: string;
  titleEn?: string;
  altAr?: string;
  altEn?: string;
  displayOrder?: number;
  isActive?: boolean;
  isCover?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}): GalleryImageRow => ({
  id: String(row._id),
  imageUrl: String(row.imageUrl || ""),
  titleAr: String(row.titleAr || ""),
  titleEn: String(row.titleEn || ""),
  altAr: String(row.altAr || ""),
  altEn: String(row.altEn || ""),
  displayOrder: Number(row.displayOrder || 0),
  isActive: row.isActive !== false,
  isCover: row.isCover === true,
  createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
  updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
});

export type GalleryImageMetadata = {
  titleAr: string;
  titleEn: string;
  altAr: string;
  altEn: string;
  displayOrder: number;
  isCover: boolean;
};

const DEFAULT_ALT_AR = "صورة من حفل التكريم";
const DEFAULT_ALT_EN = "Ceremony photo";

/**
 * Normalizes the text metadata fields for a gallery image (title/alt/order/cover).
 * The image itself is never taken from this input — it is uploaded to R2 separately and its
 * resulting URL/key are supplied by the route handler, not the client.
 */
export const normalizeGalleryImageMetadata = (raw: unknown): GalleryImageMetadata => {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const titleAr = asTrimmed(o.titleAr, 300);
  const titleEn = asTrimmed(o.titleEn, 300);
  const altAr = asTrimmed(o.altAr, 300) || titleAr || DEFAULT_ALT_AR;
  const altEn = asTrimmed(o.altEn, 300) || titleEn || DEFAULT_ALT_EN;
  const displayOrder = Number.isFinite(Number(o.displayOrder))
    ? Math.max(0, Math.floor(Number(o.displayOrder)))
    : 0;
  const isCover = o.isCover === true || o.isCover === "true";
  return { titleAr, titleEn, altAr, altEn, displayOrder, isCover };
};

/** Allowed upload mime types for gallery photos (raster images only — no SVG/PDF). */
const ALLOWED_GALLERY_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export const isAllowedGalleryImageMime = (mime: string): boolean =>
  ALLOWED_GALLERY_MIME.has(mime.trim().toLowerCase());

export type UpdateGalleryImagePatch = Partial<{
  titleAr: string;
  titleEn: string;
  altAr: string;
  altEn: string;
  displayOrder: number;
  isActive: boolean;
  isCover: boolean;
}>;

export const normalizeUpdateGalleryImage = (raw: unknown): UpdateGalleryImagePatch => {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const patch: UpdateGalleryImagePatch = {};
  if (typeof o.titleAr === "string") patch.titleAr = asTrimmed(o.titleAr, 300);
  if (typeof o.titleEn === "string") patch.titleEn = asTrimmed(o.titleEn, 300);
  if (typeof o.altAr === "string") patch.altAr = asTrimmed(o.altAr, 300);
  if (typeof o.altEn === "string") patch.altEn = asTrimmed(o.altEn, 300);
  if (o.displayOrder !== undefined && Number.isFinite(Number(o.displayOrder))) {
    patch.displayOrder = Math.max(0, Math.floor(Number(o.displayOrder)));
  }
  if (typeof o.isActive === "boolean") patch.isActive = o.isActive;
  if (typeof o.isCover === "boolean") patch.isCover = o.isCover;
  return patch;
};
