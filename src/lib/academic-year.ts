/**
 * Saudi-style academic year label: Aug (month 8) → Jul divides years.
 * Month >= 8 → Y / (Y+1); month < 8 → (Y-1) / Y.
 */

export const academicYearStartFromDate = (d: Date): number => {
  const y = d.getFullYear();
  const m = d.getMonth() + 1; // 1–12
  return m >= 8 ? y : y - 1;
};

export const formatAcademicYearLabel = (startYear: number): string =>
  `${startYear}/${startYear + 1}`;

export const academicYearLabelFromDate = (d: Date): string =>
  formatAcademicYearLabel(academicYearStartFromDate(d));
