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
  email?: string;
  username?: string;
  fullName?: string;
  fullNameAr?: string;
  profilePhoto?: string;
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
          email: data.email ? String(data.email) : undefined,
          username: data.username ? String(data.username) : undefined,
          fullName: data.fullName ? String(data.fullName) : undefined,
          fullNameAr: data.fullNameAr ? String(data.fullNameAr) : undefined,
          profilePhoto: data.profilePhoto ? String(data.profilePhoto) : undefined,
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
