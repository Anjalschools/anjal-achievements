"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DENSITY_SECTION_DEFAULTS,
  readWorkspaceDensity,
  writeWorkspaceDensity,
  type WorkspaceDensityMode,
} from "@/lib/analytics/intelligence-workspace-hierarchy";

export type IntelligenceWorkspaceContextValue = {
  density: WorkspaceDensityMode;
  setDensity: (mode: WorkspaceDensityMode) => void;
  maxRecommendationCards: number;
  expandHeatmaps: boolean;
  activeSection: string | null;
  setActiveSection: (id: string | null) => void;
};

const IntelligenceWorkspaceContext = createContext<IntelligenceWorkspaceContextValue | null>(
  null
);

export const IntelligenceWorkspaceProvider = ({ children }: { children: ReactNode }) => {
  const [density, setDensityState] = useState<WorkspaceDensityMode>("standard");
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDensityState(readWorkspaceDensity());
    setMounted(true);
  }, []);

  const setDensity = useCallback((mode: WorkspaceDensityMode) => {
    setDensityState(mode);
    writeWorkspaceDensity(mode);
  }, []);

  const prefs = DENSITY_SECTION_DEFAULTS[density];

  const value = useMemo(
    () => ({
      density,
      setDensity,
      maxRecommendationCards: prefs.maxRecommendationCards,
      expandHeatmaps: prefs.expandHeatmaps,
      activeSection: mounted ? activeSection : null,
      setActiveSection,
    }),
    [density, setDensity, prefs, activeSection, mounted]
  );

  return (
    <IntelligenceWorkspaceContext.Provider value={value}>
      {children}
    </IntelligenceWorkspaceContext.Provider>
  );
};

export const useIntelligenceWorkspace = (): IntelligenceWorkspaceContextValue => {
  const ctx = useContext(IntelligenceWorkspaceContext);
  if (!ctx) {
    return {
      density: "standard",
      setDensity: () => {},
      maxRecommendationCards: 6,
      expandHeatmaps: true,
      activeSection: null,
      setActiveSection: () => {},
    };
  }
  return ctx;
};
