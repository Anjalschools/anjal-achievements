import SectionCard from "@/components/layout/SectionCard";
import type { SchoolIntelligenceSectionKey } from "@/lib/school-intelligence/school-intelligence-page-types";
import { SECTION_LABELS } from "@/lib/school-intelligence/school-intelligence-transparency-utils";
import type { SchoolIntelligenceSectionStatus } from "@/lib/school-intelligence/school-intelligence-page-types";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

type SchoolIntelligenceSectionHealthTableProps = {
  isAr: boolean;
  sectionStatusMap: Record<SchoolIntelligenceSectionKey, SchoolIntelligenceSectionStatus>;
};

const statusIcon = (status: SchoolIntelligenceSectionStatus) => {
  if (status === "available") return <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />;
  if (status === "snapshot") return <AlertTriangle className="h-4 w-4 text-blue-600" aria-hidden />;
  return <XCircle className="h-4 w-4 text-amber-600" aria-hidden />;
};

const statusText = (status: SchoolIntelligenceSectionStatus, isAr: boolean) => {
  if (status === "available") return isAr ? "متاح" : "Available";
  if (status === "snapshot") return isAr ? "نسخة محفوظة" : "Snapshot";
  return isAr ? "غير متاح" : "Unavailable";
};

const SchoolIntelligenceSectionHealthTable = ({
  isAr,
  sectionStatusMap,
}: SchoolIntelligenceSectionHealthTableProps) => {
  const keys = Object.keys(SECTION_LABELS) as SchoolIntelligenceSectionKey[];

  return (
    <SectionCard className="mb-4">
      <h2 className="mb-3 text-base font-bold">{isAr ? "حالة الأقسام" : "Section health"}</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-border/70 text-xs text-text-light">
              <th className="px-2 py-2 text-start">{isAr ? "القسم" : "Section"}</th>
              <th className="px-2 py-2 text-start">{isAr ? "الحالة" : "Status"}</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => {
              const status = sectionStatusMap[key];
              return (
                <tr key={key} className="border-b border-border/40">
                  <td className="px-2 py-2">{isAr ? SECTION_LABELS[key].ar : SECTION_LABELS[key].en}</td>
                  <td className="px-2 py-2">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      {statusIcon(status)}
                      {statusText(status, isAr)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
};

export default SchoolIntelligenceSectionHealthTable;
