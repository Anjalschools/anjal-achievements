import { escapeHtml } from "@/lib/pdf/executive-pdf-escape";

export type ExecutivePdfFooterInput = {
  isAr: boolean;
  generatedAt?: string;
  reportTypeLabel?: string;
  pageLabel?: string;
  confidentiality?: string;
};

export const buildExecutivePdfFooter = (input: ExecutivePdfFooterInput): string => {
  const {
    isAr,
    generatedAt,
    reportTypeLabel,
    pageLabel,
    confidentiality,
  } = input;

  const brand = isAr ? "منصة تميز الأنجال" : "Al-Anjal Excellence Platform";
  const dept = isAr ? "قسم الحاسب بمدارس الأنجال الأهلية" : "IT Department — Al-Anjal Schools";
  const report = reportTypeLabel ?? (isAr ? "تقرير تنفيذي" : "Executive report");
  const dateLine = generatedAt ?? "";
  const conf =
    confidentiality ??
    (isAr ? "للاستخدام الداخلي — مدارس الأنجال" : "Internal use — Al-Anjal Schools");

  return `<footer class="ep-footer">
  <span class="ep-footer-brand">${escapeHtml(brand)}</span>
  <span class="ep-footer-dept">${escapeHtml(dept)}</span>
  <span class="ep-footer-meta">${escapeHtml(report)}${dateLine ? ` · ${escapeHtml(dateLine)}` : ""}${pageLabel ? ` · ${escapeHtml(pageLabel)}` : ""}</span>
</footer>
<p class="ep-page-foot" aria-hidden="true">
  <span class="ep-conf">${escapeHtml(conf)}</span>
</p>`;
};

export const buildExecutivePdfPageFoot = (input: {
  isAr: boolean;
  pageIndex: number;
  pageTotal: number;
  confidentiality?: string;
}): string => {
  const conf =
    input.confidentiality ??
    (input.isAr ? "سري — وثيقة داخلية" : "Confidential — internal");
  const pageLabel = input.isAr ?
    `صفحة ${input.pageIndex} / ${input.pageTotal}`
  : `Page ${input.pageIndex} / ${input.pageTotal}`;

  return `<div class="ep-page-foot">
  <span class="ep-pnum ep-num">${escapeHtml(pageLabel)}</span>
  <span class="ep-conf">${escapeHtml(conf)}</span>
</div>`;
};
