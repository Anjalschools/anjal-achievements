/**
 * Client-safe numeric / structural consistency checks for competition intelligence.
 * Uses normalized datasets + tolerance before flagging user-visible mismatches.
 */

import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";
import type { FocusedActivityReportPayload } from "@/types/focused-activity-report";
import type { StudentIntelligencePayload } from "@/lib/student-intelligence-analytics";
import {
  comparableFilterSnapshot,
  countsWithinTolerance,
  logAnalyticsConsistencyDebug,
  normalizeFocusedPayloadCounts,
  normalizeParticipationPayloadCounts,
} from "@/lib/analytics/achievement-analytics-normalizer";
import { ciRoundCount } from "@/lib/competition-intelligence-normalize";
import { competitionIntelWarn } from "@/lib/competition-intelligence-diagnostics";

export type CiTrustLevel = "synced" | "partial" | "mismatch";

export type CiConsistencyReport = {
  level: CiTrustLevel;
  issues: string[];
};

const mergeWorst = (a: CiConsistencyReport, b: CiConsistencyReport): CiConsistencyReport => {
  const order: CiTrustLevel[] = ["synced", "partial", "mismatch"];
  const level = order[Math.max(order.indexOf(a.level), order.indexOf(b.level))]!;
  return { level, issues: [...a.issues, ...b.issues] };
};

const warnIssues = (label: string, issues: string[]) => {
  if (!issues.length) return;
  competitionIntelWarn(`[ci-consistency:${label}]`, issues);
};

export const verifyParticipantCounts = (focused: FocusedActivityReportPayload | null): CiConsistencyReport => {
  const issues: string[] = [];
  if (!focused) return { level: "synced", issues: [] };

  const norm = normalizeFocusedPayloadCounts({
    totalRecords: focused.kpis.totalRecords,
    genderPie: focused.charts.genderPie,
    sectionPie: focused.charts.sectionPie,
  });

  if (norm.totalRecords > 0) {
    if (!countsWithinTolerance(norm.totalRecords, norm.genderPieSum)) {
      issues.push(`genderPie_sum_${norm.genderPieSum}_neq_totalRecords_${norm.totalRecords}`);
    }
    if (!countsWithinTolerance(norm.totalRecords, norm.sectionPieSum)) {
      issues.push(`sectionPie_sum_${norm.sectionPieSum}_neq_totalRecords_${norm.totalRecords}`);
    }
  }

  logAnalyticsConsistencyDebug("participants", {
    expectedCount: norm.totalRecords,
    actualCount: norm.genderPieSum,
    mismatchKeys: issues,
    staleSources: focused.ciObservability?.cacheHit ? ["focused_cache"] : [],
  });

  const level: CiTrustLevel =
    issues.length ? "mismatch" : "synced";
  if (issues.length) warnIssues("participants", issues);
  return { level, issues };
};

export const verifyMedalTotals = (focused: FocusedActivityReportPayload | null): CiConsistencyReport => {
  const issues: string[] = [];
  if (!focused?.decisionPlatform?.medalIntelligence?.bars?.length) return { level: "synced", issues: [] };
  const bars = focused.decisionPlatform.medalIntelligence.bars;
  const rb = focused.charts.resultBars;
  const pick = (key: string) => rb.find((x) => x.key === key)?.count ?? 0;
  const goldRb = pick("gold");
  const silverRb = pick("silver");
  const bronzeRb = pick("bronze");
  for (const b of bars) {
    const lab = `${b.labelEn}`.toLowerCase();
    if (lab.includes("gold") && goldRb > 0 && Number(b.rate) < 0) {
      issues.push("medal_bar_rate_negative");
    }
  }
  const medalSum = goldRb + silverRb + bronzeRb;
  const maxPlausible = focused.kpis.totalRecords * 2;
  if (medalSum > maxPlausible) {
    issues.push("medal_counts_implausibly_high_vs_records");
  }
  const level: CiTrustLevel = issues.length ? "partial" : "synced";
  if (issues.length) warnIssues("medals", issues);
  return { level, issues };
};

export const verifyOutcomeBuckets = (general: ParticipationAnalyticsPayload | null): CiConsistencyReport => {
  const issues: string[] = [];
  if (!general) return { level: "synced", issues: [] };

  const norm = normalizeParticipationPayloadCounts({
    totalParticipations: general.kpis.totalParticipations,
    resultOutcomeCompare: general.charts.resultOutcomeCompare,
  });

  const { totalParticipations, resultOutcomeSum } = norm;

  if (totalParticipations > 0) {
    if (resultOutcomeSum > totalParticipations) {
      if (!countsWithinTolerance(totalParticipations, resultOutcomeSum)) {
        issues.push(`resultOutcomeCompare_sum_${resultOutcomeSum}_gt_kpi_${totalParticipations}`);
      }
    } else if (resultOutcomeSum < totalParticipations) {
      const gap = totalParticipations - resultOutcomeSum;
      if (!countsWithinTolerance(totalParticipations, resultOutcomeSum)) {
        if (gap > Math.max(1, Math.ceil(totalParticipations * 0.01))) {
          issues.push(`resultOutcomeCompare_sum_${resultOutcomeSum}_lt_kpi_${totalParticipations}`);
        }
      }
    }
  }

  logAnalyticsConsistencyDebug("outcome_buckets", {
    expectedCount: totalParticipations,
    actualCount: resultOutcomeSum,
    mismatchKeys: issues,
    staleSources: general.ciObservability?.cacheHit ? ["general_cache"] : [],
  });

  const level: CiTrustLevel =
    issues.some((i) => i.includes("_gt_")) ? "mismatch"
    : issues.length ? "partial"
    : "synced";
  if (issues.length) warnIssues("outcome_buckets", issues);
  return { level, issues };
};

