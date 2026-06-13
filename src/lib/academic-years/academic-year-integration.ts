import mongoose from "mongoose";
import { requireCurrentAcademicYear } from "@/lib/academic-years/current-academic-year";

export type AcademicYearCreateFields = {
  academicYearId: mongoose.Types.ObjectId;
  academicYear: string;
  academicYearLabel: string;
};

export const buildAcademicYearCreateFields = async (): Promise<AcademicYearCreateFields> => {
  const current = await requireCurrentAcademicYear();
  if (!mongoose.Types.ObjectId.isValid(current.id)) {
    throw new Error("Current academic year id is invalid");
  }
  return {
    academicYearId: new mongoose.Types.ObjectId(current.id),
    academicYear: current.name,
    academicYearLabel: current.label,
  };
};

export const applyAcademicYearCreateFields = async <
  T extends {
    academicYear?: string;
    academicYearId?: mongoose.Types.ObjectId;
    academicYearLabel?: string;
  },
>(
  target: T
): Promise<T> => {
  const fields = await buildAcademicYearCreateFields();
  target.academicYear = fields.academicYear;
  target.academicYearId = fields.academicYearId;
  target.academicYearLabel = fields.academicYearLabel;
  return target;
};
