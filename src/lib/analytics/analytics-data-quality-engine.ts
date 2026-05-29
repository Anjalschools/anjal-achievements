/**
 * Analytics data quality checks — duplicates, orphan metrics, impossible ratios.
 */

import type { HistoricalComparisonTableModel } from "@/lib/analytics/historical-comparison-table-engine";
import { columnKey } from "@/lib/analytics/historical-comparison-table-engine";
import { isRateMetric } from "@/lib/analytics/historical-results-metric-semantics";

export type DataQualityIssue = {
  code:
    | "duplicate_row"
    | "orphan_metric"
    | "impossible_ratio"
    | "invalid_total"
    | "duplicate_semantics"
    | "inconsistent_outcome";
  severity: "warn" | "critical";
  messageAr: string;
  messageEn: string;
  ref?: string;
};

export const auditHistoricalTableQuality = (
  model: HistoricalComparisonTableModel
): DataQualityIssue[] => {
  const issues: DataQualityIssue[] = [];
  const keys = new Set<string>();

  for (const row of model.rows) {
    if (keys.has(row.key)) {
      issues.push({
        code: "duplicate_row",
        severity: "warn",
        messageAr: `صف مكرر: ${row.labelAr}`,
        messageEn: `Duplicate row: ${row.labelEn}`,
        ref: row.key,
      });
    }
    keys.add(row.key);
  }

  if (
    model.rows.some((r) => r.key === "activity_total") &&
    model.rows.filter((r) => !r.isTotal && r.key !== "activity_total").length >= 2
  ) {
    issues.push({
      code: "duplicate_semantics",
      severity: "warn",
      messageAr: "صف «إجمالي النشاط» يكرر صفوف النطاق",
      messageEn: "Activity total duplicates scope rows",
      ref: "activity_total",
    });
  }

  for (const yg of model.yearGroups) {
    for (const m of yg.metrics) {
      if (isRateMetric(m.key)) {
        const ck = columnKey(yg.year, m.key);
        const part = model.rows
          .filter((r) => !r.isTotal)
          .reduce((s, r) => s + (r.cells[columnKey(yg.year, "participation")] ?? 0), 0);
        const val = model.rows
          .filter((r) => !r.isTotal)
          .reduce((s, r) => s + (r.cells[ck] ?? 0), 0);
        if (val > 100 && m.key.includes("rate")) {
          issues.push({
            code: "impossible_ratio",
            severity: "critical",
            messageAr: `نسبة غير منطقية >100%: ${m.labelAr} ${yg.year}`,
            messageEn: `Impossible ratio >100%: ${m.labelEn} ${yg.year}`,
            ref: ck,
          });
        }
        if (part > 0 && val === 0 && /award|qualification/.test(m.key)) {
          issues.push({
            code: "orphan_metric",
            severity: "warn",
            messageAr: `عمود نسبة بدون مصدر: ${m.labelAr}`,
            messageEn: `Rate column without source: ${m.labelEn}`,
            ref: ck,
          });
        }
      }
    }
  }

  if (!model.totals.valid) {
    issues.push({
      code: "invalid_total",
      severity: "critical",
      messageAr: "صف المجموع غير متسق",
      messageEn: "Totals row inconsistent",
    });
  }

  const partTotal = model.unifiedGraph?.totals.participants ?? 0;
  const awardTotal = model.unifiedGraph?.totals.award_winners ?? 0;
  if (partTotal > 0 && awardTotal > partTotal) {
    issues.push({
      code: "inconsistent_outcome",
      severity: "critical",
      messageAr: "الجوائز أكبر من المشاركات",
      messageEn: "Awards exceed participations",
    });
  }

  return issues;
};
