"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminAchievementDetailApi } from "@/types/admin-achievement-review";
import { Loader2, Globe2, Sparkles } from "lucide-react";

type Props = {
  achievementId: string;
  detail: AdminAchievementDetailApi;
  isAr: boolean;
  onSaved: () => void | Promise<void>;
};

const derivePortfolioChecked = (a: Record<string, unknown>): boolean => {
  if (a.publicPortfolioSuppressedByAdmin === true) return false;
  return a.showInPublicPortfolio !== false;
};

const deriveHallChecked = (a: Record<string, unknown>): boolean => {
  return a.showInHallOfFame !== false;
};

const AdminAchievementVisibilityCard = ({ achievementId, detail, isAr, onSaved }: Props) => {
  const a = detail.achievement as Record<string, unknown>;
  const [portfolio, setPortfolio] = useState(derivePortfolioChecked(a));
  const [hall, setHall] = useState(deriveHallChecked(a));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const ach = detail.achievement as Record<string, unknown>;
    setPortfolio(derivePortfolioChecked(ach));
    setHall(deriveHallChecked(ach));
  }, [detail]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/achievements/${achievementId}/visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          showInPublicPortfolio: portfolio,
          showInHallOfFame: hall,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(typeof j.error === "string" ? j.error : "Save failed");
      }
      await onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }, [achievementId, portfolio, hall, onSaved]);

  const dirty =
    portfolio !== derivePortfolioChecked(a) || hall !== deriveHallChecked(a);

  return (
    <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-4 shadow-sm">
      <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-emerald-950">
        <Globe2 className="h-4 w-4 shrink-0" aria-hidden />
        {isAr ? "الظهور والنشر" : "Visibility"}
      </h2>
      <p className="mt-1 text-[11px] leading-snug text-emerald-900/80">
        {isAr
          ? "الإنجازات المعتمدة تُنشر افتراضيًا في ملف إنجاز الطالب، ويمكن استثناء هذا الإنجاز يدويًا."
          : "Approved achievements are included in the student’s public portfolio by default; you may exclude this record."}
      </p>

      <div className="mt-4 space-y-3">
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/60 bg-white/90 px-3 py-2.5 shadow-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-emerald-400 text-emerald-700 focus:ring-emerald-600"
            checked={portfolio}
            onChange={(e) => setPortfolio(e.target.checked)}
            disabled={saving}
          />
          <span>
            <span className="block text-sm font-semibold text-emerald-950">
              {isAr ? "يظهر في ملف الإنجاز" : "Show in public portfolio"}
            </span>
            <span className="mt-0.5 block text-[11px] text-emerald-800/90">
              {isAr
                ? "مستقل عن لوحة التميز — يتحكم في ظهور السجل في الرابط العام للطالب."
                : "Independent from Hall of Fame — controls this record on the student’s public link."}
            </span>
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/60 bg-white/90 px-3 py-2.5 shadow-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-violet-400 text-violet-700 focus:ring-violet-600"
            checked={hall}
            onChange={(e) => setHall(e.target.checked)}
            disabled={saving}
          />
          <span className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-700" aria-hidden />
            <span>
              <span className="block text-sm font-semibold text-slate-900">
                {isAr ? "يظهر في لوحة التميز" : "Show in Hall of Fame"}
              </span>
              <span className="mt-0.5 block text-[11px] text-slate-600">
                {isAr ? "لا يغيّر إعدادات ملف الإنجاز العام." : "Does not change public portfolio settings."}
              </span>
            </span>
          </span>
        </label>
      </div>

      {err ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800" role="alert">
          {err}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={saving || !dirty}
          onClick={() => void handleSave()}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-900 disabled:opacity-40"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {isAr ? "حفظ الظهور" : "Save visibility"}
        </button>
        {dirty ? (
          <span className="text-[11px] font-medium text-amber-800">
            {isAr ? "تغييرات غير محفوظة" : "Unsaved changes"}
          </span>
        ) : null}
      </div>
    </div>
  );
};

export default AdminAchievementVisibilityCard;
