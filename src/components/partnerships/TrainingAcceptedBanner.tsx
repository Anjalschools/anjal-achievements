"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import TrainingApplicationStatusBadge from "@/components/partnerships/TrainingApplicationStatusBadge";

const TrainingAcceptedBanner = ({
  organizationName,
  isAr,
}: {
  organizationName: string;
  isAr: boolean;
}) => (
  <div
    className="mb-6 rounded-2xl border border-green-200 bg-green-50 px-4 py-4 sm:px-5"
    role="status"
    aria-label={isAr ? "تم قبولك في التدريب الصيفي" : "Summer training acceptance"}
  >
    <div className="flex items-start gap-3">
      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-700" aria-hidden />
      <div className="min-w-0 flex-1 space-y-2 text-sm text-green-950">
        <p className="font-bold">
          {isAr ? "✓ تم قبولك في هذه الفرصة التدريبية" : "✓ You have been accepted for this training opportunity"}
        </p>
        {organizationName ? (
          <p>
            <span className="font-semibold">{isAr ? "المؤسسة:" : "Institution:"}</span> {organizationName}
          </p>
        ) : null}
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{isAr ? "الحالة:" : "Status:"}</span>
          <TrainingApplicationStatusBadge status="accepted" isAr={isAr} size="sm" />
        </p>
        <p className="text-green-900">
          {isAr
            ? "يمكنك متابعة الرسائل والتعليمات الخاصة بالتدريب."
            : "You can follow up via messages and training instructions."}{" "}
          <Link href="/summer-training/messages" className="font-semibold underline hover:text-green-800">
            {isAr ? "فتح الرسائل" : "Open messages"}
          </Link>
        </p>
      </div>
    </div>
  </div>
);

export default TrainingAcceptedBanner;
