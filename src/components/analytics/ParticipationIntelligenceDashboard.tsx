"use client";

import { Suspense, useMemo } from "react";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";
import type { AnalyticsInsightsBundle } from "@/lib/analytics/analytics-insights-engine";
import { buildAnalyticsNarratives } from "@/lib/analytics/analytics-narrative-engine";
import { useAnalyticsDerivedState, useAnalyticsFilters } from "@/contexts/AnalyticsFilterContext";
import StudentIntelligenceBoundary from "@/components/analytics/runtime/StudentIntelligenceBoundary";
import LazyStudentIntelligenceTrigger from "@/components/analytics/runtime/LazyStudentIntelligenceTrigger";
import DrillableMiniHBar from "@/components/analytics/DrillableMiniHBar";
import DrillDownHistoryBar from "@/components/analytics/DrillDownHistoryBar";
import ExecutiveSummaryPanel from "@/components/analytics/ExecutiveSummaryPanel";
import ExecutiveDashboardLayout from "@/components/analytics/layouts/ExecutiveDashboardLayout";
import MobileAnalyticsLayout from "@/components/analytics/layouts/MobileAnalyticsLayout";
import {
  deriveCompetitionComparison,
  derivePerformanceLeaders,
  deriveSectionIntelligence,
  deriveStdTestRows,
  topYearFromTrend,
} from "@/lib/analytics/participation-dashboard-derivations";
import { CI_SURFACE, CI_TYPOGRAPHY } from "@/lib/competition-intelligence-theme";
import IntelligenceCollapsibleSection from "@/components/analytics/IntelligenceCollapsibleSection";
import ParticipationAnalyticsTable from "@/components/analytics/ParticipationAnalyticsTable";
import GlobalAnalyticsNavigation from "@/components/analytics/GlobalAnalyticsNavigation";
import ExecutiveAccordionSection from "@/components/analytics/executive/ExecutiveAccordionSection";
import AnalyticsRenderBoundary from "@/components/analytics/AnalyticsRenderBoundary";
import AnalyticsSectionSkeleton from "@/components/analytics/AnalyticsSectionSkeleton";
import { UniqueStudentsMetricLabel } from "@/components/analytics/MetricWithTooltip";
import { buildParticipationCountingSnapshot, buildAnalyticsCountingDebugMeta } from "@/lib/analytics/analytics-counting-contract";
import {
  formatParticipationCount,
  formatStudentCount,
  formatMedalCount,
  formatAvgParticipationsPerStudent,
  formatAvgParticipationsPerStudentLine,
  computeAvgParticipationsPerStudent,
  uniqueStudentsLabel,
  t,
} from "@/lib/analytics/analytics-semantics";
import { createLazyAnalyticsSection } from "@/lib/analytics/analytics-render-strategies";
import ExecutiveNarrativesPanel from "@/components/analytics/ExecutiveNarrativesPanel";
import EducationalDemographicIntelligenceMatrix from "@/components/analytics/EducationalDemographicIntelligenceMatrix";
import CompetitionIntelligenceMatrix from "@/components/analytics/CompetitionIntelligenceMatrix";
import ParticipationDistributionPanel from "@/components/analytics/ParticipationDistributionPanel";
import ActivityDemographicBreakdownPanel from "@/components/analytics/ActivityDemographicBreakdownPanel";
import AnalyticsComparisonWorkspace from "@/components/analytics/AnalyticsComparisonWorkspace";
import EducationalEquityPanel from "@/components/analytics/EducationalEquityPanel";
import OpportunityIntelligencePanel from "@/components/analytics/OpportunityIntelligencePanel";
import RecommendationIntelligencePanel from "@/components/analytics/RecommendationIntelligencePanel";
import ExecutiveIntelligenceSummaryStrip from "@/components/analytics/ExecutiveIntelligenceSummaryStrip";
import StickyIntelligenceNavigator from "@/components/analytics/StickyIntelligenceNavigator";
import IntelligenceWorkspaceDensityToolbar from "@/components/analytics/IntelligenceWorkspaceDensityToolbar";
import IntelligenceLayerShell from "@/components/analytics/IntelligenceLayerShell";
import {
  IntelligenceWorkspaceProvider,
  useIntelligenceWorkspace,
} from "@/lib/analytics/intelligence-workspace-context";
import {
  isSectionVisibleInDensity,
  layerDefaultCollapsed,
} from "@/lib/analytics/intelligence-workspace-hierarchy";
import { formatPercentage } from "@/lib/analytics/analytics-number-formatting";
import { useAnalyticsPerspective } from "@/lib/analytics/analytics-perspective-context";
import { AvgParticipationsPerStudentMetricLabel } from "@/components/analytics/MetricWithTooltip";
import {
  resolveAnalyticsCompetitionScope,
  shouldShowInternationalAchievementKpi,
  shouldShowStdTestSection,
} from "@/lib/analytics/analytics-relevance";
import type { ExecutiveFilterSnapshot } from "@/lib/competition-intelligence-persistence";
import type { StudentIntelligencePayload } from "@/lib/student-intelligence-analytics";
import type { ExecutiveAnalyticsSnapshotPayload } from "@/lib/analytics/server/analytics-snapshot-schema";
import type { ExecutiveSnapshotResolveMeta } from "@/lib/analytics/server/analytics-snapshot-schema";
import { isCompetitionIntelDebugEnabled } from "@/lib/competition-intelligence-diagnostics";

