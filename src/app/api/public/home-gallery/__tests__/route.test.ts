import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/mongodb", () => ({ default: vi.fn(async () => undefined) }));

const mockFind = vi.fn();
vi.mock("@/models/GalleryImage", () => ({
  default: { find: (...args: unknown[]) => mockFind(...args) },
  HOME_CEREMONY_ALBUM_KEY: "home-ceremony",
}));

type FakeRow = {
  _id: { toString(): string };
  imageUrl: string;
  displayOrder: number;
  isActive: boolean;
  isCover?: boolean;
};

const makeQuery = (rows: FakeRow[]) => {
  const query = {
    sort: vi.fn(() => query),
    lean: vi.fn(() => Promise.resolve(rows)),
  };
  return query;
};

describe("GET /api/public/home-gallery", () => {
  beforeEach(() => {
    mockFind.mockReset();
  });

  it("only queries active images for the ceremony album, sorted by displayOrder ascending", async () => {
    mockFind.mockReturnValue(makeQuery([]));
    const { GET } = await import("../route");

    await GET();

    expect(mockFind).toHaveBeenCalledWith({ albumKey: "home-ceremony", isActive: true });
    const query = mockFind.mock.results[0].value;
    expect(query.sort).toHaveBeenCalledWith({ displayOrder: 1, createdAt: 1 });
  });

  it("returns an empty items array when there are no active images", async () => {
    mockFind.mockReturnValue(makeQuery([]));
    const { GET } = await import("../route");

    const res = await GET();
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.items).toEqual([]);
  });

  it("returns images in the order the (already-sorted) query provides them", async () => {
    mockFind.mockReturnValue(
      makeQuery([
        {
          _id: { toString: () => "a" },
          imageUrl: "https://pub-example.r2.dev/home-gallery/home-ceremony/2026/08/a.jpg",
          displayOrder: 1,
          isActive: true,
          isCover: true,
        },
        {
          _id: { toString: () => "b" },
          imageUrl: "https://pub-example.r2.dev/home-gallery/home-ceremony/2026/08/b.jpg",
          displayOrder: 2,
          isActive: true,
        },
      ])
    );
    const { GET } = await import("../route");

    const res = await GET();
    const body = await res.json();

    expect(body.items.map((i: { id: string }) => i.id)).toEqual(["a", "b"]);
    expect(body.items[0].isCover).toBe(true);
    expect(body.items[1].isCover).toBe(false);
  });

  it("never returns a base64 data URI as an image payload — only R2-backed URLs", async () => {
    mockFind.mockReturnValue(
      makeQuery([
        {
          _id: { toString: () => "a" },
          imageUrl: "https://pub-example.r2.dev/home-gallery/home-ceremony/2026/08/a.jpg",
          displayOrder: 1,
          isActive: true,
        },
      ])
    );
    const { GET } = await import("../route");

    const res = await GET();
    const body = await res.json();

    for (const item of body.items) {
      expect(String(item.imageUrl).startsWith("data:")).toBe(false);
      expect(String(item.imageUrl).startsWith("https://")).toBe(true);
    }
  });

  it("degrades to an empty list instead of throwing when the database query fails", async () => {
    mockFind.mockImplementation(() => {
      throw new Error("db down");
    });
    const { GET } = await import("../route");

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, items: [] });
  });
});
