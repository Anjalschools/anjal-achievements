"use client";

import { useEffect, useRef } from "react";
import { useAnalyticsFilters } from "@/contexts/AnalyticsFilterContext";

export type LazyStudentIntelligenceTriggerProps = {
  enabled?: boolean;
  lite?: boolean;
};

/**
 * On-demand student-intelligence fetch (non-blocking for page boot).
 */
const LazyStudentIntelligenceTrigger = ({
  enabled = true,
  lite = true,
}: LazyStudentIntelligenceTriggerProps) => {
  const { ensureStudentIntel } = useAnalyticsFilters();
  const requestedRef = useRef(false);

  useEffect(() => {
    if (!enabled || requestedRef.current) return;
    requestedRef.current = true;
    ensureStudentIntel({ lite });
  }, [enabled, lite, ensureStudentIntel]);

  return null;
};

export default LazyStudentIntelligenceTrigger;