type ExecutiveBundleLike = Partial<ExecutiveAnalyticsSnapshotPayload> &
  Pick<
    ExecutiveAnalyticsSnapshotPayload,
    "version" | "aggregationVersion" | "computedAt" | "filterFingerprint" | "kpiStrip" | "trustIssues"
  >;

const MedalIntelligencePanelLazy = createLazyAnalyticsSection(
  "medalIntelligence",
  () => import("@/components/analytics/MedalIntelligencePanel")
);

const HallOfFameIntelligenceLazy = createLazyAnalyticsSection(
  "hallOfFame",
  () => import("@/components/analytics/HallOfFameIntelligence"),
  { isAr: true }
);

export type ParticipationIntelligenceDashboardProps = {
  isAr: boolean;
  data: ParticipationAnalyticsPayload;
  insights: AnalyticsInsightsBundle;
  loading: boolean;
  page: number;
  totalPages: number;
  onPageChange: (next: number) => void;
  f: ExecutiveFilterSnapshot;
  studentIntelData: StudentIntelligencePayload | null;
  studentIntelLoading: boolean;
  onSelectStudent?: (participantId: string) => void;
  onClearFilters: () => void;
  executivePrecomputed?: ExecutiveBundleLike | null;
  executivePrecomputedMeta?: ExecutiveSnapshotResolveMeta | null;
};

const KpiCard = ({
  label,
  value,
  accent,
  onDrill,
  drillLabel,
}: {
  label: string;
  value: string | number;
  accent?: string;
  onDrill?: () => void;
  drillLabel?: string;
}) => (
  <button
    type="button"
    onClick={onDrill}
    disabled={!onDrill}
    className={`rounded-2xl border border-slate-200 bg-white p-4 text-start shadow-sm transition ${
      onDrill ? "cursor-pointer hover:ring-2 hover:ring-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-400" : ""
    } ${accent ?? ""}`}
    aria-label={drillLabel ?? label}
  >
    <p className={CI_TYPOGRAPHY.kpiLabel}>{label}</p>
    <p className={`mt-1 ${CI_TYPOGRAPHY.kpiValue}`}>{value}</p>
    {onDrill ? (
      <p className="mt-1 text-[10px] font-semibold text-indigo-600">
        {drillLabel ?? "↳"}
      </p>
    ) : null}
  </button>
);

const EmptyChart = ({ isAr, message }: { isAr: boolean; message?: string }) => (
  <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-xs text-slate-500">
    {message ?? (isAr ? "لا توجد بيانات كافية ضمن الفلاتر الحالية." : "Not enough data under current filters.")}
  </p>
);

