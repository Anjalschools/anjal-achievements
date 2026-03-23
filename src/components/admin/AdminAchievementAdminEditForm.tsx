"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminAchievementDetailApi } from "@/types/admin-achievement-review";
import { Loader2, Pencil, Save, X } from "lucide-react";

type Props = {
  achievementId: string;
  detail: AdminAchievementDetailApi;
  isAr: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void | Promise<void>;
};

const AdminAchievementAdminEditForm = ({
  achievementId,
  detail,
  isAr,
  open,
  onOpenChange,
  onSaved,
}: Props) => {
  const a = detail.achievement as Record<string, unknown>;
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [description, setDescription] = useState("");
  const [achievementLevel, setAchievementLevel] = useState("");
  const [achievementType, setAchievementType] = useState("");
  const [organization, setOrganization] = useState("");
  const [competitionName, setCompetitionName] = useState("");
  const [resultType, setResultType] = useState("");
  const [medalType, setMedalType] = useState("");
  const [rank, setRank] = useState("");
  const [participationType, setParticipationType] = useState("");
  const [achievementDate, setAchievementDate] = useState("");
  const [achievementYear, setAchievementYear] = useState("");

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setNameAr(String(a.nameAr ?? ""));
    setNameEn(String(a.nameEn ?? ""));
    setDescription(String(a.description ?? ""));
    setAchievementLevel(String(a.achievementLevel ?? a.level ?? ""));
    setAchievementType(String(a.achievementType ?? ""));
    setOrganization(String(a.organization ?? ""));
    setCompetitionName(String(a.competitionName ?? ""));
    setResultType(String(a.resultType ?? ""));
    setMedalType(String(a.medalType ?? ""));
    setRank(String(a.rank ?? ""));
    setParticipationType(String(a.participationType ?? ""));
    setAchievementDate(detail.computed.dateIso || "");
    const y = a.achievementYear;
    setAchievementYear(typeof y === "number" ? String(y) : String(y ?? ""));
  }, [open, detail, a]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/achievements/${achievementId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nameAr,
          nameEn,
          description,
          achievementLevel,
          achievementType,
          organization,
          competitionName,
          resultType,
          medalType,
          rank,
          participationType,
          achievementDate: achievementDate || undefined,
          achievementYear: achievementYear.trim() ? Number(achievementYear) : undefined,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(typeof j.error === "string" ? j.error : "Save failed");
      }
      onOpenChange(false);
      await onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }, [
    achievementId,
    nameAr,
    nameEn,
    description,
    achievementLevel,
    achievementType,
    organization,
    competitionName,
    resultType,
    medalType,
    rank,
    participationType,
    achievementDate,
    achievementYear,
    onOpenChange,
    onSaved,
  ]);

  if (!open) return null;

  return (
    <section
      className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/90 to-white p-4 shadow-sm"
      aria-labelledby="admin-edit-achievement-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="admin-edit-achievement-title" className="flex items-center gap-2 text-sm font-bold text-indigo-950">
          <Pencil className="h-4 w-4 shrink-0" aria-hidden />
          {isAr ? "تعديل الإنجاز (مسؤول)" : "Edit achievement (admin)"}
        </h3>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-text hover:bg-gray-50"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          {isAr ? "إغلاق" : "Close"}
        </button>
      </div>
      <p className="mt-1 text-[11px] text-text-light">
        {isAr
          ? "يُحفظ في السجل ويُحدَّث التقييم تلقائيًا. متاح لمسؤول النظام فقط."
          : "Saves to the record and recalculates score. Admin only."}
      </p>

      {err ? (
        <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800" role="alert">
          {err}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-xs font-semibold text-text-light">{isAr ? "الاسم (عربي)" : "Name (Arabic)"}</span>
          <input
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            autoComplete="off"
          />
        </label>
        <label className="block text-sm">
          <span className="text-xs font-semibold text-text-light">{isAr ? "الاسم (إنجليزي)" : "Name (English)"}</span>
          <input
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            autoComplete="off"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="text-xs font-semibold text-text-light">{isAr ? "الوصف" : "Description"}</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="text-xs font-semibold text-text-light">{isAr ? "نوع الإنجاز" : "Achievement type"}</span>
          <input
            value={achievementType}
            onChange={(e) => setAchievementType(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs"
            autoComplete="off"
          />
        </label>
        <label className="block text-sm">
          <span className="text-xs font-semibold text-text-light">{isAr ? "المستوى" : "Level"}</span>
          <input
            value={achievementLevel}
            onChange={(e) => setAchievementLevel(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs"
            autoComplete="off"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="text-xs font-semibold text-text-light">{isAr ? "الجهة المنظمة" : "Organization"}</span>
          <input
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            autoComplete="off"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="text-xs font-semibold text-text-light">{isAr ? "اسم المسابقة / البرنامج" : "Competition / program"}</span>
          <input
            value={competitionName}
            onChange={(e) => setCompetitionName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            autoComplete="off"
          />
        </label>
        <label className="block text-sm">
          <span className="text-xs font-semibold text-text-light">{isAr ? "نوع النتيجة" : "Result type"}</span>
          <input
            value={resultType}
            onChange={(e) => setResultType(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs"
            autoComplete="off"
          />
        </label>
        <label className="block text-sm">
          <span className="text-xs font-semibold text-text-light">{isAr ? "الميدالية" : "Medal"}</span>
          <input
            value={medalType}
            onChange={(e) => setMedalType(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            autoComplete="off"
          />
        </label>
        <label className="block text-sm">
          <span className="text-xs font-semibold text-text-light">{isAr ? "المركز / الترتيب" : "Rank"}</span>
          <input
            value={rank}
            onChange={(e) => setRank(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            autoComplete="off"
          />
        </label>
        <label className="block text-sm">
          <span className="text-xs font-semibold text-text-light">{isAr ? "نوع المشاركة" : "Participation"}</span>
          <input
            value={participationType}
            onChange={(e) => setParticipationType(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs"
            autoComplete="off"
          />
        </label>
        <label className="block text-sm">
          <span className="text-xs font-semibold text-text-light">{isAr ? "التاريخ" : "Date"}</span>
          <input
            type="date"
            value={achievementDate}
            onChange={(e) => setAchievementDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="text-xs font-semibold text-text-light">{isAr ? "العام الدراسي" : "Year"}</span>
          <input
            value={achievementYear}
            onChange={(e) => setAchievementYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm tabular-nums"
            inputMode="numeric"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => onOpenChange(false)}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-text hover:bg-gray-50 disabled:opacity-50"
        >
          {isAr ? "إلغاء" : "Cancel"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
          {isAr ? "حفظ التعديلات" : "Save changes"}
        </button>
      </div>
    </section>
  );
};

export default AdminAchievementAdminEditForm;
