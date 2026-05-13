/**
 * Single source of truth: role → capabilities + route access (Anjal platform).
 * Client-safe: no server-only imports.
 */

export type AppRole =
  | "student"
  | "admin"
  | "supervisor"
  | "schoolAdmin"
  | "teacher"
  | "judge"
  | "alumniAdmin";

/** Fine-grained capabilities for APIs + UI. */
export type RoleCapabilityKey =
  | "staffArea"
  | "viewAchievements"
  | "addAchievementAsStudent"
  | "adminAddAchievement"
  | "reviewAchievements"
  | "approveRejectWorkflow"
  | "featureAchievements"
  | "userManagement"
  | "reports"
  | "advancedAnalytics"
  | "auditLog"
  | "platformSettings"
  | "socialIntegrations"
  | "aiNews"
  | "schoolYearsAdmin"
  | "newsAdmin"
  | "accessMatrix"
  | "contactMessages"
  | "homeHighlights"
  | "letterRequests"
  | "alumniStaffArea"
  | "alumniManagement"
  | "alumniReports"
  | "alumniModeration"
  | "alumniVerification"
  | "alumniAnalytics"
  | "alumniNetworking";

export type ScopeMode = "none" | "full" | "scoped";

export type RoleDefinition = {
  labelAr: string;
  labelEn: string;
  /** Data restriction for achievements / reports */
  scopeMode: ScopeMode;
  capabilities: Record<RoleCapabilityKey, boolean>;
};

const deny: Record<RoleCapabilityKey, boolean> = {
  staffArea: false,
  viewAchievements: false,
  addAchievementAsStudent: false,
  adminAddAchievement: false,
  reviewAchievements: false,
  approveRejectWorkflow: false,
  featureAchievements: false,
  userManagement: false,
  reports: false,
  advancedAnalytics: false,
  auditLog: false,
  platformSettings: false,
  socialIntegrations: false,
  aiNews: false,
  schoolYearsAdmin: false,
  newsAdmin: false,
  accessMatrix: false,
  contactMessages: false,
  homeHighlights: false,
  letterRequests: false,
  alumniStaffArea: false,
  alumniManagement: false,
  alumniReports: false,
  alumniModeration: false,
  alumniVerification: false,
  alumniAnalytics: false,
  alumniNetworking: false,
};

const allStaffCaps: Record<RoleCapabilityKey, boolean> = {
  ...deny,
  staffArea: true,
  viewAchievements: true,
  addAchievementAsStudent: true,
  adminAddAchievement: true,
  reviewAchievements: true,
  approveRejectWorkflow: true,
  featureAchievements: true,
  userManagement: true,
  reports: true,
  advancedAnalytics: true,
  auditLog: true,
  platformSettings: true,
  socialIntegrations: true,
  aiNews: true,
  schoolYearsAdmin: true,
  newsAdmin: true,
  accessMatrix: true,
  contactMessages: true,
  homeHighlights: true,
  letterRequests: true,
  alumniStaffArea: true,
  alumniManagement: true,
  alumniReports: true,
  alumniModeration: true,
  alumniVerification: true,
  alumniAnalytics: true,
  alumniNetworking: true,
};

const alumniPlatformAdminCaps: Record<RoleCapabilityKey, boolean> = {
  ...deny,
  alumniStaffArea: true,
  alumniManagement: true,
  alumniReports: true,
  alumniModeration: true,
  alumniVerification: true,
  alumniAnalytics: true,
  alumniNetworking: true,
};

