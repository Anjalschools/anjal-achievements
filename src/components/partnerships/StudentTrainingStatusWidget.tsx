"use client";

import Link from "next/link";
import { Building2, Briefcase, CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";
import TrainingApplicationStatusBadge from "@/components/partnerships/TrainingApplicationStatusBadge";
import { studentTrainingWidgetStatusLabel } from "@/lib/partnerships/partnerships-student-dashboard-ui";
import type { StudentTrainingApplicationStatus } from "@/lib/partnerships/partnerships-constants";

type WidgetData = {
  status: string;
  applicationStatus: StudentTrainingApplicationStatus | null;
  opportunityId: string | null;
  opportunityTitle: string | null;
  organizationName: string | null;
  submittedAt: string | null;
  lastUpdatedAt: string | null;
};

const StudentTrainingStatusWidget = ({
  data,
  isAr,
  loading,
}: {
  data: WidgetData | null;
  isAr: boolean;
  loading?: boolean;
}) => {
  if (loading) {
    return (
      <div
        className="mb-6 h-36 animate-pulse rounded-2xl border border-gray-200 bg-gray-100"
        aria-busy="true"
        aria-label={isAr ? "جاري تحميل التدريب الصيفي" : "Loading summer training"}
      />
    );
  }

  if (!data) return null;

  const followHref = data.opportunityId ? `/summer-training/${data.opportunityId}` : "/summer-training";
  const FollowIcon = isAr ? ChevronLeft : ChevronRight;
  const hasApplication = data.applicationStatus != null;

  const formatDateTime = (value: string | null) => {
    if (!value) return "—";
    try {
      return new Date(value).toLocaleString(isAr ? "ar-SA" : "en-GB");
    } catch {
      return value;
    }
  };

  return (
    <section
      className="mb-6 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-white to-white p-4 shadow-sm sm:p-5"
      aria-label={isAr ? "التدريب الصيفي" : "Summer training"}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Briefcase className="h-5 w-5 text-primary" aria-hidden />
          </div>
          <div>
            <h2 className="text-lg font-bold text-text">{isAr ? "التدريب الصيفي" : "Summer training"}</h2>
            {hasApplication && data.applicationStatus ? (
              <TrainingApplicationStatusBadge
                status={data.applicationStatus}
                isAr={isAr}
                size="sm"
                className="mt-1"
              />
            ) : (
              <span className="mt-1 inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-800 ring-1 ring-gray-200">
                {studentTrainingWidgetStatusLabel("not_applied", isAr)}
              </span>
            )}
          </div>
        </div>
        <Link
          href={followHref}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white transition hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          aria-label={isAr ? "متابعة التدريب الصيفي" : "Follow up summer training"}
        >
          {isAr ? "متابعة" : "Follow up"}
          <FollowIcon className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      {hasApplication ? (
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-text-light">{isAr ? "الفرصة" : "Opportunity"}</dt>
            <dd className="mt-0.5 font-semibold text-text">{data.opportunityTitle || "—"}</dd>
          </div>
          <div className="flex items-start gap-2">
            <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <div>
              <dt className="text-xs text-text-light">{isAr ? "المؤسسة" : "Institution"}</dt>
              <dd className="mt-0.5 font-semibold text-text">{data.organizationName || "—"}</dd>
            </div>
          </div>
          <div>
            <dt className="text-xs text-text-light">{isAr ? "تاريخ التقديم" : "Submitted at"}</dt>
            <dd className="mt-0.5 text-text">
              {data.submittedAt ? <time dateTime={data.submittedAt}>{formatDateTime(data.submittedAt)}</time> : "—"}
            </dd>
          </div>
          <div className="flex items-start gap-2">
            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-text-light" aria-hidden />
            <div>
              <dt className="text-xs text-text-light">{isAr ? "آخر تحديث" : "Last update"}</dt>
              <dd className="mt-0.5 text-text">
                {data.lastUpdatedAt ? (
                  <time dateTime={data.lastUpdatedAt}>{formatDateTime(data.lastUpdatedAt)}</time>
                ) : (
                  "—"
                )}
              </dd>
            </div>
          </div>
        </dl>
      ) : (
        <p className="mt-3 text-sm text-text-light">
          {isAr
            ? "لم تتقدّم بعد على أي فرصة تدريبية. استعرض الفرص المتاحة وابدأ التقديم."
            : "You have not applied to a training opportunity yet. Browse available placements to get started."}
        </p>
      )}
    </section>
  );
};

export default StudentTrainingStatusWidget;
