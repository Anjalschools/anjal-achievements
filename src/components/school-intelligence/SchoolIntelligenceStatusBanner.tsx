import type { SchoolIntelligenceBuildStatus } from "@/lib/school-intelligence/school-intelligence-page-types";
import { systemStatusLabel } from "@/lib/school-intelligence/school-intelligence-page-utils";
import { Activity, Clock, Database } from "lucide-react";

const bannerTone: Record<SchoolIntelligenceBuildStatus, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-950",
  degraded: "border-blue-200 bg-blue-50 text-blue-950",
  unavailable: "border-amber-200 bg-amber-50 text-amber-950",
};

type SchoolIntelligenceStatusBannerProps = {
  isAr: boolean;
  status: SchoolIntelligenceBuildStatus;
  lastUpdate: string | null;
  dataSource: string;
};

const formatTimestamp = (value: string | null, isAr: boolean) => {
  if (!value) return isAr ? "—" : "—";
  try {
    return new Date(value).toLocaleString(isAr ? "ar-SA" : "en-US");
  } catch {
    return value;
  }
};

const SchoolIntelligenceStatusBanner = ({
  isAr,
  status,
  lastUpdate,
  dataSource,
}: SchoolIntelligenceStatusBannerProps) => (
  <div className={`mb-4 rounded-xl border px-4 py-3 ${bannerTone[status]}`}>
    <p className="text-sm font-bold">{isAr ? "حالة النظام" : "System status"}</p>
    <p className="mt-1 text-sm font-semibold">{systemStatusLabel(status, isAr)}</p>
    <div className="mt-2 flex flex-wrap gap-4 text-xs opacity-90">
      <span className="inline-flex items-center gap-1">
        <Clock className="h-3.5 w-3.5" aria-hidden />
        {isAr ? "آخر تحديث:" : "Last update:"} {formatTimestamp(lastUpdate, isAr)}
      </span>
      <span className="inline-flex items-center gap-1">
        <Database className="h-3.5 w-3.5" aria-hidden />
        {isAr ? "مصدر البيانات:" : "Data source:"} {dataSource}
      </span>
      <span className="inline-flex items-center gap-1">
        <Activity className="h-3.5 w-3.5" aria-hidden />
        {status === "success"
          ? isAr
            ? "اتصال مباشر"
            : "Live connection"
          : status === "degraded"
            ? isAr
              ? "استعادة من نسخة"
              : "Recovered from snapshot"
            : isAr
              ? "البيانات غير متاحة"
              : "Data unavailable"}
      </span>
    </div>
  </div>
);

export default SchoolIntelligenceStatusBanner;
