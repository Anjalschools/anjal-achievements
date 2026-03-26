export const PERMISSIONS = {
  dashboardView: "dashboard.view",
  achievementsView: "achievements.view",
  achievementsCreate: "achievements.create",
  achievementsCreateAdmin: "achievements.create.admin",
  achievementsReview: "achievements.review",
  achievementsApprove: "achievements.approve",
  achievementsRequestRevision: "achievements.request_revision",
  achievementsReject: "achievements.reject",
  achievementsFeature: "achievements.feature",
  reportsView: "reports.view",
  analyticsView: "analytics.view",
  usersManage: "users.manage",
  auditLogView: "audit.view",
  settingsManage: "settings.manage",
  aiNewsCreate: "ai.news.create",
  contactMessagesManage: "contact.messages.manage",
  accessMatrixView: "access.matrix.view",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: PermissionKey[] = Object.values(PERMISSIONS);

export const PERMISSION_LABELS: Record<PermissionKey, { ar: string; en: string }> = {
  [PERMISSIONS.dashboardView]: { ar: "عرض لوحة التحكم", en: "View dashboard" },
  [PERMISSIONS.achievementsView]: { ar: "عرض الإنجازات", en: "View achievements" },
  [PERMISSIONS.achievementsCreate]: { ar: "إضافة إنجاز", en: "Create achievement" },
  [PERMISSIONS.achievementsCreateAdmin]: { ar: "إضافة إنجاز إداري", en: "Create admin achievement" },
  [PERMISSIONS.achievementsReview]: { ar: "مراجعة الإنجازات", en: "Review achievements" },
  [PERMISSIONS.achievementsApprove]: { ar: "اعتماد الإنجازات", en: "Approve achievements" },
  [PERMISSIONS.achievementsRequestRevision]: { ar: "طلب تعديل", en: "Request revision" },
  [PERMISSIONS.achievementsReject]: { ar: "رفض الإنجازات", en: "Reject achievements" },
  [PERMISSIONS.achievementsFeature]: { ar: "تمييز الإنجاز", en: "Feature achievements" },
  [PERMISSIONS.reportsView]: { ar: "عرض التقارير", en: "View reports" },
  [PERMISSIONS.analyticsView]: { ar: "عرض التحليلات", en: "View analytics" },
  [PERMISSIONS.usersManage]: { ar: "إدارة المستخدمين", en: "Manage users" },
  [PERMISSIONS.auditLogView]: { ar: "عرض سجل العمليات", en: "View audit log" },
  [PERMISSIONS.settingsManage]: { ar: "إدارة إعدادات المنصة", en: "Manage settings" },
  [PERMISSIONS.aiNewsCreate]: { ar: "إنشاء خبر بالذكاء الاصطناعي", en: "Create AI news" },
  [PERMISSIONS.contactMessagesManage]: { ar: "إدارة رسائل التواصل", en: "Manage contact messages" },
  [PERMISSIONS.accessMatrixView]: { ar: "عرض مصفوفة الصلاحيات", en: "View access matrix" },
};

