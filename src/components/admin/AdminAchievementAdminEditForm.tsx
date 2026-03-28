"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AdminAchievementDetailApi } from "@/types/admin-achievement-review";
import {
  ACHIEVEMENT_LEVELS,
  ACHIEVEMENT_RESULT_TYPES,
  ACHIEVEMENT_TYPES,
  MEDAL_TYPES,
  PARTICIPATION_TYPES,
  RANK_OPTIONS,
} from "@/constants/achievement-options";
import {
  buildAdminAchievementEditInitialNames,
  getAdminAchievementEventSelectOptions,
  mergeUnknownEventOption,
} from "@/lib/admin-achievement-edit-form-map";
import { Loader2, Pencil, Save, X } from "lucide-react";

type Props = {
  achievementId: string;
  detail: AdminAchievementDetailApi;
  isAr: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void | Promise<void>;
};

const selectBaseClass =
  "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

const AdminAchievementAdminEditForm = ({
  achievementId,
  detail,
  isAr,
  open,
  onOpenChange,
  onSaved,
}: Props) => {
  const a = detail.achievement as Record<string, unknown>;
  const loc = isAr ? "ar" : "en";
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [description, setDescription] = useState("");
  const [achievementLevel, setAchievementLevel] = useState("");
  const [achievementType, setAchievementType] = useState("");
  const [organization, setOrganization] = useState("");
  const [competitionName, setCompetitionName] = useState("");
  const [achievementName, setAchievementName] = useState("");
  const [customEventName, setCustomEventName] = useState("");
  const [resultType, setResultType] = useState("");
  const [medalType, setMedalType] = useState("");
  const [rank, setRank] = useState("");
  const [participationType, setParticipationType] = useState("");
  const [teamRole, setTeamRole] = useState("");
  const [nominationText, setNominationText] = useState("");
  const [specialAwardText, setSpecialAwardText] = useState("");
  const [recognitionText, setRecognitionText] = useState("");
  const [otherResultText, setOtherResultText] = useState("");
  const [achievementDate, setAchievementDate] = useState("");
  const [achievementYear, setAchievementYear] = useState("");

  useEffect(() => {
    if (!open) return;
    setErr(null);
    const initNames = buildAdminAchievementEditInitialNames(a);
    setNameAr(initNames.nameAr);
    setNameEn(initNames.nameEn);
    setDescription(String(a.description ?? ""));
    setAchievementLevel(String(a.achievementLevel ?? a.level ?? ""));
    setAchievementType(String(a.achievementType ?? ""));
    setOrganization(String(a.organization ?? ""));
    setCompetitionName(String(a.competitionName ?? ""));
    const an = String(a.achievementName ?? "").trim();
    setAchievementName(an);
    setCustomEventName(String(a.customAchievementName ?? ""));
    setResultType(String(a.resultType ?? ""));
    setMedalType(String(a.medalType ?? ""));
    setRank(String(a.rank ?? ""));
    setParticipationType(String(a.participationType ?? "individual"));
    setTeamRole(String(a.teamRole ?? ""));
    setNominationText(String(a.nominationText ?? ""));
    setSpecialAwardText(String(a.specialAwardText ?? ""));
    setRecognitionText(String(a.recognitionText ?? ""));
    setOtherResultText(String(a.otherResultText ?? ""));
    setAchievementDate(detail.computed.dateIso || "");
    const y = a.achievementYear;
    setAchievementYear(typeof y === "number" ? String(y) : String(y ?? ""));
  }, [open, detail, a]);

  const typeOptions = useMemo(
    () => ACHIEVEMENT_TYPES.map((o) => ({ value: o.value, label: loc === "ar" ? o.ar : o.en })),
    [loc]
  );

  const levelOptions = useMemo(
    () => ACHIEVEMENT_LEVELS.map((o) => ({ value: o.value, label: loc === "ar" ? o.ar : o.en })),
    [loc]
  );

  const resultTypeOptions = useMemo(
    () => ACHIEVEMENT_RESULT_TYPES.map((o) => ({ value: o.value, label: loc === "ar" ? o.ar : o.en })),
    [loc]
  );

  const participationOptions = useMemo(
    () => PARTICIPATION_TYPES.map((o) => ({ value: o.value, label: loc === "ar" ? o.ar : o.en })),
    [loc]
  );

  const medalOptions = useMemo(
    () => MEDAL_TYPES.map((o) => ({ value: o.value, label: loc === "ar" ? o.ar : o.en })),
    [loc]
  );

  const rankOptions = useMemo(() => {
    const base = RANK_OPTIONS.map((o) => ({ value: o.value, label: loc === "ar" ? o.ar : o.en }));
    const r = String(rank || "").trim();
    if (r && !base.some((x) => x.value === r)) {
      return [{ value: r, label: r }, ...base];
    }
    return base;
  }, [loc, rank]);

  const medalOptionsWithCurrent = useMemo(() => {
    const m = String(medalType || "").trim();
    if (m && !MEDAL_TYPES.some((x) => x.value === m)) {
      return [{ value: m, label: m }, ...medalOptions];
    }
    return medalOptions;
  }, [medalType, medalOptions]);

  const rawEventOptions = useMemo(
    () => getAdminAchievementEventSelectOptions(achievementType, loc),
    [achievementType, loc]
  );

  const eventOptions = useMemo(
    () => mergeUnknownEventOption(rawEventOptions, achievementName, loc),
    [rawEventOptions, achievementName, loc]
  );

  const showEventSelect = eventOptions.length > 0;

  const handleSave = useCallback(async () => {
    setSaving(true);
    setErr(null);
    try {
      const eventKey = achievementName.trim() || String(a.achievementName || "").trim();
      const resolvedAchievementName = showEventSelect
        ? eventKey
        : achievementName.trim() || String(a.achievementName || "").trim();

      const resolvedCustom =
        resolvedAchievementName === "other" || resolvedAchievementName === "olympiad_other"
          ? customEventName.trim()
          : "";

      const body: Record<string, unknown> = {
        nameAr: nameAr.trim(),
        nameEn: nameEn.trim(),
        description: description.trim(),
        achievementLevel: achievementLevel.trim(),
        achievementType: achievementType.trim(),
        organization: organization.trim(),
        competitionName: competitionName.trim(),
        achievementName: resolvedAchievementName,
        customAchievementName: resolvedCustom,
        resultType: resultType.trim(),
        medalType: resultType === "medal" ? medalType.trim() : "",
        rank: resultType === "rank" ? rank.trim() : "",
        nominationText: resultType === "nomination" ? nominationText.trim() : "",
        specialAwardText: resultType === "special_award" ? specialAwardText.trim() : "",
        recognitionText: resultType === "recognition" ? recognitionText.trim() : "",
        otherResultText: resultType === "other" ? otherResultText.trim() : "",
        participationType: participationType.trim(),
        teamRole: participationType === "team" ? teamRole.trim() : "",
        achievementDate: achievementDate || undefined,
        achievementYear: achievementYear.trim() ? Number(achievementYear) : undefined,
      };

      const res = await fetch(`/api/admin/achievements/${achievementId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
    achievementName,
    customEventName,
    resultType,
    medalType,
    rank,
    nominationText,
    specialAwardText,
    recognitionText,
    otherResultText,
    participationType,
    teamRole,
    achievementDate,
    achievementYear,
    showEventSelect,
    a.achievementName,
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
          ? "يُحفظ في السجل بالقيم الداخلية المعتمدة؛ القوائم تعرض أسماء مفهومة فقط."
          : "Stored values remain raw slugs; dropdowns show human-readable labels."}
      </p>

      {err ? (
        <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800" role="alert">
          {err}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">
          <span className="text-xs font-semibold text-text-light">{isAr ? "الاسم (عربي)" : "Name (Arabic)"}</span>
          <input
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            autoComplete="off"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="text-xs font-semibold text-text-light">{isAr ? "الاسم (إنجليزي)" : "Name (English)"}</span>
          <input
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            dir="ltr"
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
          <select
            value={achievementType}
            onChange={(e) => {
              const v = e.target.value;
              setAchievementType(v);
              setAchievementName("");
              setCustomEventName("");
            }}
            className={selectBaseClass}
          >
            <option value="">{isAr ? "اختر النوع" : "Select type"}</option>
            {typeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-xs font-semibold text-text-light">{isAr ? "المستوى" : "Level"}</span>
          <select
            value={achievementLevel}
            onChange={(e) => setAchievementLevel(e.target.value)}
            className={selectBaseClass}
          >
            <option value="">{isAr ? "اختر المستوى" : "Select level"}</option>
            {levelOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
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

        {showEventSelect ? (
          <label className="block text-sm sm:col-span-2">
            <span className="text-xs font-semibold text-text-light">
              {isAr ? "الحدث / المسابقة / البرنامج" : "Event / competition / program"}
            </span>
            <select
              value={achievementName}
              onChange={(e) => setAchievementName(e.target.value)}
              className={selectBaseClass}
            >
              <option value="">{isAr ? "اختر" : "Select"}</option>
              {eventOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {(achievementName === "other" || achievementName === "olympiad_other") && (
              <input
                value={customEventName}
                onChange={(e) => setCustomEventName(e.target.value)}
                placeholder={isAr ? "اكتب الاسم المخصص" : "Custom name"}
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            )}
          </label>
        ) : (
          <label className="block text-sm sm:col-span-2">
            <span className="text-xs font-semibold text-text-light">
              {isAr ? "معرّف الحدث (مفتاح التخزين)" : "Event key (stored slug)"}
            </span>
            <input
              value={achievementName}
              onChange={(e) => setAchievementName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder={isAr ? "مثال: competition slug" : "e.g. internal event key"}
              autoComplete="off"
            />
            <span className="mt-1 block text-[10px] text-text-muted">
              {isAr
                ? "يُفضَّل اختيار نوع إنجاز يدعم القائمة أعلاه لتجنب المفاتيح الخام."
                : "Prefer an achievement type with a dropdown to avoid raw keys."}
            </span>
          </label>
        )}

        <label className="block text-sm sm:col-span-2">
          <span className="text-xs font-semibold text-text-light">
            {isAr ? "اسم مسابقة إضافي (اختياري)" : "Extra competition label (optional)"}
          </span>
          <input
            value={competitionName}
            onChange={(e) => setCompetitionName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            autoComplete="off"
          />
        </label>

        <label className="block text-sm">
          <span className="text-xs font-semibold text-text-light">{isAr ? "نوع النتيجة" : "Result type"}</span>
          <select
            value={resultType}
            onChange={(e) => setResultType(e.target.value)}
            className={selectBaseClass}
          >
            <option value="">{isAr ? "اختر" : "Select"}</option>
            {resultTypeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-xs font-semibold text-text-light">{isAr ? "نوع المشاركة" : "Participation"}</span>
          <select
            value={participationType}
            onChange={(e) => setParticipationType(e.target.value)}
            className={selectBaseClass}
          >
            {participationOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        {participationType === "team" ? (
          <label className="block text-sm sm:col-span-2">
            <span className="text-xs font-semibold text-text-light">{isAr ? "دور الفريق" : "Team role"}</span>
            <input
              value={teamRole}
              onChange={(e) => setTeamRole(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              autoComplete="off"
            />
          </label>
        ) : null}

        {resultType === "medal" ? (
          <label className="block text-sm">
            <span className="text-xs font-semibold text-text-light">{isAr ? "الميدالية" : "Medal"}</span>
            <select
              value={medalType}
              onChange={(e) => setMedalType(e.target.value)}
              className={selectBaseClass}
            >
              <option value="">{isAr ? "اختر" : "Select"}</option>
              {medalOptionsWithCurrent.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {resultType === "rank" ? (
          <label className="block text-sm">
            <span className="text-xs font-semibold text-text-light">{isAr ? "المركز" : "Rank"}</span>
            <select
              value={rank}
              onChange={(e) => setRank(e.target.value)}
              className={selectBaseClass}
            >
              <option value="">{isAr ? "اختر" : "Select"}</option>
              {rankOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {resultType === "nomination" ? (
          <label className="block text-sm sm:col-span-2">
            <span className="text-xs font-semibold text-text-light">{isAr ? "نص الترشيح" : "Nomination details"}</span>
            <textarea
              value={nominationText}
              onChange={(e) => setNominationText(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        ) : null}

        {resultType === "special_award" ? (
          <label className="block text-sm sm:col-span-2">
            <span className="text-xs font-semibold text-text-light">{isAr ? "الجائزة الخاصة" : "Special award"}</span>
            <textarea
              value={specialAwardText}
              onChange={(e) => setSpecialAwardText(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        ) : null}

        {resultType === "recognition" ? (
          <label className="block text-sm sm:col-span-2">
            <span className="text-xs font-semibold text-text-light">{isAr ? "التكريم" : "Recognition"}</span>
            <textarea
              value={recognitionText}
              onChange={(e) => setRecognitionText(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        ) : null}

        {resultType === "other" ? (
          <label className="block text-sm sm:col-span-2">
            <span className="text-xs font-semibold text-text-light">{isAr ? "تفاصيل النتيجة" : "Result details"}</span>
            <textarea
              value={otherResultText}
              onChange={(e) => setOtherResultText(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        ) : null}

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
