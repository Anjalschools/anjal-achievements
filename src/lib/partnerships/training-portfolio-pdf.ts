import "server-only";
import type { TrainingPortfolioPayload } from "@/lib/partnerships/training-portfolio-service";
import { OUTCOME_LEVEL_LABELS } from "@/lib/partnerships/training-outcome-constants";
import type { TrainingOutcomeLevel } from "@/lib/partnerships/training-outcome-constants";

export const buildTrainingPortfolioPdfHtml = (
  payload: TrainingPortfolioPayload,
  locale: "ar" | "en"
): string => {
  const isAr = locale === "ar";
  const dir = isAr ? "rtl" : "ltr";
  const title = isAr ? "ملف التدريب المهني" : "Professional Training Portfolio";
  const levelLabel = (level: TrainingOutcomeLevel) =>
    isAr ? OUTCOME_LEVEL_LABELS[level].ar : OUTCOME_LEVEL_LABELS[level].en;

  const timelineRows = payload.timeline
    .map(
      (row) => `
      <tr>
        <td>${row.institutionName}</td>
        <td>${row.academicYearLabel}</td>
        <td>${row.trainingHours}</td>
        <td>${row.employabilityScore}</td>
        <td>${levelLabel(row.outcomeLevel)}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="${isAr ? "ar" : "en"}" dir="${dir}">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 32px; color: #111; }
    h1 { font-size: 22px; margin-bottom: 4px; }
    .muted { color: #666; font-size: 13px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 20px 0; }
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 12px; }
    .card strong { display: block; font-size: 20px; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: ${isAr ? "right" : "left"}; }
    th { background: #f5f5f5; }
    h2 { font-size: 16px; margin-top: 28px; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p class="muted">${payload.studentName}</p>

  <div class="grid">
    <div class="card"><span>${isAr ? "عدد التدريبات" : "Trainings"}</span><strong>${payload.summary.trainingCount}</strong></div>
    <div class="card"><span>${isAr ? "إجمالي الساعات" : "Total hours"}</span><strong>${payload.summary.totalHours}</strong></div>
    <div class="card"><span>${isAr ? "متوسط الجاهزية للتوظيف" : "Avg employability"}</span><strong>${payload.summary.avgEmployabilityScore}</strong></div>
    <div class="card"><span>${isAr ? "توصيات التوظيف" : "Employment recs"}</span><strong>${payload.summary.employmentRecommendations}</strong></div>
  </div>

  <h2>${isAr ? "الجدول الزمني" : "Training timeline"}</h2>
  <table>
    <thead>
      <tr>
        <th>${isAr ? "المؤسسة" : "Institution"}</th>
        <th>${isAr ? "العام الدراسي" : "Academic year"}</th>
        <th>${isAr ? "الساعات" : "Hours"}</th>
        <th>${isAr ? "الجاهزية" : "Employability"}</th>
        <th>${isAr ? "المستوى" : "Outcome"}</th>
      </tr>
    </thead>
    <tbody>${timelineRows || `<tr><td colspan="5">${isAr ? "لا سجلات" : "No records"}</td></tr>`}</tbody>
  </table>

  <h2>${isAr ? "الشهادات" : "Certificates"}</h2>
  <ul>
    ${payload.certificates.map((c) => `<li>${c.title} — ${c.organizationName} (${c.hours}h)</li>`).join("") || `<li>${isAr ? "لا شهادات" : "No certificates"}</li>`}
  </ul>

  <p class="muted" style="margin-top:40px">${isAr ? "تقرير للقراءة فقط — منصة الأنجال" : "Read-only report — Al-Anjal Platform"}</p>
</body>
</html>`;
};
