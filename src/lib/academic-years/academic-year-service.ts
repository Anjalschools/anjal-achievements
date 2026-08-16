import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import AcademicYear, { type AcademicYearStatus } from "@/models/AcademicYear";
import { logAuditEvent, type AuditActor } from "@/lib/audit-log-service";
import {
  promoteStudentsForNewAcademicYear,
  type StudentPromotionSummary,
} from "@/lib/academic-years/promote-students-for-new-year";
import type { NextRequest } from "next/server";

export type AcademicYearRow = {
  id: string;
  name: string;
  label: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  isLocked: boolean;
  promotionExecuted: boolean;
  snapshotCreated: boolean;
  status: AcademicYearStatus;
  createdAt: string | null;
  updatedAt: string | null;
};

const serializeYear = (row: {
  _id?: { toString(): string };
  name?: string;
  label?: string;
  startDate?: Date;
  endDate?: Date;
  isCurrent?: boolean;
  isLocked?: boolean;
  promotionExecuted?: boolean;
  snapshotCreated?: boolean;
  status?: string;
  createdAt?: Date;
  updatedAt?: Date;
}): AcademicYearRow => ({
  id: String(row._id),
  name: String(row.name || ""),
  label: String(row.label || ""),
  startDate: row.startDate ? new Date(row.startDate).toISOString() : "",
  endDate: row.endDate ? new Date(row.endDate).toISOString() : "",
  isCurrent: row.isCurrent === true,
  isLocked: row.isLocked === true,
  promotionExecuted: row.promotionExecuted === true,
  snapshotCreated: row.snapshotCreated === true,
  status: String(row.status || "draft") as AcademicYearStatus,
  createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
  updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
});

const normalizeLabel = (name: string): string => name.replace(/-/g, "/");

export const listAcademicYears = async (): Promise<AcademicYearRow[]> => {
  await connectDB();
  const rows = await AcademicYear.find().sort({ startDate: -1 }).lean();
  return rows.map((row) => serializeYear(row));
};

export const getAcademicYearById = async (id: string): Promise<AcademicYearRow | null> => {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const row = await AcademicYear.findById(id).lean();
  return row ? serializeYear(row) : null;
};

const auditYearChange = async (input: {
  actionType: string;
  entityId: string;
  entityTitle: string;
  descriptionAr: string;
  actor: AuditActor;
  request?: NextRequest;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}) => {
  await logAuditEvent({
    actionType: input.actionType,
    entityType: "AcademicYear",
    entityId: input.entityId,
    entityTitle: input.entityTitle,
    descriptionAr: input.descriptionAr,
    actor: input.actor,
    request: input.request,
    before: input.before,
    after: input.after,
    outcome: "success",
  });
};

export const createAcademicYear = async (input: {
  name: string;
  label?: string;
  startDate: Date;
  endDate: Date;
  actor: AuditActor;
  request?: NextRequest;
}) => {
  await connectDB();
  const name = String(input.name || "").trim();
  if (!name) throw new Error("Academic year name is required");
  if (input.endDate <= input.startDate) throw new Error("endDate must be after startDate");

  const session = await mongoose.startSession();
  let outcome: { year: AcademicYearRow; promotionSummary: StudentPromotionSummary } | null = null;

  try {
    await session.withTransaction(async () => {
      const [doc] = await AcademicYear.create(
        [
          {
            name,
            label: String(input.label || "").trim() || normalizeLabel(name),
            startDate: input.startDate,
            endDate: input.endDate,
            status: "draft",
            isCurrent: false,
            isLocked: false,
            promotionExecuted: false,
            snapshotCreated: false,
            createdBy: input.actor.id,
            updatedBy: input.actor.id,
          },
        ],
        { session }
      );

      // Advance active students to their next grade / mark Grade 12 as graduated.
      // Runs in the same transaction so a new academic year is never left half-promoted.
      const promotionSummary = await promoteStudentsForNewAcademicYear(session);

      doc.promotionExecuted = true;
      await doc.save({ session });

      outcome = { year: serializeYear(doc.toObject()), promotionSummary };
    });
  } finally {
    await session.endSession();
  }

  if (!outcome) throw new Error("Failed to create academic year");
  // Explicit intermediate binding works around a TS control-flow-narrowing quirk where
  // destructuring straight off a `let` reassigned inside a withTransaction() closure
  // resolves to `never` instead of the declared type.
  const safeOutcome: { year: AcademicYearRow; promotionSummary: StudentPromotionSummary } = outcome;
  const { year, promotionSummary } = safeOutcome;

  await auditYearChange({
    actionType: "academic_year_created",
    entityId: year.id,
    entityTitle: year.label,
    descriptionAr: `تم إنشاء عام دراسي: ${year.label}`,
    actor: input.actor,
    request: input.request,
    after: { ...year, promotionSummary },
  });

  return year;
};

export const updateAcademicYear = async (input: {
  id: string;
  patch: Partial<{ name: string; label: string; startDate: Date; endDate: Date; status: AcademicYearStatus }>;
  actor: AuditActor;
  request?: NextRequest;
}) => {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(input.id)) throw new Error("Invalid academic year id");

  const doc = await AcademicYear.findById(input.id);
  if (!doc) throw new Error("Academic year not found");
  if (doc.isLocked) throw new Error("Academic year is locked");

  const before = serializeYear(doc.toObject());

  if (input.patch.name != null) doc.name = String(input.patch.name).trim();
  if (input.patch.label != null) doc.label = String(input.patch.label).trim();
  if (input.patch.startDate) doc.startDate = input.patch.startDate;
  if (input.patch.endDate) doc.endDate = input.patch.endDate;
  if (input.patch.status) doc.status = input.patch.status;
  if (doc.endDate <= doc.startDate) throw new Error("endDate must be after startDate");

  doc.updatedBy = input.actor.id;
  await doc.save();

  const after = serializeYear(doc.toObject());
  await auditYearChange({
    actionType: "academic_year_updated",
    entityId: String(doc._id),
    entityTitle: doc.label,
    descriptionAr: `تم تحديث عام دراسي: ${doc.label}`,
    actor: input.actor,
    request: input.request,
    before,
    after,
  });

  return after;
};

