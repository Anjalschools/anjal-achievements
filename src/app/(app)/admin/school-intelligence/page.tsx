"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SchoolIntelligenceAdminActions from "@/components/school-intelligence/SchoolIntelligenceAdminActions";
import SchoolIntelligenceDiagnosticsSummary from "@/components/school-intelligence/SchoolIntelligenceDiagnosticsSummary";
import SchoolIntelligenceEmptyState from "@/components/school-intelligence/SchoolIntelligenceEmptyState";
import SchoolIntelligenceSectionCard from "@/components/school-intelligence/SchoolIntelligenceSectionCard";
import SchoolIntelligenceSnapshotIndicator from "@/components/school-intelligence/SchoolIntelligenceSnapshotIndicator";
import SchoolIntelligenceStatusBanner from "@/components/school-intelligence/SchoolIntelligenceStatusBanner";
import { getLocale } from "@/lib/i18n";
import type {
  SchoolIntelligenceApiResponse,
  SchoolIntelligenceBuildStatus,
  SchoolIntelligencePageDiagnostics,
} from "@/lib/school-intelligence/school-intelligence-page-types";
import {
  buildSectionStatusMap,
  countSectionsByStatus,
  deriveDisplayScoresFromDiagnostics,
  parseSchoolIntelligenceResponse,
  resolveDataSource,
  resolveLastSuccessfulUpdate,
  resolveSnapshotTimestamp,
} from "@/lib/school-intelligence/school-intelligence-page-utils";
import type { SchoolIntelligencePayload } from "@/lib/school-intelligence/school-intelligence-types";
import { Download, GraduationCap, Loader2, Shield } from "lucide-react";

const EXPORT_TOOLTIP_AR = "التقارير غير متاحة لعدم توفر بيانات الذكاء المدرسي";
const EXPORT_TOOLTIP_EN = "Reports unavailable because school intelligence data is not available";

const formatTimestamp = (value: string | null, isAr: boolean) => {
  if (!value) return isAr ? "—" : "—";
  try {
    return new Date(value).toLocaleString(isAr ? "ar-SA" : "en-US");
  } catch {
    return value;
  }
};

