"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

const EVENT = "anjal-notifications-updated";
const DEFAULT_POLL_MS = 60_000;

export const dispatchNotificationsUpdated = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENT));
  }
};

type UnreadNotificationContextValue = {
  count: number;
  refresh: () => Promise<void>;
};

const UnreadNotificationContext = createContext<UnreadNotificationContextValue | null>(null);

let globalPollStarted = false;
let globalPollTimer: ReturnType<typeof setInterval> | null = null;
const subscribers = new Set<(count: number) => void>();
let sharedCount = 0;
let sharedLoadInFlight: Promise<void> | null = null;

const notifySubscribers = (count: number) => {
  sharedCount = count;
  for (const fn of subscribers) fn(count);
};

const loadUnreadCountShared = async (): Promise<void> => {
  if (sharedLoadInFlight) return sharedLoadInFlight;
  sharedLoadInFlight = (async () => {
    try {
      const res = await fetch("/api/notifications/unread-count", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data.count === "number") notifySubscribers(data.count);
    } catch {
      /* ignore */
    } finally {
      sharedLoadInFlight = null;
    }
  })();
  return sharedLoadInFlight;
};

const ensureGlobalPoll = (pollMs: number) => {
  if (globalPollStarted) return;
  globalPollStarted = true;
  void loadUnreadCountShared();
  globalPollTimer = setInterval(() => void loadUnreadCountShared(), pollMs);
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void loadUnreadCountShared();
    });
  }
  if (typeof window !== "undefined") {
    window.addEventListener(EVENT, () => void loadUnreadCountShared());
  }
};

export const UnreadNotificationProvider = ({
  children,
  pollMs = DEFAULT_POLL_MS,
}: {
  children: ReactNode;
  pollMs?: number;
}) => {
  const [count, setCount] = useState(0);
  const pollMsRef = useRef(pollMs);

  useEffect(() => {
    pollMsRef.current = pollMs;
    ensureGlobalPoll(pollMs);
    setCount(sharedCount);
    const onUpdate = (n: number) => setCount(n);
    subscribers.add(onUpdate);
    void loadUnreadCountShared();
    return () => {
      subscribers.delete(onUpdate);
    };
  }, [pollMs]);

  const refresh = useCallback(async () => {
    await loadUnreadCountShared();
  }, []);

  const value = useMemo(() => ({ count, refresh }), [count, refresh]);

  return (
    <UnreadNotificationContext.Provider value={value}>{children}</UnreadNotificationContext.Provider>
  );
};

export const useUnreadNotificationContext = (): UnreadNotificationContextValue => {
  const ctx = useContext(UnreadNotificationContext);
  if (ctx) return ctx;
  return {
    count: sharedCount,
    refresh: loadUnreadCountShared,
  };
};
