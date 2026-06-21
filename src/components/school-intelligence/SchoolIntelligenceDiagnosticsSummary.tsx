import SectionCard from "@/components/layout/SectionCard";
import SchoolIntelligenceMetricHelp from "@/components/school-intelligence/SchoolIntelligenceMetricHelp";
import type { SchoolIntelligencePageDiagnostics } from "@/lib/school-intelligence/school-intelligence-page-types";
import { countSlowSignals } from "@/lib/school-intelligence/school-intelligence-page-utils";
import { Activity, HeartPulse, Layers, Timer } from "lucide-react";

type SchoolIntelligenceDiagnosticsSummaryProps = {
  isAr: boolean;
  diagnostics?: SchoolIntelligencePageDiagnostics;
  healthScore?: number | null;
  intelligenceScore?: number | null;
  availableSections: number;
  noDataSections?: number;
  unavailableSections: number;
};

const SchoolIntelligenceDiagnosticsSummary = ({
  isAr,
  diagnostics,
  healthScore,
  intelligenceScore,
  availableSections,
  noDataSections = 0,
  unavailableSections,
}: SchoolIntelligenceDiagnosticsSummaryProps) => {
  const slowCount = countSlowSignals(diagnostics);

  const items = [
    {
      key: "health_score",
      label: isAr ? "مؤشر الصحة" : "Health score",
      value: healthScore != null ? `${healthScore}/100` : "—",
      icon: HeartPulse,
      helpKey: "health_score" as const,
    },
    {
      key: "intelligence_score",
      label: isAr ? "مؤشر الذكاء" : "Intelligence score",
      value: intelligenceScore != null ? `${intelligenceScore}/100` : "—",
      icon: Activity,
      helpKey: "intelligence_score" as const,
    },
    {
      key: "available_sections",
      label: isAr ? "أقسام متاحة" : "Available sections",
      value: String(availableSections),
      icon: Layers,
    },
    {
      key: "no_data_sections",
      label: isAr ? "أقسام بلا بيانات" : "No-data sections",
      value: String(noDataSections),
      icon: Layers,
    },
    {
      key: "unavailable_sections",
      label: isAr ? "أقسام غير متاحة" : "Unavailable sections",
      value: String(unavailableSections),
      icon: Layers,
    },
    {
      key: "slow_queries",
      label: isAr ? "استعلامات بطيئة" : "Slow queries",
      value: String(slowCount),
      icon: Timer,
    },
  ];

  return (
    <SectionCard>
      <h2 className="mb-3 text-base font-bold">
        {isAr ? "ملخص التشخيص" : "Diagnostics summary"}
      </h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        {items.map((item) => (
          <div key={item.key} className="rounded-xl border border-border/70 px-3 py-2">
            <div className="flex items-center gap-1.5 text-xs text-text-light">
              <item.icon className="h-3.5 w-3.5" aria-hidden />
              <span>{item.label}</span>
              {"helpKey" in item && item.helpKey ? (
                <SchoolIntelligenceMetricHelp isAr={isAr} metricKey={item.helpKey} />
              ) : null}
            </div>
            <p className="mt-1 text-lg font-black tabular-nums">{item.value}</p>
          </div>
        ))}
      </div>
      {diagnostics?.runtimeVersion ? (
        <p className="mt-2 text-[11px] text-text-light">
          {isAr ? "إصدار التشغيل:" : "Runtime:"} {diagnostics.runtimeVersion}
        </p>
      ) : null}
    </SectionCard>
  );
};

export default SchoolIntelligenceDiagnosticsSummary;
