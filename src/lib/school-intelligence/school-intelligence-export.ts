import type {
  SchoolIntelligencePayload,
  SchoolIntelligenceReportKind,
} from "@/lib/school-intelligence/school-intelligence-types";

const escapeHtml = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const REPORT_TITLES: Record<SchoolIntelligenceReportKind, { ar: string; en: string }> = {
  school: { ar: "تقرير الذكاء المدرسي", en: "School Intelligence Report" },
  board: { ar: "تقرير ذكاء مجلس الإدارة", en: "Board Intelligence Report" },
  strategic_planning: { ar: "تقرير التخطيط الاستراتيجي", en: "Strategic Planning Report" },
};

export const buildSchoolIntelligenceReportHtml = (
  payload: SchoolIntelligencePayload,
  kind: SchoolIntelligenceReportKind,
  locale: "ar" | "en"
): string => {
  const isAr = locale === "ar";
  const dir = isAr ? "rtl" : "ltr";
  const title = isAr ? REPORT_TITLES[kind].ar : REPORT_TITLES[kind].en;

  const deptRows = payload.departmentExcellence
    .map(
      (r) =>
        `<tr><td>${escapeHtml(isAr ? r.labelAr : r.labelEn)}</td><td>${r.excellenceIndex}</td><td>${r.studentCount}</td><td>${escapeHtml(r.evidence)}</td></tr>`
    )
    .join("");

  const studentRows = payload.studentSuccessGraph.topStudents
    .slice(0, 15)
    .map(
      (s) =>
        `<tr><td>${escapeHtml(s.fullNameAr || s.fullNameEn)}</td><td>${s.grade}</td><td>${s.successIndex}</td><td>${escapeHtml(s.evidence)}</td></tr>`
    )
    .join("");

  const insightList = payload.strategicInsights
    .map(
      (ins) =>
        `<li><strong>${escapeHtml(isAr ? ins.titleAr : ins.titleEn)}</strong><br/>${escapeHtml(isAr ? ins.bodyAr : ins.bodyEn)}</li>`
    )
    .join("");

  const growthRows = payload.longitudinalGrowth
    .map(
      (g) =>
        `<tr><td>${g.year}</td><td>${g.participations}</td><td>${g.growthRatePct}%</td><td>${g.avgSuccessIndex}</td></tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html dir="${dir}" lang="${locale}">
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 28px; color: #0f172a; }
    h1 { font-size: 22px; }
    .kpi { font-size: 36px; font-weight: 900; color: #047857; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
    th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: ${isAr ? "right" : "left"}; }
    th { background: #f1f5f9; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(payload.generatedAt)}</p>
  <p class="kpi">${payload.schoolExcellence.excellenceIndex}/100</p>
  <p>${isAr ? "مؤشر تميز المدرسة" : "School Excellence Index"}</p>
  <ul>
    <li>${isAr ? "مؤشر نجاح الطلاب" : "Avg student success"}: ${payload.studentSuccessGraph.avgSuccessIndex}</li>
    <li>${isAr ? "معدل المشاركة" : "Participation rate"}: ${payload.schoolExcellence.participationRatePct}%</li>
    <li>${isAr ? "المواهب المكتشفة" : "Talents discovered"}: ${payload.talentDiscovery.length}</li>
    <li>${isAr ? "تدخلات مطلوبة" : "Interventions"}: ${payload.interventions.length}</li>
  </ul>

  <h2>${isAr ? "تميز الأقسام والمسارات" : "Department & track excellence"}</h2>
  <table><thead><tr><th>${isAr ? "الشريحة" : "Cohort"}</th><th>${isAr ? "المؤشر" : "Index"}</th><th>${isAr ? "الطلاب" : "Students"}</th><th>${isAr ? "الأدلة" : "Evidence"}</th></tr></thead><tbody>${deptRows}</tbody></table>

  <h2>${isAr ? "أعلى الطلاب" : "Top students"}</h2>
  <table><thead><tr><th>${isAr ? "الطالب" : "Student"}</th><th>${isAr ? "الصف" : "Grade"}</th><th>SSI</th><th>${isAr ? "الأدلة" : "Evidence"}</th></tr></thead><tbody>${studentRows}</tbody></table>

  <h2>${isAr ? "النمو الطولي" : "Longitudinal growth"}</h2>
  <table><thead><tr><th>${isAr ? "السنة" : "Year"}</th><th>${isAr ? "المشاركات" : "Participations"}</th><th>${isAr ? "النمو" : "Growth"}</th><th>SSI</th></tr></thead><tbody>${growthRows}</tbody></table>

  <h2>${isAr ? "رؤى استراتيجية" : "Strategic insights"}</h2>
  <ul>${insightList}</ul>
</body>
</html>`;
};
