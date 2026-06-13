import type { ExecutiveDecisionIntelligencePayload } from "@/lib/analytics/executive-decision-intelligence-service";

export type ExecutiveReportKind = "executive" | "board" | "school_improvement";

const escapeHtml = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const buildExecutiveIntelligenceReportHtml = (
  payload: ExecutiveDecisionIntelligencePayload,
  kind: ExecutiveReportKind,
  locale: "ar" | "en"
): string => {
  const isAr = locale === "ar";
  const dir = isAr ? "rtl" : "ltr";
  const titles: Record<ExecutiveReportKind, { ar: string; en: string }> = {
    executive: { ar: "تقرير القرار التنفيذي", en: "Executive Decision Report" },
    board: { ar: "تقرير مجلس الإدارة", en: "Board Report" },
    school_improvement: { ar: "تقرير تحسين المدرسة", en: "School Improvement Report" },
  };
  const title = isAr ? titles[kind].ar : titles[kind].en;

  const kpiRows = [
    [isAr ? "متوسط الجاهزية الجامعية" : "Avg university readiness", payload.careerSummary.averages.universityReadiness],
    [isAr ? "متوسط الجاهزية المهنية" : "Avg career readiness", payload.careerSummary.averages.careerReadiness],
    [isAr ? "الملفات المهنية" : "Career profiles", payload.careerSummary.totalProfiles],
    [isAr ? "مخاطر مكتشفة" : "Risks detected", payload.risks.length],
    [isAr ? "فجوات الفرص" : "Opportunity gaps", payload.opportunityGaps.length],
  ];

  const insightList = payload.executiveInsights
    .slice(0, 12)
    .map(
      (ins) =>
        `<li><strong>${escapeHtml(isAr ? ins.title : ins.titleEn)}</strong><br/>${escapeHtml(isAr ? ins.body : ins.recommendationEn)}</li>`
    )
    .join("");

  const talentRows = payload.talentPipeline.byUniversityReadiness
    .slice(0, 10)
    .map(
      (t) =>
        `<tr><td>${escapeHtml(t.fullName)}</td><td>${t.universityReadiness}</td><td>${t.careerReadiness}</td><td>${escapeHtml(t.evidence)}</td></tr>`
    )
    .join("");

  const orgRows = payload.institutionEffectiveness
    .slice(0, 10)
    .map(
      (o) =>
        `<tr><td>${escapeHtml(o.organizationName)}</td><td>${o.studentCount}</td><td>${o.totalHours}</td><td>${o.satisfactionPct}%</td><td>${o.completionRatePct}%</td></tr>`
    )
    .join("");

  const roiRows = payload.competitionRoi
    .slice(0, 10)
    .map(
      (c) =>
        `<tr><td>${escapeHtml(isAr ? c.labelAr : c.labelEn)}</td><td>${c.participations}</td><td>${c.growthRatePct}%</td><td>${c.roiScore}</td></tr>`
    )
    .join("");

  const recRows = payload.strategicRecommendations
    .map(
      (r) =>
        `<li>${escapeHtml(isAr ? r.titleAr : r.titleEn)} — ${escapeHtml(isAr ? r.reasonAr : r.reasonEn)}</li>`
    )
    .join("");

  const predRows = payload.predictions
    .map(
      (p) =>
        `<tr><td>${escapeHtml(isAr ? p.labelAr : p.labelEn)}</td><td>${p.currentYearValue}</td><td>${p.predictedNextYear}</td><td>${escapeHtml(p.method)}</td></tr>`
    )
    .join("");

  return `<!DOCTYPE html><html dir="${dir}" lang="${locale}"><head><meta charset="utf-8"/>
<title>${escapeHtml(title)}</title>
<style>
body{font-family:Arial,sans-serif;padding:32px;color:#0f172a;line-height:1.5}
h1{font-size:22px} h2{font-size:16px;margin-top:24px}
table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}
th,td{border:1px solid #cbd5e1;padding:6px;text-align:${isAr ? "right" : "left"}}
th{background:#f1f5f9}
.kpi{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:16px 0}
.kpi div{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px;font-size:12px}
.note{font-size:11px;color:#64748b;margin-top:24px}
</style></head><body>
<h1>${escapeHtml(title)}</h1>
<p>${new Date(payload.generatedAt).toLocaleString(isAr ? "ar-SA" : "en-US")}</p>
<div class="kpi">${kpiRows.map(([l, v]) => `<div><strong>${escapeHtml(String(l))}</strong><br/>${v}</div>`).join("")}</div>
<h2>${isAr ? "رؤى تنفيذية" : "Executive insights"}</h2>
<ul>${insightList || `<li>—</li>`}</ul>
<h2>${isAr ? "خط أنابيب المواهب" : "Talent pipeline"}</h2>
<table><thead><tr><th>${isAr ? "الطالب" : "Student"}</th><th>${isAr ? "جامعي" : "University"}</th><th>${isAr ? "مهني" : "Career"}</th><th>${isAr ? "دليل" : "Evidence"}</th></tr></thead><tbody>${talentRows}</tbody></table>
<h2>${isAr ? "فعالية المؤسسات" : "Institution effectiveness"}</h2>
<table><thead><tr><th>${isAr ? "المؤسسة" : "Organization"}</th><th>${isAr ? "طلاب" : "Students"}</th><th>${isAr ? "ساعات" : "Hours"}</th><th>${isAr ? "رضا" : "Satisfaction"}</th><th>${isAr ? "إكمال" : "Completion"}</th></tr></thead><tbody>${orgRows}</tbody></table>
<h2>${isAr ? "عائد المسابقات" : "Competition ROI"}</h2>
<table><thead><tr><th>${isAr ? "المسابقة" : "Competition"}</th><th>${isAr ? "مشاركات" : "Participations"}</th><th>${isAr ? "نمو" : "Growth"}</th><th>ROI</th></tr></thead><tbody>${roiRows}</tbody></table>
<h2>${isAr ? "توصيات استراتيجية" : "Strategic recommendations"}</h2>
<ul>${recRows}</ul>
<h2>${isAr ? "توقعات" : "Predictions"}</h2>
<table><thead><tr><th>${isAr ? "المؤشر" : "Metric"}</th><th>${isAr ? "الحالي" : "Current"}</th><th>${isAr ? "المتوقع" : "Predicted"}</th><th>${isAr ? "المنهجية" : "Method"}</th></tr></thead><tbody>${predRows}</tbody></table>
<p class="note">${isAr ? "طبقة قراءة فقط — جميع المؤشرات قابلة للتفسير ومدعومة بأدلة." : "Read-only layer — all indicators are explainable and evidence-backed."}</p>
<p class="note">${isAr ? "مصادر البيانات:" : "Data sources:"} ${payload.governance.dataSources.join(", ")}</p>
</body></html>`;
};
