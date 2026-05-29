import { EXECUTIVE_REPORT_THEME } from "@/lib/analytics/export/analytics-report-theme";

export const buildReportCoverHtml = (input: {
  isAr: boolean;
  title: string;
  subtitle: string;
  yearsLabel?: string;
  activityLabel?: string;
  generatedAt: string;
  organizationName?: string;
}): string => {
  const t = EXECUTIVE_REPORT_THEME;
  const years = input.yearsLabel
    ? `<p>${input.isAr ? "السنوات" : "Years"}: ${input.yearsLabel}</p>`
    : "";
  const activity = input.activityLabel
    ? `<p>${input.isAr ? "النشاط" : "Activity"}: ${input.activityLabel}</p>`
    : "";
  const org = input.organizationName ?? (input.isAr ? "مدارس الأنجال الأهلية" : "Al-Anjal Schools");
  return `
<div class="cover-page">
  <p class="org">${org}</p>
  <h1>${input.title}</h1>
  <p class="subtitle">${input.subtitle}</p>
  ${years}
  ${activity}
  <p class="generated">${input.isAr ? "تاريخ الإصدار" : "Generated"}: ${input.generatedAt}</p>
</div>`;
};
