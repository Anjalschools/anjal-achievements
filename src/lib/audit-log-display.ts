/**
 * Human-facing audit log mapping — DB keeps raw actionType.
 * Arabic labels + descriptions for admin/supervisor UX.
 */

export type AuditCategory =
  | "achievements"
  | "news"
  | "publishing"
  | "users"
  | "settings"
  | "ai"
  | "certificates"
  | "profile"
  | "partnerships"
  | "system";

/** Filter tabs: الكل، الأخبار، الذكاء الاصطناعي، النشر، الإعدادات، المستخدمين */
export type AuditOperationFilter =
  | "all"
  | "news"
  | "ai"
  | "publishing"
  | "settings"
  | "users";

export type AuditDisplayStatus = "success" | "failure" | "blocked" | "partial" | "unknown";

type RowDef = {
  category: AuditCategory;
  /** Short Arabic label */
  ar: string;
  en: string;
  /** Longer Arabic description (fallback when row has no descriptionAr) */
  descAr?: string;
  descEn?: string;
};

const ROWS: Record<string, RowDef> = {
  ai_news_generated: {
    category: "ai",
    ar: "توليد مادة إعلامية بالذكاء الاصطناعي",
    en: "AI media draft generated",
    descAr: "تم إنشاء مسودة إعلامية آلياً",
    descEn: "A media draft was generated automatically",
  },
  news_post_created: {
    category: "news",
    ar: "إنشاء خبر",
    en: "News post created",
    descAr: "تم إنشاء مسودة خبر جديدة",
    descEn: "A new news draft was created",
  },
  news_post_updated: {
    category: "news",
    ar: "تعديل خبر",
    en: "News post updated",
    descAr: "تم تحديث بيانات الخبر",
    descEn: "News post fields were updated",
  },
  news_ai_generated: {
    category: "ai",
    ar: "توليد خبر بالذكاء الاصطناعي",
    en: "AI news content generated",
    descAr: "تم توليد محتوى الخبر باستخدام الذكاء الاصطناعي",
    descEn: "News body was generated using AI",
  },
  news_submitted_review: {
    category: "news",
    ar: "إرسال خبر للمراجعة",
    en: "News submitted for review",
    descAr: "أُرسل الخبر إلى مسار المراجعة",
    descEn: "The news item was submitted for review",
  },
  news_approved: {
    category: "news",
    ar: "اعتماد خبر",
    en: "News approved",
    descAr: "تم اعتماد الخبر للنشر",
    descEn: "The news item was approved for publishing",
  },
  news_published_website: {
    category: "publishing",
    ar: "تم نشر الخبر",
    en: "News published",
    descAr: "تم نشر الخبر على الموقع",
    descEn: "The news item was published on the website",
  },
  news_publish_platform: {
    category: "publishing",
    ar: "محاولة نشر على منصة",
    en: "Platform publish attempt",
    descAr: "محاولة نشر على منصة اجتماعية أو رسمية",
    descEn: "An attempt was made to publish to a platform",
  },
  news_publish_attempted: {
    category: "publishing",
    ar: "محاولة نشر خبر",
    en: "News publish attempted",
    descAr: "تمت محاولة نشر الخبر على المنصات المحددة",
    descEn: "A publish run was started for the selected targets",
  },
  news_publish_blocked: {
    category: "publishing",
    ar: "تم منع النشر بسبب التحقق",
    en: "Publish blocked",
    descAr: "تم إيقاف النشر بسبب نقص البيانات أو فشل التحقق",
    descEn: "Publishing was stopped due to missing data or validation failure",
  },
  news_publish_failed: {
    category: "publishing",
    ar: "فشل نشر الخبر",
    en: "News publish failed",
    descAr: "لم يكتمل النشر على إحدى المنصات",
    descEn: "Publishing did not complete on one or more platforms",
  },
  news_scheduled: {
    category: "news",
    ar: "جدولة نشر خبر",
    en: "News scheduled",
    descAr: "تمت جدولة وقت النشر",
    descEn: "A publish time was scheduled",
  },
  news_published: {
    category: "publishing",
    ar: "تم نشر الخبر",
    en: "News published",
    descAr: "اكتمل نشر الخبر",
    descEn: "The news item was published",
  },
  social_integration_connect: {
    category: "settings",
    ar: "ربط حساب اجتماعي",
    en: "Social account connected",
    descAr: "ربط تكامل مع منصة اجتماعية",
    descEn: "A social integration was connected",
  },
  social_integration_disconnect: {
    category: "settings",
    ar: "فصل حساب اجتماعي",
    en: "Social account disconnected",
    descAr: "إلغاء ربط منصة اجتماعية",
    descEn: "A social integration was disconnected",
  },
  social_integration_test: {
    category: "settings",
    ar: "اختبار تكامل اجتماعي",
    en: "Social integration test",
    descAr: "تشغيل اختبار للتكامل",
    descEn: "An integration connectivity test was run",
  },
  admin_settings_updated: {
    category: "settings",
    ar: "تم تحديث إعدادات المنصة",
    en: "Platform settings updated",
    descAr: "تغيير في إعدادات النظام أو المدرسة",
    descEn: "Platform or school settings were changed",
  },
  school_year_created: {
    category: "settings",
    ar: "إنشاء عام دراسي",
    en: "School year created",
    descAr: "إضافة سنة دراسية جديدة",
    descEn: "A new school year was added",
  },
  school_year_activated: {
    category: "settings",
    ar: "تفعيل عام دراسي",
    en: "School year activated",
    descAr: "تفعيل سنة دراسية كالعام الحالي",
    descEn: "A school year was set as active",
  },
  school_year_archived: {
    category: "settings",
    ar: "أرشفة عام دراسي",
    en: "School year archived",
    descAr: "أرشفة بيانات سنة دراسية",
    descEn: "A school year was archived",
  },
  achievement_created: {
    category: "achievements",
    ar: "إنشاء إنجاز",
    en: "Achievement created",
    descAr: "تسجيل إنجاز جديد في النظام",
    descEn: "A new achievement was recorded",
  },
  achievement_updated: {
    category: "achievements",
    ar: "تحديث إنجاز",
    en: "Achievement updated",
    descAr: "تعديل بيانات إنجاز",
    descEn: "Achievement data was updated",
  },
  achievement_visibility_updated: {
    category: "achievements",
    ar: "تحديث ظهور إنجاز",
    en: "Achievement visibility updated",
    descAr: "تغيير حالة الظهور أو القائمة",
    descEn: "Achievement visibility or listing was changed",
  },
  user_public_portfolio_updated: {
    category: "profile",
    ar: "تحديث الملف العام",
    en: "Public portfolio updated",
    descAr: "تعديل إعدادات الملف العام للمستخدم",
    descEn: "User public portfolio settings changed",
  },
  certificate_issued: {
    category: "certificates",
    ar: "إصدار شهادة",
    en: "Certificate issued",
    descAr: "إنشاء أو إصدار شهادة",
    descEn: "A certificate was issued",
  },
  partnership_created: {
    category: "partnerships",
    ar: "إنشاء مؤسسة شريكة",
    en: "Partner organization created",
    descAr: "تم إنشاء مؤسسة ضمن برنامج التدريب والشراكات",
    descEn: "A partner organization was created in the partnerships program",
  },
  training_opportunity_created: {
    category: "partnerships",
    ar: "إنشاء فرصة تدريبية",
    en: "Training opportunity created",
    descAr: "تم إنشاء فرصة تدريب صيفي جديدة",
    descEn: "A new summer training opportunity was created",
  },
  training_application_submitted: {
    category: "partnerships",
    ar: "تقديم طلب تدريب صيفي",
    en: "Training application submitted",
    descAr: "قدّم طالب طلباً على فرصة تدريب صيفي",
    descEn: "A student submitted a summer training application",
  },
  training_application_reviewed: {
    category: "partnerships",
    ar: "مراجعة طلب تدريب صيفي",
    en: "Training application reviewed",
    descAr: "تمت مراجعة طلب تدريب صيفي",
    descEn: "A summer training application was reviewed",
  },
  training_application_under_review: {
    category: "partnerships",
    ar: "نقل طلب تدريب للمراجعة",
    en: "Application moved to review",
    descAr: "تم نقل طلب التدريب إلى قيد المراجعة",
    descEn: "The training application was moved to under review",
  },
  training_interview_requested: {
    category: "partnerships",
    ar: "طلب مقابلة تدريب",
    en: "Training interview requested",
    descAr: "تم طلب مقابلة للطالب ضمن برنامج التدريب",
    descEn: "An interview was requested for the training applicant",
  },
  training_sent_to_institution: {
    category: "partnerships",
    ar: "إرسال ملف للمؤسسة",
    en: "Sent to partner institution",
    descAr: "تم إرسال ملف الطالب للمؤسسة الشريكة",
    descEn: "The student file was sent to the partner institution",
  },
  training_application_accepted: {
    category: "partnerships",
    ar: "اعتماد طلب تدريب",
    en: "Training application accepted",
    descAr: "تم اعتماد طلب التدريب الصيفي",
    descEn: "The summer training application was accepted",
  },
  training_application_rejected: {
    category: "partnerships",
    ar: "رفض طلب تدريب",
    en: "Training application rejected",
    descAr: "تم رفض طلب التدريب الصيفي",
    descEn: "The summer training application was rejected",
  },
  training_application_withdrawn: {
    category: "partnerships",
    ar: "انسحاب من طلب تدريب",
    en: "Training application withdrawn",
    descAr: "انسحب الطالب من طلب التدريب الصيفي",
    descEn: "A student withdrew their summer training application",
  },
  training_message_created: {
    category: "partnerships",
    ar: "رسالة تدريب صيفي",
    en: "Summer training message",
    descAr: "أنشأ طالب رسالة ضمن برنامج التدريب الصيفي",
    descEn: "A student created a message in the summer training program",
  },
  training_message_reply: {
    category: "partnerships",
    ar: "رد على رسالة تدريب",
    en: "Training message reply",
    descAr: "رد مشرف على رسالة التدريب الصيفي",
    descEn: "A supervisor replied to a summer training message",
  },
  training_student_request_update: {
    category: "partnerships",
    ar: "تحديث طلب تدريب من الطالب",
    en: "Student training request update",
    descAr: "حدّث الطالب بيانات طلب التدريب الصيفي",
    descEn: "A student updated their summer training application details",
  },
  partner_access_created: {
    category: "partnerships",
    ar: "إنشاء رابط بوابة مؤسسة",
    en: "Partner access link created",
    descAr: "تم إنشاء رابط وصول آمن للمؤسسة الشريكة",
    descEn: "A secure partner institution access link was created",
  },
  institution_review_submitted: {
    category: "partnerships",
    ar: "تقديم قرار المؤسسة",
    en: "Institution review submitted",
    descAr: "قدّمت المؤسسة الشريكة قرارها على طلب التدريب",
    descEn: "The partner institution submitted a review decision",
  },
  partnership_message_sent: {
    category: "partnerships",
    ar: "إرسال رسالة شراكات",
    en: "Partnership message sent",
    descAr: "تم إرسال رسالة ضمن برنامج التدريب والشراكات",
    descEn: "A message was sent in the partnerships program",
  },
  partnership_bulk_message_sent: {
    category: "partnerships",
    ar: "إرسال رسائل جماعية للشراكات",
    en: "Partnership bulk messages sent",
    descAr: "تم إرسال رسائل جماعية لمجموعة من طلاب التدريب",
    descEn: "Bulk partnership messages were sent to a student group",
  },
  training_report_submitted: {
    category: "partnerships",
    ar: "رفع تقرير تدريب نهائي",
    en: "Training final report submitted",
    descAr: "قدّم الطالب تقرير التدريب النهائي",
    descEn: "A student submitted the final training report",
  },
  training_report_approved: {
    category: "partnerships",
    ar: "اعتماد تقرير تدريب",
    en: "Training report approved",
    descAr: "تم اعتماد تقرير التدريب النهائي",
    descEn: "The final training report was approved",
  },
  training_report_rejected: {
    category: "partnerships",
    ar: "رفض تقرير تدريب",
    en: "Training report rejected",
    descAr: "تم رفض تقرير التدريب النهائي",
    descEn: "The final training report was rejected",
  },
  training_report_changes_requested: {
    category: "partnerships",
    ar: "طلب تعديل تقرير تدريب",
    en: "Training report changes requested",
    descAr: "طُلب من الطالب تعديل تقرير التدريب",
    descEn: "The student was asked to revise the training report",
  },
  training_attachment_uploaded: {
    category: "partnerships",
    ar: "رفع مرفق تدريب",
    en: "Training attachment uploaded",
    descAr: "تم رفع مرفق ضمن تقرير التدريب",
    descEn: "A training report attachment was uploaded",
  },
  training_achievement_created: {
    category: "partnerships",
    ar: "إنشاء إنجاز تدريب صيفي",
    en: "Summer training achievement created",
    descAr: "تم إنشاء إنجاز تدريب صيفي تلقائياً بعد اعتماد التقرير",
    descEn: "A summer training achievement was auto-created after report approval",
  },
  training_certificate_created: {
    category: "partnerships",
    ar: "إنشاء شهادة تدريب",
    en: "Training certificate created",
    descAr: "تم إصدار شهادة التدريب الصيفي تلقائياً",
    descEn: "A summer training certificate was auto-issued",
  },
  partnerships_settings_updated: {
    category: "partnerships",
    ar: "تحديث إعدادات الشراكات",
    en: "Partnership settings updated",
    descAr: "تم تحديث إعدادات برنامج التدريب والشراكات",
    descEn: "Partnership program settings were updated",
  },
  partnerships_bulk_status_change: {
    category: "partnerships",
    ar: "تغيير حالة جماعي",
    en: "Bulk status change",
    descAr: "تم تنفيذ عملية جماعية على طلبات التدريب",
    descEn: "A bulk operation was run on training applications",
  },
  partnerships_archive_executed: {
    category: "partnerships",
    ar: "أرشفة دورة تدريب",
    en: "Training cycle archived",
    descAr: "تم تجميد وأرشفة دورة التدريب الصيفي",
    descEn: "A summer training cycle was archived",
  },
  partnerships_integrity_scan: {
    category: "partnerships",
    ar: "فحص سلامة بيانات الشراكات",
    en: "Partnership integrity scan",
    descAr: "تم تشغيل فحص سلامة بيانات برنامج التدريب",
    descEn: "A partnership data integrity scan was executed",
  },
  partnerships_backup_snapshot: {
    category: "partnerships",
    ar: "تسجيل لقطة نسخ احتياطي",
    en: "Backup snapshot registered",
    descAr: "تم تسجيل علامة لقطة للنسخ الاحتياطي المستقبلي",
    descEn: "A backup snapshot marker was registered",
  },
  platform_certification_scan: {
    category: "system",
    ar: "فحص اعتماد المنصة",
    en: "Platform certification scan",
    descAr: "تم تشغيل فحص جاهزية المنصة المؤسسية",
    descEn: "An institutional platform readiness scan was executed",
  },
};

