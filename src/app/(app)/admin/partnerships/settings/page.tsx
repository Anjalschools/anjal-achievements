"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import { getLocale } from "@/lib/i18n";
import { ArrowLeft, Download, Loader2, ShieldCheck } from "lucide-react";

type SettingsForm = {
  defaultAcademicYear: string;
  maxOpportunitiesPerStudent: number;
  allowMultipleApplications: boolean;
  showPortfolioToInstitutions: boolean;
  showExcellenceScoreToInstitutions: boolean;
  allowVideoUpload: boolean;
  maxAttachmentSizeMb: number;
  reviewSlaHours: number;
  institutionDecisionSlaDays: number;
  trainingCompletionSlaDays: number;
  backupIntegrationEnabled: boolean;
  archiveMode: boolean;
  archivedAcademicYear: string;
  lastBackupSnapshotAt: string | null;
  messageActionsMode: "dropdown" | "inline";
};

type QuotaRow = {
  opportunityId: string;
  title: string;
  seats: number;
  reserveSeats: number;
  acceptedCount: number;
  candidateCount: number;
  remainingSeats: number;
  isFull: boolean;
};

type IntegrityIssue = {
  code: string;
  severity: string;
  entityType: string;
  entityId: string;
  messageAr: string;
  messageEn: string;
};

const defaultForm = (): SettingsForm => ({
  defaultAcademicYear: "",
  maxOpportunitiesPerStudent: 1,
  allowMultipleApplications: false,
  showPortfolioToInstitutions: true,
  showExcellenceScoreToInstitutions: true,
  allowVideoUpload: true,
  maxAttachmentSizeMb: 10,
  reviewSlaHours: 72,
  institutionDecisionSlaDays: 14,
  trainingCompletionSlaDays: 30,
  backupIntegrationEnabled: true,
  archiveMode: false,
  archivedAcademicYear: "",
  lastBackupSnapshotAt: null,
  messageActionsMode: "dropdown",
});

