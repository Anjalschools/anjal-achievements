"use client";

import SectionCard from "@/components/layout/SectionCard";
import type { SchoolIntelligenceFinalReadinessDiagnostics } from "@/lib/school-intelligence/school-intelligence-page-types";
import {
  interpretDiagnosticsStatus,
  interpretSnapshotStatus,
} from "@/lib/school-intelligence/school-intelligence-metric-interpretation";
import { CheckCircle2, ShieldAlert } from "lucide-react";

type SchoolIntelligenceFinalReadinessPanelProps = {
  isAr: boolean;
  readiness?: SchoolIntelligenceFinalReadinessDiagnostics;
};

const SchoolIntelligenceFinalReadinessPanel = ({
  isAr,
  readiness,
}: SchoolIntelligenceFinalReadinessPanelProps) => {
  if (!readiness) return null;

  const productionReady = readiness.finalReadiness === "PRODUCTION_READY";

  return (
    <SectionCard className="mb-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">
            {isAr ? "جاهزية الإنتاج" : "Production readiness"}
          </h2>
          <p className="mt-1 text-sm text-text-light">
            {isAr ? "تقييم نهائي لاستقرار شبكة الذكاء المدرسي." : "Final stability assessment for the School Intelligence Network."}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
            productionReady
              ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
              : "bg-amber-50 text-amber-800 ring-amber-200"
          }`}
        >
          {productionReady ? (
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
          )}
          {productionReady
            ? isAr
              ? "جاهز للإنتاج"
              : "Production Ready"
            : isAr
              ? "غير جاهز"
              : "Not Ready"}
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: isAr ? "الإصدار" : "Version", value: readiness.version },
          { label: isAr ? "أقسام متاحة" : "Available sections", value: String(readiness.availableSections) },
          { label: isAr ? "أقسام بلا بيانات" : "No-data sections", value: String(readiness.noDataSections) },
          { label: isAr ? "أقسام غير متاحة" : "Unavailable sections", value: String(readiness.unavailableSections) },
          { label: isAr ? "مؤشر الصحة" : "Health score", value: `${readiness.healthScore}/100` },
          { label: isAr ? "مؤشر الذكاء" : "Intelligence score", value: `${readiness.intelligenceScore}/100` },
          { label: isAr ? "حالة Snapshot" : "Snapshot status", value: interpretSnapshotStatus(readiness.snapshotStatus, isAr) },
          { label: isAr ? "حالة التشخيص" : "Diagnostics status", value: interpretDiagnosticsStatus(readiness.diagnosticsStatus, isAr) },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-border/70 px-3 py-2">
            <p className="text-xs text-text-light">{item.label}</p>
            <p className="mt-1 text-sm font-bold tabular-nums">{item.value}</p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
};

export default SchoolIntelligenceFinalReadinessPanel;
