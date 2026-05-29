"use client";

import {
  dispatchNotificationsUpdated,
  useUnreadNotificationContext,
} from "@/contexts/UnreadNotificationContext";

export { dispatchNotificationsUpdated };

/** Subscribes to the app-wide unread notification poll (single shared interval). */
export const useUnreadNotificationCount = (_pollMs = 60_000) => {
  const { count, refresh } = useUnreadNotificationContext();
  return { count, refresh };
};
