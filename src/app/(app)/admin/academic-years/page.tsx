"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import { getLocale } from "@/lib/i18n";
import { CalendarRange, Loader2, Lock, Unlock, Star } from "lucide-react";

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

const toInputDate = (value: string) => (value ? value.slice(0, 10) : "");

const AcademicYearsAdminPage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AcademicYearRow[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

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

  const runAction = async (id: string, action: "set_current" | "lock" | "unlock") => {
    if (!canManage) return;
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

  const formatPeriod = (row: AcademicYearRow) => {
    try {
      const start = new Date(row.startDate).toLocaleDateString(isAr ? "ar-SA" : "en-US");
      const end = new Date(row.endDate).toLocaleDateString(isAr ? "ar-SA" : "en-US");
      return `${start} — ${end}`;
    } catch {
      return "—";
    }
  };

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
                  <tr key={row.id} className="border-b border-border/50">
                    <td className="px-3 py-3 font-semibold">{row.label || row.name}</td>
                    <td className="px-3 py-3">{formatPeriod(row)}</td>
                    <td className="px-3 py-3">{statusLabel[row.status] || row.status}</td>
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
                          {!row.isCurrent && !row.isLocked ? (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void runAction(row.id, "set_current")}
                              className="rounded-lg border border-primary/30 px-2 py-1 text-xs font-bold text-primary"
                            >
                              {isAr ? "تعيين كحالي" : "Set current"}
                            </button>
                          ) : null}
                          {!row.isLocked ? (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void runAction(row.id, "lock")}
                              className="rounded-lg border border-amber-300 px-2 py-1 text-xs font-bold text-amber-900"
                            >
                              {isAr ? "قفل" : "Lock"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void runAction(row.id, "unlock")}
                              className="rounded-lg border border-emerald-300 px-2 py-1 text-xs font-bold text-emerald-900"
                            >
                              {isAr ? "إعادة فتح" : "Unlock"}
                            </button>
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
    </PageContainer>
  );
};

export default AcademicYearsAdminPage;
