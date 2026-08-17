import { describe, expect, it } from "vitest";
import {
  isAllowedGalleryImageMime,
  normalizeGalleryImageMetadata,
  normalizeUpdateGalleryImage,
  serializeGalleryImage,
} from "../home-gallery";

describe("isAllowedGalleryImageMime", () => {
  it("accepts jpeg, png, and webp", () => {
    expect(isAllowedGalleryImageMime("image/jpeg")).toBe(true);
    expect(isAllowedGalleryImageMime("image/png")).toBe(true);
    expect(isAllowedGalleryImageMime("image/webp")).toBe(true);
    expect(isAllowedGalleryImageMime("IMAGE/JPEG")).toBe(true);
  });

  it("rejects svg, pdf, and other non-raster types", () => {
    expect(isAllowedGalleryImageMime("image/svg+xml")).toBe(false);
    expect(isAllowedGalleryImageMime("application/pdf")).toBe(false);
    expect(isAllowedGalleryImageMime("")).toBe(false);
  });
});

describe("normalizeGalleryImageMetadata", () => {
  it("fills alt text from title when alt is missing", () => {
    const result = normalizeGalleryImageMetadata({ titleAr: "حفل التكريم", titleEn: "Ceremony" });
    expect(result).toEqual({
      titleAr: "حفل التكريم",
      titleEn: "Ceremony",
      altAr: "حفل التكريم",
      altEn: "Ceremony",
      displayOrder: 0,
      isCover: false,
    });
  });

  it("falls back to a default alt text when neither alt nor title is given", () => {
    const result = normalizeGalleryImageMetadata({});
    expect(result.altAr).toBe("صورة من حفل التكريم");
    expect(result.altEn).toBe("Ceremony photo");
  });

  it("clamps a negative or non-numeric displayOrder to 0", () => {
    expect(normalizeGalleryImageMetadata({ displayOrder: -5 }).displayOrder).toBe(0);
    expect(normalizeGalleryImageMetadata({ displayOrder: "not-a-number" }).displayOrder).toBe(0);
  });

  it("accepts isCover as a boolean or a form-encoded string", () => {
    expect(normalizeGalleryImageMetadata({ isCover: true }).isCover).toBe(true);
    expect(normalizeGalleryImageMetadata({ isCover: "true" }).isCover).toBe(true);
    expect(normalizeGalleryImageMetadata({ isCover: "false" }).isCover).toBe(false);
    expect(normalizeGalleryImageMetadata({}).isCover).toBe(false);
  });

  it("never includes an image field — the image is uploaded separately, not taken from this input", () => {
    const result = normalizeGalleryImageMetadata({ imageUrl: "data:image/jpeg;base64,AAAA" });
    expect(result).not.toHaveProperty("imageUrl");
  });
});

describe("normalizeUpdateGalleryImage", () => {
  it("only includes fields that are actually present in the patch", () => {
    expect(normalizeUpdateGalleryImage({ isActive: false })).toEqual({ isActive: false });
    expect(normalizeUpdateGalleryImage({ displayOrder: 3 })).toEqual({ displayOrder: 3 });
    expect(normalizeUpdateGalleryImage({})).toEqual({});
    expect(normalizeUpdateGalleryImage(null)).toEqual({});
  });

  it("ignores wrong-typed values instead of coercing them", () => {
    expect(normalizeUpdateGalleryImage({ isActive: "yes" })).toEqual({});
    expect(normalizeUpdateGalleryImage({ displayOrder: "not-a-number" })).toEqual({});
  });
});

describe("serializeGalleryImage", () => {
  it("defaults isActive to true and isCover to false when absent", () => {
    const row = serializeGalleryImage({ _id: { toString: () => "id-1" }, imageUrl: "/x.jpg" });
    expect(row.isActive).toBe(true);
    expect(row.isCover).toBe(false);
    expect(row.id).toBe("id-1");
  });

  it("respects an explicit isActive: false", () => {
    const row = serializeGalleryImage({
      _id: { toString: () => "id-2" },
      imageUrl: "/x.jpg",
      isActive: false,
    });
    expect(row.isActive).toBe(false);
  });

  it("never exposes the internal R2 objectKey to API responses", () => {
    const row = serializeGalleryImage({
      _id: { toString: () => "id-3" },
      imageUrl: "https://pub-example.r2.dev/home-gallery/home-ceremony/2026/08/abc.jpg",
    } as never);
    expect(row).not.toHaveProperty("objectKey");
  });

  it("passes through the stored imageUrl (an R2 public URL) as-is", () => {
    const url = "https://pub-example.r2.dev/home-gallery/home-ceremony/2026/08/abc.jpg";
    const row = serializeGalleryImage({ _id: { toString: () => "id-4" }, imageUrl: url });
    expect(row.imageUrl).toBe(url);
    expect(row.imageUrl.startsWith("data:")).toBe(false);
  });
});
