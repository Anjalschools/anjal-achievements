"use client";

import { useCallback, useEffect, useState } from "react";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import { getLocale } from "@/lib/i18n";
import { Activity, Download, Loader2, RefreshCw, Shield } from "lucide-react";
import type { PlatformCertificationPayload } from "@/lib/certification/platform-certification-types";

const gradeColor = (grade: string) => {
  if (grade === "excellent") return "text-emerald-700 bg-emerald-50 ring-emerald-200";
  if (grade === "good") return "text-blue-700 bg-blue-50 ring-blue-200";
  if (grade === "fair") return "text-amber-700 bg-amber-50 ring-amber-200";
  if (grade === "poor") return "text-orange-700 bg-orange-50 ring-orange-200";
  return "text-red-700 bg-red-50 ring-red-200";
};

const severityBadge = (severity: string) => {
  if (severity === "critical" || severity === "high") return "text-red-700 bg-red-50";
  if (severity === "medium") return "text-amber-700 bg-amber-50";
  return "text-slate-600 bg-slate-50";
};

const SystemHealthPage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PlatformCertificationPayload | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/system-health", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setData(json.certification || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleExport = () => {
    const params = new URLSearchParams({
      format: "html",
      lang: isAr ? "ar" : "en",
    });
    window.open(`/api/admin/system-health?${params.toString()}`, "_blank");
  };

  return (
    <PageContainer>
      <PageHeader
        title={isAr ? "مركز صحة النظام والاعتماد" : "System health & certification center"}
        subtitle={
          isAr
            ? "فحص مؤسسي للقراءة فقط — كشف المشاكل قبل المستخدم"
            : "Read-only institutional certification — detect issues before users"
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
          <Shield className="h-3 w-3" aria-hidden />
          {isAr ? "قراءة فقط — بلا تعديل للبيانات" : "Read-only — no data mutation"}
        </span>
        <button
          type="button"
          onClick={() => load()}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold"
        >
          <RefreshCw className={loading ? "h-3 w-3 animate-spin" : "h-3 w-3"} aria-hidden />
          {isAr ? "إعادة الفحص" : "Re-scan"}
        </button>
        <button
          type="button"
          onClick={handleExport}
          className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold"
        >
          <Download className="h-3 w-3" aria-hidden />
          {isAr ? "تقرير الجاهزية" : "Readiness report"}
        </button>
      </div>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-text-light">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          <span>{isAr ? "جاري الفحص المؤسسي…" : "Running institutional scan…"}</span>
        </div>
      ) : !data ? (
        <p className="py-12 text-center text-text-light">{isAr ? "لا بيانات." : "No data."}</p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-border/70 p-4">
              <p className="text-xs text-text-light">{isAr ? "جاهزية المنصة" : "Platform readiness"}</p>
              <p className="text-3xl font-black">{data.readinessScore}</p>
              <span
                className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${gradeColor(data.readinessGrade)}`}
              >
                {data.readinessGrade}
              </span>
            </div>
            {[
              { label: isAr ? "أنظمة سليمة" : "Healthy subsystems", value: `${data.subsystemHealth.filter((s) => s.ok).length}/${data.subsystemHealth.length}` },
              { label: isAr ? "مشاكل البيانات" : "Data issues", value: data.dataQuality.issueCount },
              { label: isAr ? "سلامة العلاقات" : "Integrity issues", value: data.crossSystemIntegrity.issueCount },
            ].map((card) => (
              <div key={card.label} className="rounded-2xl border border-border/70 p-4">
                <p className="text-xs text-text-light">{card.label}</p>
                <p className="text-2xl font-black">{card.value}</p>
              </div>
            ))}
          </div>

          <SectionCard>
            <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
              <Activity className="h-4 w-4" aria-hidden />
              {isAr ? "صحة الأنظمة الفرعية" : "Subsystem health"}
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {data.subsystemHealth.map((row) => (
                <div
                  key={row.key}
                  className={`rounded-xl border px-3 py-2 text-sm ${row.ok ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/50"}`}
                >
                  <p className="font-semibold">{isAr ? row.labelAr : row.labelEn}</p>
                  <p className="text-xs text-text-light">{isAr ? row.detailAr : row.detailEn}</p>
                  {row.latencyMs != null ? (
                    <p className="text-[10px] text-text-light" dir="ltr">
                      {row.latencyMs}ms
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </SectionCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard>
              <h2 className="mb-3 text-base font-bold">{isAr ? "جودة البيانات" : "Data quality"}</h2>
              <div className="mb-3 flex flex-wrap gap-2 text-xs">
                {Object.entries(data.dataQuality.summary).map(([key, count]) => (
                  <span key={key} className="rounded-full bg-muted px-2 py-1">
                    {key}: {count}
                  </span>
                ))}
              </div>
              <ul className="divide-y divide-border/60 text-sm">
                {data.dataQuality.issues.slice(0, 10).map((issue, idx) => (
                  <li key={`${issue.code}-${idx}`} className="py-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${severityBadge(issue.severity)}`}>
                      {issue.severity}
                    </span>
                    <p className="mt-1">{isAr ? issue.messageAr : issue.messageEn}</p>
                  </li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard>
              <h2 className="mb-3 text-base font-bold">{isAr ? "سلامة العلاقات بين الأنظمة" : "Cross-system integrity"}</h2>
              <ul className="divide-y divide-border/60 text-sm">
                {data.crossSystemIntegrity.issues.slice(0, 10).map((issue, idx) => (
                  <li key={`${issue.code}-${idx}`} className="py-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${severityBadge(issue.severity)}`}>
                      {issue.severity}
                    </span>
                    <p className="mt-1">{isAr ? issue.messageAr : issue.messageEn}</p>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard>
              <h2 className="mb-3 text-base font-bold">{isAr ? "اعتماد التصدير" : "Export certification"}</h2>
              <p className="mb-2 text-sm text-text-light">
                {data.exportCertification.passed}/{data.exportCertification.tests.length}{" "}
                {isAr ? "نجح" : "passed"}
              </p>
              <ul className="space-y-1 text-xs">
                {data.exportCertification.tests.map((test) => (
                  <li key={test.key} className="flex justify-between gap-2">
                    <span>{isAr ? test.labelAr : test.labelEn}</span>
                    <span className={test.passed ? "text-emerald-700" : "text-red-600"}>
                      {test.passed ? "✓" : "✗"} {test.durationMs}ms
                    </span>
                  </li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard>
              <h2 className="mb-3 text-base font-bold">{isAr ? "النسخ الاحتياطي والاستعادة" : "Backup & restore validation"}</h2>
              <p className="text-sm">{isAr ? data.backupValidation.noteAr : data.backupValidation.noteEn}</p>
              <p className="mt-2 text-xs text-text-light">
                {isAr ? "آخر لقطة:" : "Last snapshot:"}{" "}
                {data.backupValidation.snapshotMarkerAt || (isAr ? "غير مسجّلة" : "Not registered")}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {Object.entries(data.backupValidation.collectionCounts).map(([key, count]) => (
                  <span key={key} className="rounded-full bg-muted px-2 py-1">
                    {key}: {count}
                  </span>
                ))}
              </div>
            </SectionCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard>
              <h2 className="mb-3 text-base font-bold">{isAr ? "الأداء" : "Performance"}</h2>
              <ul className="space-y-1 text-xs">
                {data.performance.metrics.map((metric) => (
                  <li key={metric.key} className="flex justify-between gap-2">
                    <span>{isAr ? metric.labelAr : metric.labelEn}</span>
                    <span className={metric.withinLimit ? "text-emerald-700" : "text-amber-700"} dir="ltr">
                      {metric.durationMs}ms / {metric.limitMs}ms
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[10px] text-text-light" dir="ltr">
                heap {data.performance.memoryMb.heapUsed}/{data.performance.memoryMb.heapTotal} MB · rss{" "}
                {data.performance.memoryMb.rss} MB
              </p>
            </SectionCard>

            <SectionCard>
              <h2 className="mb-3 text-base font-bold">{isAr ? "تغطية التدقيق" : "Audit coverage"}</h2>
              <p className="mb-2 text-2xl font-black">{data.auditCoverage.coveragePct}%</p>
              <ul className="max-h-48 space-y-1 overflow-y-auto text-xs">
                {data.auditCoverage.items.map((item) => (
                  <li key={item.actionType} className="flex justify-between gap-2">
                    <span>{isAr ? item.labelAr : item.labelEn}</span>
                    <span className={item.covered ? "text-emerald-700" : "text-red-600"}>
                      {item.recentEventCount}
                    </span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard>
              <h2 className="mb-3 text-base font-bold">{isAr ? "المراجعة الأمنية" : "Security review"}</h2>
              <ul className="space-y-2 text-sm">
                {data.securityReview.checks.map((check) => (
                  <li key={check.key} className="flex items-start justify-between gap-2">
                    <span>{isAr ? check.labelAr : check.labelEn}</span>
                    <span className={check.passed ? "text-emerald-700" : "text-red-600"}>
                      {check.passed ? "✓" : "✗"}
                    </span>
                  </li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard>
              <h2 className="mb-3 text-base font-bold">{isAr ? "المراقبة والتنبيهات" : "Observability"}</h2>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-xl bg-muted/50 p-2">
                  <p className="font-black">{data.observability.slowRouteCount}</p>
                  <p>{isAr ? "مسارات بطيئة" : "Slow routes"}</p>
                </div>
                <div className="rounded-xl bg-muted/50 p-2">
                  <p className="font-black">{data.observability.recentAuditFailures}</p>
                  <p>{isAr ? "فشل تدقيق" : "Audit failures"}</p>
                </div>
                <div className="rounded-xl bg-muted/50 p-2">
                  <p className="font-black">{data.observability.integrityViolationCount}</p>
                  <p>{isAr ? "انتهاكات" : "Violations"}</p>
                </div>
              </div>
              {(data.observability.warnings.length > 0 || data.observability.errors.length > 0) && (
                <ul className="mt-3 divide-y divide-border/60 text-xs">
                  {[...data.observability.errors, ...data.observability.warnings].slice(0, 8).map((w, idx) => (
                    <li key={idx} className="py-1.5">
                      {isAr ? w.messageAr : w.messageEn}
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>

          <SectionCard>
            <h2 className="mb-3 text-base font-bold">{isAr ? "تفصيل الجاهزية" : "Readiness breakdown"}</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-border/70">
                    <th className="px-2 py-2 text-start">{isAr ? "المجال" : "Area"}</th>
                    <th className="px-2 py-2">{isAr ? "الدرجة" : "Score"}</th>
                    <th className="px-2 py-2">{isAr ? "الوزن" : "Weight"}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.readinessBreakdown.map((row) => (
                    <tr key={row.area} className="border-b border-border/40">
                      <td className="px-2 py-2">{isAr ? row.labelAr : row.labelEn}</td>
                      <td className="px-2 py-2 text-center font-bold">{row.score}</td>
                      <td className="px-2 py-2 text-center">{row.weight}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      )}
    </PageContainer>
  );
};

export default SystemHealthPage;
