import SectionCard from "@/components/layout/SectionCard";
import type { HealthScoreBreakdown } from "@/lib/school-intelligence/school-intelligence-transparency-utils";
import { HeartPulse } from "lucide-react";

type SchoolIntelligenceHealthBreakdownProps = {
  isAr: boolean;
  breakdown: HealthScoreBreakdown;
};

const SchoolIntelligenceHealthBreakdown = ({ isAr, breakdown }: SchoolIntelligenceHealthBreakdownProps) => (
  <SectionCard className="mb-4">
    <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
      <HeartPulse className="h-4 w-4" aria-hidden />
      {isAr ? "تفصيل مؤشر الصحة" : "Health score breakdown"}
    </h2>
    <p className="text-lg font-black tabular-nums">
      {isAr ? "الصحة" : "Health"} {breakdown.total}/100
    </p>
    {breakdown.items.length > 0 ? (
      <ul className="mt-2 space-y-1 text-sm text-text-light">
        {breakdown.items.map((item) => (
          <li key={item.labelEn} className="flex items-center gap-2">
            <span aria-hidden>•</span>
            <span>
              {isAr ? item.labelAr : item.labelEn}:{" "}
              <span className="font-semibold text-red-700">-{item.penalty}</span>
            </span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="mt-2 text-sm text-text-light">
        {isAr ? "لا توجد خصومات — النظام يعمل بشكل طبيعي" : "No deductions — system is healthy"}
      </p>
    )}
  </SectionCard>
);

export default SchoolIntelligenceHealthBreakdown;
