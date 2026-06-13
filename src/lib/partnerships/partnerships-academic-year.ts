import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import {
  getCurrentAcademicYear,
  requireCurrentAcademicYear,
  type CurrentAcademicYear,
} from "@/lib/academic-years/current-academic-year";
import { resolveAcademicYearForLegacyRecord } from "@/lib/academic-years/academic-year-display";
import { applyAcademicYearCreateFields } from "@/lib/academic-years/academic-year-integration";

export type ResolvedAcademicYear = {
  id: string | null;
  name: string;
  label: string;
};

const mapCurrent = (row: CurrentAcademicYear): ResolvedAcademicYear => ({
  id: row.id,
  name: row.name,
  label: row.label,
});

/** @deprecated Prefer getCurrentAcademicYear from academic-years/current-academic-year.ts */
export const resolveCurrentAcademicYear = async (): Promise<ResolvedAcademicYear> => {
  const current = await getCurrentAcademicYear();
  if (current) return mapCurrent(current);
  return { id: null, name: "—", label: "—" };
};

export const resolveApplicationAcademicYearDisplay = async (application: {
  academicYear?: string;
  academicYearLabel?: string;
}): Promise<string> => resolveAcademicYearForLegacyRecord(application);

export const applyAcademicYearFields = async (
  target: {
    academicYear: string;
    academicYearId?: mongoose.Types.ObjectId;
    academicYearLabel?: string;
  },
  resolved?: ResolvedAcademicYear
) => {
  if (resolved?.id) {
    target.academicYear = resolved.name;
    target.academicYearLabel = resolved.label;
    if (mongoose.Types.ObjectId.isValid(resolved.id)) {
      target.academicYearId = new mongoose.Types.ObjectId(resolved.id);
    }
    return;
  }

  await connectDB();
  try {
    await applyAcademicYearCreateFields(target);
  } catch {
    const current = await getCurrentAcademicYear();
    if (current) {
      target.academicYear = current.name;
      target.academicYearLabel = current.label;
      target.academicYearId = new mongoose.Types.ObjectId(current.id);
    }
  }
};

export { requireCurrentAcademicYear };
