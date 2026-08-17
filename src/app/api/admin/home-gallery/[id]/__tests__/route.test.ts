import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/mongodb", () => ({ default: vi.fn(async () => undefined) }));

const mockGate = vi.fn();
vi.mock("@/lib/home-gallery-auth", () => ({
  requireHomeGalleryAdmin: () => mockGate(),
}));

const mockDeleteFromR2 = vi.fn();
vi.mock("@/lib/home-gallery-r2-upload", () => ({
  deleteGalleryImageFromR2: (...args: unknown[]) => mockDeleteFromR2(...args),
}));

const mockFindById = vi.fn();
const mockFindByIdAndDelete = vi.fn();
const mockUpdateMany = vi.fn();
vi.mock("@/models/GalleryImage", () => ({
  default: {
    findById: (...args: unknown[]) => mockFindById(...args),
    findByIdAndDelete: (...args: unknown[]) => mockFindByIdAndDelete(...args),
    updateMany: (...args: unknown[]) => mockUpdateMany(...args),
  },
  HOME_CEREMONY_ALBUM_KEY: "home-ceremony",
}));

const ADMIN_GATE = { ok: true as const, user: { id: "admin-1", role: "admin" } };
const FORBIDDEN_GATE = {
  ok: false as const,
  response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
};
const VALID_ID = "507f1f77bcf86cd799439011";

const makeDoc = (overrides: Record<string, unknown> = {}) => {
  const doc: Record<string, unknown> = {
    _id: VALID_ID,
    imageUrl: "https://pub-example.r2.dev/home-gallery/home-ceremony/2026/08/x.jpg",
    objectKey: "home-gallery/home-ceremony/2026/08/x.jpg",
    isActive: true,
    isCover: false,
    displayOrder: 1,
    ...overrides,
  };
  doc.save = vi.fn(async () => doc);
  doc.toObject = () => ({ ...doc });
  return doc;
};

