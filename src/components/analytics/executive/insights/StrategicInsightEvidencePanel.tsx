"use client";

import { memo } from "react";

export type StrategicInsightEvidencePanelProps = {
  isAr: boolean;
  evidence: string[];
};

const StrategicInsightEvidencePanel = memo(
  ({ isAr, evidence }: StrategicInsightEvidencePanelProps) => {
    if (evidence.length === 0) return null;
    return (
      <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-2">
        <p className="text-[9px] font-black uppercase tracking-wide text-slate-500">
          {isAr ? "الأدلة" : "Evidence"}
        </p>
        <ul className="mt-1 space-y-0.5">
          {evidence.slice(0, 4).map((line) => (
            <li key={line} className="text-[10px] leading-snug text-slate-700" dir="auto">
              · {line}
            </li>
          ))}
        </ul>
      </div>
    );
  }
);

StrategicInsightEvidencePanel.displayName = "StrategicInsightEvidencePanel";

export default StrategicInsightEvidencePanel;
