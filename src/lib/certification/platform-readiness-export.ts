import type { PlatformCertificationPayload } from "@/lib/certification/platform-certification-types";

const escapeHtml = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const buildPlatformReadinessReportHtml = (
  payload: PlatformCertificationPayload,
  locale: "ar" | "en"
): string => {
  const isAr = locale === "ar";
  const dir = isAr ? "rtl" : "ltr";
  const title = isAr ? "تقرير جاهزية المنصة المؤسسية" : "Platform Readiness Report";

  const breakdownRows = payload.readinessBreakdown
    .map(
      (row) =>
        `<tr><td>${escapeHtml(isAr ? row.labelAr : row.labelEn)}</td><td>${row.score}</td><td>${row.weight}%</td></tr>`
    )
    .join("");

  const subsystemRows = payload.subsystemHealth
    .map(
      (s) =>
        `<tr><td>${escapeHtml(isAr ? s.labelAr : s.labelEn)}</td><td>${s.ok ? (isAr ? "سليم" : "OK") : isAr ? "تحذير" : "Warning"}</td><td>${escapeHtml(isAr ? s.detailAr : s.detailEn)}</td></tr>`
    )
    .join("");

  const issueRows = [...payload.dataQuality.issues, ...payload.crossSystemIntegrity.issues]
    .slice(0, 30)
    .map(
      (issue) =>
        `<tr><td>${escapeHtml(issue.code)}</td><td>${issue.severity}</td><td>${escapeHtml(isAr ? issue.messageAr : issue.messageEn)}</td></tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html dir="${dir}" lang="${locale}">
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 28px; color: #0f172a; }
    h1 { font-size: 22px; margin-bottom: 8px; }
    .score { font-size: 42px; font-weight: 900; color: #047857; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
    th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: ${isAr ? "right" : "left"}; }
    th { background: #f1f5f9; }
    .meta { color: #64748b; font-size: 12px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p class="meta">${escapeHtml(payload.generatedAt)} · ${isAr ? "قراءة فقط" : "Read-only"}</p>
  <p class="score">${payload.readinessScore}/100</p>
  <p><strong>${isAr ? "التصنيف" : "Grade"}:</strong> ${payload.readinessGrade}</p>

  <h2>${isAr ? "تفصيل الجاهزية" : "Readiness breakdown"}</h2>
  <table><thead><tr><th>${isAr ? "المجال" : "Area"}</th><th>${isAr ? "الدرجة" : "Score"}</th><th>${isAr ? "الوزن" : "Weight"}</th></tr></thead><tbody>${breakdownRows}</tbody></table>

  <h2>${isAr ? "صحة الأنظمة" : "Subsystem health"}</h2>
  <table><thead><tr><th>${isAr ? "النظام" : "System"}</th><th>${isAr ? "الحالة" : "Status"}</th><th>${isAr ? "التفاصيل" : "Details"}</th></tr></thead><tbody>${subsystemRows}</tbody></table>

  <h2>${isAr ? "مشاكل البيانات والسلامة" : "Data & integrity issues"}</h2>
  <table><thead><tr><th>${isAr ? "الرمز" : "Code"}</th><th>${isAr ? "الخطورة" : "Severity"}</th><th>${isAr ? "الوصف" : "Description"}</th></tr></thead><tbody>${issueRows || `<tr><td colspan="3">${isAr ? "لا مشاكل في العينة" : "No issues in sample"}</td></tr>`}</tbody></table>

  <h2>${isAr ? "اعتماد التصدير" : "Export certification"}</h2>
  <p>${payload.exportCertification.passed}/${payload.exportCertification.tests.length} ${isAr ? "نجح" : "passed"}</p>

  <h2>${isAr ? "المراقبة" : "Observability"}</h2>
  <ul>
    <li>${isAr ? "مسارات بطيئة" : "Slow routes"}: ${payload.observability.slowRouteCount}</li>
    <li>${isAr ? "فشل تدقيق حديث" : "Recent audit failures"}: ${payload.observability.recentAuditFailures}</li>
    <li>${isAr ? "انتهاكات السلامة" : "Integrity violations"}: ${payload.observability.integrityViolationCount}</li>
  </ul>
</body>
</html>`;
};
