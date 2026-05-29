"use client";

import { useCallback, useEffect, useState } from "react";
import { useAnalyticsFilters } from "@/contexts/AnalyticsFilterContext";
import { participationFilterFromExecutiveSnapshot } from "@/lib/analytics/report-filter-url-sync";
import {
  cloneExecutiveFilterSnapshot,
  type ExecutiveFilterSnapshot,
} from "@/lib/competition-intelligence-persistence";

type SavedViewRow = {
  id: string;
  name: string;
  scope: string;
  filterSnapshot: Record<string, unknown>;
  uiSnapshot: Record<string, unknown>;
  shareSlug?: string;
  updatedAt: string;
};

const AnalyticsSavedViewsPanel = ({ isAr }: { isAr: boolean }) => {
  const {
    f,
    setF,
    setActiveTab,
    setPage,
    setTableMode,
    setTableSortKey,
    setTableSortAsc,
    setCompareEnabled,
    setComparePick,
    setFocusedPick,
    setFocusedOutcome,
    setFocusedPage,
    copyShareUrl,
    activeTab,
    page,
    compareEnabled,
    comparePick,
    focusedPick,
    focusedOutcome,
    focusedPage,
    tableMode,
    tableSortKey,
    tableSortAsc,
    pdfPreset,
  } = useAnalyticsFilters();

  const [views, setViews] = useState<SavedViewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadViews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/analytics/saved-views?scope=participation", {
        credentials: "include",
      });
      const j = (await res.json()) as { ok?: boolean; views?: SavedViewRow[]; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error || "Failed");
      setViews(j.views ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setViews([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadViews();
  }, [loadViews]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/analytics/saved-views", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          scope: "participation",
          filterSnapshot: cloneExecutiveFilterSnapshot(f),
          uiSnapshot: {
            tab: activeTab,
            page,
            focusedPage,
            focusedOutcome,
            focusedPick,
            compareEnabled,
            comparePick,
            pdfPreset,
            tableMode,
            sortKey: tableSortKey,
            sortAsc: tableSortAsc,
          },
          createShareSlug: true,
        }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error || "Failed");
      setName("");
      await loadViews();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  const handleApply = (row: SavedViewRow) => {
    setF(
      participationFilterFromExecutiveSnapshot(
        row.filterSnapshot as unknown as ExecutiveFilterSnapshot
      )
    );
    const ui = row.uiSnapshot;
    if (ui.tab === "general" || ui.tab === "focused" || ui.tab === "studentIntel") {
      setActiveTab(ui.tab);
    }
    if (typeof ui.page === "number") setPage(ui.page);
    if (typeof ui.focusedPage === "number") setFocusedPage(ui.focusedPage);
    if (typeof ui.focusedOutcome === "string") setFocusedOutcome(ui.focusedOutcome);
    if (typeof ui.focusedPick === "string") setFocusedPick(ui.focusedPick);
    if (typeof ui.compareEnabled === "boolean") setCompareEnabled(ui.compareEnabled);
    if (typeof ui.comparePick === "string") setComparePick(ui.comparePick);
    const modes = ["summary", "activity", "detailed", "student"] as const;
    if (modes.includes(ui.tableMode as (typeof modes)[number])) {
      setTableMode(ui.tableMode as (typeof modes)[number]);
    }
    if (typeof ui.sortKey === "string") setTableSortKey(ui.sortKey as typeof tableSortKey);
    if (typeof ui.sortAsc === "boolean") setTableSortAsc(ui.sortAsc);
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    try {
      await fetch(`/api/admin/analytics/saved-views?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      await loadViews();
    } finally {
      setLoading(false);
    }
  };

  const shareLinkFor = (slug?: string) => {
    if (!slug || typeof window === "undefined") return "";
    const base = `${window.location.origin}${window.location.pathname}`;
    return `${base}?savedView=${encodeURIComponent(slug)}`;
  };

  return (
    <div
      className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm print:hidden"
      dir={isAr ? "rtl" : "ltr"}
      role="region"
      aria-label={isAr ? "التقارير المحفوظة" : "Saved analytics views"}
    >
      <p className="text-xs font-bold text-slate-800">{isAr ? "حفظ عرض التحليلات" : "Save analytics view"}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={isAr ? "مثال: تقرير بيبراس 2026" : "e.g. Bebras 2026 report"}
          className="min-w-[160px] flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
          aria-label={isAr ? "اسم التقرير" : "Report name"}
        />
        <button
          type="button"
          disabled={loading || name.trim().length < 2}
          onClick={() => void handleSave()}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
        >
          {isAr ? "حفظ" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            const url = copyShareUrl();
            void navigator.clipboard?.writeText(url);
          }}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold"
        >
          {isAr ? "نسخ الرابط" : "Copy link"}
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      <ul className="mt-3 max-h-36 space-y-1 overflow-y-auto text-xs">
        {views.length === 0 ? (
          <li className="text-slate-500">{isAr ? "لا توجد عروض محفوظة." : "No saved views yet."}</li>
        ) : (
          views.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1.5">
              <button
                type="button"
                onClick={() => handleApply(v)}
                className="font-semibold text-indigo-700 hover:underline"
              >
                {v.name}
              </button>
              <span className="flex gap-1">
                {v.shareSlug ? (
                  <button
                    type="button"
                    className="rounded border border-slate-200 px-2 py-0.5 text-[10px]"
                    onClick={() => void navigator.clipboard?.writeText(shareLinkFor(v.shareSlug))}
                  >
                    {isAr ? "رابط" : "Link"}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="rounded border border-red-100 px-2 py-0.5 text-[10px] text-red-700"
                  onClick={() => void handleDelete(v.id)}
                >
                  {isAr ? "حذف" : "Del"}
                </button>
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
};

export default AnalyticsSavedViewsPanel;
