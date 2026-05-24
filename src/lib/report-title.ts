type Params = {
  academicYear?: string;
  gender?: string;
  genderLabels?: string;
  stage?: string;
  stageLabels?: string;
  gradeLabel?: string;
  gradeLabels?: string;
  eventLabel?: string;
  eventLabels?: string;
  activityYearLabel?: string;
  activityYearLabels?: string;
  resultLabels?: string;
  levelLabels?: string;
};

export const getAchievementReportTitle = (params: Params, isAr: boolean): string => {
  const year = params.academicYear || (isAr ? "2025-2026م" : "2025-2026");
  const parts: string[] = [];

  const genderText = params.genderLabels?.trim();
  if (genderText) {
    parts.push(genderText);
  } else if (params.gender === "male") {
    parts.push(isAr ? "إنجازات الطلاب" : "Boys achievements");
  } else if (params.gender === "female") {
    parts.push(isAr ? "إنجازات الطالبات" : "Girls achievements");
  } else {
    parts.push(isAr ? "إنجازات الطلبة" : "Students achievements");
  }

  if (params.stageLabels?.trim()) parts.push(params.stageLabels.trim());
  else if (params.stage) parts.push(params.stage);

  if (params.gradeLabels?.trim()) parts.push(params.gradeLabels.trim());
  else if (params.gradeLabel) parts.push(params.gradeLabel);

  if (params.eventLabels?.trim()) parts.push(params.eventLabels.trim());
  else if (params.eventLabel) parts.push(params.eventLabel);

  if (params.levelLabels?.trim()) parts.push(params.levelLabels.trim());
  if (params.resultLabels?.trim()) parts.push(params.resultLabels.trim());

  const activityYears = params.activityYearLabels?.trim() || params.activityYearLabel?.trim();
  if (activityYears) {
    parts.push(isAr ? `سنة النشاط ${activityYears}` : `Activity year ${activityYears}`);
  }

  if (isAr) return `${parts.join(" - ")} خلال العام الدراسي ${year}`;
  return `${parts.join(" - ")} during academic year ${year}`;
};
