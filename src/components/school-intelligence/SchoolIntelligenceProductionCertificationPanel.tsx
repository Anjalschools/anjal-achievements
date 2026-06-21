"use client";

import SectionCard from "@/components/layout/SectionCard";
import type { SchoolIntelligenceFinalReadinessDiagnostics } from "@/lib/school-intelligence/school-intelligence-page-types";
import {
  interpretBuildStatus,
  interpretDiagnosticsStatus,
  interpretHealthScore,
  interpretIntelligenceScore,
  interpretationToneClass,
  interpretSnapshotStatus,
} from "@/lib/school-intelligence/school-intelligence-metric-interpretation";
import { BadgeCheck } from "lucide-react";

type SchoolIntelligenceProductionCertificationPanelProps = {
  isAr: boolean;
  readiness?: SchoolIntelligenceFinalReadinessDiagnostics;
};

const SchoolIntelligenceProductionCertificationPanel = ({
  isAr,
  readiness,
}: SchoolIntelligenceProductionCertificationPanelProps) => {
  if (!readiness) return null;

  const certified = readiness.certificationStatus === "CERTIFIED_PRODUCTION_READY";
  const healthInterpretation = interpretHealthScore(readiness.healthScore);
  const intelligenceInterpretation = interpretIntelligenceScore(readiness.intelligenceScore);

  const items = [
    {
      label: isAr ? "الإصدار" : "Version",
      value: readiness.version,
    },
    {
      label: isAr ? "حالة البناء" : "Build status",
      value: interpretBuildStatus(readiness.buildStatus, isAr),
    },
    {
      label: isAr ? "حالة الاختبارات" : "Test status",
      value: readiness.testStatus,
    },
    {
      label: isAr ? "حالة Snapshot" : "Snapshot status",
      value: interpretSnapshotStatus(readiness.snapshotStatus, isAr),
    },
    {
      label: isAr ? "حالة التشخيص" : "Diagnostics status",
      value: interpretDiagnosticsStatus(readiness.diagnosticsStatus, isAr),
    },
    {
      label: isAr ? "أقسام متاحة" : "Available sections",
      value: String(readiness.availableSections),
    },
    {
      label: isAr ? "أقسام بلا بيانات" : "No-data sections",
      value: String(readiness.noDataSections),
    },
    {
      label: isAr ? "مؤشر الصحة" : "Health score",
      value: `${readiness.healthScore}/100`,
      interpretation: isAr ? healthInterpretation.labelAr : healthInterpretation.labelEn,
      tone: healthInterpretation.tone,
    },
    {
      label: isAr ? "مؤشر الذكاء" : "Intelligence score",
      value: `${readiness.intelligenceScore}/100`,
      interpretation: isAr ? intelligenceInterpretation.labelAr : intelligenceInterpretation.labelEn,
      tone: intelligenceInterpretation.tone,
    },
  ];

  return (
    <SectionCard className="mb-4 border-emerald-200 bg-emerald-50/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">
            {isAr ? "اعتماد شبكة الذكاء المدرسي" : "School Intelligence Network Certification"}
          </h2>
          <p className="mt-1 text-sm text-text-light">
            {isAr
              ? "بطاقة الاعتماد النهائي للإنتاج — Phase D.13"
              : "Final production certification card — Phase D.13"}
          </p>
        </div>
        {certified ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white">
            <BadgeCheck className="h-4 w-4" aria-hidden />
            {isAr ? "✔ جاهز للإنتاج" : "✔ Production Ready"}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
            {isAr ? "غير معتمد بعد" : "Not certified yet"}
          </span>
        )}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-xl border border-border/70 bg-white px-3 py-2">
            <p className="text-xs text-text-light">{item.label}</p>
            <p className="mt-1 text-sm font-bold tabular-nums">{item.value}</p>
            {"interpretation" in item && item.interpretation ? (
              <p className={`mt-1 text-xs font-medium ${interpretationToneClass(item.tone!)}`}>
                {item.interpretation}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      {certified ? (
        <p className="mt-4 text-sm font-semibold text-emerald-800">
          {isAr
            ? "حالة الشبكة: CERTIFIED_PRODUCTION_READY"
            : "Network status: CERTIFIED_PRODUCTION_READY"}
        </p>
      ) : null}
    </SectionCard>
  );
};

export default SchoolIntelligenceProductionCertificationPanel;
