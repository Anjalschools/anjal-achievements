import { getCurrentAcademicYearLabel } from "@/lib/academic-years/current-academic-year";

export type AcademicYearRecordLike = {
  academicYear?: string | null;
  academicYearLabel?: string | null;
  academicYearId?: string | { toString(): string } | null;
};

const isMissingAcademicYear = (value: string | undefined | null): boolean => {
  const trimmed = String(value || "").trim();
  return !trimmed || trimmed.toLowerCase() === "unknown";
};

export const resolveAcademicYearLabel = async (record: AcademicYearRecordLike): Promise<string> => {
  const storedLabel = String(record.academicYearLabel || "").trim();
  if (!isMissingAcademicYear(storedLabel)) return storedLabel;

  const storedYear = String(record.academicYear || "").trim();
  if (!isMissingAcademicYear(storedYear)) return storedYear;

  const current = await getCurrentAcademicYearLabel();
  return current || "—";
};

export const resolveAcademicYear = async (
  record: AcademicYearRecordLike
): Promise<{ id: string | null; name: string; label: string }> => {
  const label = await resolveAcademicYearLabel(record);
  const name = !isMissingAcademicYear(record.academicYear) ? String(record.academicYear).trim() : label;
  const id = record.academicYearId
    ? typeof record.academicYearId === "string"
      ? record.academicYearId
      : record.academicYearId.toString()
    : null;

  return { id, name, label };
};

/** Display-only fallback for legacy rows missing academic year fields. */
export const resolveAcademicYearForLegacyRecord = async (
  record: AcademicYearRecordLike
): Promise<string> => resolveAcademicYearLabel(record);
