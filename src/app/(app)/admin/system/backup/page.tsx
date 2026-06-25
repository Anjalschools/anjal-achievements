"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  CheckCircle2,
  Download,
  Eye,
  FileSearch,
  History,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Upload,
} from "lucide-react";
import { BACKUP_MODULES } from "@/lib/backup/backup-constants";
import { readDrPollingResponseBody } from "@/lib/disaster-recovery/dr-polling-diagnostics";

type BackupRow = {
  id: string;
  backupModule: string;
  status: string;
  sizeBytes: number;
  manifestVersion?: string;
  storageProvider: string;
  fileName: string;
  recordCounts: Record<string, number>;
  academicYearLabel?: string;
  createdAt: string | null;
  createdBy?: { name?: string; email?: string } | null;
};

type ValidationReport = {
  status: "PASS" | "FAIL";
  reasons: string[];
  collectionSummary?: Record<string, number>;
  manifest?: { version?: string; createdAt?: string; backupModule?: string; collections?: string[] };
};

type DryRunReport = {
  status: "PASS" | "FAIL";
  reasons: string[];
  counts: Record<string, number>;
  labelsAr: Record<string, string>;
};

type RestoreLogRow = {
  id: string;
  actionType: string;
  actorName?: string;
  outcome?: string;
  descriptionAr?: string;
  metadata?: Record<string, unknown>;
  createdAt: string | null;
};

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const RESTORE_CONFIRM_PHRASE = "RESTORE";

