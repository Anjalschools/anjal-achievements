"use client";

import TrainingApplicationStatusBadge from "@/components/partnerships/TrainingApplicationStatusBadge";

type TrainingApplicationStatusCardProps = {
  status: string;
  submittedAt: string | null;
  lastUpdatedAt: string | null;
  isAr: boolean;
};

const TrainingApplicationStatusCard = ({
  status,
  submittedAt,
  lastUpdatedAt,
  isAr,
}: TrainingApplicationStatusCardProps) => {
  const formatDateTime = (value: string | null) => {
    if (!value) return isAr ? "غير محدد" : "Not set";
    try {
      return new Date(value).toLocaleString(isAr ? "ar-SA" : "en-GB");
    } catch {
      return value;
    }
  };

  return (
    <div
      className="mb-3 rounded-xl border border-blue-200 bg-blue-50/80 px-4 py-4 text-sm text-blue-950"
      role="region"
      aria-label={isAr ? "حالة طلب الالتحاق" : "Application status"}
    >
      <p className="mb-3 font-bold text-blue-950">
        {isAr ? "تم تقديم طلب الالتحاق" : "Application submitted"}
      </p>
      <dl className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <dt className="font-semibold">{isAr ? "الحالة الحالية:" : "Current status:"}</dt>
          <dd>
            <TrainingApplicationStatusBadge status={status} isAr={isAr} />
          </dd>
        </div>
        <div>
          <dt className="font-semibold">{isAr ? "تاريخ التقديم:" : "Submitted at:"}</dt>
          <dd className="mt-0.5 text-blue-900">
            {submittedAt ? <time dateTime={submittedAt}>{formatDateTime(submittedAt)}</time> : "—"}
          </dd>
        </div>
        <div>
          <dt className="font-semibold">{isAr ? "آخر تحديث:" : "Last update:"}</dt>
          <dd className="mt-0.5 text-blue-900">
            {lastUpdatedAt ? <time dateTime={lastUpdatedAt}>{formatDateTime(lastUpdatedAt)}</time> : "—"}
          </dd>
        </div>
      </dl>
    </div>
  );
};

export default TrainingApplicationStatusCard;
