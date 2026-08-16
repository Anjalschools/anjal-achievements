import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/mongodb", () => ({ default: vi.fn(async () => undefined) }));

const mockLogAuditEvent = vi.fn();
vi.mock("@/lib/audit-log-service", () => ({
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
}));

const mockPromote = vi.fn();
vi.mock("@/lib/academic-years/promote-students-for-new-year", () => ({
  promoteStudentsForNewAcademicYear: (...args: unknown[]) => mockPromote(...args),
}));

const mockCreate = vi.fn();
const mockFindById = vi.fn();
const mockFind = vi.fn();
const mockUpdateMany = vi.fn();

vi.mock("@/models/AcademicYear", () => ({
  default: {
    create: (...args: unknown[]) => mockCreate(...args),
    findById: (...args: unknown[]) => mockFindById(...args),
    find: (...args: unknown[]) => mockFind(...args),
    updateMany: (...args: unknown[]) => mockUpdateMany(...args),
  },
  ACADEMIC_YEAR_STATUSES: ["draft", "active", "locked", "archived"],
}));

vi.mock("mongoose", async (importOriginal) => {
  const actual = await importOriginal<typeof import("mongoose")>();
  return {
    ...actual,
    default: {
      ...actual.default,
      startSession: vi.fn(async () => ({
        withTransaction: async (fn: () => Promise<void>) => {
          await fn();
        },
        endSession: vi.fn(async () => undefined),
      })),
    },
  };
});

type FakeYearDoc = {
  _id: string;
  name: string;
  label: string;
  startDate: Date;
  endDate: Date;
  isCurrent: boolean;
  isLocked: boolean;
  promotionExecuted: boolean;
  snapshotCreated: boolean;
  status: string;
  updatedBy?: unknown;
  save: ReturnType<typeof vi.fn>;
  toObject: () => Record<string, unknown>;
};

const makeYearDoc = (overrides: Partial<FakeYearDoc> = {}): FakeYearDoc => {
  const doc = {
    _id: "year-1",
    name: "2026-2027",
    label: "2026/2027",
    startDate: new Date("2026-08-01"),
    endDate: new Date("2027-06-01"),
    isCurrent: false,
    isLocked: false,
    promotionExecuted: false,
    snapshotCreated: false,
    status: "draft",
    ...overrides,
  } as FakeYearDoc;
  doc.save = vi.fn(async () => doc);
  doc.toObject = () => ({ ...doc });
  return doc;
};

const actor = { id: "admin-1" } as unknown as import("@/lib/audit-log-service").AuditActor;
const VALID_ID = "507f1f77bcf86cd799439011";

describe("createAcademicYear", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockPromote.mockReset();
    mockLogAuditEvent.mockReset();
  });

  it("creates a plain draft year and does not touch any student", async () => {
    mockCreate.mockResolvedValue(makeYearDoc());
    const { createAcademicYear } = await import("../academic-year-service");

    const result = await createAcademicYear({
      name: "2026-2027",
      startDate: new Date("2026-08-01"),
      endDate: new Date("2027-06-01"),
      actor,
    });

    expect(result.status).toBe("draft");
    expect(result.isCurrent).toBe(false);
    expect(result.promotionExecuted).toBe(false);
    expect(mockPromote).not.toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "draft", isCurrent: false, promotionExecuted: false })
    );
  });
});

describe("setAcademicYearAsCurrent", () => {
  beforeEach(() => {
    mockFindById.mockReset();
    mockFind.mockReset();
    mockUpdateMany.mockReset();
    mockPromote.mockReset();
    mockLogAuditEvent.mockReset();
    mockUpdateMany.mockResolvedValue({});
    mockFind.mockReturnValue({ session: vi.fn(() => ({ lean: vi.fn(async () => []) })) });
  });

  it("promotes students and flips isCurrent on first confirmation", async () => {
    const doc = makeYearDoc({ promotionExecuted: false });
    mockFindById.mockReturnValue({ session: vi.fn(async () => doc) });
    mockPromote.mockResolvedValue({ totalEligible: 10, promotedCount: 8, graduatedCount: 2 });

    const { setAcademicYearAsCurrent } = await import("../academic-year-service");
    const outcome = await setAcademicYearAsCurrent({ id: VALID_ID, actor });

    expect(mockPromote).toHaveBeenCalledTimes(1);
    expect(doc.isCurrent).toBe(true);
    expect(doc.status).toBe("active");
    expect(doc.promotionExecuted).toBe(true);
    expect(doc.save).toHaveBeenCalled();
    expect(outcome.alreadyPromoted).toBe(false);
    expect(outcome.promotionSummary).toEqual({ totalEligible: 10, promotedCount: 8, graduatedCount: 2 });
    expect(mockUpdateMany).toHaveBeenCalledWith(
      { _id: { $ne: "year-1" } },
      { $set: { isCurrent: false } },
      expect.any(Object)
    );
  });

  it("does not re-promote when promotionExecuted is already true (idempotent double-confirmation)", async () => {
    const doc = makeYearDoc({ promotionExecuted: true, isCurrent: true, status: "active" });
    mockFindById.mockReturnValue({ session: vi.fn(async () => doc) });

    const { setAcademicYearAsCurrent } = await import("../academic-year-service");
    const outcome = await setAcademicYearAsCurrent({ id: VALID_ID, actor });

    expect(mockPromote).not.toHaveBeenCalled();
    expect(outcome.alreadyPromoted).toBe(true);
    expect(outcome.promotionSummary).toBeNull();
    expect(doc.isCurrent).toBe(true);
    expect(doc.promotionExecuted).toBe(true);
  });

  it("propagates a promotion failure without marking promotionExecuted or saving", async () => {
    const doc = makeYearDoc({ promotionExecuted: false });
    mockFindById.mockReturnValue({ session: vi.fn(async () => doc) });
    mockPromote.mockRejectedValue(new Error("boom"));

    const { setAcademicYearAsCurrent } = await import("../academic-year-service");

    await expect(setAcademicYearAsCurrent({ id: VALID_ID, actor })).rejects.toThrow("boom");
    expect(doc.save).not.toHaveBeenCalled();
    expect(doc.promotionExecuted).toBe(false);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it("rejects an invalid id before touching the database", async () => {
    const { setAcademicYearAsCurrent } = await import("../academic-year-service");
    await expect(setAcademicYearAsCurrent({ id: "not-an-id", actor })).rejects.toThrow(
      "Invalid academic year id"
    );
    expect(mockFindById).not.toHaveBeenCalled();
  });

  it("throws (not locked as current) when the target year is locked", async () => {
    const doc = makeYearDoc({ isLocked: true });
    mockFindById.mockReturnValue({ session: vi.fn(async () => doc) });

    const { setAcademicYearAsCurrent } = await import("../academic-year-service");
    await expect(setAcademicYearAsCurrent({ id: VALID_ID, actor })).rejects.toThrow(
      "Cannot set a locked academic year as current"
    );
    expect(mockPromote).not.toHaveBeenCalled();
  });
});
