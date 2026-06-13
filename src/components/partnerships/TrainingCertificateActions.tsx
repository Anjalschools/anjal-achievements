"use client";

import Link from "next/link";
import { Award, Download, ShieldCheck } from "lucide-react";
export type TrainingCertificateSummary = {
  recordId: string;
  achievementId: string;
  opportunityId?: string | null;
  opportunityTitle: string;
  organizationName: string;
  certificateViewPath: string;
  certificateVerifyPath: string | null;
  volunteerHours: number | null;
};

const TrainingCertificateActions = ({
  certificate,
  isAr,
  compact = false,
}: {
  certificate: TrainingCertificateSummary;
  isAr: boolean;
  compact?: boolean;
}) => (
  <div
    className={`rounded-xl border border-emerald-200 bg-emerald-50/80 ${compact ? "p-3" : "p-4"}`}
    role="region"
    aria-label={isAr ? "شهادة التدريب" : "Training certificate"}
  >
    {!compact ? (
      <div className="mb-3 flex items-start gap-2">
        <Award className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden />
        <div>
          <h3 className="font-bold text-emerald-950">
            {isAr ? "شهادة التدريب الصيفي" : "Summer training certificate"}
          </h3>
          <p className="text-sm text-emerald-900">
            {certificate.opportunityTitle}
            {certificate.organizationName ? ` · ${certificate.organizationName}` : ""}
          </p>
        </div>
      </div>
    ) : null}
    <div className="flex flex-wrap gap-2">
      <Link
        href={certificate.certificateViewPath}
        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        aria-label={isAr ? "عرض شهادة التدريب" : "View training certificate"}
      >
        <Award className="h-3.5 w-3.5" aria-hidden />
        {isAr ? "عرض الشهادة" : "View certificate"}
      </Link>
      <a
        href={certificate.certificateViewPath}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        aria-label={isAr ? "تحميل شهادة التدريب" : "Download training certificate"}
      >
        <Download className="h-3.5 w-3.5" aria-hidden />
        {isAr ? "تحميل الشهادة" : "Download"}
      </a>
      {certificate.certificateVerifyPath ? (
        <Link
          href={certificate.certificateVerifyPath}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          aria-label={isAr ? "التحقق من شهادة التدريب" : "Verify training certificate"}
        >
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          {isAr ? "التحقق من الشهادة" : "Verify"}
        </Link>
      ) : null}
    </div>
  </div>
);

export default TrainingCertificateActions;
