"use client";

import {
  buildConsistencyCauses,
  CONSISTENCY_CLASSIFICATION_TONES,
  getConsistencyClassification,
} from "@/lib/partnerships/final-report-review-ux-constants";
import type { TrainingReportIntelligence } from "@/lib/partnerships/training-intelligence-types";

type ConsistencyExplanationPanelProps = {
  intelligence: TrainingReportIntelligence | null | undefined;
  locale: "ar" | "en";
};

const ConsistencyExplanationPanel = ({ intelligence, locale }: ConsistencyExplanationPanelProps) => {
  const isAr = locale === "ar";

  if (!intelligence) return null;

  const classification = getConsistencyClassification(intelligence.consistencyScore, locale);
  const tone = CONSISTENCY_CLASSIFICATION_TONES[classification.key];
  const causes = buildConsistencyCauses(intelligence, locale);

  return (
    <div className={`mb-4 rounded-xl border px-4 py-3 ${tone}`} aria-label={isAr ? "شرح درجة الاتساق" : "Consistency score explanation"}>
      <p className="text-xs font-bold">{isAr ? "درجة الاتساق" : "Consistency score"}</p>
      <p className="text-2xl font-black">{intelligence.consistencyScore}%</p>
      <p className="mt-1 text-sm font-bold">
        {isAr ? "التصنيف:" : "Classification:"} {classification.label}
      </p>

      <div className="mt-3">
        <p className="text-xs font-bold">{isAr ? "الأسباب المحتملة" : "Possible causes"}</p>
        {causes.length > 0 ? (
          <ul className="mt-2 space-y-1 text-xs" aria-label={isAr ? "أسباب انخفاض الاتساق" : "Consistency causes"}>
            {causes.map((cause) => (
              <li key={cause} className="rounded-lg bg-white/60 px-2 py-1">
                {cause}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs opacity-90">
            {isAr ? "لا توجد تفاصيل إضافية." : "No additional details available."}
          </p>
        )}
      </div>
    </div>
  );
};

export default ConsistencyExplanationPanel;
