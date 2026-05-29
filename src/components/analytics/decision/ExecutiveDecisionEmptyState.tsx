"use client";

import { memo } from "react";

const ExecutiveDecisionEmptyState = memo(({ isAr }: { isAr: boolean }) => (
  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center" dir={isAr ? "rtl" : "ltr"}>
    <p className="text-sm font-black text-slate-800">
      {isAr ? "لا توجد قرارات تنفيذية ضمن الفلاتر الحالية" : "No executive decisions for current filters"}
    </p>
    <p className="mt-2 text-xs text-slate-600">
      {isAr
        ? "وسّع السنوات أو أزل فلاترًا لبناء إشارات قرار أقوى."
        : "Expand years or relax filters to strengthen decision signals."}
    </p>
  </div>
));

ExecutiveDecisionEmptyState.displayName = "ExecutiveDecisionEmptyState";

export default ExecutiveDecisionEmptyState;
