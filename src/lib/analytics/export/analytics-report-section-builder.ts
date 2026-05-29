export type ReportSectionBlock = {
  id: string;
  titleAr: string;
  titleEn: string;
  html: string;
  landscape?: boolean;
};

export const buildReportSectionHtml = (
  block: ReportSectionBlock,
  isAr: boolean
): string => {
  const title = isAr ? block.titleAr : block.titleEn;
  const orient = block.landscape ? "landscape-section" : "portrait-section";
  return `<section id="${block.id}" class="report-section ${orient}"><h2>${title}</h2>${block.html}</section>`;
};

export const buildExecutiveSummarySection = (input: {
  isAr: boolean;
  kpis: string[];
  risks: string[];
  opportunities: string[];
  recommendations: string[];
}): string => {
  const h = (label: string, items: string[]) =>
    items.length
      ? `<div class="summary-block"><h3>${label}</h3><ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul></div>`
      : "";
  return [
    h(input.isAr ? "أهم المؤشرات" : "Key indicators", input.kpis),
    h(input.isAr ? "المخاطر" : "Risks", input.risks),
    h(input.isAr ? "الفرص" : "Opportunities", input.opportunities),
    h(input.isAr ? "التوصيات" : "Recommendations", input.recommendations),
  ].join("");
};
