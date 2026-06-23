"use client";

import { AlertTriangle } from "lucide-react";

type StudentRevisionBannerProps = {
  revisionReason: string;
  revisionRequestedAt?: string | null;
  reviewerName?: string | null;
  locale: "ar" | "en";
};

const formatRevisionDate = (value: string | null | undefined, locale: "ar" | "en") => {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const StudentRevisionBanner = ({
  revisionReason,
  revisionRequestedAt,
  reviewerName,
  locale,
}: StudentRevisionBannerProps) => {
  const isAr = locale === "ar";
  const formattedDate = formatRevisionDate(revisionRequestedAt, locale);

  return (
    <section
      className="mb-4 rounded-2xl border-2 border-orange-300 bg-orange-50 px-4 py-4 text-orange-950 shadow-sm"
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-black">
            {isAr ? "تم إرجاع التقرير للتعديل" : "Report returned for revision"}
          </h2>
          <p className="mt-2 text-sm font-bold">
            {isAr ? "ملاحظات المشرف:" : "Supervisor notes:"}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{revisionReason}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-orange-800">
            {formattedDate ? (
              <span>
                {isAr ? "تاريخ الإرجاع:" : "Returned on:"} {formattedDate}
              </span>
            ) : null}
            {reviewerName ? (
              <span>
                {isAr ? "المشرف:" : "Reviewer:"} {reviewerName}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
};

export default StudentRevisionBanner;
