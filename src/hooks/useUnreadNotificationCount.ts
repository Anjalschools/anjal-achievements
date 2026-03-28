"use client";

import { useCallback, useEffect, useState } from "react";

const EVENT = "anjal-notifications-updated";

export const dispatchNotificationsUpdated = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENT));
  }
};

export const useUnreadNotificationCount = (pollMs = 45000) => {
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/unread-count", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data.count === "number") setCount(data.count);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), pollMs);
    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    const onCustom = () => void load();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener(EVENT, onCustom);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener(EVENT, onCustom);
    };
  }, [load, pollMs]);

  return { count, refresh: load };
};
