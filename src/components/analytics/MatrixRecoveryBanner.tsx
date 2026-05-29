"use client";

import type { MatrixDebugMeta } from "@/lib/analytics/historical-matrix-model";

export type MatrixRecoveryBannerProps = {
  isAr: boolean;
  meta?: MatrixDebugMeta;
};

const MatrixRecoveryBanner = ({ isAr, meta }: MatrixRecoveryBannerProps) => {
  if (!meta?.recoveryMode) return null;

  const message = isAr
    ? meta.recoveryReasonAr || "تم توسيع نطاق التحليل تاريخيًا لعرض بيانات متوافقة."
    : meta.recoveryReasonEn || "Historical scope was expanded to show compatible data.";

  return (
    <div
      className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-medium text-amber-900"
      dir={isAr ? "rtl" : "ltr"}
      role="note"
    >
      {message}
    </div>
  );
};

export default MatrixRecoveryBanner;
