"use client";

import SectionCard from "@/components/layout/SectionCard";
import type { SchoolImprovementFullDiagnostics } from "@/lib/school-improvement/intelligence-diagnostics-types";
import { Activity, AlertTriangle, CheckCircle2, Clock3, Database, Server } from "lucide-react";
import Link from "next/link";

const statusColor = (status: string) => {
  if (status === "healthy" || status === "success") return "text-emerald-700 bg-emerald-50 ring-emerald-200";
  if (status === "warning" || status === "no_data") return "text-amber-700 bg-amber-50 ring-amber-200";
  return "text-red-700 bg-red-50 ring-red-200";
};

type SchoolImprovementDiagnosticsPanelProps = {
  diagnostics: SchoolImprovementFullDiagnostics;
  isAr: boolean;
};

export const SchoolImprovementDiagnosticsPanel = ({
  diagnostics,
  isAr,
}: SchoolImprovementDiagnosticsPanelProps) => {
  const unavailableReports = diagnostics.sectionReports.filter((section) => section.status === "unavailable");
  const slowQueries = diagnostics.mongoQueries.filter((query) => query.slow);
  const healthScore = diagnostics.healthScore?.score;
  const healthLabel = isAr ? diagnostics.healthScore?.labelAr : diagnostics.healthScore?.labelEn;

  return (
    <SectionCard>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold">
            <Activity className="h-4 w-4" aria-hidden />
            {isAr ? "تشخيص ذكاء التحسين المدرسي" : "School improvement intelligence diagnostics"}
          </h2>
          <p className="mt-1 text-xs text-text-light">
            {isAr
              ? "تشخيصات تنفيذية للمسؤول — الخدمة، الاستعلام، والخطأ الجذري"
              : "System admin execution diagnostics — service, query, and root cause"}
          </p>
          {healthScore != null ? (
            <p className="mt-2 text-sm font-bold text-primary">
              {isAr ? "مؤشر الصحة" : "Health score"}: {healthScore}/100 {healthLabel ? `(${healthLabel})` : ""}
            </p>
          ) : null}
          <Link href="/admin/intelligence-health" className="mt-2 inline-block text-xs font-semibold text-primary underline">
            {isAr ? "مركز صحة الذكاء المؤسسي" : "Institutional intelligence health center"}
          </Link>
        </div>
        <div className="rounded-xl border border-border/70 px-3 py-2 text-xs">
          <p className="text-text-light">{isAr ? "آخر تحديث" : "Last refresh"}</p>
          <p className="font-semibold">{new Date(diagnostics.generatedAt).toLocaleString(isAr ? "ar-SA" : "en-US")}</p>
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: isAr ? "أقسام سليمة" : "Healthy sections",
            value: diagnostics.healthySections.length,
            icon: CheckCircle2,
          },
          {
            label: isAr ? "أقسام غير متاحة" : "Unavailable sections",
            value: diagnostics.unavailableSections.length,
            icon: AlertTriangle,
          },
          {
            label: isAr ? "أقسام بطيئة" : "Slow sections",
            value: diagnostics.slowSections.length,
            icon: Clock3,
          },
          {
            label: isAr ? "زمن التنفيذ" : "Execution time",
            value: `${diagnostics.totalDurationMs}ms`,
            icon: Server,
          },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-border/70 px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-text-light">
              <card.icon className="h-3.5 w-3.5" aria-hidden />
              {card.label}
            </div>
            <p className="mt-1 text-xl font-black">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-bold">{isAr ? "حالة البيئة" : "Environment status"}</h3>
          <ul className="space-y-2 text-sm">
            {diagnostics.environment.map((check) => (
              <li key={check.key} className={`rounded-lg px-3 py-2 ring-1 ${statusColor(check.status)}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{isAr ? check.labelAr : check.labelEn}</span>
                  <span className="text-xs uppercase">{check.status}</span>
                </div>
                {check.detail ? <p className="mt-1 text-xs">{check.detail}</p> : null}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold">
            <Database className="h-4 w-4" aria-hidden />
            {isAr ? "استعلامات Mongo البطيئة" : "Slow Mongo queries"}
          </h3>
          {slowQueries.length === 0 ? (
            <p className="text-sm text-text-light">{isAr ? "لا توجد استعلامات بطيئة." : "No slow queries."}</p>
          ) : (
            <ul className="max-h-56 space-y-2 overflow-y-auto text-xs">
              {slowQueries.slice(0, 12).map((query, index) => (
                <li key={`${query.collection}-${query.operation}-${index}`} className="rounded-lg border border-border/70 px-3 py-2">
                  <p className="font-semibold">
                    {query.collection}.{query.pipelineName || query.operation}
                  </p>
                  <p className="text-text-light">
                    {query.durationMs}ms · {query.documentsReturned} docs
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {unavailableReports.length > 0 ? (
        <div className="mb-4">
          <h3 className="mb-2 text-sm font-bold">{isAr ? "الأسباب الجذرية للأقسام غير المتاحة" : "Unavailable section root causes"}</h3>
          <ul className="space-y-3 text-sm">
            {unavailableReports.map((section) => (
              <li key={section.section} className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-950">
                <p className="font-bold">{section.section}</p>
                <p className="text-xs">{section.service || "—"}</p>
                <p className="mt-1">{section.error?.message || "—"}</p>
                {section.error?.stack ? (
                  <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap text-[11px]">{section.error.stack}</pre>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {diagnostics.aggregationFailures.length > 0 ? (
        <div className="mb-4">
          <h3 className="mb-2 text-sm font-bold">{isAr ? "فشل التجميعات" : "Aggregation failures"}</h3>
          <ul className="space-y-2 text-xs">
            {diagnostics.aggregationFailures.map((failure, index) => (
              <li key={`${failure.pipelineName}-${index}`} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="font-semibold">
                  {failure.pipelineName} · {failure.collection}
                  {failure.stageIndex != null ? ` · stage ${failure.stageIndex}` : ""}
                </p>
                <p>{failure.error}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {diagnostics.modelIssues.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-bold">{isAr ? "مشاكل النماذج / الاستيراد" : "Model / import issues"}</h3>
          <ul className="space-y-2 text-xs">
            {diagnostics.modelIssues.map((issue, index) => (
              <li key={`${issue.name}-${index}`} className="rounded-lg border border-border/70 px-3 py-2">
                <p className="font-semibold">
                  {issue.kind}: {issue.name}
                </p>
                <p>{issue.message}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </SectionCard>
  );
};
