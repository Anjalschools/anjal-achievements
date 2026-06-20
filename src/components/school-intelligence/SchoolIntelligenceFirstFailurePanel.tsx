import SectionCard from "@/components/layout/SectionCard";
import type { SchoolIntelligencePageDiagnostics } from "@/lib/school-intelligence/school-intelligence-page-types";
import { AlertOctagon, Clock, Database, ServerCrash } from "lucide-react";

type SchoolIntelligenceFirstFailurePanelProps = {
  isAr: boolean;
  diagnostics?: SchoolIntelligencePageDiagnostics;
};

const formatTimestamp = (value: string | null | undefined, isAr: boolean) => {
  if (!value) return isAr ? "—" : "—";
  try {
    return new Date(value).toLocaleString(isAr ? "ar-SA" : "en-US");
  } catch {
    return value;
  }
};

const formatDuration = (ms: number | undefined, isAr: boolean) => {
  if (ms == null) return isAr ? "—" : "—";
  if (ms >= 1000) return isAr ? `${(ms / 1000).toFixed(1)} ثانية` : `${(ms / 1000).toFixed(1)}s`;
  return isAr ? `${ms} مللي ثانية` : `${ms}ms`;
};

const SchoolIntelligenceFirstFailurePanel = ({
  isAr,
  diagnostics,
}: SchoolIntelligenceFirstFailurePanelProps) => {
  const firstFailure = diagnostics?.firstFailure;
  const snapshotSave = diagnostics?.snapshotSave;

  if (!firstFailure && !snapshotSave?.attempted) return null;

  const queryLabel =
    firstFailure?.queryName ||
    firstFailure?.mongoOperation ||
    (isAr ? "—" : "—");

  return (
    <SectionCard className="mb-4 border-amber-200 bg-amber-50/40">
      <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-amber-950">
        <AlertOctagon className="h-4 w-4" aria-hidden />
        {isAr ? "بطاقة السبب الجذري" : "Root cause card"}
      </h2>

      {firstFailure ? (
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          <RootCauseField
            label={isAr ? "القسم المتعطل" : "Failed section"}
            value={firstFailure.section}
          />
          <RootCauseField
            label={isAr ? "الخدمة" : "Service"}
            value={firstFailure.service}
            icon={ServerCrash}
          />
          <RootCauseField
            label={isAr ? "نوع الخطأ" : "Error type"}
            value={firstFailure.failureClassification || firstFailure.errorName}
          />
          <RootCauseField
            label={isAr ? "الاستعلام المتسبب" : "Failing query"}
            value={queryLabel}
          />
          <RootCauseField
            label={isAr ? "قاعدة البيانات المتأثرة" : "Affected database collection"}
            value={firstFailure.mongoCollection || (isAr ? "—" : "—")}
          />
          <RootCauseField
            label={isAr ? "مدة التنفيذ" : "Execution duration"}
            value={formatDuration(firstFailure.durationMs, isAr)}
            icon={Clock}
          />
          <RootCauseField
            label={isAr ? "سبب الفشل" : "Failure reason"}
            value={firstFailure.errorMessage}
            className="sm:col-span-2"
            valueClassName="text-red-800"
          />
          {firstFailure.timeoutMs != null ? (
            <RootCauseField
              label={isAr ? "مهلة الاستعلام" : "Query timeout"}
              value={`${firstFailure.timeoutMs}ms`}
            />
          ) : null}
          {firstFailure.documentsReturned != null ? (
            <RootCauseField
              label={isAr ? "المستندات المُرجعة" : "Documents returned"}
              value={String(firstFailure.documentsReturned)}
            />
          ) : null}
          <RootCauseField
            label={isAr ? "وقت الفشل" : "Failure time"}
            value={formatTimestamp(firstFailure.timestamp, isAr)}
          />
          {firstFailure.stack ? (
            <div className="rounded-xl border border-border/70 bg-white px-3 py-2 sm:col-span-2">
              <p className="text-xs text-text-light">{isAr ? "تتبع الخطأ" : "Stack trace"}</p>
              <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap text-[11px] text-text-light">
                {firstFailure.stack}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}

      {snapshotSave?.attempted ? (
        <div className="rounded-xl border border-border/70 bg-white px-3 py-2">
          <div className="flex items-center gap-1 text-xs text-text-light">
            <Database className="h-3.5 w-3.5" aria-hidden />
            {isAr
              ? "حفظ Snapshot (full_payload:school_intelligence_payload)"
              : "Snapshot save (full_payload:school_intelligence_payload)"}
          </div>
          <p className="mt-1 text-sm font-semibold">
            {snapshotSave.succeeded
              ? isAr
                ? "تمت المحاولة — نجح الحفظ"
                : "Attempted — save succeeded"
              : isAr
                ? "تمت المحاولة — فشل الحفظ"
                : "Attempted — save failed"}
          </p>
          {!snapshotSave.succeeded && snapshotSave.errorMessage ? (
            <p className="mt-1 text-xs text-red-700">{snapshotSave.errorMessage}</p>
          ) : null}
          <p className="mt-1 text-[11px] text-text-light">
            {formatTimestamp(snapshotSave.timestamp, isAr)}
          </p>
        </div>
      ) : (
        <p className="text-sm text-text-light">
          {isAr
            ? "لم تُنفَّذ محاولة حفظ Snapshot — فشل البناء قبل مرحلة الحفظ"
            : "Snapshot save was not attempted — build failed before save phase"}
        </p>
      )}
    </SectionCard>
  );
};

const RootCauseField = ({
  label,
  value,
  icon: Icon,
  className = "",
  valueClassName = "",
}: {
  label: string;
  value: string;
  icon?: typeof ServerCrash;
  className?: string;
  valueClassName?: string;
}) => (
  <div className={`rounded-xl border border-border/70 bg-white px-3 py-2 ${className}`}>
    <div className="flex items-center gap-1 text-xs text-text-light">
      {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
      {label}
    </div>
    <p className={`mt-1 text-sm font-semibold ${valueClassName}`}>{value}</p>
  </div>
);

export default SchoolIntelligenceFirstFailurePanel;
