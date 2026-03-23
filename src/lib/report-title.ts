type Params = {
  academicYear?: string;
  gender?: string;
  stage?: string;
  gradeLabel?: string;
  eventLabel?: string;
};

export const getAchievementReportTitle = (params: Params, isAr: boolean): string => {
  const year = params.academicYear || (isAr ? "2025-2026م" : "2025-2026");
  const parts: string[] = [];

  if (params.gender === "male") parts.push(isAr ? "إنجازات الطلاب" : "Boys achievements");
  else if (params.gender === "female") parts.push(isAr ? "إنجازات الطالبات" : "Girls achievements");
  else parts.push(isAr ? "إنجازات الطلبة" : "Students achievements");

  if (params.stage) parts.push(params.stage);
  if (params.gradeLabel) parts.push(params.gradeLabel);
  if (params.eventLabel) parts.push(params.eventLabel);

  if (isAr) return `${parts.join(" - ")} خلال العام الدراسي ${year}`;
  return `${parts.join(" - ")} during academic year ${year}`;
};
