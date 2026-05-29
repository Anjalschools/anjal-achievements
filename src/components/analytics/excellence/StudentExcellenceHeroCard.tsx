"use client";

import { memo } from "react";
import type { StudentIntelRow } from "@/lib/student-intelligence-analytics";

export type StudentExcellenceHeroCardProps = {
  isAr: boolean;
  row: StudentIntelRow;
  onSelect?: (id: string) => void;
};

const StudentExcellenceHeroCard = memo(({ isAr, row, onSelect }: StudentExcellenceHeroCardProps) => {
  const name = isAr ? row.nameAr : row.nameEn;
  return (
    <button
      type="button"
      className="flex w-full items-center gap-4 rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white p-4 text-start shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
      onClick={() => onSelect?.(row.participantId)}
      aria-label={isAr ? `بطل التميز ${name}` : `Excellence hero ${name}`}
    >
      {row.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={row.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover ring-2 ring-teal-200" />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 text-xl font-black text-teal-800">
          {name.slice(0, 1)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black text-teal-950" dir="auto">
          {name}
        </p>
        <p className="mt-1 text-xs text-teal-800/90">
          {isAr ? row.stageLabelAr : row.stageLabelEn} · {row.medalCount}{" "}
          {isAr ? "ميداليات" : "medals"} · {row.recordCount} {isAr ? "سجلات" : "records"}
        </p>
      </div>
    </button>
  );
});

StudentExcellenceHeroCard.displayName = "StudentExcellenceHeroCard";

export default StudentExcellenceHeroCard;