/** @deprecated Use auditActionLabel — kept for callers expecting AUDIT_EVENT_LABELS */
export const AUDIT_EVENT_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(ROWS).map(([k, v]) => [k, v.ar])
);

export const AUDIT_EVENT_DESCRIPTIONS: Record<string, string> = Object.fromEntries(
  Object.entries(ROWS).filter(([, v]) => v.descAr).map(([k, v]) => [k, v.descAr!])
);

export const auditActionCategory = (actionType: string): AuditCategory =>
  ROWS[actionType]?.category || "system";

export const auditActionLabel = (actionType: string, isAr: boolean): string => {
  const row = ROWS[actionType];
  if (row) return isAr ? row.ar : row.en;
  return actionType.replace(/_/g, " ");
};

export const auditActionDescription = (actionType: string, isAr: boolean): string | undefined => {
  const row = ROWS[actionType];
  if (!row) return undefined;
  if (isAr) return row.descAr;
  return row.descEn;
};

const USERS_ACTION_TYPES = ["user_public_portfolio_updated"];

export const isAuditCategory = (s: string): s is AuditCategory =>
  [
    "achievements",
    "news",
    "publishing",
    "users",
    "settings",
    "ai",
    "certificates",
    "profile",
    "partnerships",
    "system",
  ].includes(s as AuditCategory);