const PartnershipsSettingsPage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<SettingsForm>(defaultForm);
  const [quotas, setQuotas] = useState<QuotaRow[]>([]);
  const [sla, setSla] = useState<Record<string, unknown> | null>(null);
  const [issues, setIssues] = useState<IntegrityIssue[]>([]);
  const [archiveYear, setArchiveYear] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/partnerships/settings", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      const settings = json.settings || {};
      setForm({
        defaultAcademicYear: settings.defaultAcademicYear || "",
        maxOpportunitiesPerStudent: Number(settings.maxOpportunitiesPerStudent ?? 1),
        allowMultipleApplications: settings.allowMultipleApplications === true,
        showPortfolioToInstitutions: settings.showPortfolioToInstitutions !== false,
        showExcellenceScoreToInstitutions: settings.showExcellenceScoreToInstitutions !== false,
        allowVideoUpload: settings.allowVideoUpload !== false,
        maxAttachmentSizeMb: Number(settings.maxAttachmentSizeMb ?? 10),
        reviewSlaHours: Number(settings.reviewSlaHours ?? 72),
        institutionDecisionSlaDays: Number(settings.institutionDecisionSlaDays ?? 14),
        trainingCompletionSlaDays: Number(settings.trainingCompletionSlaDays ?? 30),
        backupIntegrationEnabled: settings.backupIntegrationEnabled !== false,
        archiveMode: settings.archiveMode === true,
        archivedAcademicYear: settings.archivedAcademicYear || "",
        lastBackupSnapshotAt: settings.lastBackupSnapshotAt || null,
        messageActionsMode: settings.messageActionsMode === "inline" ? "inline" : "dropdown",
      });
      setQuotas(Array.isArray(json.quotas) ? json.quotas : []);
      setSla(json.sla || null);
      setArchiveYear(settings.defaultAcademicYear || settings.archivedAcademicYear || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/partnerships/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const handleIntegrityScan = async () => {
    setScanning(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/partnerships/integrity", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setIssues(Array.isArray(json.issues) ? json.issues : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setScanning(false);
    }
  };

  const handleArchive = async () => {
    if (!archiveYear.trim()) return;
    if (!window.confirm(isAr ? `أرشفة العام ${archiveYear}؟` : `Archive year ${archiveYear}?`)) return;
    setArchiving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/partnerships/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ academicYear: archiveYear.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setArchiving(false);
    }
  };

  const handleExport = (report: string, format: string) => {
    const params = new URLSearchParams({ report, format });
    if (form.defaultAcademicYear) params.set("academicYear", form.defaultAcademicYear);
    window.open(`/api/admin/partnerships/export?${params.toString()}`, "_blank");
  };

  return (
    <PageContainer>
      <div className="mb-4">
        <Link href="/admin/partnerships" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {isAr ? "العودة" : "Back"}
        </Link>
      </div>

      <PageHeader
        title={isAr ? "إعدادات التدريب والشراكات" : "Partnership program settings"}
        subtitle={isAr ? "الحوكمة والتشغيل المؤسسي" : "Governance and operational controls"}
      />

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-text-light">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          <span>{isAr ? "جاري التحميل…" : "Loading…"}</span>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <SectionCard>
            <h2 className="mb-4 text-base font-bold">{isAr ? "إعدادات عامة" : "General settings"}</h2>
            <div className="space-y-3">
              <input
                value={form.defaultAcademicYear}
                onChange={(e) => setForm((p) => ({ ...p, defaultAcademicYear: e.target.value }))}
                placeholder={isAr ? "السنة الدراسية الافتراضية" : "Default academic year"}
                className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                aria-label={isAr ? "السنة الدراسية" : "Academic year"}
              />
              <input
                type="number"
                min={1}
                max={10}
                value={form.maxOpportunitiesPerStudent}
                onChange={(e) =>
                  setForm((p) => ({ ...p, maxOpportunitiesPerStudent: Number(e.target.value) || 1 }))
                }
                className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                aria-label={isAr ? "عدد الفرص المسموح" : "Max opportunities per student"}
              />
              {[
                ["allowMultipleApplications", isAr ? "السماح بأكثر من طلب" : "Allow multiple applications"],
                ["showPortfolioToInstitutions", isAr ? "إظهار ملف الإنجاز للمؤسسات" : "Show portfolio to institutions"],
                ["showExcellenceScoreToInstitutions", isAr ? "إظهار مؤشر التميز" : "Show excellence score"],
                ["allowVideoUpload", isAr ? "السماح برفع الفيديو" : "Allow video upload"],
                ["backupIntegrationEnabled", isAr ? "تفعيل تكامل النسخ الاحتياطي" : "Backup integration enabled"],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form[key as keyof SettingsForm] as boolean}
                    onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.checked }))}
                  />
                  {label}
                </label>
              ))}
              <input
                type="number"
                min={1}
                max={50}
                value={form.maxAttachmentSizeMb}
                onChange={(e) => setForm((p) => ({ ...p, maxAttachmentSizeMb: Number(e.target.value) || 10 }))}
                className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                aria-label={isAr ? "أقصى حجم للمرفقات (ميجابايت)" : "Max attachment size (MB)"}
              />
              <label className="block text-sm">
                <span className="mb-1 block font-bold">
                  {isAr ? "عرض إجراءات الرسائل" : "Message actions display"}
                </span>
                <select
                  value={form.messageActionsMode}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      messageActionsMode: e.target.value === "inline" ? "inline" : "dropdown",
                    }))
                  }
                  className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                  aria-label={isAr ? "وضع إجراءات الرسائل" : "Message actions mode"}
                >
                  <option value="dropdown">{isAr ? "قائمة ⋮ منسدلة" : "Dropdown ⋮ menu"}</option>
                  <option value="inline">{isAr ? "أزرار مباشرة (تعديل / حذف / استعادة)" : "Inline buttons (edit / delete / restore)"}</option>
                </select>
              </label>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {saving ? (isAr ? "جاري الحفظ…" : "Saving…") : isAr ? "حفظ الإعدادات" : "Save settings"}
              </button>
            </div>
          </SectionCard>

          <SectionCard>
            <h2 className="mb-4 text-base font-bold">{isAr ? "مراقبة SLA" : "SLA monitoring"}</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <input
                type="number"
                value={form.reviewSlaHours}
                onChange={(e) => setForm((p) => ({ ...p, reviewSlaHours: Number(e.target.value) || 72 }))}
                className="rounded-xl border border-border px-3 py-2 text-sm"
                aria-label={isAr ? "مدة المراجعة (ساعات)" : "Review SLA hours"}
              />
              <input
                type="number"
                value={form.institutionDecisionSlaDays}
                onChange={(e) =>
                  setForm((p) => ({ ...p, institutionDecisionSlaDays: Number(e.target.value) || 14 }))
                }
                className="rounded-xl border border-border px-3 py-2 text-sm"
                aria-label={isAr ? "مدة قرار المؤسسة (أيام)" : "Institution SLA days"}
              />
              <input
                type="number"
                value={form.trainingCompletionSlaDays}
                onChange={(e) =>
                  setForm((p) => ({ ...p, trainingCompletionSlaDays: Number(e.target.value) || 30 }))
                }
                className="rounded-xl border border-border px-3 py-2 text-sm"
                aria-label={isAr ? "مدة إنهاء التدريب (أيام)" : "Completion SLA days"}
              />
            </div>
            {sla ? (
              <div className="mt-4 grid gap-2 text-sm">
                <p>
                  {isAr ? "متأخر — مراجعة:" : "Overdue — review:"}{" "}
                  <strong>{String((sla as { overdue?: { review?: number } }).overdue?.review ?? 0)}</strong>
                </p>
                <p>
                  {isAr ? "متأخر — مؤسسة:" : "Overdue — institution:"}{" "}
                  <strong>{String((sla as { overdue?: { institution?: number } }).overdue?.institution ?? 0)}</strong>
                </p>
                <p>
                  {isAr ? "متأخر — إكمال:" : "Overdue — completion:"}{" "}
                  <strong>{String((sla as { overdue?: { completion?: number } }).overdue?.completion ?? 0)}</strong>
                </p>
              </div>
            ) : null}
          </SectionCard>

          <SectionCard>
            <h2 className="mb-4 text-base font-bold">{isAr ? "محرك المقاعد" : "Quotas engine"}</h2>
            {quotas.length === 0 ? (
              <p className="text-sm text-text-light">{isAr ? "لا توجد فرص نشطة." : "No active opportunities."}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/70">
                      <th className="px-2 py-2 text-start">{isAr ? "الفرصة" : "Opportunity"}</th>
                      <th className="px-2 py-2">{isAr ? "مقاعد" : "Seats"}</th>
                      <th className="px-2 py-2">{isAr ? "احتياط" : "Reserve"}</th>
                      <th className="px-2 py-2">{isAr ? "مقبول" : "Accepted"}</th>
                      <th className="px-2 py-2">{isAr ? "مرشح" : "Candidates"}</th>
                      <th className="px-2 py-2">{isAr ? "متبقي" : "Left"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotas.map((row) => (
                      <tr key={row.opportunityId} className="border-b border-border/40">
                        <td className="px-2 py-2">{row.title}</td>
                        <td className="px-2 py-2 text-center">{row.seats}</td>
                        <td className="px-2 py-2 text-center">{row.reserveSeats}</td>
                        <td className="px-2 py-2 text-center">{row.acceptedCount}</td>
                        <td className="px-2 py-2 text-center">{row.candidateCount}</td>
                        <td className={`px-2 py-2 text-center ${row.isFull ? "font-bold text-red-600" : ""}`}>
                          {row.remainingSeats}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <SectionCard>
            <h2 className="mb-4 text-base font-bold">{isAr ? "فحص سلامة البيانات" : "Data integrity"}</h2>
            <button
              type="button"
              onClick={handleIntegrityScan}
              disabled={scanning}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold"
            >
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ShieldCheck className="h-4 w-4" aria-hidden />}
              {isAr ? "تشغيل الفحص" : "Run scan"}
            </button>
            {issues.length > 0 ? (
              <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto text-xs">
                {issues.map((issue, idx) => (
                  <li key={`${issue.entityId}-${idx}`} className="rounded-lg bg-amber-50 px-2 py-1 text-amber-950">
                    {isAr ? issue.messageAr : issue.messageEn} — {issue.entityType}:{issue.entityId}
                  </li>
                ))}
              </ul>
            ) : null}
          </SectionCard>

          <SectionCard>
            <h2 className="mb-4 text-base font-bold">{isAr ? "مركز التصدير" : "Export center"}</h2>
            <div className="flex flex-wrap gap-2">
              {(["organizations", "trainees", "hours", "approvals"] as const).map((report) =>
                (["csv", "xlsx", "pdf"] as const).map((format) => (
                  <button
                    key={`${report}-${format}`}
                    type="button"
                    onClick={() => handleExport(report, format)}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-semibold"
                  >
                    <Download className="h-3 w-3" aria-hidden />
                    {report} / {format}
                  </button>
                ))
              )}
            </div>
          </SectionCard>

          <SectionCard>
            <h2 className="mb-4 text-base font-bold">{isAr ? "وضع الأرشفة" : "Archive mode"}</h2>
            <p className="mb-2 text-sm text-text-light">
              {form.archiveMode
                ? isAr
                  ? `الأرشفة مفعّلة للعام: ${form.archivedAcademicYear || "—"}`
                  : `Archive active for: ${form.archivedAcademicYear || "—"}`
                : isAr
                  ? "الوضع الحالي: نشط"
                  : "Current mode: active"}
            </p>
            {form.lastBackupSnapshotAt ? (
              <p className="mb-2 text-xs text-text-light">
                {isAr ? "آخر لقطة نسخ:" : "Last backup snapshot:"} {form.lastBackupSnapshotAt}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <input
                value={archiveYear}
                onChange={(e) => setArchiveYear(e.target.value)}
                placeholder={isAr ? "العام الدراسي للأرشفة" : "Academic year to archive"}
                className="rounded-xl border border-border px-3 py-2 text-sm"
                aria-label={isAr ? "العام للأرشفة" : "Year to archive"}
              />
              <button
                type="button"
                onClick={handleArchive}
                disabled={archiving || !archiveYear.trim()}
                className="rounded-xl bg-amber-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {archiving ? (isAr ? "جاري الأرشفة…" : "Archiving…") : isAr ? "أرشفة الدورة" : "Archive cycle"}
              </button>
            </div>
          </SectionCard>
        </div>
      )}
    </PageContainer>
  );
};

export default PartnershipsSettingsPage;
