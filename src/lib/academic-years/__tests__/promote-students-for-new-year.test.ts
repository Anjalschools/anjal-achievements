import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/mongodb", () => ({ default: vi.fn(async () => undefined) }));

const mockFind = vi.fn();
const mockBulkWrite = vi.fn();

vi.mock("@/models/User", () => ({
  default: {
    find: (...args: unknown[]) => mockFind(...args),
    bulkWrite: (...args: unknown[]) => mockBulkWrite(...args),
  },
}));

type FakeStudent = {
  _id: string;
  grade: string;
  studentLifecycleStatus?: string;
};

const makeQuery = (result: FakeStudent[]) => {
  const query = {
    select: vi.fn(() => query),
    session: vi.fn(() => query),
    lean: vi.fn(() => Promise.resolve(result)),
  };
  return query;
};

const fakeSession = {} as import("mongoose").ClientSession;

describe("promoteStudentsForNewAcademicYear", () => {
  beforeEach(() => {
    mockFind.mockReset();
    mockBulkWrite.mockReset();
    mockBulkWrite.mockResolvedValue({});
  });

  it("advances a non-graduating student to the next grade", async () => {
    mockFind.mockReturnValue(makeQuery([{ _id: "s1", grade: "g4" }]));
    const { promoteStudentsForNewAcademicYear } = await import("../promote-students-for-new-year");

    const summary = await promoteStudentsForNewAcademicYear(fakeSession);

    expect(mockBulkWrite).toHaveBeenCalledWith(
      [{ updateOne: { filter: { _id: "s1" }, update: { $set: { grade: "g5" } } } }],
      { session: fakeSession }
    );
    expect(summary).toEqual({ totalEligible: 1, promotedCount: 1, graduatedCount: 0 });
  });

  it("marks a Grade 12 student as graduated instead of assigning a nonexistent next grade", async () => {
    mockFind.mockReturnValue(makeQuery([{ _id: "s2", grade: "g12" }]));
    const { promoteStudentsForNewAcademicYear } = await import("../promote-students-for-new-year");

    const summary = await promoteStudentsForNewAcademicYear(fakeSession);

    expect(mockBulkWrite).toHaveBeenCalledWith(
      [{ updateOne: { filter: { _id: "s2" }, update: { $set: { studentLifecycleStatus: "graduated" } } } }],
      { session: fakeSession }
    );
    expect(summary).toEqual({ totalEligible: 1, promotedCount: 0, graduatedCount: 1 });
  });

  it("does not re-graduate a student already marked graduated (idempotent)", async () => {
    mockFind.mockReturnValue(
      makeQuery([{ _id: "s3", grade: "g12", studentLifecycleStatus: "graduated" }])
    );
    const { promoteStudentsForNewAcademicYear } = await import("../promote-students-for-new-year");

    const summary = await promoteStudentsForNewAcademicYear(fakeSession);

    expect(mockBulkWrite).not.toHaveBeenCalled();
    expect(summary).toEqual({ totalEligible: 1, promotedCount: 0, graduatedCount: 0 });
  });

  it("promotes a mixed batch and skips students with no readable grade", async () => {
    mockFind.mockReturnValue(
      makeQuery([
        { _id: "s4", grade: "g6" },
        { _id: "s5", grade: "g11" },
        { _id: "s6", grade: "g12" },
        { _id: "s7", grade: "" },
      ])
    );
    const { promoteStudentsForNewAcademicYear } = await import("../promote-students-for-new-year");

    const summary = await promoteStudentsForNewAcademicYear(fakeSession);

    expect(mockBulkWrite).toHaveBeenCalledWith(
      [
        { updateOne: { filter: { _id: "s4" }, update: { $set: { grade: "g7" } } } },
        { updateOne: { filter: { _id: "s5" }, update: { $set: { grade: "g12" } } } },
        { updateOne: { filter: { _id: "s6" }, update: { $set: { studentLifecycleStatus: "graduated" } } } },
      ],
      { session: fakeSession }
    );
    expect(summary).toEqual({ totalEligible: 4, promotedCount: 2, graduatedCount: 1 });
  });

  it("only reads role:student status:active users (reuses the existing eligibility filter)", async () => {
    mockFind.mockReturnValue(makeQuery([]));
    const { promoteStudentsForNewAcademicYear } = await import("../promote-students-for-new-year");

    await promoteStudentsForNewAcademicYear(fakeSession);

    expect(mockFind).toHaveBeenCalledWith({ role: "student", status: "active" });
  });
});