export const actionTypesForAuditCategory = (cat: AuditCategory): string[] => {
  if (cat === "users") return [...USERS_ACTION_TYPES];
  return (Object.entries(ROWS) as [string, RowDef][])
    .filter(([, v]) => v.category === cat)
    .map(([k]) => k);
};

/** Maps UI filter (الأخبار، الذكاء، …) to Mongo actionType query. */
export const actionTypesForOperationFilter = (filter: AuditOperationFilter): string[] | null => {
  if (filter === "all") return null;
  if (filter === "users") return [...USERS_ACTION_TYPES];
  return actionTypesForAuditCategory(filter as AuditCategory);
};

export const normalizePlatformKey = (raw: string): string =>
  String(raw || "")
    .trim()
    .toLowerCase();

/** Known social / site keys for badges and filters */
export const PLATFORM_LABELS: Record<string, { ar: string; en: string }> = {
  website: { ar: "الموقع", en: "Website" },
  instagram: { ar: "Instagram", en: "Instagram" },
  x: { ar: "X", en: "X" },
  twitter: { ar: "X", en: "X" },
  tiktok: { ar: "TikTok", en: "TikTok" },
  snapchat: { ar: "Snapchat", en: "Snapchat" },
};

export const platformLabel = (key: string, isAr: boolean): string => {
  const k = normalizePlatformKey(key);
  const row = PLATFORM_LABELS[k] || PLATFORM_LABELS[k.replace(/^@/, "")];
  if (row) return isAr ? row.ar : row.en;
  return key;
};

