import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import { applyAcademicYearCreateFields } from "@/lib/academic-years/academic-year-integration";
import VolunteerRecord from "@/models/VolunteerRecord";

export const listVolunteerRecords = async (studentId: string) => {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(studentId)) return [];
  const rows = await VolunteerRecord.find({ studentId }).sort({ createdAt: -1 }).limit(50).lean();
  return rows.map((row) => ({
    id: String(row._id),
    title: row.title,
    organization: row.organization,
    description: row.description || "",
    hours: Number(row.hours || 0),
    status: row.status,
    academicYear: row.academicYear,
    startDate: row.startDate ? new Date(row.startDate).toISOString().slice(0, 10) : null,
    endDate: row.endDate ? new Date(row.endDate).toISOString().slice(0, 10) : null,
    createdAt: row.createdAt?.toISOString() || null,
  }));
};

export const createVolunteerRecord = async (
  studentId: string,
  input: {
    title: string;
    organization: string;
    description?: string;
    hours: number;
    startDate?: string;
    endDate?: string;
    submit?: boolean;
  }
) => {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(studentId)) throw new Error("Invalid student id");
  const title = String(input.title || "").trim();
  const organization = String(input.organization || "").trim();
  if (!title || !organization) throw new Error("Title and organization are required");
  const hours = Math.max(0, Number(input.hours) || 0);

  const payload: {
    studentId: string;
    title: string;
    organization: string;
    description?: string;
    hours: number;
    startDate?: Date;
    endDate?: Date;
    academicYear: string;
    academicYearId?: mongoose.Types.ObjectId;
    academicYearLabel?: string;
    status: "draft" | "submitted";
  } = {
    studentId,
    title,
    organization,
    description: String(input.description || "").trim() || undefined,
    hours,
    startDate: input.startDate ? new Date(input.startDate) : undefined,
    endDate: input.endDate ? new Date(input.endDate) : undefined,
    academicYear: "unknown",
    status: input.submit ? "submitted" : "draft",
  };

  try {
    await applyAcademicYearCreateFields(payload);
  } catch {
    /* backward compatible when no current academic year configured */
  }

  const row = await VolunteerRecord.create(payload);

  return {
    id: String(row._id),
    title: row.title,
    organization: row.organization,
    hours: row.hours,
    status: row.status,
    academicYear: row.academicYear,
  };
};

export const updateVolunteerRecord = async (
  studentId: string,
  recordId: string,
  input: Partial<{
    title: string;
    organization: string;
    description: string;
    hours: number;
    startDate: string;
    endDate: string;
    submit: boolean;
  }>
) => {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(studentId) || !mongoose.Types.ObjectId.isValid(recordId)) {
    throw new Error("Invalid id");
  }
  const row = await VolunteerRecord.findOne({ _id: recordId, studentId });
  if (!row) throw new Error("Record not found");
  if (row.status === "approved") throw new Error("Approved records cannot be edited");

  if (input.title != null) row.title = String(input.title).trim();
  if (input.organization != null) row.organization = String(input.organization).trim();
  if (input.description != null) row.description = String(input.description).trim();
  if (input.hours != null) row.hours = Math.max(0, Number(input.hours) || 0);
  if (input.startDate) row.startDate = new Date(input.startDate);
  if (input.endDate) row.endDate = new Date(input.endDate);
  if (input.submit) row.status = "submitted";

  await row.save();
  return { id: String(row._id), status: row.status };
};

export const deleteVolunteerRecord = async (studentId: string, recordId: string) => {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(studentId) || !mongoose.Types.ObjectId.isValid(recordId)) {
    throw new Error("Invalid id");
  }
  const row = await VolunteerRecord.findOne({ _id: recordId, studentId });
  if (!row) throw new Error("Record not found");
  if (row.status === "approved") throw new Error("Approved records cannot be deleted");
  await row.deleteOne();
  return { ok: true };
};
