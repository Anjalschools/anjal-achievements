"use client";

import { useCallback, useState } from "react";
import Link from "next/link";

type PreviewRow = {
  id: string;
  eligible: boolean;
  protected: boolean;
  wouldApply: boolean;
  current: {
    achievementCategory: string;
    achievementName: string;
    customAchievementName: string;
    achievementLevel: string;
  };
  proposed: {
    achievementCategory: string;
    achievementLevel?: string;
    patchKeys: string[];
  } | null;
  classification: {
    confidence: string;
    score: number;
    reasons: string[];
    matchedSignals: string[];
    negativeSignals: string[];
  } | null;
};

type PreviewResponse = {
  classifierVersion: string;
  totalCandidates: number;
  scanned: number;
  returned: number;
  wouldApplyCount: number;
  safetyRecommendation: string[];
  previews: PreviewRow[];
};

const AchievementBackfillPreviewPage = () => {
  const [limit, setLimit] = useState(50);
  const [onlyWouldApply, setOnlyWouldApply] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<PreviewResponse | null>(null);

  const handleLoad = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({
        limit: String(limit),
        ...(onlyWouldApply ? { onlyWouldApply: "1" } : {}),
      });
      const res = await fetch(`/api/admin/achievement-backfill-preview?${qs}`);
      const json = (await res.json()) as PreviewResponse & { error?: string };
      if (!res.ok) {
        setError(json.error || "Failed to load preview");
        setData(null);
        return;
      }
      setData(json);
    } catch {
      setError("Network error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [limit, onlyWouldApply]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">معاينة Backfill التصنيفات</h1>
          <p className="mt-1 text-sm text-slate-600">
            قراءة فقط — لا يتم تعديل قاعدة البيانات
          </p>
        </div>
        <Link
          href="/admin/achievements/review"
          className="text-sm text-indigo-700 underline hover:text-indigo-900"
        >
          العودة لمراجعة الإنجازات
        </Link>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">الحد (limit)</span>
          <input
            type="number"
            min={1}
            max={200}
            value={limit}
            onChange={(e) => setLimit(Math.min(200, Math.max(1, Number(e.target.value) || 50)))}
            className="w-28 rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={onlyWouldApply}
            onChange={(e) => setOnlyWouldApply(e.target.checked)}
            className="rounded border-slate-300"
          />
          عرض المقترح للتطبيق فقط
        </label>
        <button
          type="button"
          onClick={handleLoad}
          disabled={loading}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? "جاري التحميل…" : "تحميل المعاينة"}
        </button>
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      {data ? (
        <>
          <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <span className="text-slate-500">إصدار المصنّف</span>
              <p className="font-mono font-medium">{data.classifierVersion}</p>
            </div>
            <div>
              <span className="text-slate-500">مرشّحون إجمالاً</span>
              <p className="font-medium">{data.totalCandidates}</p>
            </div>
            <div>
              <span className="text-slate-500">تم فحص</span>
              <p className="font-medium">{data.scanned}</p>
            </div>
            <div>
              <span className="text-slate-500">سيُطبَّق (ضمن العينة)</span>
              <p className="font-medium text-emerald-800">{data.wouldApplyCount}</p>
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-semibold">تسلسل آمن مقترح قبل --apply:</p>
            <ol className="mt-2 list-decimal pr-5 space-y-1">
              {data.safetyRecommendation.map((line) => (
                <li key={line}>
                  <code className="text-xs">{line}</code>
                </li>
              ))}
            </ol>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-right text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-3 py-2">المعرف</th>
                  <th className="px-3 py-2">الحالي</th>
                  <th className="px-3 py-2">المقترح</th>
                  <th className="px-3 py-2">ثقة</th>
                  <th className="px-3 py-2">إشارات</th>
                  <th className="px-3 py-2">حماية</th>
                </tr>
              </thead>
              <tbody>
                {data.previews.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-2 font-mono text-xs">{p.id}</td>
                    <td className="px-3 py-2">
                      <div>{p.current.achievementCategory || "—"}</div>
                      <div className="text-xs text-slate-500">{p.current.achievementName}</div>
                      <div className="text-xs text-slate-500">{p.current.achievementLevel}</div>
                    </td>
                    <td className="px-3 py-2">
                      {p.proposed ? (
                        <>
                          <div className="font-medium text-indigo-900">
                            {p.proposed.achievementCategory}
                          </div>
                          {p.proposed.achievementLevel ? (
                            <div className="text-xs">مستوى: {p.proposed.achievementLevel}</div>
                          ) : null}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {p.classification ? (
                        <>
                          <div>{p.classification.confidence}</div>
                          <div className="text-xs text-slate-500">score {p.classification.score}</div>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 max-w-xs">
                      {p.classification?.matchedSignals?.length ? (
                        <ul className="text-xs text-slate-600 list-disc pr-4">
                          {p.classification.matchedSignals.slice(0, 3).map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ul>
                      ) : null}
                      {p.classification?.negativeSignals?.length ? (
                        <p className="mt-1 text-xs text-amber-800">
                          − {p.classification.negativeSignals.join(", ")}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      {p.protected ? (
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
                          محمي
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default AchievementBackfillPreviewPage;
