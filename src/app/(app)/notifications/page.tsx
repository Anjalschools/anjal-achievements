"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import { getLocale } from "@/lib/i18n";
import { Loader2, ExternalLink, Inbox } from "lucide-react";
import { dispatchNotificationsUpdated } from "@/hooks/useUnreadNotificationCount";
import type { NotificationApiItem } from "@/lib/notification-serialize";
import { isAchievementReviewerRole } from "@/lib/achievement-reviewer-roles";
import { getNotificationTypeLabel } from "@/lib/achievement-display-labels";
import { notificationMatchesFilter } from "@/lib/notification-category";

const typeBadgeClass: Record<string, string> = {
  achievement_approved: "bg-emerald-100 text-emerald-900",
  achievement_needs_revision: "bg-amber-100 text-amber-950",
  achievement_rejected: "bg-red-100 text-red-950",
  achievement_deleted: "bg-red-100 text-red-900",
  achievement_featured: "bg-yellow-100 text-yellow-950",
  certificate_issued: "bg-sky-100 text-sky-950",
  ai_flag_notice: "bg-violet-100 text-violet-900",
  achievement_submitted_for_review: "bg-orange-100 text-orange-950",
  achievement_updated_for_review: "bg-orange-100 text-orange-950",
  system: "bg-gray-100 text-gray-800",
};

type FilterTab = "all" | "unread" | "reviews" | "certificates" | "system";

const NotificationsPage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [items, setItems] = useState<NotificationApiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [markAllBusy, setMarkAllBusy] = useState(false);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [role, setRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    const loadRole = async () => {
      try {
        const res = await fetch("/api/user/profile", { cache: "no-store", credentials: "same-origin" });
        if (!res.ok) {
          setRole(null);
          return;
        }
        const j = (await res.json()) as { role?: string };
        setRole(String(j.role || ""));
      } catch {
        setRole(null);
      } finally {
        setRoleLoading(false);
      }
    };
    void loadRole();
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/notifications?limit=80", { cache: "no-store", credentials: "same-origin" });
      if (res.status === 401) {
        setError(isAr ? "يرجى تسجيل الدخول" : "Please sign in");
        setItems([]);
        return;
      }
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(typeof j.error === "string" ? j.error : "fetch failed");
      }
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setError(isAr ? "تعذر تحميل الإشعارات. تحقق من الاتصال وحاول مرة أخرى." : "Could not load notifications. Check your connection and try again.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [isAr]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredItems = useMemo(
    () => items.filter((n) => notificationMatchesFilter(n.type, filter, n.isRead)),
    [items, filter]
  );

  const unread = items.filter((n) => !n.isRead).length;

  const handleMarkRead = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: "PATCH", credentials: "same-origin" });
      if (res.ok) {
        setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
        dispatchNotificationsUpdated();
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleMarkAll = async () => {
    setMarkAllBusy(true);
    try {
      const res = await fetch("/api/notifications/read-all", { method: "PATCH", credentials: "same-origin" });
      if (res.ok) {
        setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
        dispatchNotificationsUpdated();
      }
    } finally {
      setMarkAllBusy(false);
    }
  };

  const subtitle = isAchievementReviewerRole(role)
    ? isAr
      ? "تنبيهات اعتماد الإنجازات والشهادات والمراجعة والطوابير الإدارية"
      : "Alerts for approvals, certificates, reviews, and admin queues"
    : isAr
      ? "تنبيهات اعتماد الإنجازات والشهادات والمراجعة"
      : "Updates on achievements, certificates, and reviews";

  const tabBtn = (id: FilterTab, labelAr: string, labelEn: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setFilter(id)}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
        filter === id ? "bg-primary text-white" : "bg-gray-100 text-text hover:bg-gray-200"
      }`}
    >
      {isAr ? labelAr : labelEn}
    </button>
  );

  return (
    <PageContainer>
      <div dir={isAr ? "rtl" : "ltr"}>
        <PageHeader title={isAr ? "الإشعارات" : "Notifications"} subtitle={subtitle} />

        {roleLoading ? (
          <div className="mb-4 flex items-center gap-2 text-sm text-text-light" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {isAr ? "جاري التهيئة…" : "Initializing…"}
          </div>
        ) : null}

        <div className="mb-4 flex flex-wrap items-center gap-2">
          {tabBtn("all", "الكل", "All")}
          {tabBtn("unread", "غير المقروءة", "Unread")}
          {tabBtn("reviews", "المراجعات", "Reviews")}
          {tabBtn("certificates", "الشهادات", "Certificates")}
          {tabBtn("system", "النظام", "System")}
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {unread > 0 ? (
            <button
              type="button"
              disabled={markAllBusy}
              onClick={handleMarkAll}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-text hover:bg-gray-50 disabled:opacity-50"
            >
              {markAllBusy
                ? isAr
                  ? "جاري التحديث…"
                  : "Updating…"
                : isAr
                  ? "تعليم الكل كمقروء"
                  : "Mark all as read"}
            </button>
          ) : (
            <span className="text-sm text-text-light">
              {isAr ? "لا توجد إشعارات غير مقروءة" : "No unread notifications"}
            </span>
          )}
        </div>

        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {error}
            <div className="mt-2">
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  void load();
                }}
                className="font-semibold text-red-900 underline"
              >
                {isAr ? "إعادة المحاولة" : "Retry"}
              </button>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
            <p className="text-sm text-text-light">{isAr ? "جاري تحميل الإشعارات…" : "Loading notifications…"}</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
            <Inbox className="mx-auto mb-4 h-14 w-14 text-gray-300" aria-hidden />
            <p className="text-base font-semibold text-text">
              {isAr ? "لا توجد إشعارات في هذا القسم" : "No notifications in this view"}
            </p>
            <p className="mt-2 text-sm text-text-light">
              {items.length === 0
                ? isAr
                  ? "سيظهر هنا أي تحديث يخص إنجازاتك أو مراجعاتك."
                  : "Achievement and review updates will appear here."
                : isAr
                  ? "جرّب فلترًا آخر أو عرض «الكل»."
                  : "Try another filter or view “All”."}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {filteredItems.map((n) => {
              const badge = typeBadgeClass[n.type] || "bg-gray-100 text-gray-800";
              const busy = busyId === n.id;
              const dateStr = (() => {
                try {
                  return new Date(n.createdAt).toLocaleString(isAr ? "ar-SA" : "en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  });
                } catch {
                  return n.createdAt;
                }
              })();
              return (
                <li
                  key={n.id}
                  className={`rounded-2xl border p-4 shadow-sm ${
                    n.isRead ? "border-gray-200 bg-white" : "border-primary/25 bg-primary/[0.04]"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge}`}>
                          {getNotificationTypeLabel(n.type, isAr ? "ar" : "en")}
                        </span>
                        {!n.isRead ? (
                          <span className="text-xs font-medium text-primary">{isAr ? "جديد" : "New"}</span>
                        ) : null}
                      </div>
                      <h2 className="text-base font-bold text-text">{n.title}</h2>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-text-light">{n.message}</p>
                      <p className="mt-2 text-xs text-text-muted">{dateStr}</p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2">
                      {!n.isRead ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleMarkRead(n.id)}
                          className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-text hover:bg-gray-200 disabled:opacity-50"
                        >
                          {isAr ? "تعليم كمقروء" : "Mark read"}
                        </button>
                      ) : null}
                      {n.actionHref ? (
                        <Link
                          href={n.actionHref}
                          className="inline-flex items-center justify-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:opacity-95"
                        >
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                          {isAr ? "انتقال" : "Open"}
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </PageContainer>
  );
};

export default NotificationsPage;
