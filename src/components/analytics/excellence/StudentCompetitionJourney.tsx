"use client";

import { memo } from "react";
import type { JourneyStage } from "@/lib/analytics/student-excellence-derivations";

export type StudentCompetitionJourneyProps = {
  isAr: boolean;
  stages: JourneyStage[];
};

const StudentCompetitionJourney = memo(({ isAr, stages }: StudentCompetitionJourneyProps) => (
  <ol className="flex flex-wrap items-center gap-2" dir={isAr ? "rtl" : "ltr"}>
    {stages.map((s, i) => (
      <li key={s.key} className="flex items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
            s.complete ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-500 ring-1 ring-slate-200"
          }`}
        >
          {isAr ? s.labelAr : s.labelEn}
        </span>
        {i < stages.length - 1 ? (
          <span className="text-slate-300" aria-hidden="true">
            →
          </span>
        ) : null}
      </li>
    ))}
  </ol>
));

StudentCompetitionJourney.displayName = "StudentCompetitionJourney";

export default StudentCompetitionJourney;