export const APP_ROLE_MATRIX: Record<AppRole, RoleDefinition> = {
  student: {
    labelAr: "طالب",
    labelEn: "Student",
    scopeMode: "none",
    capabilities: {
      ...deny,
      viewAchievements: true,
      addAchievementAsStudent: true,
    },
  },
  admin: {
    labelAr: "مسؤول المنصة",
    labelEn: "Platform admin",
    scopeMode: "full",
    capabilities: allStaffCaps,
  },
  supervisor: {
    labelAr: "مشرف",
    labelEn: "Supervisor",
    scopeMode: "scoped",
    capabilities: {
      ...deny,
      staffArea: true,
      viewAchievements: true,
      addAchievementAsStudent: true,
      adminAddAchievement: true,
      reviewAchievements: true,
      approveRejectWorkflow: true,
      featureAchievements: false,
      userManagement: false,
      reports: true,
      advancedAnalytics: false,
      auditLog: false,
      platformSettings: false,
      socialIntegrations: false,
      aiNews: false,
      schoolYearsAdmin: false,
      newsAdmin: false,
      accessMatrix: false,
      contactMessages: true,
      homeHighlights: false,
      letterRequests: true,
    },
  },
  schoolAdmin: {
    labelAr: "مدير المدرسة",
    labelEn: "School admin",
    scopeMode: "scoped",
    capabilities: {
      ...deny,
      staffArea: true,
      viewAchievements: true,
      addAchievementAsStudent: true,
      adminAddAchievement: true,
      reviewAchievements: true,
      approveRejectWorkflow: true,
      featureAchievements: true,
      userManagement: false,
      reports: true,
      advancedAnalytics: true,
      auditLog: false,
      platformSettings: false,
      socialIntegrations: false,
      aiNews: false,
      schoolYearsAdmin: false,
      newsAdmin: false,
      accessMatrix: false,
      contactMessages: true,
      homeHighlights: false,
    },
  },
  teacher: {
    labelAr: "رائد النشاط",
    labelEn: "Activity lead (teacher)",
    scopeMode: "scoped",
    capabilities: {
      ...deny,
      staffArea: true,
      viewAchievements: true,
      addAchievementAsStudent: true,
      adminAddAchievement: true,
      reviewAchievements: true,
      approveRejectWorkflow: true,
      featureAchievements: false,
      userManagement: false,
      reports: true,
      advancedAnalytics: false,
      auditLog: false,
      platformSettings: false,
      socialIntegrations: false,
      aiNews: false,
      schoolYearsAdmin: false,
      newsAdmin: false,
      accessMatrix: false,
      contactMessages: true,
      homeHighlights: false,
      letterRequests: false,
    },
  },
  judge: {
    labelAr: "محكم",
    labelEn: "Judge",
    scopeMode: "scoped",
    capabilities: {
      ...deny,
      staffArea: true,
      viewAchievements: true,
      addAchievementAsStudent: true,
      adminAddAchievement: false,
      reviewAchievements: true,
      approveRejectWorkflow: true,
      featureAchievements: false,
      userManagement: false,
      reports: false,
      advancedAnalytics: false,
      auditLog: false,
      platformSettings: false,
      socialIntegrations: false,
      aiNews: false,
      schoolYearsAdmin: false,
      newsAdmin: false,
      accessMatrix: false,
      contactMessages: false,
      homeHighlights: false,
    },
  },
  alumniAdmin: {
    labelAr: "مسؤول منصة الخريجين",
    labelEn: "Alumni platform admin",
    scopeMode: "none",
    capabilities: alumniPlatformAdminCaps,
  },
};

export const normalizeAppRole = (role: string | null | undefined): AppRole | null => {
  const r = String(role || "").trim() as AppRole;
  return r in APP_ROLE_MATRIX ? r : null;
};

export const getRoleDefinition = (role: string | null | undefined): RoleDefinition | null => {
  const n = normalizeAppRole(role);
  return n ? APP_ROLE_MATRIX[n] : null;
};

export const roleHasCapability = (
  role: string | null | undefined,
  key: RoleCapabilityKey
): boolean => {
  const def = getRoleDefinition(role);
  if (!def) return false;
  return def.capabilities[key] === true;
};

/** UI labels for capability audit (no raw keys shown to end users). */
export const ROLE_CAPABILITY_LABELS: Record<RoleCapabilityKey, { ar: string; en: string }> = {
  staffArea: { ar: "لوحة الإدارة والوصول", en: "Admin area access" },
  viewAchievements: { ar: "عرض الإنجازات", en: "View achievements" },
  addAchievementAsStudent: { ar: "إضافة إنجاز (كطالب)", en: "Add achievement (as student)" },
  adminAddAchievement: { ar: "إضافة إنجاز إداري", en: "Add achievement (admin)" },
  reviewAchievements: { ar: "مراجعة الإنجازات", en: "Review achievements" },
  approveRejectWorkflow: { ar: "اعتماد / رفض / طلب تعديل", en: "Approve / reject / request revision" },
  featureAchievements: { ar: "تمييز الإنجاز", en: "Feature achievements" },
  userManagement: { ar: "إدارة المستخدمين", en: "User management" },
  reports: { ar: "التقارير", en: "Reports" },
  advancedAnalytics: { ar: "الإحصاءات المتقدمة", en: "Advanced analytics" },
  auditLog: { ar: "سجل العمليات", en: "Audit log" },
  platformSettings: { ar: "إعدادات المنصة", en: "Platform settings" },
  socialIntegrations: { ar: "التكاملات الاجتماعية", en: "Social integrations" },
  aiNews: { ar: "إنشاء خبر بالذكاء الاصطناعي", en: "AI news authoring" },
  schoolYearsAdmin: { ar: "إدارة السنوات الدراسية", en: "School years admin" },
  newsAdmin: { ar: "إدارة الأخبار", en: "News admin" },
  accessMatrix: { ar: "مصفوفة الصلاحيات (داخلية)", en: "Access matrix (internal)" },
  contactMessages: { ar: "رسائل التواصل", en: "Contact messages" },
  homeHighlights: { ar: "إبرازات الصفحة الرئيسية", en: "Home page highlights" },
  letterRequests: { ar: "طلبات الإفادة وخطاب التوصية", en: "Testimonials & recommendation letters" },
  alumniStaffArea: { ar: "لوحة إدارة الخريجين", en: "Alumni admin area" },
  alumniManagement: { ar: "إدارة مجتمع الخريجين", en: "Alumni community management" },
  alumniReports: { ar: "تقارير الخريجين", en: "Alumni reports" },
  alumniModeration: { ar: "مراجعة المحتوى (قصص/ذكريات/فرص)", en: "Alumni content moderation" },
  alumniVerification: { ar: "توثيق الخريجين والطلبات", en: "Alumni verification" },
  alumniAnalytics: { ar: "تحليلات الخريجين", en: "Alumni analytics" },
  alumniNetworking: { ar: "الشبكة المهنية وCRM", en: "Alumni networking & CRM" },
};

