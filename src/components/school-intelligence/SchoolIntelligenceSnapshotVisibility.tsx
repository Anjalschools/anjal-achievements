import SectionCard from "@/components/layout/SectionCard";
import type { SnapshotVisibility } from "@/lib/school-intelligence/school-intelligence-transparency-utils";
import { Database, History } from "lucide-react";

type SchoolIntelligenceSnapshotVisibilityProps = {
  isAr: boolean;
  snapshot: SnapshotVisibility;
};

const formatTimestamp = (value: string | null, isAr: boolean) => {
  if (!value) return isAr ? "—" : "—";
  try {
    return new Date(value).toLocaleString(isAr ? "ar-SA" : "en-US");
  } catch {
    return value;
  }
};

const SchoolIntelligenceSnapshotVisibility = ({ isAr, snapshot }: SchoolIntelligenceSnapshotVisibilityProps) => (
  <SectionCard className="mb-4">
    <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
      <History className="h-4 w-4" aria-hidden />
      {isAr ? "حالة النسخة المحفوظة" : "Snapshot status"}
    </h2>
    <div className="grid gap-2 sm:grid-cols-3">
      <div className="rounded-xl border border-border/70 px-3 py-2">
        <p className="text-xs text-text-light">{isAr ? "Snapshot متاح" : "Snapshot available"}</p>
        <p className="mt-1 font-semibold">{snapshot.available ? (isAr ? "نعم" : "Yes") : isAr ? "لا" : "No"}</p>
      </div>
      <div className="rounded-xl border border-border/70 px-3 py-2">
        <p className="text-xs text-text-light">{isAr ? "آخر نسخة ناجحة" : "Last successful snapshot"}</p>
        <p className="mt-1 font-semibold">{formatTimestamp(snapshot.timestamp, isAr)}</p>
        <p className="mt-0.5 text-xs text-text-light">
          {isAr ? snapshot.ageLabelAr : snapshot.ageLabelEn}
        </p>
      </div>
      <div className="rounded-xl border border-border/70 px-3 py-2">
        <div className="flex items-center gap-1 text-xs text-text-light">
          <Database className="h-3.5 w-3.5" aria-hidden />
          {isAr ? "مصدر العرض الحالي" : "Current display source"}
        </div>
        <p className="mt-1 font-semibold">
          {snapshot.inUse
            ? isAr
              ? "نسخة محفوظة قيد الاستخدام"
              : "Snapshot in use"
            : isAr
              ? "بيانات مباشرة"
              : "Live data"}
        </p>
      </div>
    </div>
    {snapshot.inUse ? (
      <p className="mt-2 text-xs text-blue-800">
        {isAr ? "تم عرض آخر نسخة ناجحة من البيانات" : "Showing last successful snapshot data"}
      </p>
    ) : null}
  </SectionCard>
);

export default SchoolIntelligenceSnapshotVisibility;
