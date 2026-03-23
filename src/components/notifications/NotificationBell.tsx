"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { getLocale } from "@/lib/i18n";
import { useUnreadNotificationCount } from "@/hooks/useUnreadNotificationCount";

const NotificationBell = () => {
  const locale = getLocale();
  const { count } = useUnreadNotificationCount();

  const label =
    locale === "ar"
      ? count > 0
        ? `الإشعارات، ${count} غير مقروء`
        : "الإشعارات"
      : count > 0
        ? `Notifications, ${count} unread`
        : "Notifications";

  return (
    <Link
      href="/notifications"
      className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-text shadow-sm transition-colors hover:bg-gray-50"
      aria-label={label}
    >
      <Bell className="h-5 w-5 text-text" aria-hidden />
      {count > 0 ? (
        <span className="absolute -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white ltr:left-0 rtl:right-0">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
};

export default NotificationBell;
