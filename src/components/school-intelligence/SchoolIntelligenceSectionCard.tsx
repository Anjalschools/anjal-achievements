import SectionCard from "@/components/layout/SectionCard";
import SchoolIntelligenceEmptyState from "@/components/school-intelligence/SchoolIntelligenceEmptyState";
import type {
  SchoolIntelligencePageDiagnostics,
  SchoolIntelligenceSectionStatus,
} from "@/lib/school-intelligence/school-intelligence-page-types";
import { sectionStatusLabel } from "@/lib/school-intelligence/school-intelligence-page-utils";
import { resolveSectionEmptyKind } from "@/lib/school-intelligence/school-intelligence-transparency-utils";
import type { SchoolIntelligenceBuildStatus } from "@/lib/school-intelligence/school-intelligence-page-types";
import type { ReactNode } from "react";

const statusBadgeTone: Record<SchoolIntelligenceSectionStatus, string> = {
  available: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  snapshot: "bg-blue-50 text-blue-800 ring-blue-200",
  unavailable: "bg-amber-50 text-amber-800 ring-amber-200",
};

type SchoolIntelligenceSectionCardProps = {
  isAr: boolean;
  title: ReactNode;
  sectionStatus: SchoolIntelligenceSectionStatus;
  globalStatus: SchoolIntelligenceBuildStatus;
  diagnostics?: SchoolIntelligencePageDiagnostics;
  hasData: boolean;
  children: ReactNode;
};

const SchoolIntelligenceSectionCard = ({
  isAr,
  title,
  sectionStatus,
  globalStatus,
  diagnostics,
  hasData,
  children,
}: SchoolIntelligenceSectionCardProps) => {
  const emptyKind = resolveSectionEmptyKind(sectionStatus, globalStatus, diagnostics);

  return (
    <SectionCard>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold">{title}</h2>
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${statusBadgeTone[sectionStatus]}`}
        >
          {sectionStatusLabel(sectionStatus, isAr)}
        </span>
      </div>
      {hasData ? children : <SchoolIntelligenceEmptyState isAr={isAr} kind={emptyKind} />}
    </SectionCard>
  );
};

export default SchoolIntelligenceSectionCard;