export const deriveDisplayStatus = (
  actionType: string,
  outcome: string | undefined
): AuditDisplayStatus => {
  if (actionType === "news_publish_blocked") return "blocked";
  const o = String(outcome || "").toLowerCase();
  if (o === "success") return "success";
  if (o === "failure") return "failure";
  if (o === "partial") return "partial";
  return "unknown";
};

export const statusBadgeTheme = (status: AuditDisplayStatus) => {
  switch (status) {
    case "success":
      return { className: "bg-emerald-100 text-emerald-900 ring-emerald-200" };
    case "failure":
      return { className: "bg-red-100 text-red-900 ring-red-200" };
    case "blocked":
      return { className: "bg-amber-100 text-amber-950 ring-amber-200" };
    case "partial":
      return { className: "bg-sky-100 text-sky-900 ring-sky-200" };
    default:
      return { className: "bg-gray-100 text-gray-800 ring-gray-200" };
  }
};

export const statusLabelUi = (status: AuditDisplayStatus, isAr: boolean): string => {
  if (isAr) {
    switch (status) {
      case "success":
        return "نجاح";
      case "failure":
        return "فشل";
      case "blocked":
        return "تم المنع";
      case "partial":
        return "جزئي";
      default:
        return "غير محدد";
    }
  }
  switch (status) {
    case "success":
      return "Success";
    case "failure":
      return "Failed";
    case "blocked":
      return "Blocked";
    case "partial":
      return "Partial";
    default:
      return "—";
  }
};

