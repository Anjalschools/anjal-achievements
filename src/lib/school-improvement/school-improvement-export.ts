import type {
  SchoolImprovementPayload,
  SchoolImprovementReportKind,
} from "@/lib/school-improvement/school-improvement-types";

const escapeHtml = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const REPORT_TITLES: Record<SchoolImprovementReportKind, { ar: string; en: string }> = {
  board: { ar: "تقرير تخطيط مجلس الإدارة", en: "Board Planning Report" },
  leadership: { ar: "تقرير القيادة المدرسية", en: "School Leadership Report" },
  school_planning: { ar: "تقرير التخطيط المدرسي", en: "School Planning Report" },
};

export const buildSchoolImprovementReportHtml = (
  payload: SchoolImprovementPayload,
  kind: SchoolImprovementReportKind,
  locale: "ar" | "en"
): string => {
  const isAr = locale === "ar";
  const dir = isAr ? "rtl" : "ltr";
  const title = isAr ? REPORT_TITLES[kind].ar : REPORT_TITLES[kind].en;

  const actionRows = payload.actionEngine
    .filter((a) => kind !== "board" || a.priority === "high")
    .slice(0, kind === "school_planning" ? 25 : 15)
    .map(
      (a) =>
        `<tr><td>${escapeHtml(isAr ? a.recommendationAr : a.recommendationEn)}</td><td>${a.priority}</td><td>${escapeHtml(isAr ? a.ownerLabelAr : a.ownerLabelEn)}</td><td>${escapeHtml(isAr ? a.timeline : a.timelineEn)}</td></tr>`
    )
    .join("");

  const planRows = payload.improvementPlans
    .map(
      (p) =>
        `<tr><td>${escapeHtml(isAr ? p.titleAr : p.titleEn)}</td><td>${p.priority}</td><td>${p.actions.length}</td></tr>`
    )
    .join("");

  const roadmapSection = payload.strategicRoadmap
    .filter((r) => (kind === "board" ? r.horizon === "annual" : r.horizon === "quarterly"))
    .slice(0, 4)
    .map(
      (r) =>
        `<h3>${escapeHtml(isAr ? r.periodLabelAr : r.periodLabelEn)}</h3><ul>${r.actions
          .map((a) => `<li>${escapeHtml(isAr ? a.titleAr : a.titleEn)} (${a.priority})</li>`)
          .join("")}</ul>`
    )
    .join("");

  const scenarioRows = payload.predictiveScenarios
    .map(
      (s) =>
        `<tr><td>${escapeHtml(isAr ? s.scenarioAr : s.scenarioEn)}</td><td>${s.currentValue}</td><td>${s.projectedValue}</td><td>${s.confidence}</td></tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html dir="${dir}" lang="${locale}">
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 28px; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
    th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: ${isAr ? "right" : "left"}; }
    th { background: #f1f5f9; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(payload.generatedAt)} · ${isAr ? "قراءة فقط — بلا تنفيذ تلقائي" : "Read-only — no auto-execution"}</p>
  <p><strong>${isAr ? "إجراءات مقترحة" : "Proposed actions"}:</strong> ${payload.summary.totalActions} · <strong>${isAr ? "عالية الأولوية" : "High priority"}:</strong> ${payload.summary.highPriority}</p>

  <h2>${isAr ? "محرك الإجراءات" : "Action engine"}</h2>
  <table><thead><tr><th>${isAr ? "التوصية" : "Recommendation"}</th><th>${isAr ? "الأولوية" : "Priority"}</th><th>${isAr ? "المسؤول" : "Owner"}</th><th>${isAr ? "المدة" : "Timeline"}</th></tr></thead><tbody>${actionRows}</tbody></table>

  <h2>${isAr ? "خطط التحسين" : "Improvement plans"}</h2>
  <table><thead><tr><th>${isAr ? "الخطة" : "Plan"}</th><th>${isAr ? "الأولوية" : "Priority"}</th><th>${isAr ? "إجراءات" : "Actions"}</th></tr></thead><tbody>${planRows}</tbody></table>

  <h2>${isAr ? "خارطة الطريق" : "Strategic roadmap"}</h2>
  ${roadmapSection}

  <h2>${isAr ? "محاكاة التحسين" : "Predictive scenarios"}</h2>
  <table><thead><tr><th>${isAr ? "السيناريو" : "Scenario"}</th><th>${isAr ? "الحالي" : "Current"}</th><th>${isAr ? "المتوقع" : "Projected"}</th><th>${isAr ? "الثقة" : "Confidence"}</th></tr></thead><tbody>${scenarioRows}</tbody></table>
</body>
</html>`;
};
