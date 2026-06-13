import connectDB from "@/lib/mongodb";
import AcademicYear, { type IAcademicYear } from "@/models/AcademicYear";

export type CurrentAcademicYear = {
  id: string;
  name: string;
  label: string;
  startDate: string;
  endDate: string;
  isLocked: boolean;
  status: string;
};

const toCurrentAcademicYear = (row: IAcademicYear | Record<string, unknown>): CurrentAcademicYear => ({
  id: String((row as { _id?: { toString(): string } })._id),
  name: String((row as { name?: string }).name || ""),
  label: String((row as { label?: string }).label || ""),
  startDate: new Date((row as { startDate: Date }).startDate).toISOString(),
  endDate: new Date((row as { endDate: Date }).endDate).toISOString(),
  isLocked: (row as { isLocked?: boolean }).isLocked === true,
  status: String((row as { status?: string }).status || "draft"),
});

export const getCurrentAcademicYear = async (): Promise<CurrentAcademicYear | null> => {
  await connectDB();
  const row = await AcademicYear.findOne({ isCurrent: true }).lean();
  if (!row) return null;
  return toCurrentAcademicYear(row);
};

export const requireCurrentAcademicYear = async (): Promise<CurrentAcademicYear> => {
  const row = await getCurrentAcademicYear();
  if (!row) {
    throw new Error("No current academic year is configured. Set one in /admin/academic-years.");
  }
  return row;
};

export const getCurrentAcademicYearLabel = async (): Promise<string | null> => {
  const row = await getCurrentAcademicYear();
  return row?.label || null;
};

export const getCurrentAcademicYearId = async (): Promise<string | null> => {
  const row = await getCurrentAcademicYear();
  return row?.id || null;
};
