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
  Briefcase,
  SlidersHorizontal,
  ScrollText,
  LineChart,
  Sparkles,
  Share2,
  LayoutGrid,
  ListOrdered,
  PanelsTopLeft,
  CalendarDays,
  GraduationCap,
  BadgeCheck,
  type LucideIcon,
  MessagesSquare,
  Newspaper,
  BarChart3,
  Bot,
  Megaphone,
  Users,
  Activity,
  Search,
  Images,
} from "lucide-react";
import { useUnreadNotificationCount } from "@/hooks/useUnreadNotificationCount";
import { getLocale } from "@/lib/i18n";
import { isReviewerNavRole } from "@/lib/app-navigation-roles";
import { useAppSession } from "@/contexts/AppSessionContext";
import { roleHasCapability, type RoleCapabilityKey } from "@/lib/app-role-scope-matrix";
import AuthGuardLink from "@/components/auth/AuthGuardLink";
import { isAuthGuardHref } from "@/lib/requireAuthRedirect";
import { isEligibleForAcademicAdvisor } from "@/lib/alumni/isEligibleForAcademicAdvisor";
import { canAccessAlumniCommunity } from "@/lib/alumni/canAccessAlumniCommunity";

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
  const letterRequestsStudentItem = {
    href: "/letter-requests",
    icon: ScrollText,
    label: locale === "ar" ? "الإفادة وخطاب التوصية" : "Testimonials & letters",
  };
  const letterRequestsAdminItem = {
    href: "/admin/letter-requests",
    icon: ScrollText,
    label: locale === "ar" ? "طلبات الخطابات" : "Letter requests",
  };
  const alumniOnboardingAdminItem = {
    href: "/admin/alumni/onboarding-requests",
    icon: GraduationCap,
    label: locale === "ar" ? "طلبات الخريجين" : "Alumni requests",
  };
  const alumniVerificationCenterItem = {
    href: "/admin/alumni/verification-center",
    icon: BadgeCheck,
    label: locale === "ar" ? "توثيق الخريجين" : "Alumni verification",
  };
  const alumniStoriesAdminItem = {
    href: "/admin/alumni/stories",
    icon: PanelsTopLeft,
    label: locale === "ar" ? "قصص الخريجين" : "Alumni stories",
  };
  const alumniMemoriesAdminItem = {
    href: "/admin/alumni/memories",
    icon: Images,
    label: locale === "ar" ? "مراجعة الذكريات" : "Memories review",
  };
  const alumniOpportunitiesAdminItem = {
    href: "/admin/alumni/opportunities",
    icon: Briefcase,
    label: locale === "ar" ? "فرص الخريجين" : "Alumni opportunities",
  };
  const alumniOpportunityReviewAdminItem = {
    href: "/admin/alumni/opportunities/review",
    icon: ClipboardCheck,
    label: locale === "ar" ? "مراجعة الفرص" : "Opportunities review",
  };
  const alumniAnnouncementsAdminItem = {
    href: "/admin/alumni/announcements",
    icon: Newspaper,
    label: locale === "ar" ? "إعلانات الخريجين" : "Alumni announcements",
  };
  const alumniCohortsAdminItem = {
    href: "/admin/alumni/cohorts",
    icon: CalendarDays,
    label: locale === "ar" ? "دفعات الخريجين" : "Alumni cohorts",
  };
  const alumniAnalyticsAdminItem = {
    href: "/admin/alumni/analytics",
    icon: BarChart3,
    label: locale === "ar" ? "تحليلات الخريجين" : "Alumni analytics",
  };
  const alumniCampaignsAdminItem = {
    href: "/admin/alumni/campaigns",
    icon: Megaphone,
    label: locale === "ar" ? "حملات الخريجين" : "Alumni campaigns",
  };
  const alumniCrmAdminItem = {
    href: "/admin/alumni/crm",
    icon: Users,
    label: locale === "ar" ? "CRM الخريجين" : "Alumni CRM",
  };
  const alumniPlatformHealthAdminItem = {
    href: "/admin/alumni/platform-health",
    icon: Activity,
    label: locale === "ar" ? "صحة المنصة (خريجين)" : "Alumni platform health",
  };
  const alumniEventsAdminItem = {
    href: "/admin/alumni/events",
    icon: CalendarDays,
    label: locale === "ar" ? "فعاليات الخريجين" : "Alumni events",
  };
  const alumniInboxAdminItem = {
    href: "/admin/alumni/inbox",
    icon: MessagesSquare,
    label: locale === "ar" ? "بريد الخريجين" : "Alumni inbox",
  };
  const alumniDashboardNavItem = {
    href: "/alumni/dashboard",
    icon: LayoutDashboard,
    label: locale === "ar" ? "لوحة الخريجين" : "Alumni dashboard",
  };
  const alumniInboxNavItem = {
    href: "/alumni/inbox",
    icon: MessagesSquare,
    label: locale === "ar" ? "صندوق الرسائل" : "Inbox",
  };
  const alumniMentorshipNavItem = {
    href: "/alumni/mentorship",
    icon: GraduationCap,
    label: locale === "ar" ? "الإرشاد" : "Mentorship",
  };
  const alumniMemoriesNavItem = {
    href: "/alumni/dashboard#alumni-memories",
    icon: Images,
    label: locale === "ar" ? "ذكرياتي في الأنجال" : "My school memories",
  };
  const alumniAssistantNavItem = {
    href: "/alumni/assistant",
    icon: Bot,
    label:
      profile?.accountType === "alumni"
        ? locale === "ar"
          ? "المرشد المهني الذكي"
          : "Smart career advisor"
        : locale === "ar"
          ? "المرشد الأكاديمي الذكي"
          : "Smart academic advisor",
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
  const alumniDiscoverySearchItem = {
    href: "/search",
    icon: Search,
    label: locale === "ar" ? "استكشاف المجتمع" : "Discover network",
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
  const homeCeremonySettingsItem = {
    href: "/admin/settings/home-ceremony",
    icon: CalendarDays,
    label: locale === "ar" ? "تحرير الصفحة الرئيسية" : "Edit homepage",
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
    { ...homeHighlightsItem, capability: "homeHighlights" },
    { ...homeCeremonySettingsItem, capability: "platformSettings" },
    { ...analyticsItem, capability: "advancedAnalytics" },
    { ...hallOfFameItem, capability: "viewAchievements" },
    { ...achievementsItem, capability: "viewAchievements" },
    { ...notificationsItem, capability: null },
    { ...profileItem, capability: null },
    { ...aiNewsItem, capability: "aiNews" },
    { ...contactMessagesItem, capability: "contactMessages" },
    { ...letterRequestsAdminItem, capability: "letterRequests" },
    { ...alumniOnboardingAdminItem, capability: "userManagement" },
    { ...alumniVerificationCenterItem, capability: "userManagement" },
    { ...alumniStoriesAdminItem, capability: "userManagement" },
    { ...alumniMemoriesAdminItem, capability: "userManagement" },
    { ...alumniOpportunitiesAdminItem, capability: "userManagement" },
    { ...alumniOpportunityReviewAdminItem, capability: "userManagement" },
    { ...alumniAnnouncementsAdminItem, capability: "userManagement" },
    { ...alumniCohortsAdminItem, capability: "userManagement" },
    { ...alumniAnalyticsAdminItem, capability: "userManagement" },
    { ...alumniCampaignsAdminItem, capability: "userManagement" },
    { ...alumniCrmAdminItem, capability: "userManagement" },
    { ...alumniPlatformHealthAdminItem, capability: "userManagement" },
    { ...alumniEventsAdminItem, capability: "userManagement" },
    { ...alumniInboxAdminItem, capability: "userManagement" },
    { ...auditLogItem, capability: "auditLog" },
    { ...adminSettingsItem, capability: "platformSettings" },
    { ...scoringSettingsItem, capability: "platformSettings" },
    { ...socialIntegrationsItem, capability: "socialIntegrations" },
    { ...accessMatrixItem, capability: "accessMatrix" },
    { ...settingsItem, capability: null },
  ];

  const showAcademicAdvisorNav =
    !isReviewer &&
    (profile?.role === "student" || profile?.accountType === "alumni") &&
    isEligibleForAcademicAdvisor({
      accountType: profile?.accountType,
      grade: profile?.grade,
      role: profile?.role,
    });

  const showAlumniCommunityNav =
    !isReviewer &&
    canAccessAlumniCommunity({
      accountType: profile?.accountType,
      grade: profile?.grade,
      role: profile?.role,
      alumniCommunityRemovedAt: profile?.alumniCommunityRemovedAt,
      alumniPermanentlyPurgedAt: profile?.alumniPermanentlyPurgedAt,
    });

  const isAlumniAccount = profile?.accountType === "alumni";

  const navItems = isReviewer
    ? staffNavCandidates
        .filter((row) => row.capability === null || can(row.capability))
        .map(({ capability: _omit, ...rest }) => rest)
    : [
        ...(isAlumniAccount
          ? [alumniDashboardNavItem, alumniInboxNavItem, alumniMentorshipNavItem, alumniMemoriesNavItem]
          : [studentDashboardItem]),
        ...(showAcademicAdvisorNav ? [alumniAssistantNavItem] : []),
        ...(!isAlumniAccount ? [hallOfFameItem] : []),
        ...(showAlumniCommunityNav ? [alumniDiscoverySearchItem] : []),
        ...(!isAlumniAccount ? [achievementsItem, letterRequestsStudentItem, addAchievementItem] : []),
        notificationsItem,
        profileItem,
        settingsItem,
      ];

  const isActive = (href: string) => {
    if (href === "/alumni/dashboard") {
      return pathname === "/alumni/dashboard" || pathname?.startsWith("/alumni/dashboard/");
    }
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
    if (href === "/admin/settings/home-ceremony") {
      return pathname?.startsWith("/admin/settings/home-ceremony");
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
    if (href === "/admin/alumni/onboarding-requests") {
      return pathname === "/admin/alumni/onboarding-requests" || pathname?.startsWith("/admin/alumni/onboarding-requests/");
    }
    if (href === "/admin/alumni/verification-center") {
      return pathname === "/admin/alumni/verification-center" || pathname?.startsWith("/admin/alumni/verification-center/");
    }
    if (href === "/admin/alumni/stories") {
      return pathname === "/admin/alumni/stories" || pathname?.startsWith("/admin/alumni/stories/");
    }
    if (href === "/admin/alumni/opportunities") {
      return pathname === "/admin/alumni/opportunities" || pathname?.startsWith("/admin/alumni/opportunities/");
    }
    if (href === "/admin/alumni/announcements") {
      return pathname === "/admin/alumni/announcements" || pathname?.startsWith("/admin/alumni/announcements/");
    }
    if (href === "/admin/alumni/cohorts") {
      return pathname === "/admin/alumni/cohorts" || pathname?.startsWith("/admin/alumni/cohorts/");
    }
    if (href === "/admin/alumni/analytics") {
      return pathname === "/admin/alumni/analytics" || pathname?.startsWith("/admin/alumni/analytics/");
    }
    if (href === "/admin/alumni/campaigns") {
      return pathname === "/admin/alumni/campaigns" || pathname?.startsWith("/admin/alumni/campaigns/");
    }
    if (href === "/admin/alumni/crm") {
      return pathname === "/admin/alumni/crm" || pathname?.startsWith("/admin/alumni/crm/");
    }
    if (href === "/admin/alumni/platform-health") {
      return pathname === "/admin/alumni/platform-health" || pathname?.startsWith("/admin/alumni/platform-health/");
    }
    if (href === "/admin/alumni/events") {
      return pathname === "/admin/alumni/events" || pathname?.startsWith("/admin/alumni/events/");
    }
    if (href === "/admin/alumni/inbox") {
      return pathname === "/admin/alumni/inbox" || pathname?.startsWith("/admin/alumni/inbox/");
    }
    if (href === "/admin/home-highlights") {
      return pathname === "/admin/home-highlights" || pathname?.startsWith("/admin/home-highlights/");
    }
    if (href === "/hall-of-fame") {
      return pathname === "/hall-of-fame";
    }
    if (href === "/search") {
      return pathname === "/search" || pathname?.startsWith("/search/");
    }
    if (href === "/alumni/dashboard#alumni-memories") {
      return pathname === "/alumni/dashboard";
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
              {isAlumniAccount
                ? locale === "ar"
                  ? "مجتمع الخريجين"
                  : "Alumni hub"
                : locale === "ar"
                  ? "منصة التميز"
                  : "Excellence Platform"}
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
              const navCls = `flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                active
                  ? "bg-primary/10 text-primary"
                  : "text-text-light hover:bg-gray-100 hover:text-text"
              }`;
              const close = () => setIsOpen(false);
              return isAuthGuardHref(item.href) ? (
                <AuthGuardLink key={item.href} href={item.href} onClick={close} className={navCls}>
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="min-w-0 flex-1">{item.label}</span>
                  {badge > 0 ? (
                    <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  ) : null}
                </AuthGuardLink>
              ) : (
                <Link key={item.href} href={item.href} onClick={close} className={navCls}>
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