export const verifyYearTrend = (focused: FocusedActivityReportPayload | null): CiConsistencyReport => {
  const issues: string[] = [];
  if (!focused?.charts?.yearTrend?.length) return { level: "synced", issues: [] };
  for (const y of focused.charts.yearTrend) {
    const records = ciRoundCount(y.records);
    const students = ciRoundCount(y.distinctStudents);
    if (records > 0 && records < students) {
      issues.push(`year_${y.year}_records_lt_distinctStudents`);
    }
    if (y.totalMedals < 0 || y.goldMedals < 0) {
      issues.push(`year_${y.year}_negative_medals`);
    }
  }
  const level: CiTrustLevel = issues.length ? "mismatch" : "synced";
  if (issues.length) warnIssues("year_trend", issues);
  return { level, issues };
};

export const verifyComparisonConsistency = (
  a: FocusedActivityReportPayload | null,
  b: FocusedActivityReportPayload | null
): CiConsistencyReport => {
  const issues: string[] = [];
  if (!a || !b) return { level: "synced", issues: [] };
  const fa = comparableFilterSnapshot(a.filters as Record<string, unknown> | undefined);
  const fb = comparableFilterSnapshot(b.filters as Record<string, unknown> | undefined);
  if (fa !== fb) {
    issues.push("compare_demographic_filter_snapshot_mismatch");
  }
  const level: CiTrustLevel = issues.length ? "partial" : "synced";
  if (issues.length) warnIssues("compare", issues);
  return { level, issues };
};

export const verifyStudentIntelRows = (payload: StudentIntelligencePayload | null): CiConsistencyReport => {
  const issues: string[] = [];
  if (!payload) return { level: "synced", issues: [] };
  const checkPool = (
    rows: { participantId: string; recordCount: number; medalCount: number; growthIndex?: number; yearSpan?: number }[],
    name: string
  ) => {
    const seen = new Set<string>();
    let dup = 0;
    for (const r of rows) {
      if (seen.has(r.participantId)) dup += 1;
      seen.add(r.participantId);
      if (r.recordCount < r.medalCount) {
        issues.push(`${name}_medals_gt_records_${r.participantId.slice(0, 8)}`);
      }
      if (typeof r.growthIndex === "number" && typeof r.yearSpan === "number" && r.yearSpan > 0) {
        if (!Number.isFinite(r.growthIndex)) issues.push(`${name}_growth_nan`);
      }
    }
    if (dup > 0) issues.push(`${name}_duplicate_participant_rows_${dup}`);
  };
  checkPool(payload.byParticipation, "byParticipation");
  checkPool(payload.byMedals, "byMedals");
  checkPool(payload.byFastestGrowth, "byFastestGrowth");
  const level: CiTrustLevel = issues.length ? "mismatch" : "synced";
  if (issues.length) warnIssues("student_intel", issues);
  return { level, issues };
};

export const mergeTrustReports = (reports: CiConsistencyReport[]): CiConsistencyReport => {
  if (!reports.length) return { level: "synced", issues: [] };
  const merged = reports.reduce((acc, r) => mergeWorst(acc, r));
  const critical = merged.issues.filter(
    (i) =>
      i.includes("_gt_") ||
      i.includes("negative") ||
      i.includes("duplicate_participant") ||
      i.includes("medals_gt_records")
  );
  if (merged.level === "mismatch" && critical.length === 0) {
    return { level: "partial", issues: merged.issues };
  }
  return merged;
};

/** Unified entry: run all checks; downgrade noise; dev diagnostics only. */
export const runAnalyticsConsistencyEngine = (input: {
  general: ParticipationAnalyticsPayload | null;
  focused: FocusedActivityReportPayload | null;
  compareA: FocusedActivityReportPayload | null;
  compareB: FocusedActivityReportPayload | null;
  studentIntel: StudentIntelligencePayload | null;
  governance?: CiConsistencyReport;
}): CiConsistencyReport => {
  const reports: CiConsistencyReport[] = [
    verifyOutcomeBuckets(input.general),
    verifyParticipantCounts(input.focused),
    verifyMedalTotals(input.focused),
    verifyYearTrend(input.focused),
    verifyComparisonConsistency(input.compareA, input.compareB),
    verifyStudentIntelRows(input.studentIntel),
  ];
  if (input.governance) reports.push(input.governance);
  const merged = mergeTrustReports(reports);

  logAnalyticsConsistencyDebug("engine", {
    expectedCount: input.general?.kpis.totalParticipations ?? 0,
    actualCount: input.focused?.kpis.totalRecords ?? 0,
    mismatchKeys: merged.issues,
    staleSources: [
      ...(input.general?.ciObservability?.cacheHit ? ["general"] : []),
      ...(input.focused?.ciObservability?.cacheHit ? ["focused"] : []),
    ],
  });

  return merged;
};

