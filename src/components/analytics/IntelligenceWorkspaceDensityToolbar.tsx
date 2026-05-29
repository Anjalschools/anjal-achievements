"use client";

import { useIntelligenceWorkspace } from "@/lib/analytics/intelligence-workspace-context";
import type { WorkspaceDensityMode } from "@/lib/analytics/intelligence-workspace-hierarchy";
import { useAnalyticsPerspective } from "@/lib/analytics/analytics-perspective-context";
import { t } from "@/lib/analytics/analytics-semantic-registry";

const MODES: WorkspaceDensityMode[] = ["executive", "standard", "deep"];

const IntelligenceWorkspaceDensityToolbar = ({ isAr }: { isAr: boolean }) => {
  const { density, setDensity } = useIntelligenceWorkspace();
  const { loc } = useAnalyticsPerspective();

  const labelKey = (m: WorkspaceDensityMode): Parameters<typeof t>[0] => {
    const map: Record<WorkspaceDensityMode, Parameters<typeof t>[0]> = {
      executive: "workspace.density.executive",
      standard: "workspace.density.standard",
      deep: "workspace.density.deep",
    };
    return map[m];
  };

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 print:hidden"
      dir={isAr ? "rtl" : "ltr"}
      role="group"
      aria-label={t("workspace.density.title", loc)}
    >
      <span className="text-[10px] font-bold text-slate-700">{t("workspace.density.title", loc)}</span>
      {MODES.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => setDensity(m)}
          className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition ${
            density === m
              ? "bg-indigo-600 text-white"
              : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-indigo-50"
          }`}
          aria-pressed={density === m}
        >
          {t(labelKey(m), loc)}
        </button>
      ))}
    </div>
  );
};

export default IntelligenceWorkspaceDensityToolbar;
