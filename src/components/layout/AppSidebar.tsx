"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Trophy,
  PlusCircle,
  User,
  Settings,
  Menu,
  X,
  ClipboardCheck,
  Bell,
  Gauge,
  UserCog,
  FileBarChart,
  Star,
} from "lucide-react";
import { useUnreadNotificationCount } from "@/hooks/useUnreadNotificationCount";
import { getLocale } from "@/lib/i18n";

const AppSidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [reviewerNav, setReviewerNav] = useState(false);
  const [adminManagerNav, setAdminManagerNav] = useState(false);
  const pathname = usePathname();
  const locale = getLocale();
  const { count: unreadNotifications } = useUnreadNotificationCount();

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/user/profile", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const role = String(data.role || "");
        setReviewerNav(["admin", "supervisor", "schoolAdmin", "teacher", "judge"].includes(role));
        setAdminManagerNav(role === "admin" || role === "supervisor");
      } catch {
        setReviewerNav(false);
      }
    };
    load();
  }, []);

  const achievementsItem = {
    href: "/achievements",
    icon: Trophy,
    label: locale === "ar" ? "الإنجازات" : "Achievements",
  };
  const addAchievementItem = {
    href: "/achievements/new",
    icon: PlusCircle,
    label: locale === "ar" ? "إضافة إنجاز" : "Add Achievement",
  };
  const studentDashboardItem = {
    href: "/dashboard",
    icon: LayoutDashboard,
    label: locale === "ar" ? "لوحة التحكم" : "Dashboard",
  };
  const hallOfFameItem = {
    href: "/hall-of-fame",
    icon: Star,
    label: locale === "ar" ? "لوحة التميز" : "Hall of Fame",
  };
  const adminDashboardItem = {
    href: "/admin/dashboard",
    icon: Gauge,
    label: locale === "ar" ? "لوحة الإدارة" : "Admin dashboard",
  };
  const reviewItem = {
    href: "/admin/achievements/review",
    icon: ClipboardCheck,
    label: locale === "ar" ? "مراجعة الإنجازات" : "Review achievements",
  };
  const usersItem = {
    href: "/admin/users",
    icon: UserCog,
    label: locale === "ar" ? "إدارة المستخدمين" : "User management",
  };
  const reportsItem = {
    href: "/admin/achievements/reports",
    icon: FileBarChart,
    label: locale === "ar" ? "التقارير" : "Reports",
  };
  const notificationsItem = {
    href: "/notifications",
    icon: Bell,
    label: locale === "ar" ? "الإشعارات" : "Notifications",
    badgeCount: unreadNotifications,
  };
  const profileItem = {
    href: "/profile",
    icon: User,
    label: locale === "ar" ? "الملف الشخصي" : "Profile",
  };
  const settingsItem = {
    href: "/settings",
    icon: Settings,
    label: locale === "ar" ? "الإعدادات" : "Settings",
  };

  /** Admin/supervisor: executive order — no student `/dashboard` to avoid confusion with admin dashboard. */
  const navItems = adminManagerNav
    ? [
        adminDashboardItem,
        reviewItem,
        usersItem,
        reportsItem,
        hallOfFameItem,
        achievementsItem,
        addAchievementItem,
        notificationsItem,
        profileItem,
        settingsItem,
      ]
    : [
        studentDashboardItem,
        hallOfFameItem,
        achievementsItem,
        addAchievementItem,
        ...(reviewerNav ? [adminDashboardItem, reviewItem, reportsItem] : []),
        notificationsItem,
        profileItem,
        settingsItem,
      ];

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    if (href === "/admin/dashboard") {
      return pathname === "/admin/dashboard" || pathname?.startsWith("/admin/dashboard/");
    }
    if (href === "/admin/achievements/review") {
      return pathname?.startsWith("/admin/achievements/review");
    }
    if (href === "/admin/users") {
      return pathname === "/admin/users" || pathname?.startsWith("/admin/users/");
    }
    if (href === "/admin/achievements/reports") {
      return pathname?.startsWith("/admin/achievements/reports");
    }
    if (href === "/hall-of-fame") {
      return pathname === "/hall-of-fame";
    }
    return pathname?.startsWith(href);
  };

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed top-[7.25rem] z-[60] rounded-lg bg-white p-2 shadow-lg ring-1 ring-gray-200 lg:hidden ${
          locale === "ar" ? "right-4" : "left-4"
        }`}
        aria-label={locale === "ar" ? "القائمة" : "Menu"}
      >
        {isOpen ? (
          <X className="h-6 w-6 text-text" />
        ) : (
          <Menu className="h-6 w-6 text-text" />
        )}
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed bottom-0 z-40 w-[280px] transform border-gray-200 bg-white shadow-lg transition-transform duration-300 ease-in-out lg:translate-x-0 top-[7.75rem] ${
          locale === "ar"
            ? `right-0 border-l ${isOpen ? "translate-x-0" : "translate-x-full"}`
            : `left-0 border-r ${isOpen ? "translate-x-0" : "-translate-x-full"}`
        }`}
        dir={locale === "ar" ? "rtl" : "ltr"}
      >
        <div className="flex h-full flex-col">
          {/* Logo/Header */}
          <div className="flex h-16 items-center border-b border-gray-200 px-6">
            <h2 className="text-lg font-bold text-primary">
              {locale === "ar" ? "منصة التميز" : "Excellence Platform"}
            </h2>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-4 py-6">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              const badge =
                "badgeCount" in item && typeof item.badgeCount === "number" && item.badgeCount > 0
                  ? item.badgeCount
                  : 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-text-light hover:bg-gray-100 hover:text-text"
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="min-w-0 flex-1">{item.label}</span>
                  {badge > 0 ? (
                    <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
};

export default AppSidebar;