/** Heuristic empty-state explanation (no extra server round-trip). */
export const describeFocusedEmptyContext = (params: {
  hasActivityPick: boolean;
  totalRecords: number;
  academicYear: string;
  stage: string;
  outcome: string;
  primaryType: string;
}): { codes: string[]; hintsAr: string[]; hintsEn: string[]; primaryAr: string; primaryEn: string } => {
  const codes: string[] = [];
  const hintsAr: string[] = [];
  const hintsEn: string[] = [];
  if (params.totalRecords !== 0) {
    return { codes, hintsAr, hintsEn, primaryAr: "", primaryEn: "" };
  }
  if (!params.hasActivityPick) {
    codes.push("no_activity_selected");
    hintsAr.push("اختر نشاطًا من القائمة أعلاه.");
    hintsEn.push("Pick an activity from the search control above.");
    return {
      codes,
      hintsAr,
      hintsEn,
      primaryAr: "لا توجد نتائج لهذا النشاط",
      primaryEn: "No results for this activity",
    };
  }
  codes.push("zero_rows_scope");
  hintsAr.push("لا توجد سجلات مطابقة لمجموعة الفلاتر الحالية لهذا النشاط.");
  hintsEn.push("No rows match the current filter scope for this activity.");
  let primaryAr = "لا توجد نتائج ضمن نطاق الفلاتر الحالية لهذا النشاط";
  let primaryEn = "No results for this activity under the current filter scope";
  if (params.academicYear && params.academicYear !== "all") {
    codes.push("year_scope");
    primaryAr = "لا توجد نتائج لهذه السنة";
    primaryEn = "No results for this academic year";
  } else if (params.stage && params.stage !== "all") {
    codes.push("stage_scope");
    primaryAr = "لا توجد نتائج لهذه المرحلة";
    primaryEn = "No results for this stage";
  } else if (params.outcome && params.outcome !== "all") {
    codes.push("outcome_scope");
    primaryAr = "لا توجد نتائج لهذا النوع من الإنجاز";
    primaryEn = "No results for this achievement outcome type";
  } else if (params.primaryType && params.primaryType !== "all") {
    codes.push("primary_type_scope");
    primaryAr = "لا توجد نتائج لهذا النوع الرئيسي من الأنشطة";
    primaryEn = "No results for this primary activity category";
  }
  if (params.academicYear && params.academicYear !== "all") {
    if (!codes.includes("year_scope")) codes.push("year_scope");
    hintsAr.push("جرّب عامًا دراسيًا أوسع إن كانت السجلات في أعوام أخرى.");
    hintsEn.push("Try a broader academic year if records exist in other years.");
  }
  if (params.stage && params.stage !== "all") {
    if (!codes.includes("stage_scope")) codes.push("stage_scope");
    hintsAr.push("جرّب إزالة قيد المرحلة لرؤية كل الصفوف.");
    hintsEn.push("Clear the stage filter to include all stages.");
  }
  if (params.outcome && params.outcome !== "all") {
    if (!codes.includes("outcome_scope")) codes.push("outcome_scope");
    hintsAr.push("غيّر «نوع الإنجاز» إلى «الكل» للتحقق من السجلات غير المصنّفة في هذا النوع.");
    hintsEn.push("Set outcome to “all” to see records outside this outcome bucket.");
  }
  if (params.primaryType && params.primaryType !== "all") {
    if (!codes.includes("primary_type_scope")) codes.push("primary_type_scope");
    hintsAr.push("وسّع «النوع الرئيسي» إذا كان النشاط مصنّفًا تحت فئة أخرى.");
    hintsEn.push("Broaden the primary type if the activity sits under another category.");
  }
  return { codes, hintsAr, hintsEn, primaryAr, primaryEn };
};

export const formatCacheAgeLabel = (generatedAtIso: string | undefined, isAr: boolean): string | null => {
  if (!generatedAtIso) return null;
  const t = Date.parse(generatedAtIso);
  if (!Number.isFinite(t)) return null;
  const sec = ciRoundCount((Date.now() - t) / 1000);
  if (sec < 5) return isAr ? "منذ لحظات" : "just now";
  if (sec < 120) return isAr ? `آخر تحديث قبل ${sec} ثانية` : `Updated ${sec}s ago`;
  const m = Math.floor(sec / 60);
  return isAr ? `آخر تحديث قبل ${m} دقيقة` : `Updated ${m} min ago`;
};