export const ROLE_CAPABILITY_AUDIT_ORDER: RoleCapabilityKey[] = [
  "staffArea",
  "viewAchievements",
  "addAchievementAsStudent",
  "adminAddAchievement",
  "reviewAchievements",
  "approveRejectWorkflow",
  "featureAchievements",
  "userManagement",
  "reports",
  "advancedAnalytics",
  "auditLog",
  "platformSettings",
  "socialIntegrations",
  "aiNews",
  "schoolYearsAdmin",
  "newsAdmin",
  "accessMatrix",
  "contactMessages",
  "homeHighlights",
  "letterRequests",
  "alumniStaffArea",
  "alumniManagement",
  "alumniReports",
  "alumniModeration",
  "alumniVerification",
  "alumniAnalytics",
  "alumniNetworking",
];

/** Route prefixes under /admin — must stay in sync with AppSidebar + API guards */
export const ADMIN_ROUTE_REQUIRED_CAPABILITY: Array<{
  prefix: string;
  capability: RoleCapabilityKey;
}> = [
  { prefix: "/admin/users", capability: "userManagement" },
  { prefix: "/admin/settings/social-integrations", capability: "socialIntegrations" },
  { prefix: "/admin/scoring", capability: "platformSettings" },
  { prefix: "/admin/settings", capability: "platformSettings" },
  { prefix: "/admin/audit-log", capability: "auditLog" },
  { prefix: "/admin/access-matrix", capability: "accessMatrix" },
  { prefix: "/admin/ai/news", capability: "aiNews" },
  { prefix: "/admin/analytics", capability: "advancedAnalytics" },
  { prefix: "/admin/achievements/add", capability: "adminAddAchievement" },
  { prefix: "/admin/reports", capability: "reports" },
  { prefix: "/admin/achievements/reports", capability: "reports" },
  { prefix: "/admin/leaderboard", capability: "reviewAchievements" },
  { prefix: "/admin/achievements/review", capability: "reviewAchievements" },
  { prefix: "/admin/school-years", capability: "schoolYearsAdmin" },
  { prefix: "/admin/home-highlights", capability: "homeHighlights" },
  { prefix: "/admin/contact-messages", capability: "contactMessages" },
  { prefix: "/admin/letter-requests", capability: "letterRequests" },
  { prefix: "/admin/alumni/verification-center", capability: "alumniVerification" },
  { prefix: "/admin/alumni/onboarding-requests", capability: "alumniVerification" },
  { prefix: "/admin/alumni/verification-requests", capability: "alumniVerification" },
  { prefix: "/admin/alumni/verification", capability: "alumniVerification" },
  { prefix: "/admin/alumni/opportunities/review", capability: "alumniModeration" },
  { prefix: "/admin/alumni/memories", capability: "alumniModeration" },
  { prefix: "/admin/alumni/memory-submissions", capability: "alumniModeration" },
  { prefix: "/admin/alumni/stories", capability: "alumniModeration" },
  { prefix: "/admin/alumni/opportunities", capability: "alumniModeration" },
  { prefix: "/admin/alumni/reports", capability: "alumniReports" },
  { prefix: "/admin/alumni/analytics", capability: "alumniAnalytics" },
  { prefix: "/admin/alumni/platform-health", capability: "alumniAnalytics" },
  { prefix: "/admin/alumni/monitoring", capability: "alumniAnalytics" },
  { prefix: "/admin/alumni/reputation", capability: "alumniAnalytics" },
  { prefix: "/admin/alumni/community-feed", capability: "alumniAnalytics" },
  { prefix: "/admin/alumni/crm", capability: "alumniNetworking" },
  { prefix: "/admin/alumni", capability: "alumniManagement" },
  /** Any other /admin/* screen requires at least staff (prevents students from loading admin shell). */
  { prefix: "/admin", capability: "staffArea" },
];

export const getRequiredCapabilityForAdminPath = (pathname: string): RoleCapabilityKey | null => {
  const path = pathname.split("?")[0] || "";
  const sorted = [...ADMIN_ROUTE_REQUIRED_CAPABILITY].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const row of sorted) {
    if (path === row.prefix || path.startsWith(`${row.prefix}/`)) {
      return row.capability;
    }
  }
  return null;
};

export const canAccessAdminPath = (role: string | null | undefined, pathname: string): boolean => {
  const path = pathname.split("?")[0] || "";
  const r = String(role || "").trim().toLowerCase();
  const req = getRequiredCapabilityForAdminPath(pathname);
  if (!req) return true;
  if (roleHasCapability(role, req)) return true;
  /**
   * Backward compatibility: legacy staff used `userManagement` for all `/admin/alumni/*` tools.
   * Platform admin always passes via full capability set.
   */
  if (path.startsWith("/admin/alumni") && (r === "admin" || roleHasCapability(role, "userManagement"))) {
    return true;
  }
  return false;
};
