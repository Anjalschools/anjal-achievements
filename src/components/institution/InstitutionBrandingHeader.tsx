"use client";

import Image from "next/image";
import { Building2, MapPin, Briefcase, Calendar } from "lucide-react";

export type InstitutionBrandingData = {
  name: string;
  logo?: string;
  sector?: string;
  categoryLabelAr?: string;
  categoryLabelEn?: string;
  city?: string;
  partnershipYears?: number;
  historicallyTrainedStudents?: number;
};

type InstitutionBrandingHeaderProps = {
  data: InstitutionBrandingData;
  isAr: boolean;
  compact?: boolean;
};

const InstitutionBrandingHeader = ({ data, isAr, compact = false }: InstitutionBrandingHeaderProps) => {
  const categoryLabel = isAr ? data.categoryLabelAr : data.categoryLabelEn;

  return (
    <div
      className={`rounded-2xl border border-border/70 bg-gradient-to-br from-white to-primary/5 shadow-sm ${
        compact ? "px-4 py-3" : "px-5 py-4"
      }`}
    >
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-white">
          {data.logo ? (
            <Image
              src={data.logo}
              alt={data.name}
              width={56}
              height={56}
              className="h-full w-full object-contain"
              unoptimized
            />
          ) : (
            <Building2 className="h-7 w-7 text-primary" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className={`font-black text-foreground ${compact ? "text-lg" : "text-xl"}`}>{data.name}</h2>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-light">
            {data.sector ? (
              <span className="inline-flex items-center gap-1">
                <Briefcase className="h-3.5 w-3.5" aria-hidden />
                {data.sector}
              </span>
            ) : null}
            {categoryLabel ? (
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" aria-hidden />
                {categoryLabel}
              </span>
            ) : null}
            {data.city ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" aria-hidden />
                {data.city}
              </span>
            ) : null}
            {typeof data.partnershipYears === "number" ? (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" aria-hidden />
                {isAr
                  ? `${data.partnershipYears} سنوات شراكة`
                  : `${data.partnershipYears} partnership year${data.partnershipYears === 1 ? "" : "s"}`}
              </span>
            ) : null}
            {typeof data.historicallyTrainedStudents === "number" ? (
              <span>
                {isAr
                  ? `${data.historicallyTrainedStudents} متدرب تاريخياً`
                  : `${data.historicallyTrainedStudents} trainees historically`}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InstitutionBrandingHeader;
