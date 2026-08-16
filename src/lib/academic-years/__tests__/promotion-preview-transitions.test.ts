import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/mongodb", () => ({ default: vi.fn(async () => undefined) }));

const mockFind = vi.fn();
vi.mock("@/models/User", () => ({
  default: {
    find: (...args: unknown[]) => mockFind(...args),
  },
}));

type FakeStudent = { _id: string; fullName?: string; fullNameAr?: string; grade: string };

const makeQuery = (result: FakeStudent[]) => {
  const query = {
    select: vi.fn(() => query),
    sort: vi.fn(() => query),
    lean: vi.fn(() => Promise.resolve(result)),
  };
  return query;
};

describe("buildPromotionPlan transitions", () => {
  beforeEach(() => {
    mockFind.mockReset();
  });

  it("groups students by grade transition, in grade order, including graduates", async () => {
    mockFind.mockReturnValue(
      makeQuery([
        { _id: "s1", grade: "g5" },
        { _id: "s2", grade: "g4" },
        { _id: "s3", grade: "g4" },
        { _id: "s4", grade: "g12" },
        { _id: "s5", grade: "g12" },
        { _id: "s6", grade: "g12" },
      ])
    );
    const { buildPromotionPlan } = await import("../promotion-preview");

    const plan = await buildPromotionPlan();

    expect(plan.totalStudents).toBe(6);
    expect(plan.promotableStudents).toBe(3);
    expect(plan.graduatingStudents).toBe(3);
    expect(plan.transitions).toEqual([
      expect.objectContaining({ fromGrade: "g4", toGrade: "g5", studentCount: 2 }),
      expect.objectContaining({ fromGrade: "g5", toGrade: "g6", studentCount: 1 }),
      expect.objectContaining({ fromGrade: "g12", toGrade: null, studentCount: 3 }),
    ]);
  });

  it("returns an empty transitions list when there are no eligible students", async () => {
    mockFind.mockReturnValue(makeQuery([]));
    const { buildPromotionPlan } = await import("../promotion-preview");

    const plan = await buildPromotionPlan();

    expect(plan.transitions).toEqual([]);
    expect(plan.totalStudents).toBe(0);
  });
});
