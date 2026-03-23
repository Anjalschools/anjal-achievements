"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import { getLocale } from "@/lib/i18n";
import { Loader2, ExternalLink } from "lucide-react";
import { dispatchNotificationsUpdated } from "@/hooks/useUnreadNotificationCount";
import type { NotificationApiItem } from "@/lib/notification-serialize";

const typeBadgeClass: Record<string, string> = {
  achievement_approved: "bg-emerald-100 text-emerald-900",
  achievement_needs_revision: "bg-amber-100 text-amber-950",
  achievement_rejected: "bg-red-100 text-red-950",
  achievement_deleted: "bg-red-100 text-red-900",
  achievement_featured: "bg-yellow-100 text-yellow-950",
  certificate_issued: "bg-sky-100 text-sky-950",
  ai_flag_notice: "bg-violet-100 text-violet-900",
  system: "bg-gray-100 text-gray-800",
};

const typeLabel = (type: string, ar: boolean): string => {
  const m: Record<string, { ar: string; en: string }> = {
    achievement_approved: { ar: "اعتماد", en: "Approved" },
    achievement_needs_revision: { ar: "تعديل مطلوب", en: "Revision" },
    achievement_rejected: { ar: "رفض", en: "Rejected" },
    achievement_deleted: { ar: "حذف", en: "Deleted" },
    achievement_featured: { ar: "تمييز", en: "Featured" },
    certificate_issued: { ar: "شهادة", en: "Certificate" },
    ai_flag_notice: { ar: "تنبيه", en: "Review notice" },
    system: { ar: "عام", en: "System" },
  };
  const row = m[type] || { ar: type, en: type };
  return ar ? row.ar : row.en;
};

const NotificationsPage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [items, setItems] = useState<NotificationApiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [markAllBusy, setMarkAllBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/notifications?limit=60", { cache: "no-store" });
      if (res.status === 401) {
        setError(isAr ? "يرجى تسجيل الدخول" : "Please sign in");
        setItems([]);
        return;
      }
      if (!res.ok) {
        throw new Error("fetch failed");
      }
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setError(isAr ? "تعذر تحميل الإشعارات" : "Could not load notifications");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [isAr]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleMarkRead = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
      if (res.ok) {
        setItems((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
        );
        dispatchNotificationsUpdated();
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleMarkAll = async () => {
    setMarkAllBusy(true);
    try {
      const res = await fetch("/api/notifications/read-all", { method: "PATCH" });
      if (res.ok) {
        setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
        dispatchNotificationsUpdated();
      }
    } finally {
      setMarkAllBusy(false);
    }
  };

  const unread = items.filter((n) => !n.isRead).length;

  return (
    <PageContainer>
      <div dir={isAr ? "rtl" : "ltr"}>
        <PageHeader
          title={isAr ? "الإشعارات" : "Notifications"}
          subtitle={
            isAr
              ? "تنبيهات اعتماد الإنجازات والشهادات والمراجعة"
              : "Updates on achievements, certificates, and reviews"
          }
        />

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
          <div
            className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center text-text-light">
            {isAr ? "لا توجد إشعارات بعد." : "No notifications yet."}
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((n) => {
              const badge = typeBadgeClass[n.type] || "bg-gray-100 text-gray-800";
              const busy = busyId === n.id;
              const dateStr = (() => {
                try {
                  return new Date(n.createdAt).toLocaleString(
                    isAr ? "ar-SA" : "en-US",
                    { dateStyle: "medium", timeStyle: "short" }
                  );
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
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge}`}
                        >
                          {typeLabel(n.type, isAr)}
                        </span>
                        {!n.isRead ? (
                          <span className="text-xs font-medium text-primary">
                            {isAr ? "جديد" : "New"}
                          </span>
                        ) : null}
                      </div>
                      <h2 className="text-base font-bold text-text">{n.title}</h2>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-text-light">
                        {n.message}
                      </p>
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