const ParticipationIntelligenceDashboardInner = ({
  isAr,
  data,
  insights,
  loading,
  page,
  totalPages,
  onPageChange,
  f,
  studentIntelData,
  studentIntelLoading,
  onSelectStudent,
  onClearFilters,
  executivePrecomputed,
  executivePrecomputedMeta,
}: ParticipationIntelligenceDashboardProps) => {
  const { applyDrillFromChart, executiveMode, drillTransitioning, isAr: ctxAr, studentIntelError, fetchStudentIntelligence } =
    useAnalyticsFilters();
  const { perspective, globalKpi, exportTitleSuffix, label: perspectiveLabel, loc } =
    useAnalyticsPerspective();
  const { density } = useIntelligenceWorkspace();
  const showLayer5 = isSectionVisibleInDensity(5, density);
  const showLayer6 = isSectionVisibleInDensity(6, density);
  const { canonicalSnapshot } = useAnalyticsDerivedState();
  const kpi = data.kpis;
  const table = data.table;
  const drillHint = isAr || ctxAr ? "استكشاف" : "Explore";
  const drill = applyDrillFromChart;

  const counts = useMemo(() => buildParticipationCountingSnapshot(data), [data]);
  const scope = useMemo(() => resolveAnalyticsCompetitionScope(f), [f]);
  const showIntlKpi = shouldShowInternationalAchievementKpi(
    scope,
    kpi.internationalAchievementPct,
    kpi.internationalSectionPct
  );
  const showStdSection = shouldShowStdTestSection(f, deriveStdTestRows(table).length);

  const silverCount = counts.silverCount;
  const bronzeCount = counts.bronzeCount;
  const topYear = topYearFromTrend(data);
  if (isCompetitionIntelDebugEnabled()) {
    // eslint-disable-next-line no-console
    console.debug("[analytics-counting]", buildAnalyticsCountingDebugMeta(data));
  }

  const competitionRows = useMemo(() => deriveCompetitionComparison(table), [table]);
  const sectionRows = useMemo(() => deriveSectionIntelligence(table), [table]);
  const leaders = useMemo(() => derivePerformanceLeaders(table), [table]);
  const stdRows = useMemo(() => deriveStdTestRows(table), [table]);

  const yearTrendMax = useMemo(
    () => Math.max(1, ...data.charts.yearTrend.map((x) => x.totalRows)),
    [data.charts.yearTrend]
  );
  const compMax = useMemo(
    () => Math.max(1, ...competitionRows.map((c) => c.participations)),
    [competitionRows]
  );
  const activityMax = useMemo(
    () => Math.max(1, ...data.charts.activityHorizontal.map((x) => x.studentCount)),
    [data.charts.activityHorizontal]
  );

  const topStdLabel = stdRows[0]
    ? isAr
      ? stdRows[0].activityLabelAr
      : stdRows[0].activityLabelEn
    : isAr
      ? "—"
      : "—";

  const filterScopeLabel = isAr ? "نطاق الفلاتر الحالية" : "Current filter scope";
  const avgPerStudent = computeAvgParticipationsPerStudent(
    counts.participationCount,
    counts.uniqueStudentsCount
  );

  const narrativeBundle = useMemo(() => {
    if (executivePrecomputed?.narrativeBundle) return executivePrecomputed.narrativeBundle;
    return buildAnalyticsNarratives({
      snapshot: canonicalSnapshot,
      general: data,
      focused: null,
      filters: f,
      intelScope: "lite",
      perspective,
    });
  }, [executivePrecomputed, canonicalSnapshot, data, f, perspective]);

  const perspectiveKpi = useMemo(() => globalKpi(data), [data, globalKpi]);

  const body = (
    <>
      <GlobalAnalyticsNavigation isAr={isAr} f={f} onClear={onClearFilters} backHref="/admin/achievements/reports" />
      {!executiveMode ? (
        <ExecutiveIntelligenceSummaryStrip isAr={isAr} data={data} insights={insights} />
      ) : null}
      <IntelligenceWorkspaceDensityToolbar isAr={isAr} />
      <StickyIntelligenceNavigator isAr={isAr} />
      {executiveMode ? <ExecutiveSummaryPanel isAr={isAr} data={data} insights={insights} /> : null}
      {drillTransitioning ? (
        <p className="text-xs font-semibold text-indigo-600 print:hidden" aria-live="polite">
          {isAr ? "جاري تطبيق الاستكشاف…" : "Applying drill-down…"}
        </p>
      ) : null}
      <IntelligenceLayerShell
        level={1}
        anchorId="intel-layer-1-kpis"
        title={t("workspace.layer.1", loc)}
        isAr={isAr}
        badge={perspectiveLabel}
      >
      <ExecutiveAccordionSection
        id="exec-kpis"
        anchorId="intel-layer-1-kpis"
        title={t("section.executiveSummary", loc)}
        hint={`${filterScopeLabel} · ${perspectiveLabel}`}
        isAr={isAr}
        defaultOpen={!executiveMode}
        density="executive"
        badge={perspectiveLabel}
        collapsedPreview={[
          {
            label: isAr ? "مشاركات" : "Participations",
            value: String(counts.participationCount),
          },
          {
            label: isAr ? "طلاب" : "Students",
            value: String(counts.uniqueStudentsCount),
          },
        ]}
      >
      {executiveMode ? (
        <p className="rounded-xl border border-indigo-100 bg-indigo-50/50 px-3 py-2 text-xs text-indigo-950">
          {isAr
            ? "ملخص المؤشرات معروض أعلاه في بطاقة وضع القيادة. وسّع هذا القسم للتفاصيل الكاملة."
            : "KPI summary is shown above in leadership mode. Expand this section for full detail."}
        </p>
      ) : null}
      <section
        className={`rounded-2xl border border-slate-200 ${CI_SURFACE.hero} p-4 sm:p-5 shadow-sm print:break-inside-avoid ${
          executiveMode ? "hidden print:block" : ""
        }`}
      >
        <h2 className="text-base font-black text-slate-900">
          {t("section.executiveSummary", loc)}
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          {filterScopeLabel} · {perspectiveLabel} · {exportTitleSuffix}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard
            label={perspectiveKpi.label}
            value={
              perspective === "participation"
                ? formatParticipationCount(perspectiveKpi.value, loc)
                : perspective === "student"
                  ? formatStudentCount(perspectiveKpi.value, loc)
                  : String(perspectiveKpi.value)
            }
            accent="ring-1 ring-indigo-100"
            drillLabel={drillHint}
            onDrill={() => drill("kpi", { metricKey: "totalParticipations" })}
          />
          <KpiCard
            label={uniqueStudentsLabel(loc)}
            value={formatStudentCount(counts.uniqueStudentsCount, loc)}
            accent="ring-1 ring-indigo-100"
            drillLabel={drillHint}
            onDrill={() => drill("kpi", { metricKey: "distinctStudents" })}
          />
          <KpiCard
            label={t("kpi.avgParticipationsPerStudent", loc)}
            value={formatAvgParticipationsPerStudent(avgPerStudent, loc)}
            accent="ring-1 ring-violet-100 bg-violet-50/30"
          />
          <KpiCard
            label={isAr ? "🥇 ذهبية" : "🥇 Gold"}
            value={formatMedalCount(counts.goldCount, loc)}
            accent="bg-amber-50/50"
            drillLabel={drillHint}
            onDrill={() => drill("kpi", { metricKey: "goldMedalCount" })}
          />
          <KpiCard
            label={isAr ? "🥈 فضية" : "🥈 Silver"}
            value={formatMedalCount(silverCount, loc)}
            accent="bg-slate-50"
            drillLabel={drillHint}
            onDrill={() => drill("kpi", { metricKey: "silver" })}
          />
          <KpiCard
            label={isAr ? "🥉 برونزية" : "🥉 Bronze"}
            value={formatMedalCount(bronzeCount, loc)}
            accent="bg-orange-50/40"
            drillLabel={drillHint}
            onDrill={() => drill("kpi", { metricKey: "bronze" })}
          />
          <KpiCard
            label={isAr ? "أعلى نشاط" : "Top activity"}
            value={isAr ? kpi.topProgramLabelAr : kpi.topProgramLabelEn}
            drillLabel={drillHint}
            onDrill={() =>
              drill("kpi", {
                metricKey: "topProgram",
                labelAr: kpi.topProgramLabelAr,
                labelEn: kpi.topProgramLabelEn,
              })
            }
          />
          <KpiCard
            label={isAr ? "أعلى قسم" : "Top section"}
            value={isAr ? kpi.topSectionLabelAr : kpi.topSectionLabelEn}
            drillLabel={drillHint}
            onDrill={() =>
              drill("kpi", {
                metricKey: "topSection",
                labelAr: kpi.topSectionLabelAr,
                labelEn: kpi.topSectionLabelEn,
              })
            }
          />
          <KpiCard
            label={isAr ? "أعلى سنة" : "Peak year"}
            value={topYear ? `${topYear.year} (${topYear.rows})` : "—"}
            drillLabel={drillHint}
            onDrill={
              topYear ? () => drill("year_trend", { year: topYear.year, key: String(topYear.year) }) : undefined
            }
          />
          <KpiCard
            label={isAr ? "أعلى اختبار معياري" : "Top std. test"}
            value={topStdLabel}
            drillLabel={drillHint}
            onDrill={
              stdRows[0]
                ? () =>
                    drill("std_test_row", {
                      activityKey: stdRows[0]!.activityKey,
                      labelAr: stdRows[0]!.activityLabelAr,
                      labelEn: stdRows[0]!.activityLabelEn,
                    })
                : undefined
            }
          />
          {showIntlKpi ? (
            <KpiCard
              label={isAr ? "إنجازات دولية %" : "Intl. achievements %"}
              value={formatPercentage(kpi.internationalAchievementPct, loc)}
              drillLabel={drillHint}
              onDrill={() => drill("kpi", { metricKey: "international" })}
            />
          ) : null}
        </div>
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500 print:hidden">
          <UniqueStudentsMetricLabel isAr={isAr} />
          <AvgParticipationsPerStudentMetricLabel isAr={isAr} />
          <span className="tabular-nums text-slate-600">
            {formatAvgParticipationsPerStudentLine(
              counts.participationCount,
              counts.uniqueStudentsCount,
              loc
            )}
          </span>
        </p>
      </section>
      </ExecutiveAccordionSection>
      </IntelligenceLayerShell>

      <IntelligenceLayerShell
        level={2}
        anchorId="intel-layer-2-insights"
        title={t("workspace.layer.2", loc)}
        isAr={isAr}
      >
      {!executiveMode && narrativeBundle.narratives.length > 0 ? (
        <AnalyticsRenderBoundary sectionId="narrative-insights" isAr={isAr}>
          <ExecutiveNarrativesPanel
            isAr={isAr}
            narratives={narrativeBundle.narratives}
            exploratoryMode={executivePrecomputedMeta?.source === "snapshot_stale"}
          />
        </AnalyticsRenderBoundary>
      ) : null}

      {/* B) Hall of Fame */}
      {!executiveMode ? (
        <AnalyticsRenderBoundary sectionId="student-highlights" isAr={isAr}>
          <IntelligenceCollapsibleSection
            id="student-highlights"
            title={t("section.hallOfFame", loc)}
            hint={
              isAr
                ? "قاعة التميز — بطل الأداء وبطاقات الشرف"
                : "Excellence hall — hero performer and prestige cards"
            }
            isAr={isAr}
            defaultOpen
            density="executive"
          >
            <LazyStudentIntelligenceTrigger enabled lite />
            <StudentIntelligenceBoundary
              isAr={isAr}
              error={studentIntelError}
              loading={studentIntelLoading}
              onRetry={() => void fetchStudentIntelligence({ lite: true, force: true })}
            >
              <Suspense fallback={<AnalyticsSectionSkeleton lines={6} isAr={isAr} />}>
                <HallOfFameIntelligenceLazy
                  isAr={isAr}
                  data={studentIntelData}
                  generalData={data}
                  loading={studentIntelLoading}
                  executiveMode={executiveMode}
                  onSelectStudent={onSelectStudent}
                />
              </Suspense>
            </StudentIntelligenceBoundary>
          </IntelligenceCollapsibleSection>
        </AnalyticsRenderBoundary>
      ) : null}

      {insights.hasData && insights.insights.length > 0 ? (
        <div className="mb-4 rounded-xl border border-amber-100 bg-amber-50/30 p-3">
          <h4 className="text-xs font-black text-amber-950">
            {isAr ? "تنبيهات ورؤى حرجة" : "Critical insights & alerts"} ({insights.insights.length})
          </h4>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {insights.insights.slice(0, density === "executive" ? 4 : 8).map((ins) => (
              <li key={ins.id}>
                <button
                  type="button"
                  onClick={() => drill("insight", { insightId: ins.id, key: ins.id })}
                  className="w-full rounded-xl border border-amber-200/80 bg-white px-3 py-2 text-start text-xs hover:ring-2 hover:ring-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <p className="font-bold text-slate-900">{isAr ? ins.titleAr : ins.titleEn}</p>
                  <p className="mt-1 text-slate-600">{isAr ? ins.bodyAr : ins.bodyEn}</p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      </IntelligenceLayerShell>

      <IntelligenceLayerShell
        level={3}
        anchorId="intel-layer-3-equity"
        title={t("workspace.layer.3", loc)}
        isAr={isAr}
      >
      <AnalyticsRenderBoundary sectionId="equityPanel" isAr={isAr}>
        <IntelligenceCollapsibleSection
          id="equity-panel"
          title={t("equity.panel.title", loc)}
          hint={isAr ? "تمثيل · فجوات · توازن" : "Representation · gaps · balance"}
          isAr={isAr}
          defaultOpen={!layerDefaultCollapsed(3, density)}
        >
          <EducationalEquityPanel isAr={isAr} data={data} onDrill={drill} drillHint={drillHint} />
        </IntelligenceCollapsibleSection>
      </AnalyticsRenderBoundary>

      <div id="intel-layer-3-opportunity">
      <AnalyticsRenderBoundary sectionId="opportunityPanel" isAr={isAr}>
        <IntelligenceCollapsibleSection
          id="opportunity-panel"
          title={t("opportunity.panel.title", loc)}
          hint={isAr ? "وصول · تمثيل · تركز" : "Access · representation · concentration"}
          isAr={isAr}
          defaultOpen={!layerDefaultCollapsed(3, density)}
        >
          <OpportunityIntelligencePanel
            isAr={isAr}
            data={data}
            onDrill={drill}
            drillHint={drillHint}
          />
        </IntelligenceCollapsibleSection>
      </AnalyticsRenderBoundary>
      </div>
      </IntelligenceLayerShell>

      <IntelligenceLayerShell
        level={4}
        anchorId="intel-layer-4-recommendations"
        title={t("workspace.layer.4", loc)}
        isAr={isAr}
      >
      <AnalyticsRenderBoundary sectionId="recommendationPanel" isAr={isAr}>
        <IntelligenceCollapsibleSection
          id="recommendation-panel"
          title={t("recommendation.panel.title", loc)}
          hint={isAr ? "إجراءات · أولويات · تجميع" : "Actions · priorities · clusters"}
          isAr={isAr}
          defaultOpen={!layerDefaultCollapsed(4, density)}
        >
          <RecommendationIntelligencePanel
            isAr={isAr}
            data={data}
            onDrill={drill}
            drillHint={drillHint}
          />
        </IntelligenceCollapsibleSection>
      </AnalyticsRenderBoundary>
      </IntelligenceLayerShell>

      {showLayer5 ? (
      <IntelligenceLayerShell
        level={5}
        anchorId="intel-layer-5-comparison"
        title={t("workspace.layer.5", loc)}
        isAr={isAr}
      >
      {/* D) Medal intelligence */}
      {!executiveMode ? (
        <AnalyticsRenderBoundary sectionId="medal-intelligence" isAr={isAr}>
          <Suspense fallback={<AnalyticsSectionSkeleton lines={4} isAr={isAr} />}>
            <MedalIntelligencePanelLazy isAr={isAr} data={data} f={f} onDrill={drill} drillHint={drillHint} />
          </Suspense>
        </AnalyticsRenderBoundary>
      ) : null}

      {/* E) Competition intelligence matrix */}
      <AnalyticsRenderBoundary sectionId="competition-matrix" isAr={isAr}>
        <IntelligenceCollapsibleSection
          id="competition-matrix"
          title={t("section.competitionMatrix", loc)}
          hint={isAr ? "مشاركات · طلاب · كثافة · تحويل · ديموغرافيا" : "Participations · students · density · conversion · demographics"}
          isAr={isAr}
          defaultOpen={!executiveMode}
        >
          <CompetitionIntelligenceMatrix isAr={isAr} table={table} onDrill={drill} />
          <div className="mt-4 space-y-2">
            {competitionRows.filter((c) => c.participations > 0).map((c) => (
              <DrillableMiniHBar
                key={`bar-${c.key}`}
                label={isAr ? c.labelAr : c.labelEn}
                value={c.participations}
                max={compMax}
                isAr={isAr}
                barClassName="h-full rounded-full bg-violet-600"
                drillLabel={drillHint}
                onDrill={() =>
                  drill("competition_bar", { competitionKey: c.key, key: c.key, labelAr: c.labelAr, labelEn: c.labelEn })
                }
              />
            ))}
          </div>
        </IntelligenceCollapsibleSection>
      </AnalyticsRenderBoundary>

      {/* F) Advanced analytics */}
      <IntelligenceCollapsibleSection
        id="advanced-analytics"
        title={isAr ? "تحليلات متقدمة" : "Advanced analytics"}
        hint={isAr ? "الأداء · الأقسام · سنوي · ديموغرافيا · رؤى" : "Performance · sections · YoY · demographics · insights"}
        isAr={isAr}
        defaultOpen={false}
      >
      {/* Performance Intelligence */}
      <div className={executiveMode ? "hidden lg:block print:hidden" : ""}>
      <IntelligenceCollapsibleSection
        id="performance"
        title={isAr ? "ذكاء الأداء" : "Performance intelligence"}
        hint={isAr ? "أفضل المسابقات، الأقسام، الصفوف، وكثافة الميداليات" : "Top competitions, sections, grades, medal density"}
        isAr={isAr}
        defaultOpen
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <h4 className="text-xs font-black text-slate-800">{isAr ? "أفضل المسابقات (ميداليات)" : "Top competitions (medals)"}</h4>
            <div className="mt-2 space-y-2">
              {leaders.topCompetitions.length === 0 ? (
                <EmptyChart isAr={isAr} />
              ) : (
                leaders.topCompetitions.map((r) => (
                  <DrillableMiniHBar
                    key={r.activityKey}
                    label={isAr ? r.activityLabelAr : r.activityLabelEn}
                    value={r.goldMedalCount + r.silverMedalCount + r.bronzeMedalCount}
                    max={Math.max(1, leaders.topCompetitions[0]!.goldMedalCount + leaders.topCompetitions[0]!.silverMedalCount + leaders.topCompetitions[0]!.bronzeMedalCount)}
                    isAr={isAr}
                    barClassName="h-full rounded-full bg-indigo-600"
                    drillLabel={drillHint}
                    onDrill={() =>
                      drill("activity_row", {
                        activityKey: r.activityKey,
                        labelAr: r.activityLabelAr,
                        labelEn: r.activityLabelEn,
                      })
                    }
                  />
                ))
              )}
            </div>
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-800">{isAr ? "أعلى كثافة ميداليات" : "Highest medal density"}</h4>
            <div className="mt-2 space-y-2">
              {leaders.topMedalDensity.length === 0 ? (
                <EmptyChart isAr={isAr} />
              ) : (
                leaders.topMedalDensity.map(({ row, density }) => (
                  <DrillableMiniHBar
                    key={row.activityKey}
                    label={isAr ? row.activityLabelAr : row.activityLabelEn}
                    value={Math.round(density * 10) / 10}
                    max={Math.max(1, leaders.topMedalDensity[0]!.density)}
                    isAr={isAr}
                    suffix="%"
                    barClassName="h-full rounded-full bg-emerald-600"
                    drillLabel={drillHint}
                    onDrill={() =>
                      drill("medal_density", {
                        activityKey: row.activityKey,
                        labelAr: row.activityLabelAr,
                        labelEn: row.activityLabelEn,
                      })
                    }
                  />
                ))
              )}
            </div>
          </div>
          <div className="lg:col-span-2">
            <h4 className="text-xs font-black text-slate-800">
              {isAr ? `أفضل الأنشطة (${uniqueStudentsLabel(loc)})` : `Top activities (${uniqueStudentsLabel(loc)})`}
            </h4>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {data.charts.activityHorizontal.length === 0 ? (
                <EmptyChart isAr={isAr} />
              ) : (
                data.charts.activityHorizontal.slice(0, 8).map((r, i) => (
                  <DrillableMiniHBar
                    key={`${r.labelAr}-${i}`}
                    label={isAr ? r.labelAr : r.labelEn}
                    value={r.studentCount}
                    max={activityMax}
                    isAr={isAr}
                    drillLabel={drillHint}
                    onDrill={() =>
                      drill("activity_bar", { labelAr: r.labelAr, labelEn: r.labelEn, key: r.labelEn })
                    }
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </IntelligenceCollapsibleSection>
      </div>

      <AnalyticsRenderBoundary sectionId="comparisonWorkspace" isAr={isAr}>
        <IntelligenceCollapsibleSection
          id="comparison-workspace"
          title={t("comparison.workspace.title", loc)}
          hint={isAr ? "مقارنة أقسام · سنوات · أنشطة" : "Section · year · activity comparison"}
          isAr={isAr}
          defaultOpen={!layerDefaultCollapsed(5, density)}
        >
          <AnalyticsComparisonWorkspace isAr={isAr} data={data} onDrill={drill} />
        </IntelligenceCollapsibleSection>
      </AnalyticsRenderBoundary>

      {/* Demographic intelligence matrix — deep layer */}
      <AnalyticsRenderBoundary sectionId="demographic-matrix" isAr={isAr}>
        <IntelligenceCollapsibleSection
          id="demographic-matrix"
          title={t("section.demographicMatrix", loc)}
          hint={isAr ? "عربي · دولي · جنس · موهبة · صف · مرحلة" : "Section · gender · Mawhiba · grade · stage"}
          isAr={isAr}
          defaultOpen={false}
        >
          <EducationalDemographicIntelligenceMatrix
            isAr={isAr}
            data={data}
            table={table}
            onDrill={drill}
            drillHint={drillHint}
          />
          <div className="mt-6">
            <h4 className="mb-2 text-xs font-black text-slate-800">{t("section.distribution", loc)}</h4>
            <ParticipationDistributionPanel isAr={isAr} data={data} onDrill={drill} drillHint={drillHint} />
          </div>
          <div className="mt-6">
            <h4 className="mb-2 text-xs font-black text-slate-800">{t("section.activityDemographics", loc)}</h4>
            <ActivityDemographicBreakdownPanel isAr={isAr} table={table} />
          </div>
        </IntelligenceCollapsibleSection>
      </AnalyticsRenderBoundary>

      {showStdSection ? (
      <IntelligenceCollapsibleSection
        id="std-tests"
        title={isAr ? "الاختبارات المعيارية" : "Standardized test intelligence"}
        hint={isAr ? "SAT · IELTS · قدرات · تحصيلي" : "SAT · IELTS · Qudrat · Tahsili"}
        isAr={isAr}
      >
        {stdRows.length === 0 ? (
          <EmptyChart
            isAr={isAr}
            message={
              isAr
                ? "لا توجد اختبارات معيارية ضمن الفلاتر — جرّب تصنيف «اختبارات معيارية» أو SAT/IELTS."
                : "No standardized tests in scope — try category standardized tests or SAT/IELTS."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                  <th className="px-2 py-2">{isAr ? "الاختبار / النشاط" : "Test / activity"}</th>
                  <th className="px-2 py-2">{isAr ? "سجلات" : "Records"}</th>
                  <th className="px-2 py-2">{uniqueStudentsLabel(loc)}</th>
                  <th className="px-2 py-2">{isAr ? "تميز %" : "Excellence %"}</th>
                </tr>
              </thead>
              <tbody>
                {stdRows.map((r) => (
                  <tr
                    key={r.activityKey}
                    className="cursor-pointer border-b border-slate-100 hover:bg-teal-50/50"
                    onClick={() =>
                      drill("std_test_row", {
                        activityKey: r.activityKey,
                        labelAr: r.activityLabelAr,
                        labelEn: r.activityLabelEn,
                        competitionKey: r.typeKey,
                        key: r.typeKey,
                      })
                    }
                    tabIndex={0}
                    role="button"
                  >
                    <td className="px-2 py-2 font-semibold">{isAr ? r.activityLabelAr : r.activityLabelEn}</td>
                    <td className="px-2 py-2 tabular-nums">{r.totalParticipations}</td>
                    <td className="px-2 py-2 tabular-nums">{r.distinctParticipants}</td>
                    <td className="px-2 py-2 tabular-nums">{r.excellenceRatePct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </IntelligenceCollapsibleSection>
      ) : null}

      {/* Year-over-Year */}
      <IntelligenceCollapsibleSection
        id="yoy"
        title={isAr ? "تحليل سنوي" : "Year-over-year intelligence"}
        hint={isAr ? "نمو النشاط · الميداليات · الطلاب" : "Activity growth · medals · students"}
        isAr={isAr}
      >
        {data.charts.yearTrend.length === 0 ? (
          <EmptyChart isAr={isAr} />
        ) : (
          <div className="space-y-2">
            {data.charts.yearTrend.map((y) => (
              <DrillableMiniHBar
                key={y.year}
                label={`${y.year} · ${isAr ? "سجلات" : "rows"} ${y.totalRows} · ${isAr ? "طلاب" : "students"} ${y.distinctStudents} · 🥇 ${y.goldMedals}`}
                value={y.totalRows}
                max={yearTrendMax}
                isAr={isAr}
                barClassName="h-full rounded-full bg-teal-600"
                drillLabel={drillHint}
                onDrill={() => drill("year_trend", { year: y.year, key: String(y.year) })}
              />
            ))}
          </div>
        )}
      </IntelligenceCollapsibleSection>

      {/* Demographics charts — collapsed by default */}
      <div className={executiveMode ? "hidden print:hidden" : ""}>
      <IntelligenceCollapsibleSection
        id="demographics"
        title={isAr ? "التركيبة الديموغرافية" : "Demographic breakdown"}
        isAr={isAr}
        defaultOpen={false}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { title: isAr ? "الجنس" : "Gender", rows: data.charts.genderParticipation, max: Math.max(1, ...data.charts.genderParticipation.map((x) => x.count)) },
            { title: isAr ? "القسم" : "Section", rows: data.charts.sectionParticipation, max: Math.max(1, ...data.charts.sectionParticipation.map((x) => x.count)) },
            { title: isAr ? "موهبة" : "Mawhiba", rows: data.charts.mawhibaSplit, max: Math.max(1, ...data.charts.mawhibaSplit.map((x) => x.count)) },
          ].map((block) => (
            <div key={block.title}>
              <h4 className="text-xs font-black text-slate-800">{block.title}</h4>
              <div className="mt-2 space-y-2">
                {block.rows.map((r) => (
                  <DrillableMiniHBar
                    key={r.key}
                    label={isAr ? r.labelAr : r.labelEn}
                    value={r.count}
                    max={block.max}
                    isAr={isAr}
                    drillLabel={drillHint}
                    compact
                    onDrill={() => {
                      if (block.title.includes("Gender") || block.title.includes("الجنس")) {
                        drill("gender_bar", { key: r.key, labelAr: r.labelAr, labelEn: r.labelEn });
                      } else if (block.title.includes("Section") || block.title.includes("القسم")) {
                        drill("section_bar", { key: r.key, labelAr: r.labelAr, labelEn: r.labelEn });
                      } else {
                        drill("mawhiba_bar", { key: r.key, labelAr: r.labelAr, labelEn: r.labelEn });
                      }
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </IntelligenceCollapsibleSection>
      </div>

      </IntelligenceCollapsibleSection>

      </IntelligenceLayerShell>
      ) : null}

      {showLayer6 ? (
      <IntelligenceLayerShell
        level={6}
        anchorId="intel-layer-6-tables"
        title={t("workspace.layer.6", loc)}
        isAr={isAr}
      >
      <AnalyticsRenderBoundary sectionId="analytics-table" isAr={isAr}>
        <IntelligenceCollapsibleSection
          id="analytics-table"
          title={t("section.analyticsTable", loc)}
          hint={isAr ? "ملخص · نشاط · تفصيلي · طلاب" : "Summary · activity · detailed · students"}
          isAr={isAr}
          defaultOpen={density === "deep"}
        >
          <ParticipationAnalyticsTable
            isAr={isAr}
            rows={table}
            page={page}
            totalPages={totalPages}
            loading={loading}
            onPageChange={onPageChange}
          />
        </IntelligenceCollapsibleSection>
      </AnalyticsRenderBoundary>
      </IntelligenceLayerShell>
      ) : null}
    </>
  );

  return (
    <ExecutiveDashboardLayout isAr={isAr} executiveMode={executiveMode} historyBar={<DrillDownHistoryBar isAr={isAr} />}>
      <MobileAnalyticsLayout isAr={isAr}>{body}</MobileAnalyticsLayout>
    </ExecutiveDashboardLayout>
  );
};

const ParticipationIntelligenceDashboard = (props: ParticipationIntelligenceDashboardProps) => (
  <IntelligenceWorkspaceProvider>
    <ParticipationIntelligenceDashboardInner {...props} />
  </IntelligenceWorkspaceProvider>
);

export default ParticipationIntelligenceDashboard;
