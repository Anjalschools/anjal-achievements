"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useClientMounted } from "@/hooks/useClientMounted";

const STORAGE_KEY = "anjal-intelligence-sections-v1";

export type IntelligenceSectionState = Record<string, boolean>;

export const readIntelligenceSectionState = (): IntelligenceSectionState => {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as IntelligenceSectionState;
  } catch {
    return {};
  }
};

export const writeIntelligenceSectionState = (
  sectionId: string,
  open: boolean
): void => {
  try {
    const merged = { ...readIntelligenceSectionState(), [sectionId]: open };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    /* ignore */
  }
};

/**
 * Controlled accordion state — persists across filter refetch / child remounts.
 * Does NOT sync to URL (avoids fighting analytics filter query params).
 */
export const useStableIntelligenceSectionOpen = (
  sectionId: string,
  defaultOpen = false
) => {
  const mounted = useClientMounted();
  const userControlledRef = useRef(false);
  const [open, setOpenState] = useState(defaultOpen);
  const [hasBeenOpen, setHasBeenOpen] = useState(defaultOpen);

  useEffect(() => {
    if (!mounted || userControlledRef.current) return;
    const stored = readIntelligenceSectionState()[sectionId];
    if (typeof stored === "boolean") {
      setOpenState(stored);
      if (stored) setHasBeenOpen(true);
    }
  }, [mounted, sectionId]);

  const setOpen = useCallback(
    (next: boolean) => {
      userControlledRef.current = true;
      setOpenState(next);
      if (next) setHasBeenOpen(true);
      writeIntelligenceSectionState(sectionId, next);
    },
    [sectionId]
  );

  const toggle = useCallback(() => setOpen(!open), [open, setOpen]);

  return {
    open: mounted ? open : defaultOpen,
    setOpen,
    toggle,
    hasBeenOpen,
    mounted,
  };
};
