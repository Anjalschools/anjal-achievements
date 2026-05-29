"use client";

import type { ReactNode } from "react";
import { t, uniqueStudentsTooltip } from "@/lib/analytics/analytics-semantics";

export type MetricWithTooltipProps = {
  label: string;
  tooltip?: string;
  children?: ReactNode;
  className?: string;
};

const MetricWithTooltip = ({ label, tooltip, children, className = "" }: MetricWithTooltipProps) => (
  <span className={`inline-flex items-center gap-1 ${className}`}>
    <abbr title={tooltip ?? label} className="cursor-help border-b border-dotted border-slate-400 no-underline">
      {label}
    </abbr>
    {children ?? null}
  </span>
);

export const UniqueStudentsMetricLabel = ({
  isAr,
  className,
}: {
  isAr: boolean;
  className?: string;
}) => (
  <MetricWithTooltip
    label={t("kpi.participatingStudents", isAr ? "ar" : "en")}
    tooltip={uniqueStudentsTooltip(isAr ? "ar" : "en")}
    className={className}
  />
);

export const AvgParticipationsPerStudentMetricLabel = ({
  isAr,
  className,
}: {
  isAr: boolean;
  className?: string;
}) => (
  <MetricWithTooltip
    label={t("kpi.avgParticipationsPerStudent", isAr ? "ar" : "en")}
    tooltip={t("tooltip.avgParticipationsPerStudent", isAr ? "ar" : "en")}
    className={className}
  />
);

export default MetricWithTooltip;