export default function AdminBackupRestorePage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<BackupRow[]>([]);
  const [restoreLogs, setRestoreLogs] = useState<RestoreLogRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [moduleId, setModuleId] = useState("full");
  const [storageProvider, setStorageProvider] = useState<"local" | "r2">("local");

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<ValidationReport | null>(null);
  const [dryRun, setDryRun] = useState<DryRunReport | null>(null);

  const [restoreMode, setRestoreMode] = useState<"replace" | "merge" | "selective">("merge");
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [confirmText, setConfirmText] = useState("");
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [health, setHealth] = useState<{
    databaseBackupStatus: string;
    objectBackupStatus: string;
    recoveryReadinessScore: number;
    filesProtected: number;
    totalStorageSizeBytes: number;
    lastSuccessfulBackupAt: string | null;
    lastValidationAt: string | null;
  } | null>(null);
  const [drValidation, setDrValidation] = useState<{
    status: string;
    recoveryReadinessScore: number;
    certifications: string[];
  } | null>(null);
  const [simulation, setSimulation] = useState<{ status: string; certifications: string[] } | null>(
    null
  );

  const moduleOptions = useMemo(() => BACKUP_MODULES, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [historyRes, logsRes, healthRes] = await Promise.all([
        fetch("/api/admin/backup", { credentials: "include", cache: "no-store" }),
        fetch("/api/admin/backup/restore-logs", { credentials: "include", cache: "no-store" }),
        fetch("/api/admin/backup/health", { credentials: "include", cache: "no-store" }),
      ]);
      const historyJson = (await historyRes.json()) as { data?: BackupRow[]; error?: string };
      const logsJson = (await logsRes.json()) as { data?: RestoreLogRow[]; error?: string };
      const healthJson = (await healthRes.json()) as { data?: typeof health; error?: string };
      if (!historyRes.ok) throw new Error(historyJson.error || "LOAD_HISTORY_FAILED");
      if (!logsRes.ok) throw new Error(logsJson.error || "LOAD_LOGS_FAILED");
      setHistory(historyJson.data || []);
      setRestoreLogs(logsJson.data || []);
      if (healthRes.ok && healthJson.data) setHealth(healthJson.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "LOAD_FAILED");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreateBackup = async () => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/backup", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: moduleId, storage: storageProvider }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        data?: { recordId: string; fileName: string; downloadUrl: string };
        error?: string;
      };
      if (!res.ok || !json.data) throw new Error(json.error || "BACKUP_FAILED");

      setSuccess("تم إنشاء النسخة الاحتياطية بنجاح.");
      if (json.data.downloadUrl) {
        window.open(json.data.downloadUrl, "_blank");
      }
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "BACKUP_FAILED");
    } finally {
      setBusy(false);
    }
  };

  const handleCreateDrBackup = async () => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/backup/disaster-recovery", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module: moduleId,
          storage: storageProvider,
          includeObjects: true,
          retentionTier: "daily",
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        accepted?: boolean;
        data?: {
          recordId: string;
          statusUrl?: string;
          pollIntervalMs?: number;
          recoveryReadinessScore?: number;
        };
        error?: string;
      };

      if (res.status === 202 && json.accepted && json.data?.recordId) {
        setSuccess("جاري إنشاء نسخة الكوارث في الخلفية… سيتم التحديث تلقائياً.");
        const recordId = json.data.recordId;
        const pollMs = json.data.pollIntervalMs || 5000;
        const deadline = Date.now() + 2 * 60 * 60 * 1000;
        let lastJobPhase = "queued";

        while (Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, pollMs));
          const statusRes = await fetch(`/api/admin/backup/${recordId}`, {
            credentials: "include",
            cache: "no-store",
          });
          const statusText = await readDrPollingResponseBody(
            statusRes,
            `/api/admin/backup/${recordId}`
          );
          const statusJson = JSON.parse(statusText) as {
            data?: {
              status?: string;
              recoveryReadinessScore?: number;
              errorMessage?: string;
              jobPhase?: string;
              processedObjects?: number;
            };
            error?: string;
          };
          if (!statusRes.ok || !statusJson.data) {
            throw new Error(statusJson.error || "DR_STATUS_POLL_FAILED");
          }

          const { status, recoveryReadinessScore, errorMessage, jobPhase, processedObjects } =
            statusJson.data;
          lastJobPhase = jobPhase || lastJobPhase;
          if (status === "pending") {
            setSuccess(
              `جاري النسخ… المرحلة: ${jobPhase || "queued"} — ${processedObjects ?? 0} كائن`
            );
            continue;
          }
          if (status === "failed") {
            throw new Error(errorMessage || "DR_BACKUP_FAILED");
          }
          if (status === "completed") {
            setSuccess(
              `تم إنشاء نسخة كوارث كاملة. جاهزية الاستعادة: ${recoveryReadinessScore ?? 0}%`
            );
            window.open(`/api/admin/backup/${recordId}/download`, "_blank");
            await load();
            return;
          }
        }
        throw new Error(
          lastJobPhase === "queued" || lastJobPhase === "starting"
            ? "QUEUE_START_TIMEOUT"
            : "DR_BACKUP_TIMEOUT"
        );
      }

      if (!res.ok || !json.data) throw new Error(json.error || "DR_BACKUP_FAILED");
      setSuccess(
        `تم إنشاء نسخة كوارث كاملة. جاهزية الاستعادة: ${json.data.recoveryReadinessScore ?? 0}%`
      );
      window.open(`/api/admin/backup/${json.data.recordId}/download`, "_blank");
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "DR_BACKUP_FAILED");
    } finally {
      setBusy(false);
    }
  };

  const handleValidateDr = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = (await postZipAction("/api/admin/backup/validate-dr")) as {
        status: string;
        recoveryReadinessScore: number;
        certifications: string[];
      };
      setDrValidation(data);
      setSuccess(data.status === "PASS" ? "التحقق الكامل ناجح." : null);
      if (data.status === "FAIL") setError("فشل التحقق من نسخة الكوارث.");
    } catch (validateError) {
      setError(validateError instanceof Error ? validateError.message : "DR_VALIDATE_FAILED");
    } finally {
      setBusy(false);
    }
  };

  const handleSimulateRecovery = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = (await postZipAction("/api/admin/backup/simulate-recovery")) as {
        status: string;
        certifications: string[];
      };
      setSimulation(data);
      setSuccess(data.status === "PASS" ? "محاكاة الاستعادة: ناجحة." : null);
      if (data.status === "FAIL") setError("محاكاة الاستعادة: فشل.");
    } catch (simError) {
      setError(simError instanceof Error ? simError.message : "SIMULATION_FAILED");
    } finally {
      setBusy(false);
    }
  };

  const postZipAction = async (endpoint: string): Promise<unknown> => {
    if (!uploadFile) throw new Error("اختر ملف ZIP أولاً.");
    const formData = new FormData();
    formData.append("file", uploadFile);
    const res = await fetch(endpoint, { method: "POST", credentials: "include", body: formData });
    const json = (await res.json()) as { data?: unknown; error?: string };
    if (!res.ok) throw new Error(json.error || "REQUEST_FAILED");
    return json.data;
  };

  const handleValidate = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = (await postZipAction("/api/admin/backup/validate")) as ValidationReport;
      setValidation(data);
      setSuccess(data.status === "PASS" ? "التحقق ناجح." : null);
      if (data.status === "FAIL") setError(data.reasons.join(" · "));
    } catch (validateError) {
      setError(validateError instanceof Error ? validateError.message : "VALIDATION_FAILED");
    } finally {
      setBusy(false);
    }
  };

  const handleDryRun = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = (await postZipAction("/api/admin/backup/dry-run")) as DryRunReport;
      setDryRun(data);
      setSuccess(data.status === "PASS" ? "اكتمل فحص الاستعادة التجريبي." : null);
      if (data.status === "FAIL") setError(data.reasons.join(" · "));
    } catch (dryRunError) {
      setError(dryRunError instanceof Error ? dryRunError.message : "DRY_RUN_FAILED");
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    if (!uploadFile) {
      setError("اختر ملف ZIP للاستعادة.");
      return;
    }
    if (
      restoreMode === "replace" &&
      (confirmText !== RESTORE_CONFIRM_PHRASE || confirmPhrase !== RESTORE_CONFIRM_PHRASE)
    ) {
      setError(`يلزم تأكيد مزدوج بكتابة ${RESTORE_CONFIRM_PHRASE} في الحقلين.`);
      return;
    }
    if (restoreMode === "selective" && !selectedCollections.length) {
      setError("اختر مجموعة واحدة على الأقل للاستعادة الانتقائية.");
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("mode", restoreMode);
      formData.append("confirmText", confirmText);
      formData.append("confirmPhrase", confirmPhrase);
      formData.append("snapshotStorage", storageProvider);
      if (selectedCollections.length) {
        formData.append("collectionKeys", selectedCollections.join(","));
      }

      const res = await fetch("/api/admin/backup/restore", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error || "RESTORE_FAILED");
      setSuccess("تم تنفيذ الاستعادة وتسجيلها في سجل التدقيق.");
      setConfirmText("");
      setConfirmPhrase("");
      await load();
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : "RESTORE_FAILED");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteMetadata = async (id: string) => {
    if (!window.confirm("حذف سجل النسخة الاحتياطية (البيانات الوصفية فقط)؟")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/backup/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error || "DELETE_FAILED");
      }
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "DELETE_FAILED");
    } finally {
      setBusy(false);
    }
  };

  const toggleCollection = (key: string) => {
    setSelectedCollections((prev) =>
      prev.includes(key) ? prev.filter((row) => row !== key) : [...prev, key]
    );
  };

  if (loading && !history.length) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      </div>
    );
  }

  return (
    <div dir="rtl" className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">النسخ الاحتياطي والاستعادة</h1>
          <p className="mt-1 text-sm text-slate-600">
            حماية تشغيلية للمنصة — قراءة فقط عند النسخ، واستعادة مُدقَّقة مع سجل تدقيق كامل.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700"
        >
          <RefreshCw className={busy ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden />
          تحديث
        </button>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}
      {success ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </p>
      ) : null}

      {health ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 space-y-3 text-sm">
          <h2 className="text-lg font-black text-emerald-900">لوحة جاهزية النسخ والاستعادة</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <p>
              قاعدة البيانات: <strong>{health.databaseBackupStatus}</strong>
            </p>
            <p>
              التخزين الكائني: <strong>{health.objectBackupStatus}</strong>
            </p>
            <p>
              جاهزية الاستعادة: <strong>{health.recoveryReadinessScore}%</strong>
            </p>
            <p>
              ملفات محمية: <strong>{health.filesProtected}</strong>
            </p>
            <p>
              الحجم الإجمالي: <strong>{formatBytes(health.totalStorageSizeBytes)}</strong>
            </p>
            <p>
              آخر نسخة:{" "}
              <strong>
                {health.lastSuccessfulBackupAt
                  ? new Date(health.lastSuccessfulBackupAt).toLocaleString("ar-SA")
                  : "—"}
              </strong>
            </p>
            <p>
              آخر تحقق:{" "}
              <strong>
                {health.lastValidationAt
                  ? new Date(health.lastValidationAt).toLocaleString("ar-SA")
                  : "—"}
              </strong>
            </p>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-black text-slate-900">
          <Archive className="h-5 w-5" aria-hidden />
          إنشاء نسخة احتياطية
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            <span className="font-bold text-slate-700">النطاق</span>
            <select
              value={moduleId}
              onChange={(e) => setModuleId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            >
              {moduleOptions.map((mod) => (
                <option key={mod.id} value={mod.id}>
                  {mod.labelAr}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-bold text-slate-700">التخزين</span>
            <select
              value={storageProvider}
              onChange={(e) => setStorageProvider(e.target.value as "local" | "r2")}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            >
              <option value="local">تنزيل محلي فوري</option>
              <option value="r2">تخزين R2 (للتاريخ والتنزيل لاحقاً)</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleCreateBackup()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            إنشاء نسخة قاعدة بيانات
          </button>
          <button
            type="button"
            onClick={() => void handleCreateDrBackup()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
            نسخة كوارث كاملة (DB + ملفات)
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-black text-slate-900">
          <History className="h-5 w-5" aria-hidden />
          سجل النسخ الاحتياطية
        </h2>
        {!history.length ? (
          <p className="text-sm text-slate-500">لا توجد نسخ احتياطية مسجلة بعد.</p>
        ) : (
          <div className="space-y-3">
            {history.map((row) => (
              <div key={row.id} className="rounded-xl border border-slate-100 p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-900">{row.fileName}</p>
                    <p className="text-slate-600">
                      {row.backupModule} · {formatBytes(row.sizeBytes)} · {row.storageProvider} ·{" "}
                      {row.createdAt ? new Date(row.createdAt).toLocaleString("ar-SA") : "—"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`/api/admin/backup/${row.id}/download`}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 font-bold"
                    >
                      <Download className="h-4 w-4" />
                      تنزيل
                    </a>
                    <button
                      type="button"
                      onClick={() => void handleDeleteMetadata(row.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 font-bold text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                      حذف السجل
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-black text-slate-900">
          <Upload className="h-5 w-5" aria-hidden />
          التحقق والاستعادة
        </h2>
        <input
          type="file"
          accept=".zip,application/zip"
          onChange={(e) => {
            setUploadFile(e.target.files?.[0] || null);
            setValidation(null);
            setDryRun(null);
            setDrValidation(null);
            setSimulation(null);
          }}
          className="block w-full text-sm"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleValidate()}
            disabled={busy || !uploadFile}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold"
          >
            <FileSearch className="h-4 w-4" />
            التحقق من الحزمة
          </button>
          <button
            type="button"
            onClick={() => void handleDryRun()}
            disabled={busy || !uploadFile}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold"
          >
            <Eye className="h-4 w-4" />
            فحص الاستعادة
          </button>
          <button
            type="button"
            onClick={() => void handleValidateDr()}
            disabled={busy || !uploadFile}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-900"
          >
            <ShieldAlert className="h-4 w-4" />
            تحقق كوارث كامل
          </button>
          <button
            type="button"
            onClick={() => void handleSimulateRecovery()}
            disabled={busy || !uploadFile}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-900"
          >
            <RefreshCw className="h-4 w-4" />
            محاكاة الاستعادة
          </button>
        </div>

        {validation ? (
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm">
            <p className="font-bold flex items-center gap-2">
              {validation.status === "PASS" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <ShieldAlert className="h-4 w-4 text-red-600" />
              )}
              نتيجة التحقق: {validation.status}
            </p>
            {validation.reasons.length ? (
              <ul className="mt-2 list-disc pr-5 text-red-700">
                {validation.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {dryRun?.status === "PASS" ? (
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm">
            <p className="font-bold mb-2">معاينة الاستعادة (بدون كتابة)</p>
            <ul className="space-y-1">
              {Object.entries(dryRun.counts).map(([key, count]) => (
                <li key={key}>
                  {dryRun.labelsAr[key] || key}: <strong>{count}</strong>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {drValidation ? (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 text-sm">
            <p className="font-bold">
              تحقق الكوارث: {drValidation.status} · جاهزية {drValidation.recoveryReadinessScore}%
            </p>
            {drValidation.certifications.length ? (
              <p className="mt-2 text-emerald-900">{drValidation.certifications.join(" · ")}</p>
            ) : null}
          </div>
        ) : null}

        {simulation ? (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 text-sm">
            <p className="font-bold">محاكاة الاستعادة: {simulation.status}</p>
            {simulation.certifications.length ? (
              <p className="mt-2 text-emerald-900">{simulation.certifications.join(" · ")}</p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-black text-amber-900">
          <ShieldAlert className="h-5 w-5" />
          استعادة البيانات
        </h2>
        <label className="block text-sm">
          <span className="font-bold">وضع الاستعادة</span>
          <select
            value={restoreMode}
            onChange={(e) => setRestoreMode(e.target.value as "replace" | "merge" | "selective")}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
          >
            <option value="merge">دمج — إدراج/تحديث دون حذف</option>
            <option value="replace">استبدال — حذف ثم استعادة (تأكيد مزدوج)</option>
            <option value="selective">انتقائي — مجموعات محددة فقط</option>
          </select>
        </label>

        {restoreMode === "selective" && validation?.manifest?.collections ? (
          <div className="flex flex-wrap gap-2">
            {validation.manifest.collections.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => toggleCollection(key)}
                className={`rounded-lg border px-3 py-1 text-xs font-bold ${
                  selectedCollections.includes(key)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-slate-200 bg-white"
                }`}
              >
                {key}
              </button>
            ))}
          </div>
        ) : null}

        {restoreMode === "replace" ? (
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={`اكتب ${RESTORE_CONFIRM_PHRASE} للتأكيد 1`}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              value={confirmPhrase}
              onChange={(e) => setConfirmPhrase(e.target.value)}
              placeholder={`اكتب ${RESTORE_CONFIRM_PHRASE} للتأكيد 2`}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => void handleRestore()}
          disabled={busy || !uploadFile}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-700 px-4 py-2 text-sm font-bold text-white"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
          تنفيذ الاستعادة
        </button>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="text-lg font-black text-slate-900">سجل عمليات الاستعادة والنسخ</h2>
        {!restoreLogs.length ? (
          <p className="text-sm text-slate-500">لا توجد عمليات مسجلة بعد.</p>
        ) : (
          <div className="space-y-2 text-sm">
            {restoreLogs.map((row) => (
              <div key={row.id} className="rounded-lg border border-slate-100 px-3 py-2">
                <p className="font-bold">
                  {row.actionType} · {row.outcome || "—"} · {row.actorName || "—"}
                </p>
                <p className="text-slate-600">
                  {row.descriptionAr || "—"} ·{" "}
                  {row.createdAt ? new Date(row.createdAt).toLocaleString("ar-SA") : "—"}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