const SchoolIntelligencePage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<SchoolIntelligenceBuildStatus>("success");
  const [diagnostics, setDiagnostics] = useState<SchoolIntelligencePageDiagnostics | undefined>();
  const [snapshotUsed, setSnapshotUsed] = useState(false);
  const [data, setData] = useState<SchoolIntelligencePayload | null>(null);
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);

  const sectionStatusMap = useMemo(
    () => buildSectionStatusMap(data, status, snapshotUsed),
    [data, status, snapshotUsed]
  );
  const sectionCounts = useMemo(() => countSectionsByStatus(sectionStatusMap), [sectionStatusMap]);
  const displayScores = useMemo(
    () => deriveDisplayScoresFromDiagnostics(diagnostics),
    [diagnostics]
  );
  const lastUpdate = useMemo(
    () => resolveLastSuccessfulUpdate(diagnostics, data, snapshotUsed),
    [diagnostics, data, snapshotUsed]
  );
  const snapshotTimestamp = useMemo(
    () => resolveSnapshotTimestamp(diagnostics, data),
    [diagnostics, data]
  );
  const dataSource = useMemo(
    () => resolveDataSource(status, snapshotUsed, isAr),
    [status, snapshotUsed, isAr]
  );

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/user/profile", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        setIsSystemAdmin(String(json.role || "").trim() === "admin");
      } catch {
        setIsSystemAdmin(false);
      }
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/school-intelligence", { cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as SchoolIntelligenceApiResponse;

      if (res.status === 401 || res.status === 403) {
        throw new Error(typeof json.messageAr === "string" ? json.messageAr : "Forbidden");
      }

      const parsed = parseSchoolIntelligenceResponse(json);
      setData(parsed.intelligence);
      setStatus(parsed.status);
      setDiagnostics(parsed.diagnostics);
      setSnapshotUsed(parsed.snapshotUsed);
      setError(null);

      if (json.diagnostics?.runtimeVersion || json.diagnostics?.buildTimestamp) {
        console.log(
          "[SchoolIntelligence Runtime]",
          json.diagnostics.runtimeVersion,
          json.diagnostics.buildTimestamp
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setData(null);
      setStatus("unavailable");
      setSnapshotUsed(false);
      setDiagnostics(undefined);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleExport = (report: string) => {
    if (status === "unavailable") return;
    const params = new URLSearchParams({
      format: "html",
      report,
      lang: isAr ? "ar" : "en",
    });
    window.open(`/api/admin/school-intelligence/export?${params.toString()}`, "_blank");
  };

  const exportsDisabled = status === "unavailable";
  const exportTooltip = isAr ? EXPORT_TOOLTIP_AR : EXPORT_TOOLTIP_EN;

  const hasSummaryData =
    Boolean(data) &&
    (data!.schoolExcellence.excellenceIndex > 0 || data!.studentSuccessGraph.totalNodes > 0);

  return (
    <PageContainer>
      <PageHeader
        title={isAr ? "شبكة الذكاء المدرسي" : "School intelligence network"}
        subtitle={
          isAr
            ? "طبقة موحدة للقراءة فقط — مؤشرات نجاح الطالب وتميز المدرسة"
            : "Unified read-only layer — student success and school excellence indices"
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
          <Shield className="h-3 w-3" aria-hidden />
          {isAr ? "قراءة فقط — بلا تعديل للبيانات" : "Read-only — no data mutation"}
        </span>
        {(["school", "board", "strategic_planning"] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => handleExport(kind)}
            disabled={exportsDisabled}
            title={exportsDisabled ? exportTooltip : undefined}
            aria-disabled={exportsDisabled}
            className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Download className="h-3 w-3" aria-hidden />
            {kind === "school"
              ? isAr
                ? "تقرير مدرسي"
                : "School report"
              : kind === "board"
                ? isAr
                  ? "تقرير المجلس"
                  : "Board report"
                : isAr
                  ? "التخطيط الاستراتيجي"
                  : "Strategic planning"}
          </button>
        ))}
      </div>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      {!loading ? (
        <>
          <SchoolIntelligenceStatusBanner
            isAr={isAr}
            status={status}
            lastUpdate={lastUpdate}
            dataSource={dataSource}
          />
          <SchoolIntelligenceSnapshotIndicator
            isAr={isAr}
            snapshotUsed={snapshotUsed}
            snapshotTimestamp={snapshotTimestamp}
          />
          <p className="mb-4 text-xs text-text-light">
            {isAr ? "آخر تحديث ناجح:" : "Last successful update:"}{" "}
            <span className="font-semibold text-text">{formatTimestamp(lastUpdate, isAr)}</span>
          </p>
        </>
      ) : null}

      {isSystemAdmin && !loading ? (
        <SchoolIntelligenceAdminActions isAr={isAr} onRetry={load} onRefresh={load} />
      ) : null}

      {!loading ? (
        <div className="mb-4">
          <SchoolIntelligenceDiagnosticsSummary
            isAr={isAr}
            diagnostics={diagnostics}
            healthScore={displayScores.healthScore}
            resilienceScore={displayScores.resilienceScore}
            availableSections={sectionCounts.available + sectionCounts.snapshot}
            unavailableSections={sectionCounts.unavailable}
          />
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-text-light">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          <span>{isAr ? "جاري بناء شبكة الذكاء…" : "Building intelligence network…"}</span>
        </div>
      ) : !data ? (
        <SchoolIntelligenceEmptyState
          isAr={isAr}
          title={isAr ? "تعذر تحميل شبكة الذكاء المدرسي" : "School intelligence could not be loaded"}
          description={
            isAr
              ? "يرجى إعادة المحاولة أو التحقق من حالة النظام أعلاه"
              : "Please retry or review the system status above"
          }
        />
      ) : (
        <div className="space-y-4">
          <SchoolIntelligenceSectionCard
            isAr={isAr}
            title={isAr ? "ملخص المؤشرات" : "Indicator summary"}
            sectionStatus={sectionStatusMap.summary}
            hasData={hasSummaryData}
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-border/70 p-4">
                <p className="text-xs text-text-light">{isAr ? "تميز المدرسة" : "School excellence"}</p>
                <p className="text-3xl font-black text-emerald-700">{data.schoolExcellence.excellenceIndex}</p>
              </div>
              {[
                {
                  label: isAr ? "مؤشر نجاح الطلاب" : "Avg student success",
                  value: data.studentSuccessGraph.avgSuccessIndex,
                },
                {
                  label: isAr ? "معدل المشاركة" : "Participation rate",
                  value: `${data.schoolExcellence.participationRatePct}%`,
                },
                { label: isAr ? "تدخلات" : "Interventions", value: data.interventions.length },
              ].map((card) => (
                <div key={card.label} className="rounded-2xl border border-border/70 p-4">
                  <p className="text-xs text-text-light">{card.label}</p>
                  <p className="text-2xl font-black">{card.value}</p>
                </div>
              ))}
            </div>
          </SchoolIntelligenceSectionCard>

          <SchoolIntelligenceSectionCard
            isAr={isAr}
            title={
              <span className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4" aria-hidden />
                {isAr ? "رؤى استراتيجية" : "Strategic insights"}
              </span>
            }
            sectionStatus={sectionStatusMap.strategic_insights}
            hasData={data.strategicInsights.length > 0}
          >
            <ul className="space-y-2 text-sm">
              {data.strategicInsights.map((ins) => (
                <li key={ins.id} className="rounded-xl bg-muted/50 px-3 py-2">
                  <p className="font-semibold">{isAr ? ins.titleAr : ins.titleEn}</p>
                  <p className="text-text-light">{isAr ? ins.bodyAr : ins.bodyEn}</p>
                </li>
              ))}
            </ul>
          </SchoolIntelligenceSectionCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <SchoolIntelligenceSectionCard
              isAr={isAr}
              title={isAr ? "نجاح الطلاب (SSI)" : "Student success (SSI)"}
              sectionStatus={sectionStatusMap.student_success}
              hasData={data.studentSuccessGraph.topStudents.length > 0}
            >
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/70">
                      <th className="px-2 py-2 text-start">{isAr ? "الطالب" : "Student"}</th>
                      <th className="px-2 py-2">{isAr ? "الصف" : "Grade"}</th>
                      <th className="px-2 py-2">SSI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.studentSuccessGraph.topStudents.slice(0, 12).map((row) => (
                      <tr key={row.studentId} className="border-b border-border/40">
                        <td className="px-2 py-2">{row.fullNameAr || row.fullNameEn}</td>
                        <td className="px-2 py-2 text-center">{row.grade}</td>
                        <td className="px-2 py-2 text-center font-bold">{row.successIndex}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SchoolIntelligenceSectionCard>

            <SchoolIntelligenceSectionCard
              isAr={isAr}
              title={isAr ? "تميز الأقسام والمسارات" : "Department excellence"}
              sectionStatus={sectionStatusMap.department_excellence}
              hasData={data.departmentExcellence.length > 0}
            >
              <ul className="divide-y divide-border/60 text-sm">
                {data.departmentExcellence.map((row) => (
                  <li key={row.key} className="flex justify-between py-2">
                    <span>{isAr ? row.labelAr : row.labelEn}</span>
                    <span className="font-bold text-emerald-700">{row.excellenceIndex}</span>
                  </li>
                ))}
              </ul>
            </SchoolIntelligenceSectionCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SchoolIntelligenceSectionCard
              isAr={isAr}
              title={isAr ? "اكتشاف المواهب" : "Talent discovery"}
              sectionStatus={sectionStatusMap.talent_discovery}
              hasData={data.talentDiscovery.length > 0}
            >
              <ul className="divide-y divide-border/60 text-sm">
                {data.talentDiscovery.slice(0, 10).map((row) => (
                  <li key={`${row.studentId}-${row.talentType}`} className="py-2">
                    <p className="font-semibold">{row.fullName}</p>
                    <p className="text-text-light">{isAr ? row.detailAr : row.detailEn}</p>
                  </li>
                ))}
              </ul>
            </SchoolIntelligenceSectionCard>

            <SchoolIntelligenceSectionCard
              isAr={isAr}
              title={isAr ? "محرك التدخل" : "Intervention engine"}
              sectionStatus={sectionStatusMap.interventions}
              hasData={data.interventions.length > 0}
            >
              <ul className="divide-y divide-border/60 text-sm">
                {data.interventions.slice(0, 10).map((row) => (
                  <li key={`${row.studentId}-${row.interventionType}`} className="py-2">
                    <p className="font-semibold">{row.fullName}</p>
                    <p className="text-text-light">{isAr ? row.detailAr : row.detailEn}</p>
                  </li>
                ))}
              </ul>
            </SchoolIntelligenceSectionCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SchoolIntelligenceSectionCard
              isAr={isAr}
              title={isAr ? "خريطة الفرص" : "Opportunity mapping"}
              sectionStatus={sectionStatusMap.opportunity_mapping}
              hasData={data.opportunityMapping.length > 0}
            >
              <ul className="divide-y divide-border/60 text-sm">
                {data.opportunityMapping.slice(0, 10).map((row) => (
                  <li key={row.key} className="flex justify-between gap-2 py-2">
                    <span>{isAr ? row.labelAr : row.labelEn}</span>
                    <span className="font-bold text-amber-700">{row.gapPct}%</span>
                  </li>
                ))}
              </ul>
            </SchoolIntelligenceSectionCard>

            <SchoolIntelligenceSectionCard
              isAr={isAr}
              title={isAr ? "النمو الطولي" : "Growth tracking"}
              sectionStatus={sectionStatusMap.longitudinal_growth}
              hasData={data.longitudinalGrowth.length > 0}
            >
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/70">
                      <th className="px-2 py-2">{isAr ? "السنة" : "Year"}</th>
                      <th className="px-2 py-2">{isAr ? "المشاركات" : "Participations"}</th>
                      <th className="px-2 py-2">{isAr ? "النمو" : "Growth"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.longitudinalGrowth.map((row) => (
                      <tr key={row.year} className="border-b border-border/40">
                        <td className="px-2 py-2 text-center">{row.year}</td>
                        <td className="px-2 py-2 text-center">{row.participations}</td>
                        <td className="px-2 py-2 text-center">{row.growthRatePct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SchoolIntelligenceSectionCard>
          </div>
        </div>
      )}
    </PageContainer>
  );
};

export default SchoolIntelligencePage;
