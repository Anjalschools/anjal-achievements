"use client";

import { useState } from "react";
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
  SlidersHorizontal,
  ScrollText,
  LineChart,
  Sparkles,
  Share2,
  LayoutGrid,
  ListOrdered,
  PanelsTopLeft,
  type LucideIcon,
  MessagesSquare,
} from "lucide-react";
import { useUnreadNotificationCount } from "@/hooks/useUnreadNotificationCount";
import { getLocale } from "@/lib/i18n";
import { isReviewerNavRole } from "@/lib/app-navigation-roles";
import { useAppSession } from "@/contexts/AppSessionContext";
import { roleHasCapability, type RoleCapabilityKey } from "@/lib/app-role-scope-matrix";

const AppSidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const locale = getLocale();
  const { count: unreadNotifications } = useUnreadNotificationCount();
  const { profile } = useAppSession();
  const navRole = profile?.role ?? null;

  const isReviewer = isReviewerNavRole(navRole);

  const can = (key: RoleCapabilityKey) => roleHasCapability(navRole, key);

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
  const leaderboardItem = {
    href: "/admin/leaderboard",
    icon: ListOrdered,
    label: locale === "ar" ? "ترتيب الطلاب" : "Student leaderboard",
  };
  const adminAddAchievementItem = {
    href: "/admin/achievements/add",
    icon: PlusCircle,
    label: locale === "ar" ? "إضافة إنجاز (إداري)" : "Add achievement (admin)",
  };
  const analyticsItem = {
    href: "/admin/analytics",
    icon: LineChart,
    label: locale === "ar" ? "الإحصاءات المتقدمة" : "Advanced analytics",
  };
  const aiNewsItem = {
    href: "/admin/ai/news",
    icon: Sparkles,
    label: locale === "ar" ? "إنشاء خبر بالذكاء الاصطناعي" : "AI news",
  };
  const auditLogItem = {
    href: "/admin/audit-log",
    icon: ScrollText,
    label: locale === "ar" ? "سجل العمليات" : "Audit log",
  };
  const adminSettingsItem = {
    href: "/admin/settings",
    icon: SlidersHorizontal,
    label: locale === "ar" ? "إعدادات المنصة" : "Platform settings",
  };
  const socialIntegrationsItem = {
    href: "/admin/settings/social-integrations",
    icon: Share2,
    label: locale === "ar" ? "التكاملات الاجتماعية" : "Social integrations",
  };
  const scoringSettingsItem = {
    href: "/admin/scoring",
    icon: SlidersHorizontal,
    label: locale === "ar" ? "إعدادات النقاط" : "Points settings",
  };
  const accessMatrixItem = {
    href: "/admin/access-matrix",
    icon: LayoutGrid,
    label: locale === "ar" ? "مصفوفة الصلاحيات" : "Access matrix",
  };
  const contactMessagesItem = {
    href: "/admin/contact-messages",
    icon: MessagesSquare,
    label: locale === "ar" ? "رسائل التواصل" : "Contact messages",
  };
  const homeHighlightsItem = {
    href: "/admin/home-highlights",
    icon: PanelsTopLeft,
    label: locale === "ar" ? "إبرازات الصفحة الرئيسية" : "Home highlights",
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

  /**
   * Students: dashboard + hall + achievements + student add + notifications + profile + settings.
   * Staff: items filtered by `app-role-scope-matrix` (same rules as AdminAreaGuard + APIs).
   * Never show student "Add achievement" for reviewer roles.
   */
  const staffNavCandidates: Array<{
    href: string;
    icon: LucideIcon;
    label: string;
    capability: RoleCapabilityKey | null;
    badgeCount?: number;
  }> = [
    { ...adminDashboardItem, capability: "staffArea" },
    { ...reviewItem, capability: "reviewAchievements" },
    { ...adminAddAchievementItem, capability: "adminAddAchievement" },
    { ...usersItem, capability: "userManagement" },
    { ...reportsItem, capability: "reports" },
    { ...leaderboardItem, capability: "reviewAchievements" },
    { ...homeHighlightsItem, capability: "contactMessages" },
    { ...analyticsItem, capability: "advancedAnalytics" },
    { ...hallOfFameItem, capability: "viewAchievements" },
    { ...achievementsItem, capability: "viewAchievements" },
    { ...notificationsItem, capability: null },
    { ...profileItem, capability: null },
    { ...aiNewsItem, capability: "aiNews" },
    { ...contactMessagesItem, capability: "contactMessages" },
    { ...auditLogItem, capability: "auditLog" },
    { ...adminSettingsItem, capability: "platformSettings" },
    { ...scoringSettingsItem, capability: "platformSettings" },
    { ...socialIntegrationsItem, capability: "socialIntegrations" },
    { ...accessMatrixItem, capability: "accessMatrix" },
    { ...settingsItem, capability: null },
  ];

  const navItems = isReviewer
    ? staffNavCandidates
        .filter((row) => row.capability === null || can(row.capability))
        .map(({ capability: _omit, ...rest }) => rest)
    : [
        studentDashboardItem,
        hallOfFameItem,
        achievementsItem,
        addAchievementItem,
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
    if (href === "/admin/leaderboard") {
      return pathname === "/admin/leaderboard" || pathname?.startsWith("/admin/leaderboard/");
    }
    if (href === "/admin/achievements/add") {
      return pathname === "/admin/achievements/add";
    }
    if (href === "/admin/analytics") {
      return pathname === "/admin/analytics" || pathname?.startsWith("/admin/analytics/");
    }
    if (href === "/admin/ai/news") {
      return pathname === "/admin/ai/news" || pathname?.startsWith("/admin/ai/");
    }
    if (href === "/admin/audit-log") {
      return pathname === "/admin/audit-log";
    }
    if (href === "/admin/settings") {
      return pathname === "/admin/settings";
    }
    if (href === "/admin/settings/social-integrations") {
      return pathname?.startsWith("/admin/settings/social-integrations");
    }
    if (href === "/admin/scoring") {
      return pathname === "/admin/scoring" || pathname?.startsWith("/admin/scoring/");
    }
    if (href === "/admin/access-matrix") {
      return pathname === "/admin/access-matrix" || pathname?.startsWith("/admin/access-matrix/");
    }
    if (href === "/admin/contact-messages") {
      return pathname === "/admin/contact-messages" || pathname?.startsWith("/admin/contact-messages/");
    }
    if (href === "/admin/home-highlights") {
      return pathname === "/admin/home-highlights" || pathname?.startsWith("/admin/home-highlights/");
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
        className={`fixed bottom-0 z-40 flex w-[280px] transform flex-col border-gray-200 bg-white shadow-lg transition-transform duration-300 ease-in-out lg:translate-x-0 top-[7.75rem] max-h-[calc(100vh-7.75rem)] min-h-0 ${
          locale === "ar"
            ? `right-0 border-l ${isOpen ? "translate-x-0" : "translate-x-full"}`
            : `left-0 border-r ${isOpen ? "translate-x-0" : "-translate-x-full"}`
        }`}
        dir={locale === "ar" ? "rtl" : "ltr"}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Logo/Header */}
          <div className="flex h-16 shrink-0 items-center border-b border-gray-200 px-6">
            <h2 className="text-lg font-bold text-primary">
              {locale === "ar" ? "منصة التميز" : "Excellence Platform"}
            </h2>
          </div>

          {/* Navigation: scroll independently so all items stay reachable without zooming out */}
          <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-4 py-6">
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
