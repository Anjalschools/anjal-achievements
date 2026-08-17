import mongoose, { Document, Model, Schema } from "mongoose";

/** Groups images into a gallery; a single fixed key is used today (the homepage ceremony gallery). */
export const HOME_CEREMONY_ALBUM_KEY = "home-ceremony";

export interface IGalleryImage extends Document {
  albumKey: string;
  /** Public R2 object URL (see src/lib/r2.ts) — never a base64 payload. */
  imageUrl: string;
  /** R2 object key, used to delete the underlying object on GalleryImage removal. */
  objectKey: string;
  titleAr?: string;
  titleEn?: string;
  altAr: string;
  altEn: string;
  displayOrder: number;
  isActive: boolean;
  isCover: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const GalleryImageSchema = new Schema<IGalleryImage>(
  {
    albumKey: { type: String, required: true, trim: true, maxlength: 120, default: HOME_CEREMONY_ALBUM_KEY, index: true },
    // Stored in Cloudflare R2 — same production storage service used for achievement
    // attachments (src/lib/r2.ts / src/app/api/uploads/attachment). MongoDB holds only the
    // resulting public URL + object key, never image bytes.
    imageUrl: { type: String, required: true, trim: true, maxlength: 2000 },
    objectKey: { type: String, required: true, trim: true, maxlength: 500 },
    titleAr: { type: String, trim: true, maxlength: 300 },
    titleEn: { type: String, trim: true, maxlength: 300 },
    altAr: { type: String, required: true, trim: true, maxlength: 300 },
    altEn: { type: String, required: true, trim: true, maxlength: 300 },
    displayOrder: { type: Number, required: true, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
    isCover: { type: Boolean, default: false },
  },
  { timestamps: true }
);

GalleryImageSchema.index({ albumKey: 1, isActive: 1, displayOrder: 1 });

const GalleryImage: Model<IGalleryImage> =
  mongoose.models.GalleryImage || mongoose.model<IGalleryImage>("GalleryImage", GalleryImageSchema);

export default GalleryImage;
