"use client";

import type { EducationalFunnelModel } from "@/lib/analytics/educational-funnel-intelligence";
import { formatLocalizedNumber } from "@/lib/analytics/analytics-number-formatting";

export type EducationalFunnelChartProps = {
  model: EducationalFunnelModel;
  isAr: boolean;
  className?: string;
};

const EducationalFunnelChart = ({ model, isAr, className = "" }: EducationalFunnelChartProps) => {
  const max = Math.max(...model.stages.map((s) => s.count), 1);
  const loc = isAr ? "ar" : "en";

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}
      dir={isAr ? "rtl" : "ltr"}
      role="img"
      aria-label={isAr ? model.titleAr : model.titleEn}
    >
      <h4 className="mb-3 text-sm font-bold text-slate-800">
        {isAr ? model.titleAr : model.titleEn}
      </h4>
      <div className="space-y-2">
        {model.stages.map((stage, idx) => {
          const widthPct = Math.max(8, Math.round((stage.count / max) * 100));
          const conv = model.metrics.stageConversion[idx - 1];
          return (
            <div key={stage.key} className="flex flex-col items-center gap-1">
              <div
                className="flex h-9 items-center justify-between rounded-md bg-primary/15 px-3 text-xs font-bold text-slate-800 transition-all"
                style={{ width: `${widthPct}%`, minWidth: "40%" }}
              >
                <span>{isAr ? stage.labelAr : stage.labelEn}</span>
                <span className="tabular-nums">{formatLocalizedNumber(stage.count, loc, 0)}</span>
              </div>
              {idx > 0 && conv !== undefined ? (
                <span className="text-[10px] text-slate-500">
                  {isAr ? `تحويل ${conv}%` : `${conv}% conversion`}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-slate-600">
        {isAr ? "كفاءة المسار" : "Pipeline efficiency"}:{" "}
        <span className="font-bold text-slate-900">{model.metrics.pipelineEfficiency}%</span>
        {model.metrics.bottleneckStage ? (
          <span className="ms-2">
            · {isAr ? "عنق زجاجة" : "Bottleneck"}: {model.metrics.bottleneckStage}
          </span>
        ) : null}
      </p>
    </div>
  );
};

export default EducationalFunnelChart;
