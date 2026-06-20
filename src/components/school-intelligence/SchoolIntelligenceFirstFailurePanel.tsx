import SectionCard from "@/components/layout/SectionCard";
import type { SchoolIntelligencePageDiagnostics } from "@/lib/school-intelligence/school-intelligence-page-types";
import {
  formatFieldBytesSummary,
  pickPrimaryQuerySourceEntry,
} from "@/lib/school-intelligence/school-intelligence-query-source-trace";
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
  const payloadSource =
    pickPrimaryQuerySourceEntry(
      diagnostics?.querySourceMap,
      firstFailure?.queryName || firstFailure?.mongoOperation
    ) ??
    (firstFailure?.sourceVariableName
      ? {
          queryName: firstFailure.queryName || firstFailure.mongoOperation || "unknown",
          collection: firstFailure.mongoCollection || "unknown",
          filterKeys: firstFailure.filterKeys || [],
          projectionKeys: firstFailure.projectionKeys || [],
          sourceVariableName: firstFailure.sourceVariableName,
          sourceFunction: firstFailure.sourceFunction || "unknown",
          arrayLength: firstFailure.arrayLength,
          serializedBytes: firstFailure.serializedBytes,
          totalSerializedBytes: firstFailure.totalSerializedBytes || firstFailure.serializedBytes || 0,
          offendingFilterPath: firstFailure.offendingFilterPath,
          uniqueValues: firstFailure.uniqueValues,
          duplicateValues: firstFailure.duplicateValues,
          firstFiveValues: firstFailure.firstFiveValues,
          lastFiveValues: firstFailure.lastFiveValues,
          fieldBytes: firstFailure.fieldBytes || {},
          inArrayAnalysis: [],
        }
      : undefined);

  if (!firstFailure && !snapshotSave?.attempted && !payloadSource) return null;

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
          {firstFailure.querySizeBytes != null ? (
            <RootCauseField
              label={isAr ? "حجم الاستعلام (بايت)" : "Query size (bytes)"}
              value={String(firstFailure.querySizeBytes)}
            />
          ) : null}
          {firstFailure.pipelineSizeBytes != null ? (
            <RootCauseField
              label={isAr ? "حجم خط الأنابيب (بايت)" : "Pipeline size (bytes)"}
              value={String(firstFailure.pipelineSizeBytes)}
            />
          ) : null}
          {firstFailure.arrayLength != null ? (
            <RootCauseField
              label={isAr ? "عدد عناصر المصفوفة" : "Array length"}
              value={String(firstFailure.arrayLength)}
            />
          ) : null}
          {firstFailure.serializedBytes != null ? (
            <RootCauseField
              label={isAr ? "الحجم المُسلسل (بايت)" : "Serialized size (bytes)"}
              value={String(firstFailure.serializedBytes)}
            />
          ) : null}
          {firstFailure.limitBytes != null ? (
            <RootCauseField
              label={isAr ? "حد الأمان (بايت)" : "Safety limit (bytes)"}
              value={String(firstFailure.limitBytes)}
            />
          ) : null}
          {firstFailure.offendingFilterPath ? (
            <RootCauseField
              label={isAr ? "الفلتر المتسبب" : "Offending filter"}
              value={firstFailure.offendingFilterPath}
              className="sm:col-span-2"
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

      {diagnostics?.chunkRecovery?.length ? (
        <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50/40 px-3 py-3">
          <h3 className="mb-2 text-sm font-bold text-emerald-950">
            {isAr ? "استرداد الحمولة المُجزّأة" : "Chunked payload recovery"}
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {diagnostics.chunkRecovery.map((entry) => (
              <div
                key={`${entry.queryName}-${entry.collection}`}
                className="rounded-lg border border-border/70 bg-white px-3 py-2 sm:col-span-2"
              >
                <p className="text-xs text-text-light">{entry.queryName}</p>
                <p className="mt-1 text-sm font-semibold">
                  {isAr
                    ? `${entry.chunkCount} دفعة × ${entry.chunkSize} — ${entry.chunkExecutionMs}ms`
                    : `${entry.chunkCount} chunks × ${entry.chunkSize} — ${entry.chunkExecutionMs}ms`}
                </p>
                <p className="mt-1 text-xs text-emerald-800">
                  {entry.chunkedRecoveryUsed
                    ? isAr
                      ? "تم تفعيل الاسترداد المُجزّأ"
                      : "Chunked recovery used"
                    : isAr
                      ? "لم يُستخدم"
                      : "Not used"}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {payloadSource ? (
        <div className="mb-3 rounded-xl border border-red-200 bg-white px-3 py-3">
          <h3 className="mb-2 text-sm font-bold text-red-950">
            {isAr ? "اكتشاف مصدر حمولة الاستعلام" : "Query payload source discovery"}
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <RootCauseField
              label={isAr ? "الحقل المتسبب" : "Offending field"}
              value={payloadSource.offendingFilterPath || firstFailure?.offendingFilterPath || (isAr ? "—" : "—")}
            />
            <RootCauseField
              label={isAr ? "عدد العناصر" : "Element count"}
              value={String(payloadSource.arrayLength ?? firstFailure?.arrayLength ?? (isAr ? "—" : "—"))}
            />
            <RootCauseField
              label={isAr ? "عدد العناصر الفريدة" : "Unique element count"}
              value={String(payloadSource.uniqueValues ?? firstFailure?.uniqueValues ?? (isAr ? "—" : "—"))}
            />
            <RootCauseField
              label={isAr ? "الحجم التسلسلي" : "Serialized size"}
              value={`${payloadSource.serializedBytes ?? firstFailure?.serializedBytes ?? payloadSource.totalSerializedBytes} B`}
            />
            <RootCauseField
              label={isAr ? "مصدر البيانات" : "Data source"}
              value={`${payloadSource.sourceVariableName} ← ${payloadSource.sourceFunction}()`}
              className="sm:col-span-2"
            />
            {(payloadSource.firstFiveValues?.length || firstFailure?.firstFiveValues?.length) ? (
              <RootCauseField
                label={isAr ? "أول 5 عناصر" : "First 5 elements"}
                value={(payloadSource.firstFiveValues || firstFailure?.firstFiveValues || []).join(", ")}
                className="sm:col-span-2"
                valueClassName="break-all text-xs font-normal"
              />
            ) : null}
            {(payloadSource.lastFiveValues?.length || firstFailure?.lastFiveValues?.length) ? (
              <RootCauseField
                label={isAr ? "آخر 5 عناصر" : "Last 5 elements"}
                value={(payloadSource.lastFiveValues || firstFailure?.lastFiveValues || []).join(", ")}
                className="sm:col-span-2"
                valueClassName="break-all text-xs font-normal"
              />
            ) : null}
          </div>
          {Object.keys(payloadSource.fieldBytes).length > 0 ? (
            <div className="mt-2 rounded-lg border border-border/70 bg-slate-50 px-3 py-2">
              <p className="text-xs text-text-light">{isAr ? "توزيع الحجم حسب الحقل" : "Per-field payload breakdown"}</p>
              <p className="mt-1 break-all text-xs font-medium text-text">
                {formatFieldBytesSummary(payloadSource.fieldBytes)}
              </p>
            </div>
          ) : null}
          {diagnostics?.querySourceMap && diagnostics.querySourceMap.length > 1 ? (
            <div className="mt-2 overflow-x-auto">
              <p className="mb-1 text-xs text-text-light">{isAr ? "خريطة مصادر الاستعلام" : "Query source map"}</p>
              <table className="min-w-full text-left text-[11px]">
                <thead>
                  <tr className="border-b border-border/70 text-text-light">
                    <th className="px-2 py-1">{isAr ? "الاستعلام" : "Query"}</th>
                    <th className="px-2 py-1">{isAr ? "المصدر" : "Source"}</th>
                    <th className="px-2 py-1">{isAr ? "العناصر" : "Items"}</th>
                    <th className="px-2 py-1">{isAr ? "الحجم" : "Size"}</th>
                  </tr>
                </thead>
                <tbody>
                  {diagnostics.querySourceMap.map((entry) => (
                    <tr key={`${entry.queryName}-${entry.sourceVariableName}`} className="border-b border-border/40">
                      <td className="px-2 py-1 font-medium">{entry.queryName}</td>
                      <td className="px-2 py-1">{entry.sourceVariableName}</td>
                      <td className="px-2 py-1">{entry.arrayLength ?? "—"}</td>
                      <td className="px-2 py-1">{entry.serializedBytes ?? entry.totalSerializedBytes} B</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
