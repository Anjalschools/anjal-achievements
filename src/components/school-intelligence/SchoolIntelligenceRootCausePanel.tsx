import SectionCard from "@/components/layout/SectionCard";
import type { RootCauseSummary } from "@/lib/school-intelligence/school-intelligence-transparency-utils";
import { AlertCircle, Clock, Database, RefreshCw, ServerCrash } from "lucide-react";

type SchoolIntelligenceRootCausePanelProps = {
  isAr: boolean;
  rootCause: RootCauseSummary;
};

const formatTimestamp = (value: string | null, isAr: boolean) => {
  if (!value) return isAr ? "—" : "—";
  try {
    return new Date(value).toLocaleString(isAr ? "ar-SA" : "en-US");
  } catch {
    return value;
  }
};

const SchoolIntelligenceRootCausePanel = ({ isAr, rootCause }: SchoolIntelligenceRootCausePanelProps) => {
  const rows = [
    {
      icon: ServerCrash,
      label: isAr ? "الخدمة المتعطلة" : "Failing service",
      value: rootCause.failingService,
    },
    {
      icon: AlertCircle,
      label: isAr ? "فئة الخطأ" : "Error category",
      value: rootCause.errorCategory,
    },
    {
      icon: Clock,
      label: isAr ? "أول فشل" : "First failure",
      value: formatTimestamp(rootCause.firstFailureTime, isAr),
    },
    {
      icon: RefreshCw,
      label: isAr ? "آخر محاولة" : "Last retry",
      value: formatTimestamp(rootCause.lastRetryTime, isAr),
    },
    {
      icon: Database,
      label: isAr ? "توفر Snapshot" : "Snapshot availability",
      value: rootCause.snapshotAvailable
        ? isAr
          ? "متاح"
          : "Available"
        : isAr
          ? "غير متاح"
          : "Unavailable",
    },
  ];

  return (
    <SectionCard className="mb-4">
      <h2 className="mb-3 text-base font-bold">{isAr ? "سبب المشكلة الرئيسي" : "Primary root cause"}</h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => (
          <div key={row.label} className="rounded-xl border border-border/70 px-3 py-2">
            <div className="flex items-center gap-1.5 text-xs text-text-light">
              <row.icon className="h-3.5 w-3.5" aria-hidden />
              {row.label}
            </div>
            <p className="mt-1 text-sm font-semibold">{row.value}</p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
};

export default SchoolIntelligenceRootCausePanel;
