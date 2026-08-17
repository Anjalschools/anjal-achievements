import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/mongodb", () => ({ default: vi.fn(async () => undefined) }));

const mockGate = vi.fn();
vi.mock("@/lib/home-gallery-auth", () => ({
  requireHomeGalleryAdmin: () => mockGate(),
}));

const mockIsR2Configured = vi.fn(() => true);
vi.mock("@/lib/r2", () => ({
  isR2Configured: () => mockIsR2Configured(),
}));

const mockUploadToR2 = vi.fn();
vi.mock("@/lib/home-gallery-r2-upload", () => ({
  uploadGalleryImageBufferToR2: (...args: unknown[]) => mockUploadToR2(...args),
}));

const mockFind = vi.fn();
const mockFindOne = vi.fn();
const mockUpdateMany = vi.fn();
const mockCreate = vi.fn();
vi.mock("@/models/GalleryImage", () => ({
  default: {
    find: (...args: unknown[]) => mockFind(...args),
    findOne: (...args: unknown[]) => mockFindOne(...args),
    updateMany: (...args: unknown[]) => mockUpdateMany(...args),
    create: (...args: unknown[]) => mockCreate(...args),
  },
  HOME_CEREMONY_ALBUM_KEY: "home-ceremony",
}));

const ADMIN_GATE = { ok: true as const, user: { id: "admin-1", role: "admin" } };
const FORBIDDEN_GATE = {
  ok: false as const,
  response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
};

const listQuery = (rows: unknown[]) => {
  const q = { sort: vi.fn(() => q), lean: vi.fn(() => Promise.resolve(rows)) };
  return q;
};

const findOneQuery = (row: unknown) => {
  const q = { sort: vi.fn(() => q), select: vi.fn(() => q), lean: vi.fn(() => Promise.resolve(row)) };
  return q;
};

const makeUploadFile = (name = "photo.jpg", type = "image/jpeg", content = "fake-image-bytes") =>
  new File([content], name, { type });

const postRequestWithFile = (fields: Record<string, string> = {}, file: File | null = makeUploadFile()) => {
  const formData = new FormData();
  if (file) formData.append("file", file);
  for (const [k, v] of Object.entries(fields)) formData.append(k, v);
  return new NextRequest("http://localhost/api/admin/home-gallery", {
    method: "POST",
    body: formData,
  });
};

describe("GET /api/admin/home-gallery", () => {
  beforeEach(() => {
    mockGate.mockReset();
    mockFind.mockReset();
  });

  it("rejects a non-admin caller before touching the database", async () => {
    mockGate.mockResolvedValue(FORBIDDEN_GATE);
    const { GET } = await import("../route");

    const res = await GET();

    expect(res.status).toBe(403);
    expect(mockFind).not.toHaveBeenCalled();
  });

  it("lists all images (active and inactive) for an admin, sorted by displayOrder", async () => {
    mockGate.mockResolvedValue(ADMIN_GATE);
    mockFind.mockReturnValue(listQuery([]));
    const { GET } = await import("../route");

    await GET();

    expect(mockFind).toHaveBeenCalledWith({ albumKey: "home-ceremony" });
    expect(mockFind.mock.results[0].value.sort).toHaveBeenCalledWith({ displayOrder: 1, createdAt: 1 });
  });
});

