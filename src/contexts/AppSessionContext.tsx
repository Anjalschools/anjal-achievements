"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
  type ReactNode,
} from "react";

export type AppSessionProfile = {
  id: string;
  role?: string;
  accountType?: "student" | "alumni";
  email?: string;
  username?: string;
  fullName?: string;
  fullNameAr?: string;
  profilePhoto?: string;
  /** Student grade key (e.g. g11); used for feature gating without extra fetches. */
  grade?: string;
  mustChangePassword?: boolean;
  needsAlumniOnboarding?: boolean;
  alumniActivationStatus?: string;
  /** ISO timestamps when admin removed alumni from community visibility. */
  alumniCommunityRemovedAt?: string | null;
  alumniPermanentlyPurgedAt?: string | null;
  /** Computed trust badges for alumni (from GET /api/user/profile). */
  alumniBadges?: string[];
  /** Weighted profile completion for alumni hub (from GET /api/user/profile). */
  alumniProfileCompletion?: {
    pct: number;
    filled: number;
    total: number;
    breakdown: Record<string, boolean>;
  };
};

type AppSessionValue = {
  profile: AppSessionProfile | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

export const AppSessionContext = createContext<AppSessionValue | null>(null);

/** Safe on public routes: returns null if provider missing (should not happen when wrapped at root). */
export const useAppSessionOptional = (): AppSessionValue | null => useContext(AppSessionContext);

export const AppSessionProvider = ({ children }: { children: ReactNode }) => {
  const [profile, setProfile] = useState<AppSessionProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const didInitRef = useRef(false);
  const inflightRef = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async () => {
    if (inflightRef.current) return inflightRef.current;
    setLoading(true);
    inflightRef.current = (async () => {
      try {
        const res = await fetch("/api/user/profile", {
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok) {
          setProfile(null);
          return;
        }
        const data = (await res.json()) as Record<string, unknown>;
        setProfile({
          id: String(data.id || ""),
          role: data.role ? String(data.role) : undefined,
          accountType:
            data.accountType === "alumni" ? "alumni" : data.accountType === "student" ? "student" : undefined,
          email: data.email ? String(data.email) : undefined,
          username: data.username ? String(data.username) : undefined,
          fullName: data.fullName ? String(data.fullName) : undefined,
          fullNameAr: data.fullNameAr ? String(data.fullNameAr) : undefined,
          profilePhoto: data.profilePhoto ? String(data.profilePhoto) : undefined,
          grade: data.grade ? String(data.grade) : undefined,
          mustChangePassword: data.mustChangePassword === true,
          needsAlumniOnboarding: data.needsAlumniOnboarding === true,
          alumniActivationStatus:
            data.alumniActivationStatus != null && data.alumniActivationStatus !== ""
              ? String(data.alumniActivationStatus)
              : undefined,
          alumniCommunityRemovedAt:
            data.alumniCommunityRemovedAt != null && String(data.alumniCommunityRemovedAt) !== ""
              ? String(data.alumniCommunityRemovedAt)
              : null,
          alumniPermanentlyPurgedAt:
            data.alumniPermanentlyPurgedAt != null && String(data.alumniPermanentlyPurgedAt) !== ""
              ? String(data.alumniPermanentlyPurgedAt)
              : null,
          alumniBadges: Array.isArray(data.alumniBadges)
            ? (data.alumniBadges as unknown[]).map((b) => String(b)).filter(Boolean)
            : undefined,
          alumniProfileCompletion:
            data.alumniProfileCompletion &&
            typeof data.alumniProfileCompletion === "object" &&
            data.alumniProfileCompletion !== null &&
            typeof (data.alumniProfileCompletion as { pct?: unknown }).pct === "number"
              ? {
                  pct: Math.round(Number((data.alumniProfileCompletion as { pct: number }).pct)),
                  filled: Number((data.alumniProfileCompletion as { filled?: number }).filled) || 0,
                  total: Number((data.alumniProfileCompletion as { total?: number }).total) || 0,
                  breakdown:
                    ((data.alumniProfileCompletion as { breakdown?: Record<string, boolean> }).breakdown as Record<
                      string,
                      boolean
                    >) || {},
                }
              : undefined,
        });
      } catch {
        setProfile(null);
      } finally {
        setLoading(false);
        inflightRef.current = null;
      }
    })();
    return inflightRef.current;
  }, []);

  useEffect(() => {
    // Prevent double-fetch in dev StrictMode and avoid spam logs.
    if (didInitRef.current) return;
    didInitRef.current = true;
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      profile,
      loading,
      refresh,
    }),
    [profile, loading, refresh]
  );

  return <AppSessionContext.Provider value={value}>{children}</AppSessionContext.Provider>;
};

export const useAppSession = (): AppSessionValue => {
  const ctx = useContext(AppSessionContext);
  if (!ctx) {
    throw new Error("useAppSession must be used within AppSessionProvider");
  }
  return ctx;
};