export const setAcademicYearAsCurrent = async (input: {
  id: string;
  actor: AuditActor;
  request?: NextRequest;
}) => {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(input.id)) throw new Error("Invalid academic year id");

  const session = await mongoose.startSession();
  let result: AcademicYearRow | null = null;

  try {
    await session.withTransaction(async () => {
      const target = await AcademicYear.findById(input.id).session(session);
      if (!target) throw new Error("Academic year not found");
      if (target.isLocked) throw new Error("Cannot set a locked academic year as current");

      const beforeCurrent = await AcademicYear.find({ isCurrent: true }).session(session).lean();

      await AcademicYear.updateMany(
        { _id: { $ne: target._id } },
        { $set: { isCurrent: false } },
        { session }
      );

      target.isCurrent = true;
      target.status = "active";
      target.updatedBy = input.actor.id;
      await target.save({ session });

      result = serializeYear(target.toObject());

      await auditYearChange({
        actionType: "academic_year_set_current",
        entityId: String(target._id),
        entityTitle: target.label,
        descriptionAr: `تم تعيين العام الدراسي الحالي: ${target.label}`,
        actor: input.actor,
        request: input.request,
        before: { previousCurrent: beforeCurrent.map((row) => String(row._id)) },
        after: result,
      });
    });
  } finally {
    await session.endSession();
  }

  if (!result) throw new Error("Failed to set current academic year");
  return result;
};

export const lockAcademicYear = async (input: {
  id: string;
  actor: AuditActor;
  request?: NextRequest;
}) => {
  await connectDB();
  const doc = await AcademicYear.findById(input.id);
  if (!doc) throw new Error("Academic year not found");

  const before = serializeYear(doc.toObject());
  doc.isLocked = true;
  doc.status = "locked";
  doc.updatedBy = input.actor.id;
  await doc.save();

  const after = serializeYear(doc.toObject());
  await auditYearChange({
    actionType: "academic_year_locked",
    entityId: String(doc._id),
    entityTitle: doc.label,
    descriptionAr: `تم قفل العام الدراسي: ${doc.label}`,
    actor: input.actor,
    request: input.request,
    before,
    after,
  });

  return after;
};

export const unlockAcademicYear = async (input: {
  id: string;
  actor: AuditActor;
  request?: NextRequest;
}) => {
  await connectDB();
  const doc = await AcademicYear.findById(input.id);
  if (!doc) throw new Error("Academic year not found");

  const before = serializeYear(doc.toObject());
  doc.isLocked = false;
  doc.status = doc.isCurrent ? "active" : "draft";
  doc.updatedBy = input.actor.id;
  await doc.save();

  const after = serializeYear(doc.toObject());
  await auditYearChange({
    actionType: "academic_year_unlocked",
    entityId: String(doc._id),
    entityTitle: doc.label,
    descriptionAr: `تم إعادة فتح العام الدراسي: ${doc.label}`,
    actor: input.actor,
    request: input.request,
    before,
    after,
  });

  return after;
};

export const deleteAcademicYear = async (input: {
  id: string;
  actor: AuditActor;
  request?: NextRequest;
}) => {
  await connectDB();
  const doc = await AcademicYear.findById(input.id);
  if (!doc) throw new Error("Academic year not found");
  if (doc.isLocked) throw new Error("Cannot delete a locked academic year");
  if (doc.isCurrent) throw new Error("Cannot delete the current academic year");

  const before = serializeYear(doc.toObject());
  await AcademicYear.deleteOne({ _id: doc._id });

  await auditYearChange({
    actionType: "academic_year_deleted",
    entityId: String(doc._id),
    entityTitle: doc.label,
    descriptionAr: `تم حذف عام دراسي: ${doc.label}`,
    actor: input.actor,
    request: input.request,
    before,
  });
};

export const archiveAcademicYear = async (input: {
  id: string;
  actor: AuditActor;
  request?: NextRequest;
}) => {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(input.id)) throw new Error("Invalid academic year id");

  const doc = await AcademicYear.findById(input.id);
  if (!doc) throw new Error("Academic year not found");
  if (doc.isCurrent) throw new Error("Cannot archive the current academic year");

  const before = serializeYear(doc.toObject());
  doc.status = "archived";
  doc.isCurrent = false;
  doc.updatedBy = input.actor.id;
  await doc.save();

  const after = serializeYear(doc.toObject());
  await auditYearChange({
    actionType: "academic_year_archived",
    entityId: String(doc._id),
    entityTitle: doc.label,
    descriptionAr: `تم أرشفة العام الدراسي: ${doc.label}`,
    actor: input.actor,
    request: input.request,
    before,
    after,
  });

  return after;
};

export type AcademicYearDashboardSummary = {
  current: AcademicYearRow | null;
  total: number;
  activeCount: number;
  archivedCount: number;
};

export const summarizeAcademicYears = async (): Promise<AcademicYearDashboardSummary> => {
  const items = await listAcademicYears();
  return {
    current: items.find((row) => row.isCurrent) || null,
    total: items.length,
    activeCount: items.filter((row) => row.status === "active").length,
    archivedCount: items.filter((row) => row.status === "archived").length,
  };
};
