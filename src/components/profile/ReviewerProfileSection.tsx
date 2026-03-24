"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Award,
  BarChart3,
  Bell,
  ClipboardCheck,
  Edit,
  FileBarChart,
  Mail,
  PlusCircle,
  Shield,
  UserCog,
  Users,
} from "lucide-react";
import SectionCard from "@/components/layout/SectionCard";
import StatCard from "@/components/layout/StatCard";
import { getLocale } from "@/lib/i18n";
import type { AdminDashboardPayload } from "@/lib/admin-dashboard-stats";
import { adminRoleLabel, adminStatusBadgeClass, adminStatusLabel } from "@/lib/admin-users-ui-labels";
import { useUnreadNotificationCount } from "@/hooks/useUnreadNotificationCount";

export type ReviewerProfileUserPayload = {
  fullName: string;
  email: string;
  username: string;
  phone: string;
  profilePhoto?: string;
  role: string;
  preferredLanguage?: string;
  accountStatus?: string;
  createdAt?: string;
  lastLoginAt?: string | null;
};

type ReviewerProfileSectionProps = {
  user: ReviewerProfileUserPayload;
  dashboard: AdminDashboardPayload | null;
  dashboardError: string | null;
  /** Platform admin / supervisor — can open user management. */
  canManageUsers: boolean;
};

const fmtDate = (iso: string | null | undefined, isAr: boolean) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(isAr ? "ar-SA" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
};

