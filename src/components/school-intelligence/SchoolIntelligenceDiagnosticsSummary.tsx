import SectionCard from "@/components/layout/SectionCard";
import type { SchoolIntelligencePageDiagnostics } from "@/lib/school-intelligence/school-intelligence-page-types";
import { countSlowSignals } from "@/lib/school-intelligence/school-intelligence-page-utils";
import { Activity, HeartPulse, Layers, Timer } from "lucide-react";

type SchoolIntelligenceDiagnosticsSummaryProps = {
  isAr: boolean;
  diagnostics?: SchoolIntelligencePageDiagnostics;
  healthScore?: number | null;
  resilienceScore?: number | null;
  availableSections: number;
  unavailableSections: number;
};

const SchoolIntelligenceDiagnosticsSummary = ({
  isAr,
  diagnostics,
  healthScore,
  resilienceScore,
  availableSections,
  unavailableSections,
}: SchoolIntelligenceDiagnosticsSummaryProps) => {
  const slowCount = countSlowSignals(diagnostics);

  const items = [
    {
      label: isAr ? "مؤشر الصحة" : "Health score",
      value: healthScore != null ? `${healthScore}/100` : "—",
      icon: HeartPulse,
    },
    {
      label: isAr ? "مؤشر المرونة" : "Resilience score",
      value: resilienceScore != null ? `${resilienceScore}/100` : "—",
      icon: Activity,
    },
    {
      label: isAr ? "أقسام متاحة" : "Available sections",
      value: String(availableSections),
      icon: Layers,
    },
    {
      label: isAr ? "أقسام غير متاحة" : "Unavailable sections",
      value: String(unavailableSections),
      icon: Layers,
    },
    {
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
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {items.map((item) => (
          <div key={item.label} className="rounded-xl border border-border/70 px-3 py-2">
            <div className="flex items-center gap-1.5 text-xs text-text-light">
              <item.icon className="h-3.5 w-3.5" aria-hidden />
              {item.label}
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
