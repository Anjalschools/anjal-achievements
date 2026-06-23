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
  ClipboardList,
  Bell,
  Gauge,
  UserCog,
  FileBarChart,
  Star,
  Building2,
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
  Mail,
  Newspaper,
  BarChart3,
  Bot,
  Megaphone,
  Users,
  Activity,
  Archive,
  Award,
  Search,
  Images,
  FileSpreadsheet,
} from "lucide-react";
import { useUnreadNotificationCount } from "@/hooks/useUnreadNotificationCount";
import { defaultLocale, getLocale } from "@/lib/i18n";
import { useClientMounted } from "@/hooks/useClientMounted";
import {
  isStaffAdminNavRole,
  isAlumniPlatformAdminRole,
  isPartnershipSupervisorRole,
  isTrainingInstitutionRole,
} from "@/lib/app-navigation-roles";
import { useAppSession } from "@/contexts/AppSessionContext";
import { roleHasCapability, type RoleCapabilityKey } from "@/lib/app-role-scope-matrix";
import AuthGuardLink from "@/components/auth/AuthGuardLink";
import { isAuthGuardHref } from "@/lib/requireAuthRedirect";
import { isEligibleForAcademicAdvisor } from "@/lib/alumni/isEligibleForAcademicAdvisor";
import { canAccessAlumniCommunity } from "@/lib/alumni/canAccessAlumniCommunity";

const AppSidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const mounted = useClientMounted();
  const locale = mounted ? getLocale() : defaultLocale;
  const { count: unreadNotifications } = useUnreadNotificationCount();
  const { profile } = useAppSession();
  const navRole = profile?.role ?? null;

  const isStaffNav = isStaffAdminNavRole(navRole);
  const isAlumniAdminOnly = isAlumniPlatformAdminRole(navRole);
  const isPartnershipSupervisorOnly = isPartnershipSupervisorRole(navRole);
  const isTrainingInstitutionOnly = isTrainingInstitutionRole(navRole);

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
  const summerTrainingStudentItem = {
    href: "/summer-training",
    icon: Briefcase,
    label: locale === "ar" ? "التدريب الصيفي والشراكات" : "Summer training",
  };
  const summerTrainingMessagesStudentItem = {
    href: "/summer-training/messages",
    icon: Mail,
    label: locale === "ar" ? "رسائل التدريب" : "Training messages",
  };
  const summerTrainingFinalReportStudentItem = {
    href: "/summer-training/final-report",
    icon: FileSpreadsheet,
    label: locale === "ar" ? "التقرير النهائي" : "Final report",
  };
  const careerProfileStudentItem = {
    href: "/career-profile",
    icon: Briefcase,
    label: locale === "ar" ? "الملف المهني" : "Career profile",
  };
  const partnershipsAdminItem = {
    href: "/admin/partnerships",
    icon: Briefcase,
    label: locale === "ar" ? "التدريب والشراكات" : "Training & partnerships",
  };
  const partnershipsApplicationsAdminItem = {
    href: "/admin/partnerships/applications",
    icon: ScrollText,
    label: locale === "ar" ? "طلبات التدريب" : "Training applications",
  };
  const partnershipsMessagesAdminItem = {
    href: "/admin/partnerships/messages",
    icon: Mail,
    label: locale === "ar" ? "رسائل الشراكات" : "Partnership messages",
  };
  const partnershipsFinalReportsAdminItem = {
    href: "/admin/partnerships/final-reports",
    icon: FileSpreadsheet,
    label: locale === "ar" ? "تقارير التدريب" : "Training reports",
  };
  const partnershipsTrainingAchievementsAdminItem = {
    href: "/admin/partnerships/training-achievements",
    icon: Award,
    label: locale === "ar" ? "إنجازات التدريب" : "Training achievements",
  };
  const partnershipsSettingsAdminItem = {
    href: "/admin/partnerships/settings",
    icon: SlidersHorizontal,
    label: locale === "ar" ? "إعدادات الشراكات" : "Partnership settings",
  };
  const partnershipsAuditAdminItem = {
    href: "/admin/partnerships/audit",
    icon: FileBarChart,
    label: locale === "ar" ? "تدقيق الشراكات" : "Partnership audit",
  };
  const partnershipsIntelligenceAdminItem = {
    href: "/admin/partnerships/intelligence",
    icon: BarChart3,
    label: locale === "ar" ? "ذكاء جودة الشراكات" : "Partnership intelligence",
  };
  const letterRequestsAdminItem = {
    href: "/admin/letter-requests",
    icon: ScrollText,
    label: locale === "ar" ? "طلبات الخطابات" : "Letter requests",
  };
  const alumniExecutiveHomeItem = {
    href: "/admin/alumni",
    icon: LayoutDashboard,
    label: locale === "ar" ? "لوحة مجتمع الخريجين" : "Alumni executive",
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
  const alumniReportsAdminItem = {
    href: "/admin/alumni/reports",
    icon: FileSpreadsheet,
    label: locale === "ar" ? "تقارير الخريجين" : "Alumni reports",
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
  const alumniCommunityFeedStaffItem = {
    href: "/admin/alumni/community-feed",
    icon: LayoutGrid,
    label: locale === "ar" ? "تغذية المجتمع" : "Community feed",
    capability: "alumniAnalytics" as const satisfies RoleCapabilityKey,
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
  const alumniCommunityFeedStudentItem = {
    href: "/alumni/community",
    icon: LayoutGrid,
    label: locale === "ar" ? "مجتمع الخريجين" : "Community feed",
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
  const participationAnalyticsItem = {
    href: "/admin/reports/achievement-participation",
    icon: BarChart3,
    label: locale === "ar" ? "إحصائيات المشاركات والإنجازات" : "Participation & achievements analytics",
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
  const careerAnalyticsAdminItem = {
    href: "/admin/career/analytics",
    icon: Briefcase,
    label: locale === "ar" ? "جاهزية مهنية وجامعية" : "Career readiness analytics",
  };
  const executiveIntelligenceAdminItem = {
    href: "/admin/executive-intelligence",
    icon: LineChart,
    label: locale === "ar" ? "الذكاء التنفيذي" : "Executive intelligence",
  };
  const schoolIntelligenceAdminItem = {
    href: "/admin/school-intelligence",
    icon: GraduationCap,
    label: locale === "ar" ? "الذكاء المدرسي" : "School intelligence",
  };
  const schoolImprovementAdminItem = {
    href: "/admin/school-improvement-intelligence",
    icon: ClipboardList,
    label: locale === "ar" ? "تحسين مدرسي وإجراءات" : "School improvement & actions",
  };
  const systemHealthAdminItem = {
    href: "/admin/system-health",
    icon: Activity,
    label: locale === "ar" ? "صحة النظام والاعتماد" : "System health & certification",
  };
  const backupRestoreAdminItem = {
    href: "/admin/system/backup",
    icon: Archive,
    label: locale === "ar" ? "النسخ الاحتياطي والاستعادة" : "Backup & restore",
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
  const academicYearsAdminItem = {
    href: "/admin/academic-years",
    icon: CalendarDays,
    label: locale === "ar" ? "الأعوام الدراسية" : "Academic years",
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
  const institutionProfileItem = {
    href: "/institution/profile",
    icon: User,
    label: locale === "ar" ? "ملف المؤسسة" : "Institution profile",
  };
  const institutionSettingsItem = {
    href: "/institution/settings",
    icon: Settings,
    label: locale === "ar" ? "إعدادات المؤسسة" : "Institution settings",
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
    { ...participationAnalyticsItem, capability: "reports" },
    { ...leaderboardItem, capability: "reviewAchievements" },
    { ...homeHighlightsItem, capability: "homeHighlights" },
    { ...academicYearsAdminItem, capability: "academicYearsRead" },
    { ...homeCeremonySettingsItem, capability: "platformSettings" },
    { ...analyticsItem, capability: "advancedAnalytics" },
    { ...careerAnalyticsAdminItem, capability: "advancedAnalytics" },
    { ...executiveIntelligenceAdminItem, capability: "advancedAnalytics" },
    { ...schoolIntelligenceAdminItem, capability: "advancedAnalytics" },
    { ...schoolImprovementAdminItem, capability: "advancedAnalytics" },
    { ...systemHealthAdminItem, capability: "platformSettings" },
    { ...backupRestoreAdminItem, capability: "platformSettings" },
    { ...hallOfFameItem, capability: "viewAchievements" },
    { ...achievementsItem, capability: "viewAchievements" },
    { ...notificationsItem, capability: null },
    { ...profileItem, capability: null },
    { ...aiNewsItem, capability: "aiNews" },
    { ...contactMessagesItem, capability: "contactMessages" },
    { ...letterRequestsAdminItem, capability: "letterRequests" },
    { ...partnershipsAdminItem, capability: "partnershipsManagement" },
    { ...partnershipsApplicationsAdminItem, capability: "partnershipsManagement" },
    { ...partnershipsMessagesAdminItem, capability: "partnershipsManagement" },
    { ...partnershipsFinalReportsAdminItem, capability: "partnershipsManagement" },
    { ...partnershipsTrainingAchievementsAdminItem, capability: "partnershipsManagement" },
    { ...partnershipsSettingsAdminItem, capability: "partnershipsManagement" },
    { ...partnershipsAuditAdminItem, capability: "partnershipsManagement" },
    { ...partnershipsIntelligenceAdminItem, capability: "partnershipsManagement" },
    { ...alumniOnboardingAdminItem, capability: "alumniVerification" },
    { ...alumniVerificationCenterItem, capability: "alumniVerification" },
    { ...alumniStoriesAdminItem, capability: "alumniModeration" },
    { ...alumniMemoriesAdminItem, capability: "alumniModeration" },
    { ...alumniOpportunitiesAdminItem, capability: "alumniModeration" },
    { ...alumniOpportunityReviewAdminItem, capability: "alumniModeration" },
    { ...alumniAnnouncementsAdminItem, capability: "alumniManagement" },
    { ...alumniCohortsAdminItem, capability: "alumniManagement" },
    { ...alumniAnalyticsAdminItem, capability: "alumniAnalytics" },
    { ...alumniReportsAdminItem, capability: "alumniReports" },
    { ...alumniCampaignsAdminItem, capability: "alumniManagement" },
    { ...alumniCrmAdminItem, capability: "alumniNetworking" },
    { ...alumniPlatformHealthAdminItem, capability: "alumniAnalytics" },
    { ...alumniEventsAdminItem, capability: "alumniManagement" },
    { ...alumniInboxAdminItem, capability: "alumniManagement" },
    { ...alumniCommunityFeedStaffItem, capability: "alumniAnalytics" },
    { ...auditLogItem, capability: "auditLog" },
    { ...adminSettingsItem, capability: "platformSettings" },
    { ...scoringSettingsItem, capability: "platformSettings" },
    { ...socialIntegrationsItem, capability: "socialIntegrations" },
    { ...accessMatrixItem, capability: "accessMatrix" },
    { ...settingsItem, capability: null },
  ];

  const showAcademicAdvisorNav =
    !isStaffNav &&
    (profile?.role === "student" || profile?.accountType === "alumni") &&
    isEligibleForAcademicAdvisor({
      accountType: profile?.accountType,
      grade: profile?.grade,
      role: profile?.role,
    });

  const showAlumniCommunityNav =
    !isStaffNav &&
    canAccessAlumniCommunity({
      accountType: profile?.accountType,
      grade: profile?.grade,
      role: profile?.role,
      alumniCommunityRemovedAt: profile?.alumniCommunityRemovedAt,
      alumniPermanentlyPurgedAt: profile?.alumniPermanentlyPurgedAt,
    });

  const isAlumniAccount = profile?.accountType === "alumni";

  const alumniCommunityDiscoverAdminItem = {
    href: "/search",
    icon: Search,
    label: locale === "ar" ? "استكشاف المجتمع" : "Community discovery",
    capability: "alumniNetworking" as const satisfies RoleCapabilityKey,
  };

  const alumniAdminNavCandidates: Array<{
    href: string;
    icon: LucideIcon;
    label: string;
    capability: RoleCapabilityKey | null;
    badgeCount?: number;
  }> = [
    { ...alumniExecutiveHomeItem, capability: "alumniManagement" },
    { ...alumniCommunityDiscoverAdminItem, capability: "alumniNetworking" },
    ...staffNavCandidates.filter((row) => row.href.startsWith("/admin/alumni")),
    { ...notificationsItem, capability: null },
    { ...profileItem, capability: null },
    { ...settingsItem, capability: null },
  ];

  const institutionTrainingPortalItem = {
    href: "/institution/training",
    icon: Building2,
    label: locale === "ar" ? "بوابة المؤسسة التدريبية" : "Institution training portal",
  };

  const institutionMessagesItem = {
    href: "/institution/training/messages",
    icon: Mail,
    label: locale === "ar" ? "رسائل المؤسسة" : "Institution messages",
  };

  const partnershipSupervisorNavCandidates: Array<{
    href: string;
    icon: LucideIcon;
    label: string;
    capability: RoleCapabilityKey | null;
    badgeCount?: number;
  }> = [
    { ...partnershipsAdminItem, capability: "partnershipsManagement" },
    { ...partnershipsApplicationsAdminItem, capability: "partnershipsManagement" },
    { ...partnershipsMessagesAdminItem, capability: "partnershipsManagement" },
    { ...partnershipsFinalReportsAdminItem, capability: "partnershipsManagement" },
    { ...partnershipsTrainingAchievementsAdminItem, capability: "partnershipsManagement" },
    { ...partnershipsSettingsAdminItem, capability: "partnershipsManagement" },
    { ...partnershipsAuditAdminItem, capability: "partnershipsManagement" },
    { ...academicYearsAdminItem, capability: "academicYearsRead" },
    { ...notificationsItem, capability: null },
    { ...profileItem, capability: null },
    { ...settingsItem, capability: null },
  ];

  const trainingInstitutionNavCandidates: Array<{
    href: string;
    icon: LucideIcon;
    label: string;
    capability: RoleCapabilityKey | null;
    badgeCount?: number;
  }> = [
    { ...institutionTrainingPortalItem, capability: null },
    { ...institutionMessagesItem, capability: null },
    { ...notificationsItem, capability: null },
    { ...institutionProfileItem, capability: null },
    { ...institutionSettingsItem, capability: null },
  ];

  const navItems = isAlumniAdminOnly
    ? alumniAdminNavCandidates
        .filter((row) => row.capability === null || can(row.capability))
        .map(({ capability: _omit, ...rest }) => rest)
    : isTrainingInstitutionOnly
    ? trainingInstitutionNavCandidates.map(({ capability: _omit, ...rest }) => rest)
    : isPartnershipSupervisorOnly
    ? partnershipSupervisorNavCandidates
        .filter((row) => row.capability === null || can(row.capability))
        .map(({ capability: _omit, ...rest }) => rest)
    : isStaffNav
    ? staffNavCandidates
        .filter((row) => row.capability === null || can(row.capability))
        .map(({ capability: _omit, ...rest }) => rest)
    : [
        ...(isAlumniAccount
          ? [alumniDashboardNavItem, alumniInboxNavItem, alumniMentorshipNavItem, alumniMemoriesNavItem]
          : [studentDashboardItem]),
        ...(showAcademicAdvisorNav ? [alumniAssistantNavItem] : []),
        ...(!isAlumniAccount ? [hallOfFameItem] : []),
        ...(showAlumniCommunityNav ? [alumniDiscoverySearchItem, alumniCommunityFeedStudentItem] : []),
        ...(!isAlumniAccount
          ? [
              achievementsItem,
              letterRequestsStudentItem,
              summerTrainingStudentItem,
              summerTrainingMessagesStudentItem,
              summerTrainingFinalReportStudentItem,
              careerProfileStudentItem,
              addAchievementItem,
            ]
          : []),
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
    if (href === "/admin/reports/achievement-participation") {
      return pathname?.startsWith("/admin/reports/achievement-participation");
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
    if (href === "/admin/career/analytics") {
      return pathname === "/admin/career/analytics" || pathname?.startsWith("/admin/career/analytics/");
    }
    if (href === "/admin/executive-intelligence") {
      return pathname === "/admin/executive-intelligence" || pathname?.startsWith("/admin/executive-intelligence/");
    }
    if (href === "/admin/school-intelligence") {
      return pathname === "/admin/school-intelligence" || pathname?.startsWith("/admin/school-intelligence/");
    }
    if (href === "/admin/school-improvement-intelligence") {
      return (
        pathname === "/admin/school-improvement-intelligence" ||
        pathname?.startsWith("/admin/school-improvement-intelligence/")
      );
    }
    if (href === "/admin/system-health") {
      return pathname === "/admin/system-health" || pathname?.startsWith("/admin/system-health/");
    }
    if (href === "/career-profile") {
      return pathname === "/career-profile" || pathname?.startsWith("/career-profile/");
    }
    if (href === "/admin/ai/news") {
      return pathname === "/admin/ai/news" || pathname?.startsWith("/admin/ai/");
    }
    if (href === "/admin/audit-log") {
      return pathname === "/admin/audit-log";
    }
    if (href === "/admin/academic-years") {
      return pathname === "/admin/academic-years" || pathname?.startsWith("/admin/academic-years/");
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
    if (href === "/admin/partnerships/applications") {
      return (
        pathname === "/admin/partnerships/applications" ||
        pathname?.startsWith("/admin/partnerships/applications/")
      );
    }
    if (href === "/admin/partnerships") {
      return (
        pathname === "/admin/partnerships" ||
        (pathname?.startsWith("/admin/partnerships/") &&
          !pathname?.startsWith("/admin/partnerships/applications") &&
          !pathname?.startsWith("/admin/partnerships/messages") &&
          !pathname?.startsWith("/admin/partnerships/final-reports") &&
          !pathname?.startsWith("/admin/partnerships/training-achievements") &&
          !pathname?.startsWith("/admin/partnerships/settings") &&
          !pathname?.startsWith("/admin/partnerships/audit") &&
          !pathname?.startsWith("/admin/partnerships/intelligence"))
      );
    }
    if (href === "/summer-training/messages") {
      return pathname === "/summer-training/messages" || pathname?.startsWith("/summer-training/messages/");
    }
    if (href === "/summer-training/final-report") {
      return pathname === "/summer-training/final-report" || pathname?.startsWith("/summer-training/final-report/");
    }
    if (href === "/summer-training") {
      return (
        (pathname === "/summer-training" || pathname?.startsWith("/summer-training/")) &&
        !pathname?.startsWith("/summer-training/messages") &&
        !pathname?.startsWith("/summer-training/final-report")
      );
    }
    if (href === "/institution/training") {
      return (
        pathname === "/institution/training" ||
        (pathname?.startsWith("/institution/training/") &&
          !pathname?.startsWith("/institution/training/messages"))
      );
    }
    if (href === "/institution/profile") {
      return pathname === "/institution/profile";
    }
    if (href === "/institution/settings") {
      return pathname === "/institution/settings";
    }
    if (href === "/admin/partnerships/messages") {
      return pathname === "/admin/partnerships/messages" || pathname?.startsWith("/admin/partnerships/messages/");
    }
    if (href === "/admin/partnerships/final-reports") {
      return (
        pathname === "/admin/partnerships/final-reports" ||
        pathname?.startsWith("/admin/partnerships/final-reports/")
      );
    }
    if (href === "/admin/partnerships/training-achievements") {
      return (
        pathname === "/admin/partnerships/training-achievements" ||
        pathname?.startsWith("/admin/partnerships/training-achievements/")
      );
    }
    if (href === "/admin/partnerships/settings") {
      return pathname === "/admin/partnerships/settings" || pathname?.startsWith("/admin/partnerships/settings/");
    }
    if (href === "/admin/partnerships/audit") {
      return pathname === "/admin/partnerships/audit" || pathname?.startsWith("/admin/partnerships/audit/");
    }
    if (href === "/admin/partnerships/intelligence") {
      return (
        pathname === "/admin/partnerships/intelligence" ||
        pathname?.startsWith("/admin/partnerships/intelligence/")
      );
    }
    if (href === "/alumni/community") {
      return pathname === "/alumni/community" || pathname?.startsWith("/alumni/community/");
    }
    if (href === "/admin/alumni/community-feed") {
      return pathname === "/admin/alumni/community-feed" || pathname?.startsWith("/admin/alumni/community-feed/");
    }
    if (href === "/admin/alumni") {
      return pathname === "/admin/alumni" || pathname === "/admin/alumni/";
    }
    if (href === "/admin/alumni/onboarding-requests") {
      return pathname === "/admin/alumni/onboarding-requests" || pathname?.startsWith("/admin/alumni/onboarding-requests/");
    }
    if (href === "/admin/alumni/verification-center") {
      return pathname === "/admin/alumni/verification-center" || pathname?.startsWith("/admin/alumni/verification-center/");
    }
    if (href === "/admin/alumni/memories") {
      return pathname === "/admin/alumni/memories" || pathname?.startsWith("/admin/alumni/memories/");
    }
    if (href === "/admin/alumni/stories") {
      return pathname === "/admin/alumni/stories" || pathname?.startsWith("/admin/alumni/stories/");
    }
    if (href === "/admin/alumni/opportunities/review") {
      return pathname === "/admin/alumni/opportunities/review" || pathname?.startsWith("/admin/alumni/opportunities/review/");
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
    if (href === "/admin/alumni/reports") {
      return pathname === "/admin/alumni/reports" || pathname?.startsWith("/admin/alumni/reports/");
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
              {isAlumniAdminOnly
                ? locale === "ar"
                  ? "إدارة الخريجين"
                  : "Alumni administration"
                : isAlumniAccount
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