describe("POST /api/admin/home-gallery", () => {
  beforeEach(() => {
    mockGate.mockReset();
    mockIsR2Configured.mockReset();
    mockIsR2Configured.mockReturnValue(true);
    mockUploadToR2.mockReset();
    mockFindOne.mockReset();
    mockUpdateMany.mockReset();
    mockCreate.mockReset();
    mockUpdateMany.mockResolvedValue({});
  });

  it("rejects a non-admin caller before touching R2 or the database", async () => {
    mockGate.mockResolvedValue(FORBIDDEN_GATE);
    const { POST } = await import("../route");

    const res = await POST(postRequestWithFile());

    expect(res.status).toBe(403);
    expect(mockUploadToR2).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns 503 when R2 storage is not configured", async () => {
    mockGate.mockResolvedValue(ADMIN_GATE);
    mockIsR2Configured.mockReturnValue(false);
    const { POST } = await import("../route");

    const res = await POST(postRequestWithFile());

    expect(res.status).toBe(503);
    expect(mockUploadToR2).not.toHaveBeenCalled();
  });

  it("rejects a request with no file field", async () => {
    mockGate.mockResolvedValue(ADMIN_GATE);
    const { POST } = await import("../route");

    const res = await POST(postRequestWithFile({}, null));

    expect(res.status).toBe(400);
    expect(mockUploadToR2).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rejects a disallowed file type without uploading to R2", async () => {
    mockGate.mockResolvedValue(ADMIN_GATE);
    const { POST } = await import("../route");

    const res = await POST(postRequestWithFile({}, makeUploadFile("evil.svg", "image/svg+xml")));

    expect(res.status).toBe(400);
    expect(mockUploadToR2).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("uploads the file to R2 and stores only the resulting URL/key in MongoDB — never base64", async () => {
    mockGate.mockResolvedValue(ADMIN_GATE);
    mockFindOne.mockReturnValue(findOneQuery(null));
    mockUploadToR2.mockResolvedValue({
      key: "home-gallery/home-ceremony/2026/08/abc123.jpg",
      url: "https://pub-example.r2.dev/home-gallery/home-ceremony/2026/08/abc123.jpg",
    });
    mockCreate.mockResolvedValue({
      toObject: () => ({
        _id: "new-id",
        imageUrl: "https://pub-example.r2.dev/home-gallery/home-ceremony/2026/08/abc123.jpg",
      }),
    });
    const { POST } = await import("../route");

    const res = await POST(postRequestWithFile({ titleAr: "صورة", titleEn: "Photo" }));
    const body = await res.json();

    expect(mockUploadToR2).toHaveBeenCalledWith(
      expect.objectContaining({ albumKey: "home-ceremony", fileName: "photo.jpg", mimeType: "image/jpeg" })
    );
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        imageUrl: "https://pub-example.r2.dev/home-gallery/home-ceremony/2026/08/abc123.jpg",
        objectKey: "home-gallery/home-ceremony/2026/08/abc123.jpg",
      })
    );
    const createdArg = mockCreate.mock.calls[0][0];
    expect(createdArg.imageUrl.startsWith("data:")).toBe(false);
    expect(res.status).toBe(201);
    expect(body.item.id).toBe("new-id");
  });

  it("auto-assigns the next displayOrder when none is given", async () => {
    mockGate.mockResolvedValue(ADMIN_GATE);
    mockFindOne.mockReturnValue(findOneQuery({ displayOrder: 4 }));
    mockUploadToR2.mockResolvedValue({ key: "k.jpg", url: "https://pub-example.r2.dev/k.jpg" });
    mockCreate.mockResolvedValue({ toObject: () => ({ _id: "new-id", imageUrl: "https://pub-example.r2.dev/k.jpg" }) });
    const { POST } = await import("../route");

    await POST(postRequestWithFile());

    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ displayOrder: 5 }));
  });

  it("unsets isCover on every other image when the new image is created as cover", async () => {
    mockGate.mockResolvedValue(ADMIN_GATE);
    mockFindOne.mockReturnValue(findOneQuery(null));
    mockUploadToR2.mockResolvedValue({ key: "k.jpg", url: "https://pub-example.r2.dev/k.jpg" });
    mockCreate.mockResolvedValue({ toObject: () => ({ _id: "new-id", imageUrl: "https://pub-example.r2.dev/k.jpg" }) });
    const { POST } = await import("../route");

    await POST(postRequestWithFile({ isCover: "true" }));

    expect(mockUpdateMany).toHaveBeenCalledWith(
      { albumKey: "home-ceremony" },
      { $set: { isCover: false } }
    );
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ isCover: true }));
  });

  it("does not touch other images' cover flag when the new image is not the cover", async () => {
    mockGate.mockResolvedValue(ADMIN_GATE);
    mockFindOne.mockReturnValue(findOneQuery(null));
    mockUploadToR2.mockResolvedValue({ key: "k.jpg", url: "https://pub-example.r2.dev/k.jpg" });
    mockCreate.mockResolvedValue({ toObject: () => ({ _id: "new-id", imageUrl: "https://pub-example.r2.dev/k.jpg" }) });
    const { POST } = await import("../route");

    await POST(postRequestWithFile());

    expect(mockUpdateMany).not.toHaveBeenCalled();
  });
});
