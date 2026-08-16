"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import IconActionButton from "@/components/ui/IconActionButton";
import { getLocale } from "@/lib/i18n";
import { AlertTriangle, Archive, CalendarRange, Loader2, Lock, Pencil, Star, Unlock, X } from "lucide-react";

type AcademicYearRow = {
  id: string;
  name: string;
  label: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  isLocked: boolean;
  promotionExecuted: boolean;
  snapshotCreated: boolean;
  status: string;
};

type PromotionTransition = {
  fromGrade: string;
  fromGradeLabelAr: string;
  fromGradeLabelEn: string;
  toGrade: string | null;
  toGradeLabelAr: string | null;
  toGradeLabelEn: string | null;
  studentCount: number;
};

type PromotionPreview = {
  totalStudents: number;
  promotableStudents: number;
  graduatingStudents: number;
  transitions: PromotionTransition[];
};

type PromotionSummary = {
  totalEligible: number;
  promotedCount: number;
  graduatedCount: number;
};

type AcademicYearSummary = {
  current: AcademicYearRow | null;
  total: number;
  activeCount: number;
  archivedCount: number;
};

const toInputDate = (value: string) => (value ? value.slice(0, 10) : "");

const AcademicYearsAdminPage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AcademicYearRow[]>([]);
  const [summary, setSummary] = useState<AcademicYearSummary>({
    current: null,
    total: 0,
    activeCount: 0,
    archivedCount: 0,
  });
  const [canManage, setCanManage] = useState(false);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");

  const [confirmYear, setConfirmYear] = useState<AcademicYearRow | null>(null);
  const [previewData, setPreviewData] = useState<PromotionPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);
  const [lastSetCurrentNotice, setLastSetCurrentNotice] = useState<string | null>(null);

  const statusLabel = useMemo(
    () =>
      ({
        draft: isAr ? "مسودة" : "Draft",
        active: isAr ? "نشط" : "Active",
        locked: isAr ? "مقفل" : "Locked",
        archived: isAr ? "مؤرشف" : "Archived",
      }) as Record<string, string>,
    [isAr]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/academic-years", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setItems(Array.isArray(json.items) ? json.items : []);
      setCanManage(json.canManage === true);
      if (json.summary) setSummary(json.summary as AcademicYearSummary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    if (!canManage || !name.trim() || !startDate || !endDate) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/academic-years", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), startDate, endDate }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setName("");
      setStartDate("");
      setEndDate("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (id: string, action: "lock" | "unlock" | "archive") => {
    if (!canManage) return;
    const confirmMessages: Record<typeof action, string> = {
      lock: isAr
        ? "قفل العام الدراسي يمنع الطلبات والتعديلات الجديدة.\n\nهل تريد المتابعة؟"
        : "Locking this year prevents new applications and edits.\n\nContinue?",
      unlock: isAr
        ? "إعادة فتح العام الدراسي ستسمح مجدداً بالطلبات والتعديلات.\n\nهل تريد المتابعة؟"
        : "Unlocking this year will allow applications and edits again.\n\nContinue?",
      archive: isAr
        ? "أرشفة العام الدراسي تنقله إلى السجل التاريخي.\n\nهل تريد المتابعة؟"
        : "Archiving moves this year to historical records.\n\nContinue?",
    };
    if (!window.confirm(confirmMessages[action])) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/academic-years/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
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

  const openSetCurrentDialog = async (row: AcademicYearRow) => {
    if (!canManage) return;
    setConfirmYear(row);
    setPreviewData(null);
    setPreviewError(null);
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/admin/academic-years?preview=1", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      if (json.promotionPreview) setPreviewData(json.promotionPreview as PromotionPreview);
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : "Error");
    } finally {
      setPreviewLoading(false);
    }
  };

  const closeSetCurrentDialog = () => {
    if (confirmSubmitting) return;
    setConfirmYear(null);
    setPreviewData(null);
    setPreviewError(null);
  };

  const confirmSetCurrent = async () => {
    if (!confirmYear || !canManage) return;
    setConfirmSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/academic-years/${encodeURIComponent(confirmYear.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_current" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");

      const summary = json.promotionSummary as PromotionSummary | null;
      if (json.alreadyPromoted) {
        setLastSetCurrentNotice(
          isAr
            ? `تم تعيين "${confirmYear.label}" كعام حالي — تم تنفيذ ترحيل الطلاب مسبقًا لهذا العام، لم يُعَد تنفيذه.`
            : `"${confirmYear.label}" set as current — students for this year were already promoted earlier; promotion was not re-run.`
        );
      } else if (summary) {
        setLastSetCurrentNotice(
          isAr
            ? `تم تعيين "${confirmYear.label}" كعام حالي وترحيل ${summary.promotedCount} طالبًا وتخريج ${summary.graduatedCount} طالبًا.`
            : `"${confirmYear.label}" set as current. Promoted ${summary.promotedCount} students, graduated ${summary.graduatedCount}.`
        );
      }

      setConfirmYear(null);
      setPreviewData(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setConfirmSubmitting(false);
    }
  };

  const startEdit = (row: AcademicYearRow) => {
    setEditingId(row.id);
    setEditName(row.name);
    setEditStartDate(toInputDate(row.startDate));
    setEditEndDate(toInputDate(row.endDate));
  };

  const handleSaveEdit = async () => {
    if (!editingId || !canManage) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/academic-years/${encodeURIComponent(editingId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          startDate: editStartDate,
          endDate: editEndDate,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setEditingId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const formatPeriod = (row: AcademicYearRow) => {
    try {
      const start = new Date(row.startDate).toLocaleDateString(isAr ? "ar-SA" : "en-US");
      const end = new Date(row.endDate).toLocaleDateString(isAr ? "ar-SA" : "en-US");
      return `${start} — ${end}`;
    } catch {
      return "—";
    }
  };

  const renderStatusBadges = (row: AcademicYearRow) => (
    <div className="flex flex-wrap gap-1">
      {row.isCurrent ? (
        <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
          {isAr ? "الحالي" : "Current"}
        </span>
      ) : null}
      {row.status === "archived" ? (
        <span className="inline-flex rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
          {isAr ? "مؤرشف" : "Archived"}
        </span>
      ) : null}
      {row.isLocked ? (
        <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
          {isAr ? "مقفل" : "Locked"}
        </span>
      ) : null}
      {row.status === "active" && !row.isLocked ? (
        <span className="inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800">
          {isAr ? "نشط" : "Active"}
        </span>
      ) : null}
      {!row.isCurrent && row.status !== "archived" && row.status !== "active" && !row.isLocked ? (
        <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
          {statusLabel[row.status] || row.status}
        </span>
      ) : null}
    </div>
  );

  const summaryCards = [
    {
      label: isAr ? "العام الحالي" : "Current year",
      value: summary.current?.label || summary.current?.name || (isAr ? "—" : "—"),
    },
    { label: isAr ? "عدد الأعوام" : "Total years", value: String(summary.total) },
    { label: isAr ? "الأعوام النشطة" : "Active years", value: String(summary.activeCount) },
    { label: isAr ? "الأعوام المؤرشفة" : "Archived years", value: String(summary.archivedCount) },
  ];

  return (
    <PageContainer>
      <PageHeader
        title={isAr ? "الأعوام الدراسية" : "Academic years"}
        subtitle={
          isAr
            ? "محرك العام الدراسي — مصدر الحقيقة المركزي للمنصة"
            : "Academic year engine — central source of truth"
        }
      />

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
      {lastSetCurrentNotice ? (
        <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {lastSetCurrentNotice}
        </p>
      ) : null}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <SectionCard key={card.label} className="p-4">
            <p className="text-xs font-semibold text-text-light">{card.label}</p>
            <p className="mt-1 text-lg font-black text-foreground">{card.value}</p>
          </SectionCard>
        ))}
      </div>

      {canManage ? (
        <SectionCard className="mb-6">
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-foreground">
            <CalendarRange className="h-4 w-4 text-primary" aria-hidden />
            {isAr ? "إنشاء عام جديد" : "Create academic year"}
          </h2>
          <div className="grid gap-3 md:grid-cols-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isAr ? "مثال: 2026-2027" : "e.g. 2026-2027"}
              className="rounded-xl border border-border px-3 py-2 text-sm"
              aria-label={isAr ? "اسم العام" : "Year name"}
            />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-xl border border-border px-3 py-2 text-sm"
              aria-label={isAr ? "تاريخ البداية" : "Start date"}
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-xl border border-border px-3 py-2 text-sm"
              aria-label={isAr ? "تاريخ النهاية" : "End date"}
            />
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={saving || !name.trim() || !startDate || !endDate}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              {saving ? "…" : isAr ? "إضافة" : "Add"}
            </button>
          </div>
        </SectionCard>
      ) : (
        <p className="mb-4 text-sm text-text-light">
          {isAr ? "عرض للقراءة فقط." : "Read-only view."}
        </p>
      )}

      <SectionCard>
        <h2 className="mb-4 text-base font-bold text-foreground">
          {isAr ? "قائمة الأعوام" : "Academic years list"}
        </h2>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-text-light">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            <span>{isAr ? "جاري التحميل…" : "Loading…"}</span>
          </div>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-text-light">
            {isAr ? "لا توجد أعوام دراسية بعد." : "No academic years yet."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border/70 text-start">
                  <th className="px-3 py-2 font-bold">{isAr ? "الاسم" : "Name"}</th>
                  <th className="px-3 py-2 font-bold">{isAr ? "الفترة" : "Period"}</th>
                  <th className="px-3 py-2 font-bold">{isAr ? "الحالة" : "Status"}</th>
                  <th className="px-3 py-2 font-bold">{isAr ? "الحالي" : "Current"}</th>
                  <th className="px-3 py-2 font-bold">{isAr ? "القفل" : "Lock"}</th>
                  {canManage ? <th className="px-3 py-2 font-bold">{isAr ? "إجراءات" : "Actions"}</th> : null}
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-b border-border/50 align-top">
                    <td className="px-3 py-3 font-semibold">
                      {editingId === row.id ? (
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full rounded-lg border border-border px-2 py-1"
                          aria-label={isAr ? "تعديل الاسم" : "Edit name"}
                        />
                      ) : (
                        row.label || row.name
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {editingId === row.id ? (
                        <div className="flex flex-col gap-1">
                          <input
                            type="date"
                            value={editStartDate}
                            onChange={(e) => setEditStartDate(e.target.value)}
                            className="rounded-lg border border-border px-2 py-1"
                          />
                          <input
                            type="date"
                            value={editEndDate}
                            onChange={(e) => setEditEndDate(e.target.value)}
                            className="rounded-lg border border-border px-2 py-1"
                          />
                        </div>
                      ) : (
                        formatPeriod(row)
                      )}
                    </td>
                    <td className="px-3 py-3">{renderStatusBadges(row)}</td>
                    <td className="px-3 py-3">
                      {row.isCurrent ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <Star className="h-4 w-4" aria-hidden />
                          {isAr ? "نعم" : "Yes"}
                        </span>
                      ) : (
                        isAr ? "لا" : "No"
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {row.isLocked ? (
                        <span className="inline-flex items-center gap-1 text-amber-800">
                          <Lock className="h-4 w-4" aria-hidden />
                          {isAr ? "مقفل" : "Locked"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-text-light">
                          <Unlock className="h-4 w-4" aria-hidden />
                          {isAr ? "مفتوح" : "Open"}
                        </span>
                      )}
                    </td>
                    {canManage ? (
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          {editingId === row.id ? (
                            <>
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => void handleSaveEdit()}
                                className="rounded-lg bg-primary px-2 py-1 text-xs font-bold text-white"
                              >
                                {isAr ? "حفظ" : "Save"}
                              </button>
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => setEditingId(null)}
                                className="rounded-lg border border-border px-2 py-1 text-xs font-bold"
                              >
                                {isAr ? "إلغاء" : "Cancel"}
                              </button>
                            </>
                          ) : (
                            <>
                              {!row.isLocked && row.status !== "archived" ? (
                                <IconActionButton
                                  label={isAr ? "تعديل" : "Edit"}
                                  disabled={saving}
                                  onClick={() => startEdit(row)}
                                >
                                  <Pencil className="h-4 w-4" aria-hidden />
                                </IconActionButton>
                              ) : null}
                              {!row.isCurrent && !row.isLocked && row.status !== "archived" ? (
                                <IconActionButton
                                  label={isAr ? "تعيين كعام حالي" : "Set as current year"}
                                  disabled={saving}
                                  onClick={() => void openSetCurrentDialog(row)}
                                >
                                  <Star className="h-4 w-4 text-primary" aria-hidden />
                                </IconActionButton>
                              ) : null}
                              {!row.isLocked && row.status !== "archived" ? (
                                <IconActionButton
                                  label={isAr ? "قفل" : "Lock year"}
                                  disabled={saving}
                                  onClick={() => void runAction(row.id, "lock")}
                                >
                                  <Lock className="h-4 w-4 text-amber-800" aria-hidden />
                                </IconActionButton>
                              ) : (
                                <IconActionButton
                                  label={isAr ? "إعادة فتح" : "Unlock year"}
                                  disabled={saving}
                                  onClick={() => void runAction(row.id, "unlock")}
                                >
                                  <Unlock className="h-4 w-4 text-emerald-800" aria-hidden />
                                </IconActionButton>
                              )}
                              {!row.isCurrent && row.status !== "archived" ? (
                                <IconActionButton
                                  label={isAr ? "أرشفة" : "Archive year"}
                                  disabled={saving}
                                  onClick={() => void runAction(row.id, "archive")}
                                >
                                  <Archive className="h-4 w-4" aria-hidden />
                                </IconActionButton>
                              ) : null}
                            </>
                          )}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {confirmYear ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="set-current-dialog-title"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <AlertTriangle className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="set-current-dialog-title" className="text-base font-bold text-foreground">
                  {isAr ? "تنبيه: تعيين العام الحالي وترحيل الطلاب" : "Warning: set current year and promote students"}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeSetCurrentDialog}
                disabled={confirmSubmitting}
                aria-label={isAr ? "إغلاق" : "Close"}
                className="shrink-0 rounded-lg p-1 text-text-light hover:bg-slate-100 disabled:opacity-50"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <p className="whitespace-pre-line text-sm text-text-light">
              {isAr
                ? `أنت على وشك تعيين العام الدراسي ${confirmYear.label} كعام حالي.\n\nسيؤدي هذا الإجراء إلى ترحيل الطلاب إلى الصفوف التالية، وتحويل طلاب الصف الثالث الثانوي إلى خريجين.\n\nسيتم الاحتفاظ بسجل الطلاب وإنجازاتهم السابقة ولن يتم حذفها.\n\nلا تنفذ هذا الإجراء إلا بعد التأكد من جاهزية بيانات العام الجديد.`
                : `You are about to set ${confirmYear.label} as the current academic year.\n\nThis will promote students to their next grade, and convert Grade 12 students to graduates.\n\nStudent records and their past achievements are preserved and will not be deleted.\n\nOnly proceed once the new year's data is ready.`}
            </p>

            {confirmYear.promotionExecuted ? (
              <p className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-800">
                {isAr
                  ? "تم تنفيذ ترحيل الطلاب مسبقًا لهذا العام — لن يتم ترحيل الطلاب مرة أخرى، سيتم فقط تعيينه كعام حالي."
                  : "Students for this year were already promoted earlier — promotion will not run again; only the current-year flag will change."}
              </p>
            ) : null}

            <div className="mt-4 rounded-xl border border-border bg-slate-50 p-3">
              {previewLoading ? (
                <div className="flex items-center gap-2 py-3 text-sm text-text-light">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  {isAr ? "جاري حساب أعداد الترحيل المتوقعة…" : "Calculating expected promotion counts…"}
                </div>
              ) : previewError ? (
                <p className="py-2 text-sm text-red-600">{previewError}</p>
              ) : previewData ? (
                <>
                  <ul className="space-y-1 text-sm">
                    {previewData.transitions.map((t) => (
                      <li key={t.fromGrade} className="flex items-center justify-between gap-3">
                        <span className="text-foreground">
                          {isAr
                            ? t.toGradeLabelAr
                              ? `${t.fromGradeLabelAr} ← ${t.toGradeLabelAr}`
                              : `${t.fromGradeLabelAr} ← خريجون`
                            : t.toGradeLabelEn
                              ? `${t.fromGradeLabelEn} → ${t.toGradeLabelEn}`
                              : `${t.fromGradeLabelEn} → Graduates`}
                        </span>
                        <span className="font-bold tabular-nums text-foreground">
                          {t.studentCount} {isAr ? "طالب" : "students"}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 flex items-center justify-between border-t border-border/70 pt-2 text-sm font-bold">
                    <span>{isAr ? "إجمالي الطلاب المتأثرين" : "Total students affected"}</span>
                    <span className="tabular-nums">{previewData.totalStudents}</span>
                  </div>
                </>
              ) : (
                <p className="py-2 text-sm text-text-light">
                  {isAr ? "لا يوجد طلاب نشطون للترحيل حاليًا." : "No active students to promote."}
                </p>
              )}
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={closeSetCurrentDialog}
                disabled={confirmSubmitting}
                className="rounded-xl border border-border px-4 py-2 text-sm font-bold text-foreground disabled:opacity-60"
              >
                {isAr ? "إلغاء" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={() => void confirmSetCurrent()}
                disabled={confirmSubmitting || previewLoading}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {confirmSubmitting
                  ? "…"
                  : isAr
                    ? "تأكيد تعيين العام وترحيل الطلاب"
                    : "Confirm: set year and promote students"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PageContainer>
  );
};

export default AcademicYearsAdminPage;
