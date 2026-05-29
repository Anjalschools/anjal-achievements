"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useClientMounted } from "@/hooks/useClientMounted";

export const EXECUTIVE_SECTION_STORAGE_KEY = "anjal-exec-sections-v2";
export const EXECUTIVE_SECTION_URL_PARAM = "execSec";

/** Canonical executive workspace section ids (15 sections) */
export const EXECUTIVE_SECTION_IDS = [
  "exec-kpis",
  "exec-equity",
  "exec-opportunities",
  "exec-recommendations",
  "exec-historical",
  "exec-comparison",
  "exec-students",
  "exec-competitions",
  "exec-decisions",
  "exec-excellence",
  "exec-funnels",
  "exec-matrix",
  "exec-demographics",
  "exec-strategic",
  "exec-deep-intelligence",
] as const;

export type ExecutiveSectionId = (typeof EXECUTIVE_SECTION_IDS)[number];

export type ExecutiveSectionVisibilityState = Record<string, boolean>;

const DEFAULT_OPEN: ExecutiveSectionVisibilityState = {
  "exec-kpis": true,
  "exec-equity": false,
  "exec-opportunities": false,
  "exec-recommendations": false,
  "exec-historical": false,
  "exec-comparison": false,
  "exec-students": false,
  "exec-competitions": false,
  "exec-decisions": false,
  "exec-excellence": false,
  "exec-funnels": false,
  "exec-matrix": false,
  "exec-demographics": false,
  "exec-strategic": false,
  "exec-deep-intelligence": false,
};

const LEGACY_KEY_MAP: Record<string, ExecutiveSectionId> = {
  "exec-equity-opportunity": "exec-equity",
  "exec-student": "exec-students",
  "exec-competition": "exec-competitions",
  "exec-demographic": "exec-demographics",
  "exec-deep": "exec-deep-intelligence",
  "exec-results": "exec-matrix",
  "exec-talent": "exec-funnels",
};

const migrateLegacyState = (
  parsed: ExecutiveSectionVisibilityState
): ExecutiveSectionVisibilityState => {
  const next: ExecutiveSectionVisibilityState = { ...DEFAULT_OPEN };
  for (const id of EXECUTIVE_SECTION_IDS) {
    if (typeof parsed[id] === "boolean") next[id] = parsed[id]!;
  }
  for (const [legacy, canonical] of Object.entries(LEGACY_KEY_MAP)) {
    if (typeof parsed[legacy] === "boolean" && parsed[legacy]) {
      next[canonical] = true;
    }
  }
  if (parsed["exec-equity-opportunity"]) {
    next["exec-equity"] = true;
    next["exec-opportunities"] = true;
  }
  return next;
};

export const readExecutiveSectionState = (): ExecutiveSectionVisibilityState => {
  if (typeof window === "undefined") return { ...DEFAULT_OPEN };
  try {
    const raw =
      localStorage.getItem(EXECUTIVE_SECTION_STORAGE_KEY) ??
      localStorage.getItem("anjal-exec-sections-v1");
    if (!raw) return { ...DEFAULT_OPEN };
    const parsed = JSON.parse(raw) as ExecutiveSectionVisibilityState;
    return migrateLegacyState(parsed);
  } catch {
    return { ...DEFAULT_OPEN };
  }
};

export const writeExecutiveSectionState = (state: ExecutiveSectionVisibilityState): void => {
  try {
    localStorage.setItem(EXECUTIVE_SECTION_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
};

export const parseExecutiveSectionsFromUrl = (
  searchParams: URLSearchParams
): ExecutiveSectionVisibilityState | null => {
  const raw = searchParams.get(EXECUTIVE_SECTION_URL_PARAM);
  if (!raw) return null;
  const openIds = raw.split(",").filter(Boolean);
  const next: ExecutiveSectionVisibilityState = { ...DEFAULT_OPEN };
  for (const id of EXECUTIVE_SECTION_IDS) {
    next[id] = openIds.includes(id);
  }
  for (const id of openIds) {
    const mapped = LEGACY_KEY_MAP[id] ?? id;
    if (mapped in next) next[mapped] = true;
    else next[id] = true;
  }
  return next;
};

export const serializeExecutiveSectionsToUrl = (
  state: ExecutiveSectionVisibilityState,
  base: URLSearchParams
): URLSearchParams => {
  const params = new URLSearchParams(base.toString());
  const open = Object.entries(state)
    .filter(([, v]) => v)
    .map(([k]) => k);
  if (open.length === 0) {
    params.delete(EXECUTIVE_SECTION_URL_PARAM);
  } else {
    params.set(EXECUTIVE_SECTION_URL_PARAM, open.join(","));
  }
  return params;
};

export const useExecutiveSectionVisibility = (sectionId: string, defaultOpen = false) => {
  const mounted = useClientMounted();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const canonicalId = LEGACY_KEY_MAP[sectionId] ?? sectionId;
  const userControlledRef = useRef(false);
  const [open, setOpenState] = useState(
    () => DEFAULT_OPEN[canonicalId as ExecutiveSectionId] ?? defaultOpen
  );
  const [hasBeenOpen, setHasBeenOpen] = useState(false);

  useEffect(() => {
    if (!mounted || userControlledRef.current) return;
    const fromUrl = parseExecutiveSectionsFromUrl(searchParams);
    const fromStorage = readExecutiveSectionState();
    const merged = fromUrl ? { ...fromStorage, ...fromUrl } : fromStorage;
    const isOpen =
      merged[canonicalId] ??
      merged[sectionId] ??
      DEFAULT_OPEN[canonicalId as ExecutiveSectionId] ??
      defaultOpen;
    setOpenState(isOpen);
    if (isOpen) setHasBeenOpen(true);
  }, [mounted, canonicalId, sectionId, defaultOpen]);

  useEffect(() => {
    if (!mounted || userControlledRef.current || sectionId.startsWith("hist-")) return;
    const fromUrl = parseExecutiveSectionsFromUrl(searchParams);
    if (!fromUrl) return;
    const isOpen =
      fromUrl[canonicalId] ??
      fromUrl[sectionId] ??
      open;
    setOpenState(isOpen);
    if (isOpen) setHasBeenOpen(true);
  }, [mounted, searchParams, canonicalId, sectionId, open]);

  const setOpen = useCallback(
    (next: boolean) => {
      userControlledRef.current = true;
      setOpenState(next);
      if (next) setHasBeenOpen(true);
      const merged = { ...readExecutiveSectionState(), [canonicalId]: next };
      writeExecutiveSectionState(merged);
      if (!sectionId.startsWith("hist-")) {
        const params = serializeExecutiveSectionsToUrl(
          merged,
          new URLSearchParams(searchParams.toString())
        );
        const q = params.toString();
        router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
      }
    },
    [canonicalId, pathname, router, searchParams, sectionId]
  );

  const toggle = useCallback(() => setOpen(!open), [open, setOpen]);

  return useMemo(
    () => ({ open, setOpen, toggle, hasBeenOpen, mounted }),
    [open, setOpen, toggle, hasBeenOpen, mounted]
  );
};