const patchRequest = (body: Record<string, unknown>) =>
  new NextRequest(`http://localhost/api/admin/home-gallery/${VALID_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("PATCH /api/admin/home-gallery/[id]", () => {
  beforeEach(() => {
    mockGate.mockReset();
    mockFindById.mockReset();
    mockUpdateMany.mockReset();
    mockUpdateMany.mockResolvedValue({});
  });

  it("rejects a non-admin caller before touching the database", async () => {
    mockGate.mockResolvedValue(FORBIDDEN_GATE);
    const { PATCH } = await import("../route");

    const res = await PATCH(patchRequest({ isActive: false }), { params: { id: VALID_ID } });

    expect(res.status).toBe(403);
    expect(mockFindById).not.toHaveBeenCalled();
  });

  it("rejects an invalid id", async () => {
    mockGate.mockResolvedValue(ADMIN_GATE);
    const { PATCH } = await import("../route");

    const res = await PATCH(patchRequest({ isActive: false }), { params: { id: "not-an-id" } });

    expect(res.status).toBe(400);
    expect(mockFindById).not.toHaveBeenCalled();
  });

  it("returns 404 when the image does not exist", async () => {
    mockGate.mockResolvedValue(ADMIN_GATE);
    mockFindById.mockResolvedValue(null);
    const { PATCH } = await import("../route");

    const res = await PATCH(patchRequest({ isActive: false }), { params: { id: VALID_ID } });

    expect(res.status).toBe(404);
  });

  it("toggles isActive on the target image", async () => {
    mockGate.mockResolvedValue(ADMIN_GATE);
    const doc = makeDoc({ isActive: true });
    mockFindById.mockResolvedValue(doc);
    const { PATCH } = await import("../route");

    const res = await PATCH(patchRequest({ isActive: false }), { params: { id: VALID_ID } });
    const body = await res.json();

    expect(doc.isActive).toBe(false);
    expect(doc.save).toHaveBeenCalled();
    expect(body.item.isActive).toBe(false);
  });

  it("unsets isCover on every other image, and only every other image, when this one becomes cover", async () => {
    mockGate.mockResolvedValue(ADMIN_GATE);
    const doc = makeDoc({ isCover: false });
    mockFindById.mockResolvedValue(doc);
    const { PATCH } = await import("../route");

    await PATCH(patchRequest({ isCover: true }), { params: { id: VALID_ID } });

    expect(mockUpdateMany).toHaveBeenCalledWith(
      { albumKey: "home-ceremony", _id: { $ne: VALID_ID } },
      { $set: { isCover: false } }
    );
    expect(doc.isCover).toBe(true);
  });

  it("does not touch other images when isCover is not part of the patch", async () => {
    mockGate.mockResolvedValue(ADMIN_GATE);
    const doc = makeDoc();
    mockFindById.mockResolvedValue(doc);
    const { PATCH } = await import("../route");

    await PATCH(patchRequest({ displayOrder: 3 }), { params: { id: VALID_ID } });

    expect(mockUpdateMany).not.toHaveBeenCalled();
    expect(doc.displayOrder).toBe(3);
  });
});

const findByIdLeanQuery = (row: unknown) => {
  const q = { select: vi.fn(() => q), lean: vi.fn(() => Promise.resolve(row)) };
  return q;
};

describe("DELETE /api/admin/home-gallery/[id]", () => {
  beforeEach(() => {
    mockGate.mockReset();
    mockFindById.mockReset();
    mockFindByIdAndDelete.mockReset();
    mockDeleteFromR2.mockReset();
  });

  it("rejects a non-admin caller before touching R2 or the database", async () => {
    mockGate.mockResolvedValue(FORBIDDEN_GATE);
    const { DELETE } = await import("../route");

    const res = await DELETE(new NextRequest(`http://localhost/api/admin/home-gallery/${VALID_ID}`), {
      params: { id: VALID_ID },
    });

    expect(res.status).toBe(403);
    expect(mockFindById).not.toHaveBeenCalled();
    expect(mockDeleteFromR2).not.toHaveBeenCalled();
    expect(mockFindByIdAndDelete).not.toHaveBeenCalled();
  });

  it("rejects an invalid id", async () => {
    mockGate.mockResolvedValue(ADMIN_GATE);
    const { DELETE } = await import("../route");

    const res = await DELETE(new NextRequest("http://localhost/api/admin/home-gallery/not-an-id"), {
      params: { id: "not-an-id" },
    });

    expect(res.status).toBe(400);
    expect(mockFindById).not.toHaveBeenCalled();
  });

  it("returns 404 when the image does not exist", async () => {
    mockGate.mockResolvedValue(ADMIN_GATE);
    mockFindById.mockReturnValue(findByIdLeanQuery(null));
    const { DELETE } = await import("../route");

    const res = await DELETE(new NextRequest(`http://localhost/api/admin/home-gallery/${VALID_ID}`), {
      params: { id: VALID_ID },
    });

    expect(res.status).toBe(404);
    expect(mockDeleteFromR2).not.toHaveBeenCalled();
  });

  it("deletes the R2 object before the MongoDB record, using the stored objectKey", async () => {
    mockGate.mockResolvedValue(ADMIN_GATE);
    mockFindById.mockReturnValue(
      findByIdLeanQuery({ objectKey: "home-gallery/home-ceremony/2026/08/x.jpg" })
    );
    mockDeleteFromR2.mockResolvedValue(undefined);
    mockFindByIdAndDelete.mockResolvedValue({ _id: VALID_ID });
    const { DELETE } = await import("../route");

    const res = await DELETE(new NextRequest(`http://localhost/api/admin/home-gallery/${VALID_ID}`), {
      params: { id: VALID_ID },
    });
    const body = await res.json();

    expect(mockDeleteFromR2).toHaveBeenCalledWith("home-gallery/home-ceremony/2026/08/x.jpg");
    expect(mockFindByIdAndDelete).toHaveBeenCalledWith(VALID_ID);
    // R2 delete must happen before the Mongo delete.
    expect(mockDeleteFromR2.mock.invocationCallOrder[0]).toBeLessThan(
      mockFindByIdAndDelete.mock.invocationCallOrder[0]
    );
    expect(body).toEqual({ ok: true });
  });

  it("does not delete the MongoDB record when the R2 delete fails (fails closed)", async () => {
    mockGate.mockResolvedValue(ADMIN_GATE);
    mockFindById.mockReturnValue(
      findByIdLeanQuery({ objectKey: "home-gallery/home-ceremony/2026/08/x.jpg" })
    );
    mockDeleteFromR2.mockRejectedValue(new Error("r2 unreachable"));
    const { DELETE } = await import("../route");

    const res = await DELETE(new NextRequest(`http://localhost/api/admin/home-gallery/${VALID_ID}`), {
      params: { id: VALID_ID },
    });

    expect(res.status).toBe(502);
    expect(mockFindByIdAndDelete).not.toHaveBeenCalled();
  });

  it("reports a distinct error (not ok:true) when R2 delete succeeds but the Mongo delete fails", async () => {
    mockGate.mockResolvedValue(ADMIN_GATE);
    mockFindById.mockReturnValue(
      findByIdLeanQuery({ objectKey: "home-gallery/home-ceremony/2026/08/x.jpg" })
    );
    mockDeleteFromR2.mockResolvedValue(undefined);
    mockFindByIdAndDelete.mockRejectedValue(new Error("mongo unreachable"));
    const { DELETE } = await import("../route");

    const res = await DELETE(new NextRequest(`http://localhost/api/admin/home-gallery/${VALID_ID}`), {
      params: { id: VALID_ID },
    });
    const body = await res.json();

    expect(mockDeleteFromR2).toHaveBeenCalled();
    expect(res.status).toBe(500);
    expect(body.ok).not.toBe(true);
  });
});