const ReviewerProfileSection = ({ user, dashboard, dashboardError, canManageUsers }: ReviewerProfileSectionProps) => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const { count: unreadNotifications } = useUnreadNotificationCount();

  const getInitials = (name: string) => {
    if (!name) return "A";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const [avatarFailed, setAvatarFailed] = useState(false);

  const avatarSrc = user.profilePhoto?.trim() ?? "";
  const showAvatar =
    Boolean(avatarSrc) &&
    !avatarFailed &&
    (avatarSrc.startsWith("/") ||
      avatarSrc.startsWith("data:") ||
      avatarSrc.startsWith("http://") ||
      avatarSrc.startsWith("https://"));
  const avatarUnopt =
    avatarSrc.startsWith("data:") || avatarSrc.startsWith("http://") || avatarSrc.startsWith("https://");

  const stats = dashboard?.stats;
  const roleLabel = adminRoleLabel(user.role, isAr);
  const statusLabel = adminStatusLabel(user.accountStatus || "active", isAr);

  return (
    <>
      <SectionCard className="mb-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          <div className="flex flex-col items-center md:items-start">
            <div className="relative mb-4 h-28 w-28 shrink-0">
              {showAvatar ? (
                <Image
                  src={avatarSrc}
                  alt={user.fullName || "User"}
                  fill
                  unoptimized={avatarUnopt}
                  className="rounded-full object-cover"
                  onError={() => setAvatarFailed(true)}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-full bg-primary text-2xl font-bold text-white">
                  {getInitials(user.fullName)}
                </div>
              )}
            </div>
            <div className="text-center md:text-start">
              <h1 className="mb-1 text-2xl font-bold text-text">{user.fullName || (isAr ? "المستخدم" : "User")}</h1>
              <p className="mb-2 flex flex-wrap items-center justify-center gap-2 text-sm text-text-light md:justify-start">
                <Mail className="h-4 w-4 shrink-0" aria-hidden />
                <span>{user.email || "—"}</span>
              </p>
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${adminStatusBadgeClass(user.accountStatus || "active")}`}
              >
                {statusLabel}
              </span>
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-4 border-t border-gray-200 pt-6 md:border-t-0 md:border-s md:ps-6 md:pt-0">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-medium text-text-light">{isAr ? "اسم المستخدم" : "Username"}</p>
                <p className="text-sm font-semibold text-text">{user.username || "—"}</p>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-text-light">{isAr ? "الدور" : "Role"}</p>
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-text">
                  <Shield className="h-4 w-4 text-primary" aria-hidden />
                  {roleLabel}
                </p>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-text-light">{isAr ? "اللغة المفضلة" : "Preferred language"}</p>
                <p className="text-sm font-semibold text-text">
                  {user.preferredLanguage === "en" ? (isAr ? "الإنجليزية" : "English") : isAr ? "العربية" : "Arabic"}
                </p>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-text-light">{isAr ? "رقم الجوال" : "Phone"}</p>
                <p className="text-sm font-semibold text-text">{user.phone?.trim() || "—"}</p>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-text-light">{isAr ? "تاريخ إنشاء الحساب" : "Account created"}</p>
                <p className="text-sm font-semibold text-text">{fmtDate(user.createdAt, isAr)}</p>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-text-light">{isAr ? "آخر دخول" : "Last sign-in"}</p>
                <p className="text-sm font-semibold text-text">{fmtDate(user.lastLoginAt ?? undefined, isAr)}</p>
              </div>
            </div>

            <div className="pt-2">
              <Link
                href="/settings"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-gray-50"
              >
                <Edit className="h-4 w-4" aria-hidden />
                <span>{isAr ? "تعديل الملف الشخصي" : "Edit profile"}</span>
              </Link>
            </div>
          </div>
        </div>
      </SectionCard>

      {dashboardError ? (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="alert">
          {dashboardError}
        </div>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={isAr ? "إجمالي الإنجازات" : "Total achievements"}
          value={stats?.totalAchievements ?? "—"}
          icon={Award}
        />
        <StatCard
          title={isAr ? "بانتظار المراجعة" : "Pending review"}
          value={stats?.pendingReview ?? "—"}
          icon={ClipboardCheck}
        />
        <StatCard
          title={isAr ? "معتمد" : "Approved"}
          value={stats?.approved ?? "—"}
          icon={Award}
        />
        <StatCard
          title={isAr ? "مميز" : "Featured"}
          value={stats?.featured ?? "—"}
          icon={Award}
        />
        <StatCard
          title={isAr ? "إشعارات غير مقروءة" : "Unread notifications"}
          value={unreadNotifications}
          icon={Bell}
        />
        <StatCard
          title={isAr ? "المستخدمون" : "Users"}
          value={stats?.totalUsers ?? "—"}
          icon={Users}
        />
      </div>

      <SectionCard className="mb-6">
        <h3 className="mb-4 text-lg font-bold text-text">{isAr ? "إجراءات سريعة" : "Quick actions"}</h3>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/achievements/review"
            className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/10"
          >
            <ClipboardCheck className="h-4 w-4" />
            {isAr ? "مراجعة الإنجازات" : "Review achievements"}
          </Link>
          <Link
            href="/admin/achievements/add"
            className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/10"
          >
            <PlusCircle className="h-4 w-4" />
            {isAr ? "إضافة إنجاز (إداري)" : "Add achievement (admin)"}
          </Link>
          {canManageUsers ? (
            <Link
              href="/admin/users"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-text hover:bg-gray-50"
            >
              <UserCog className="h-4 w-4" />
              {isAr ? "إدارة المستخدمين" : "User management"}
            </Link>
          ) : null}
          <Link
            href="/admin/achievements/reports"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-text hover:bg-gray-50"
          >
            <FileBarChart className="h-4 w-4" />
            {isAr ? "التقارير" : "Reports"}
          </Link>
          <Link
            href="/admin/analytics"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-text hover:bg-gray-50"
          >
            <BarChart3 className="h-4 w-4" />
            {isAr ? "الإحصاءات المتقدمة" : "Analytics"}
          </Link>
          <Link
            href="/notifications"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-text hover:bg-gray-50"
          >
            <Bell className="h-4 w-4" />
            {isAr ? "الإشعارات" : "Notifications"}
          </Link>
        </div>
      </SectionCard>

      <SectionCard>
        <h3 className="mb-2 text-lg font-bold text-text">{isAr ? "نشاط حديث (إداري)" : "Recent admin activity"}</h3>
        <p className="text-sm text-text-light">
          {isAr
            ? "تفاصيل الطوابير والأولويات متاحة من لوحة الإدارة."
            : "Queues and priority details are available on the admin dashboard."}
        </p>
        <div className="mt-4">
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
          >
            {isAr ? "الانتقال إلى لوحة الإدارة" : "Admin dashboard"}
          </Link>
        </div>
      </SectionCard>
    </>
  );
};

export default ReviewerProfileSection;