const metaString = (m: Record<string, unknown> | undefined, keys: string[]): string => {
  if (!m) return "";
  for (const k of keys) {
    const v = m[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
  }
  return "";
};

/** Collect platform keys from row.platform and metadata */
export const collectPlatformKeys = (row: Record<string, unknown>): string[] => {
  const set = new Set<string>();
  const p = row.platform;
  if (p) set.add(normalizePlatformKey(String(p)));
  const meta = row.metadata as Record<string, unknown> | undefined;
  if (meta && typeof meta === "object") {
    const mp = meta.platform;
    if (mp) set.add(normalizePlatformKey(String(mp)));
    const targets = meta.targets;
    if (Array.isArray(targets)) {
      for (const t of targets) set.add(normalizePlatformKey(String(t)));
    }
  }
  return [...set].filter(Boolean);
};

export const extractErrorMessage = (row: Record<string, unknown>): string | undefined => {
  const meta = row.metadata as Record<string, unknown> | undefined;
  const fromMeta = metaString(meta, [
    "error",
    "errorMessage",
    "message",
    "detail",
    "reason",
    "code",
  ]);
  if (fromMeta) return fromMeta.slice(0, 2000);
  if (meta?.blocking && Array.isArray(meta.blocking)) {
    const parts = meta.blocking.map((x) => String(x)).filter(Boolean);
    if (parts.length) return parts.join(" · ").slice(0, 2000);
  }
  if (meta?.blocks && Array.isArray(meta.blocks)) {
    const parts = meta.blocks.map((x) => String(x)).filter(Boolean);
    if (parts.length) return parts.join(" · ").slice(0, 2000);
  }
  const d = String(row.descriptionAr || "").trim();
  const st = deriveDisplayStatus(String(row.actionType), String(row.outcome));
  if ((st === "failure" || st === "blocked") && d) return d;
  return undefined;
};

export type AuditUiAugment = {
  label: string;
  category: AuditCategory;
  /** Template or row description */
  description: string;
  displayStatus: AuditDisplayStatus;
  statusLabel: string;
  platformKeys: string[];
  errorHint?: string;
};

export const enrichAuditLogForUi = (
  row: Record<string, unknown>,
  isAr: boolean
): Record<string, unknown> & { _ui: AuditUiAugment } => {
  const actionType = String(row.actionType || "");
  const templateDesc = auditActionDescription(actionType, isAr);
  const rowDesc = String(row.descriptionAr || "").trim();
  const description = rowDesc || templateDesc || (isAr ? "—" : "—");

  const displayStatus = deriveDisplayStatus(actionType, row.outcome ? String(row.outcome) : undefined);
  const statusLabel = statusLabelUi(displayStatus, isAr);
  const platformKeys = collectPlatformKeys(row);
  const errorHint = extractErrorMessage(row);

  return {
    ...row,
    _ui: {
      label: auditActionLabel(actionType, isAr),
      category: auditActionCategory(actionType),
      description,
      displayStatus,
      statusLabel,
      platformKeys,
      errorHint:
        displayStatus === "failure" || displayStatus === "blocked" ? errorHint : undefined,
    },
  };
};
