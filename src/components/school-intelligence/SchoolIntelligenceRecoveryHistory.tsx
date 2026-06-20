import SectionCard from "@/components/layout/SectionCard";
import type { RecoveryHistoryView } from "@/lib/school-intelligence/school-intelligence-transparency-utils";
import { RotateCcw } from "lucide-react";

type SchoolIntelligenceRecoveryHistoryProps = {
  isAr: boolean;
  recovery: RecoveryHistoryView;
};

const formatTimestamp = (value: string | null, isAr: boolean) => {
  if (!value) return isAr ? "—" : "—";
  try {
    return new Date(value).toLocaleString(isAr ? "ar-SA" : "en-US");
  } catch {
    return value;
  }
};

const formatDuration = (ms: number | null, isAr: boolean) => {
  if (ms == null) return isAr ? "—" : "—";
  const seconds = Math.round(ms / 1000);
  return isAr ? `${seconds} ثانية` : `${seconds}s`;
};

const SchoolIntelligenceRecoveryHistory = ({ isAr, recovery }: SchoolIntelligenceRecoveryHistoryProps) => (
  <SectionCard className="mb-4">
    <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
      <RotateCcw className="h-4 w-4" aria-hidden />
      {isAr ? "سجل التعافي" : "Recovery history"}
    </h2>
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border border-border/70 px-3 py-2">
        <p className="text-xs text-text-light">{isAr ? "آخر محاولة إصلاح" : "Last recovery attempt"}</p>
        <p className="mt-1 text-sm font-semibold">{formatTimestamp(recovery.lastAttemptAt, isAr)}</p>
      </div>
      <div className="rounded-xl border border-border/70 px-3 py-2">
        <p className="text-xs text-text-light">{isAr ? "عدد المحاولات" : "Attempt count"}</p>
        <p className="mt-1 text-sm font-semibold">{recovery.attemptCount}</p>
      </div>
      <div className="rounded-xl border border-border/70 px-3 py-2">
        <p className="text-xs text-text-light">{isAr ? "نجاح الإصلاح" : "Recovery outcome"}</p>
        <p
          className={`mt-1 text-sm font-semibold ${recovery.recoverySucceeded ? "text-emerald-700" : "text-red-700"}`}
        >
          {isAr ? recovery.recoveryLabelAr : recovery.recoveryLabelEn}
        </p>
      </div>
      <div className="rounded-xl border border-border/70 px-3 py-2">
        <p className="text-xs text-text-light">{isAr ? "مدة التعافي" : "Recovery duration"}</p>
        <p className="mt-1 text-sm font-semibold">{formatDuration(recovery.recoveryDurationMs, isAr)}</p>
      </div>
    </div>
  </SectionCard>
);

export default SchoolIntelligenceRecoveryHistory;
