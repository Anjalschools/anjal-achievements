/**
 * Admin-facing copy for platform settings — never show raw Mongo keys in UI.
 * DB field paths stay unchanged for backward compatibility.
 */

export type SettingsGroupId = "achievements" | "certificates" | "ai" | "branding" | "schoolYear";

export type SettingsSectionKey = "workflow" | "certificate" | "ai" | "branding" | "schoolYearPolicy";

export type PlatUiField = {
  group: SettingsGroupId;
  section: SettingsSectionKey;
  key: string;
  kind: "boolean" | "string" | "number";
  labelAr: string;
  labelEn: string;
  descriptionAr: string;
  descriptionEn: string;
  tooltipAr: string;
  tooltipEn: string;
  /** Confirm before turning this boolean OFF */
  confirmBeforeOff?: boolean;
  /** Warn before turning this boolean ON */
  warnBeforeOn?: boolean;
  numberMin?: number;
  numberMax?: number;
  numberStep?: number;
  inputMaxLength?: number;
};

export const SETTINGS_GROUP_HEADERS: Record<
  SettingsGroupId,
  { titleAr: string; titleEn: string; descAr: string; descEn: string }
> = {
  achievements: {
    titleAr: "إدارة الإنجازات",
    titleEn: "Achievement management",
    descAr: "سياسات المراجعة والظهور في لوحة التميز وتعديل الإنجازات المعتمدة.",
    descEn: "Review flow, Hall of Fame visibility, and post-approval edits.",
  },
  certificates: {
    titleAr: "الشهادات والتحقق",
    titleEn: "Certificates & verification",
    descAr: "نصوص الشهادات، البادئة، والتحقق العام من صحة الشهادة.",
    descEn: "Certificate wording, numbering prefix, and public verification.",
  },
  ai: {
    titleAr: "الذكاء الاصطناعي",
    titleEn: "Artificial intelligence",
    descAr: "تفعيل ميزات المساعدة والتحليل — يمكن تعطيلها لأسباب سياسية أو تقنية.",
    descEn: "Assistive and analytics features — can be disabled for policy or technical reasons.",
  },
  branding: {
    titleAr: "الهوية المؤسسية",
    titleEn: "Branding",
    descAr: "أسماء المدرسة، الروابط، الشعارات، وتوقيع الشهادة الظاهر للمستندات.",
    descEn: "School names, links, logos, and certificate signature assets.",
  },
  schoolYear: {
    titleAr: "العام الدراسي",
    titleEn: "School year",
    descAr: "سياسات الأرشفة عند تفعيل عام جديد. إدارة الأعوام من API الأعوام الدراسية.",
    descEn: "Archiving when activating a new year. Manage years via school-years API.",
  },
};

const T = (
  labelAr: string,
  labelEn: string,
  descriptionAr: string,
  descriptionEn: string,
  tooltipAr: string,
  tooltipEn: string
) => ({ labelAr, labelEn, descriptionAr, descriptionEn, tooltipAr, tooltipEn });

/** Lookup by `section.key` for any ad-hoc display */
export const SETTINGS_LABELS: Record<string, { ar: string; en: string }> = {};

const reg = (fields: PlatUiField[]) => {
  for (const f of fields) {
    SETTINGS_LABELS[`${f.section}.${f.key}`] = { ar: f.labelAr, en: f.labelEn };
  }
  return fields;
};

export const PLATFORM_UI_FIELDS: PlatUiField[] = reg([
  {
    group: "achievements",
    section: "workflow",
    key: "adminCanDirectApprove",
    kind: "boolean",
    ...T(
      "السماح للمشرف بالموافقة المباشرة",
      "Admin direct approval",
      "يمكن لمسؤول النظام اعتماد الإنجاز دون المرور بمرحلة المراجعة الكاملة عند الحاجة.",
      "System admin can approve achievements without the full review chain when needed.",
      "يُستخدم في الحالات الاستثنائية؛ تأكد من توافقها مع سياسة المدرسة.",
      "Use for exceptions; align with school policy."
    ),
  },
  {
    group: "achievements",
    section: "workflow",
    key: "showApprovedDirectlyInHallOfFame",
    kind: "boolean",
    ...T(
      "عرض الإنجازات المعتمدة مباشرة في لوحة التميز",
      "Show approved in Hall of Fame",
      "الإنجازات المعتمدة تظهر في لوحة التميز دون خطوات نشر إضافية.",
      "Approved achievements appear in Hall of Fame without extra publishing steps.",
      "عطّلها إذا رغبت بمراجعة إعلامية قبل الظهور العام.",
      "Disable if you want a comms step before public display."
    ),
  },
  {
    group: "achievements",
    section: "workflow",
    key: "allowEditApprovedAchievementByAdmin",
    kind: "boolean",
    ...T(
      "السماح بتعديل الإنجاز بعد اعتماده (للمشرف)",
      "Allow admin to edit after approval",
      "يستطيع المشرف تعديل بيانات إنجاز معتمد لاحقًا.",
      "Admin may edit an already-approved achievement later.",
      "قد يؤثر على الشهادات الصادرة مسبقًا؛ راقب السجل.",
      "May affect certificates already issued; keep audit in mind."
    ),
  },
  {
    group: "achievements",
    section: "workflow",
    key: "allowDeleteApprovedAchievementByAdmin",
    kind: "boolean",
    ...T(
      "السماح بحذف إنجاز معتمد (للمشرف)",
      "Allow admin to delete approved",
      "يستطيع المشرف حذف إنجاز معتمد — إجراء حرج.",
      "Admin may delete an approved achievement — critical action.",
      "استخدم فقط مع ضوابط داخلية صارمة.",
      "Use only with strict internal controls."
    ),
  },
  {
    group: "achievements",
    section: "workflow",
    key: "requireAiReviewBeforeManualReview",
    kind: "boolean",
    ...T(
      "اشتراط مراجعة ذكاء اصطناعي قبل المراجعة اليدوية",
      "Require AI review before manual review",
      "يُفضّل تشغيل مسار AI قبل أن يدخل الإنجاز لمراجعة البشر.",
      "Prefer an AI pass before human review begins.",
      "يتطلب تفعيل ميزات AI ذات الصلة.",
      "Requires relevant AI features to be enabled."
    ),
  },
  {
    group: "achievements",
    section: "workflow",
    key: "autoFeatureTopAchievements",
    kind: "boolean",
    ...T(
      "تمييز أعلى الإنجازات تلقائيًا",
      "Auto-feature top achievements",
      "تمييز الإنجازات ذات الدرجات العليا تلقائيًا في العرض.",
      "Automatically feature top-scoring achievements in listings.",
      "يؤثر على العرض العام حسب منطق المنصة.",
      "Affects public display per platform logic."
    ),
  },
  {
    group: "achievements",
    section: "workflow",
    key: "requireMediaApprovalBeforePublishing",
    kind: "boolean",
    ...T(
      "اشتراط اعتماد الوسائط قبل النشر",
      "Require media approval before publishing",
      "المرفقات الإعلامية تحتاج موافقة قبل الظهور.",
      "Media attachments need approval before going live.",
      "يزيد الضبط على المحتوى المرئي.",
      "Tighter control on visual content."
    ),
  },
  {
    group: "schoolYear",
    section: "schoolYearPolicy",
    key: "autoArchivePreviousWhenActivating",
    kind: "boolean",
    warnBeforeOn: true,
    ...T(
      "أرشفة العام السابق تلقائيًا عند تفعيل عام جديد",
      "Auto-archive previous year when activating new",
      "عند تفعيل عام دراسي جديد تُؤرشف بيانات العام الحالي حسب سياسة المنصة.",
      "When a new school year is activated, current-year data is archived per platform rules.",
      "سيتم أرشفة جميع بيانات العام الحالي عند التفعيل — راجع التوثيق والنسخ الاحتياطي.",
      "Activating will archive current-year data — review docs and backups."
    ),
  },
  {
    group: "certificates",
    section: "certificate",
    key: "certificatePrefix",
    kind: "string",
    inputMaxLength: 10,
    ...T(
      "بادئة رقم الشهادة",
      "Certificate ID prefix",
      "اختصار يظهر قبل الرقم التسلسلي (مثال: ANJ) — مطلوب، بحد أقصى 10 أحرف.",
      "Prefix before serial (e.g. ANJ) — required, max 10 characters.",
      "يُستخدم في التحقق والطباعة؛ لا تغيّرها باستخفاف بعد الإصدار.",
      "Used in verification and printing; avoid careless changes after issuance."
    ),
  },
  {
    group: "certificates",
    section: "certificate",
    key: "certificateTitleAr",
    kind: "string",
    ...T(
      "عنوان الشهادة (عربي)",
      "Certificate title (Arabic)",
      "العنوان الرئيسي الظاهر على الشهادة بالعربية.",
      "Main certificate title in Arabic.",
      "يظهر في ترويسة المستند الرسمي.",
      "Shown in the official document header."
    ),
  },
  {
    group: "certificates",
    section: "certificate",
    key: "certificateTitleEn",
    kind: "string",
    ...T(
      "عنوان الشهادة (إنجليزي)",
      "Certificate title (English)",
      "عنوان إنجليزي اختياري للنسخة الثنائية.",
      "Optional English title for bilingual output.",
      "اتركه فارغًا إن لم تُستخدم الشهادة ثنائية اللغة.",
      "Leave empty if certificates are Arabic-only."
    ),
  },
  {
    group: "certificates",
    section: "certificate",
    key: "verificationEnabled",
    kind: "boolean",
    ...T(
      "تفعيل صفحة التحقق العامة",
      "Enable public verification",
      "السماح للزائر بالتحقق من صحة الشهادة عبر الرابط أو الرمز.",
      "Allow visitors to verify certificate authenticity via link or code.",
      "عطّلها إذا أوقفتم التحقق العلني مؤقتًا.",
      "Disable if public verification is paused."
    ),
  },
  {
    group: "certificates",
    section: "certificate",
    key: "qrEnabled",
    kind: "boolean",
    ...T(
      "رمز QR على الشهادة",
      "QR code on certificate",
      "إظهار رمز استجابة سريع يوجّه لصفحة التحقق.",
      "Show QR that links to verification page.",
      "يتطلب تفعيل التحقق عادةً.",
      "Usually pair with verification enabled."
    ),
  },
  {
    group: "certificates",
    section: "certificate",
    key: "showStudentGrade",
    kind: "boolean",
    ...T("إظهار الصف الدراسي", "Show student grade", "طباعة الصف على الشهادة.", "Print grade on certificate.", "", ""),
  },
  {
    group: "certificates",
    section: "certificate",
    key: "showAchievementLevel",
    kind: "boolean",
    ...T("إظهار مستوى الإنجاز", "Show achievement level", "طباعة المستوى على الشهادة.", "Print level on certificate.", "", ""),
  },
  {
    group: "certificates",
    section: "certificate",
    key: "showAchievementDate",
    kind: "boolean",
    ...T("إظهار تاريخ الإنجاز", "Show achievement date", "طباعة التاريخ على الشهادة.", "Print date on certificate.", "", ""),
  },
  {
    group: "certificates",
    section: "certificate",
    key: "showAchievementResult",
    kind: "boolean",
    ...T("إظهار نتيجة الإنجاز", "Show achievement result", "طباعة النتيجة/الدرجة إن وُجدت.", "Print result/score if present.", "", ""),
  },
  {
    group: "certificates",
    section: "certificate",
    key: "verificationSuccessMessageAr",
    kind: "string",
    ...T(
      "رسالة نجاح التحقق (عربي)",
      "Verification success message (AR)",
      "نص يظهر للزائر عند نجاح التحقق.",
      "Text shown when verification succeeds.",
      "حافظ على نبرة رسمية وموجزة.",
      "Keep tone formal and concise."
    ),
  },
  {
    group: "certificates",
    section: "certificate",
    key: "verificationFailureMessageAr",
    kind: "string",
    ...T("رسالة فشل التحقق (عربي)", "Verification failure message (AR)", "نص عند فشل التحقق.", "Text when verification fails.", "", ""),
  },
  {
    group: "certificates",
    section: "certificate",
    key: "verificationSuccessMessageEn",
    kind: "string",
    ...T("رسالة نجاح التحقق (إنجليزي)", "Verification success message (EN)", "نص إنجليزي عند النجاح.", "English text on success.", "", ""),
  },
  {
    group: "certificates",
    section: "certificate",
    key: "verificationFailureMessageEn",
    kind: "string",
    ...T("رسالة فشل التحقق (إنجليزي)", "Verification failure message (EN)", "نص إنجليزي عند الفشل.", "English text on failure.", "", ""),
  },
  {
    group: "ai",
    section: "ai",
    key: "aiEnabled",
    kind: "boolean",
    confirmBeforeOff: true,
    ...T(
      "تفعيل الذكاء الاصطناعي (رئيسي)",
      "AI master switch",
      "يقطع أو يشغّل جميع ميزات الذكاء الاصطناعي في المنصة.",
      "Master switch for all AI-powered features.",
      "التعطيل يوقف المساعدة والتحليل الآلي — تأكد قبل الحفظ.",
      "Disabling stops assistive and analytic AI — confirm before saving."
    ),
  },
  {
    group: "ai",
    section: "ai",
    key: "aiFieldSuggestionEnabled",
    kind: "boolean",
    confirmBeforeOff: true,
    ...T(
      "اقتراحات الحقول أثناء الإدخال",
      "Field suggestions while typing",
      "اقتراحات لملء الحقول في نماذج الإنجاز.",
      "Suggestions while filling achievement forms.",
      "يتطلب المفتاح الرئيسي للـ AI مفعّلًا.",
      "Requires master AI to be on."
    ),
  },
  {
    group: "ai",
    section: "ai",
    key: "aiDuplicateDetectionEnabled",
    kind: "boolean",
    confirmBeforeOff: true,
    ...T(
      "كشف التكرار المحتمل",
      "Duplicate detection",
      "تنبيه عند تشابه إنجاز مع إدخالات سابقة.",
      "Flags potential duplicates against past entries.",
      "يساعد على جودة البيانات.",
      "Helps data quality."
    ),
  },
  {
    group: "ai",
    section: "ai",
    key: "aiAttachmentReviewEnabled",
    kind: "boolean",
    confirmBeforeOff: true,
    ...T(
      "مراجعة المرفقات بالذكاء الاصطناعي",
      "AI attachment review",
      "تحليل أولي للمرفقات قبل المراجعة البشرية.",
      "Initial attachment screening before human review.",
      "لا يغني عن المراجعة اليدوية.",
      "Does not replace human review."
    ),
  },
  {
    group: "ai",
    section: "ai",
    key: "aiMediaGenerationEnabled",
    kind: "boolean",
    confirmBeforeOff: true,
    ...T(
      "توليد المحتوى الإعلامي (أخبار/سوشال)",
      "AI media generation",
      "توليد مسودات إعلامية من لوحة الإدارة.",
      "Generate media drafts from admin console.",
      "يعتمد على مفتاح OpenAI في البيئة.",
      "Depends on OpenAI key in environment."
    ),
  },
  {
    group: "ai",
    section: "ai",
    key: "aiInsightsEnabled",
    kind: "boolean",
    confirmBeforeOff: true,
    ...T(
      "رؤى وتحليلات بالذكاء الاصطناعي",
      "AI insights & analytics",
      "ملخصات أو رؤى في لوحات التحليلات عند توفرها.",
      "Summaries or insights in analytics where available.",
      "قد يزيد استهلاك واجهة النموذج.",
      "May increase model API usage."
    ),
  },
  {
    group: "ai",
    section: "ai",
    key: "minConfidenceForSuggestions",
    kind: "number",
    numberMin: 0,
    numberMax: 1,
    numberStep: 0.05,
    ...T(
      "حد الثقة الأدنى للاقتراحات",
      "Min confidence for suggestions",
      "قيمة بين 0 و 1 — ارتفاعها يقلل الاقتراحات الضعيفة.",
      "0–1 — higher means fewer low-confidence suggestions.",
      "اضبط حسب دقة النموذج لديك.",
      "Tune per your model quality."
    ),
  },
  {
    group: "ai",
    section: "ai",
    key: "minConfidenceForDuplicateFlag",
    kind: "number",
    numberMin: 0,
    numberMax: 1,
    numberStep: 0.05,
    ...T("حد الثقة لكشف التكرار", "Min confidence for duplicates", "عتبة تنبيه التكرار.", "Duplicate alert threshold.", "", ""),
  },
  {
    group: "ai",
    section: "ai",
    key: "minConfidenceForMediaRecommendation",
    kind: "number",
    numberMin: 0,
    numberMax: 1,
    numberStep: 0.05,
    ...T(
      "حد الثقة لتوصيات الوسائط",
      "Min confidence for media recommendations",
      "عتبة توصيات الوسائط/المرفقات.",
      "Threshold for media-related recommendations.",
      "",
      ""
    ),
  },
  ...(
    [
      ["schoolNameAr", "اسم المدرسة (عربي)", "School name (Arabic)", "الاسم الرسمي بالعربية.", "Official Arabic name."],
      ["schoolNameEn", "اسم المدرسة (إنجليزي)", "School name (English)", "الاسم بالإنجليزية للوثائق الثنائية.", "English name for bilingual docs."],
      ["educationalAuthorityAr", "جهة تعليمية (عربي)", "Authority (Arabic)", "اسم الإدارة أو الجهة.", "Education authority Arabic."],
      ["educationalAuthorityEn", "جهة تعليمية (إنجليزي)", "Authority (English)", "اسم الجهة بالإنجليزية.", "Authority English."],
      ["cityAr", "المدينة (عربي)", "City (Arabic)", "مدينة المدرسة.", "School city Arabic."],
      ["cityEn", "المدينة (إنجليزي)", "City (English)", "مدينة المدرسة بالإنجليزية.", "School city English."],
      ["websiteUrl", "رابط الموقع", "Website URL", "الصفحة الرسمية للمدرسة — يُتحقق من صحة الرابط.", "Official site — must be a valid URL if set."],
      ["contactInfoTitleAr", "عنوان صندوق التواصل (عربي)", "Contact box title (Arabic)", "عنوان قسم معلومات التواصل في صفحة اتصل بنا.", "Contact info card title on Contact page."],
      ["contactInfoTitleEn", "عنوان صندوق التواصل (إنجليزي)", "Contact box title (English)", "عنوان القسم بالإنجليزية.", "English title for contact info card."],
      ["contactPageIntroAr", "مقدمة صفحة التواصل (عربي)", "Contact page intro (Arabic)", "وصف مختصر يظهر أعلى نموذج التواصل.", "Short intro shown above contact form."],
      ["contactPageIntroEn", "مقدمة صفحة التواصل (إنجليزي)", "Contact page intro (English)", "الوصف المختصر بالإنجليزية.", "English intro text for contact page."],
      ["contactEmailPrimary", "البريد الإلكتروني الأساسي للتواصل", "Primary contact email", "البريد الرسمي الرئيسي الظاهر للزوار.", "Primary public contact email."],
      ["contactEmailSecondary", "البريد الإلكتروني الثانوي", "Secondary contact email", "بريد إضافي اختياري.", "Optional secondary email."],
      ["contactPhonePrimary", "رقم الهاتف الأساسي للتواصل", "Primary contact phone", "الهاتف الرسمي الرئيسي الظاهر للزوار.", "Primary public phone number."],
      ["contactPhoneSecondary", "رقم الهاتف الثانوي", "Secondary contact phone", "رقم إضافي اختياري.", "Optional secondary phone."],
      ["contactAddressAr", "عنوان التواصل (عربي)", "Contact address (Arabic)", "العنوان الظاهر في صفحة اتصل بنا.", "Public address shown on contact page."],
      ["contactAddressEn", "عنوان التواصل (إنجليزي)", "Contact address (English)", "العنوان بالإنجليزية.", "English public address."],
      [
        "mapEmbedUrl",
        "رابط تضمين الخريطة (Embed URL)",
        "Map embed URL",
        "رابط https://www.google.com/maps/embed?… أو لصق كود iframe من Google (يُستخرج الرابط تلقائياً).",
        "Paste the https://www.google.com/maps/embed?… link or the full iframe from Google Maps (src is extracted safely).",
      ],
      ["mapTitleAr", "عنوان الخريطة (عربي)", "Map title (Arabic)", "عنوان يظهر على الخريطة في صفحة التواصل.", "Map title displayed on contact page."],
      ["mapTitleEn", "عنوان الخريطة (إنجليزي)", "Map title (English)", "عنوان الخريطة بالإنجليزية.", "English map title."],
      ["mapLocationLabelAr", "وصف الموقع (عربي)", "Map location label (Arabic)", "وصف موقع المدرسة بجانب الخريطة.", "Location label shown near map."],
      ["mapLocationLabelEn", "وصف الموقع (إنجليزي)", "Map location label (English)", "وصف الموقع بالإنجليزية.", "English location label."],
      ["latitude", "خط العرض (اختياري)", "Latitude (optional)", "قيمة خط العرض إن رغبت بتوثيقها.", "Optional latitude value."],
      ["longitude", "خط الطول (اختياري)", "Longitude (optional)", "قيمة خط الطول إن رغبت بتوثيقها.", "Optional longitude value."],
      ["socialFacebook", "فيسبوك", "Facebook", "رابط صفحة فيسبوك.", "Facebook page URL."],
      ["socialX", "X (تويتر)", "X (Twitter)", "رابط حساب X.", "X profile URL."],
      ["socialYoutube", "يوتيوب", "YouTube", "رابط القناة.", "Channel URL."],
      ["socialInstagram", "إنستغرام", "Instagram", "رابط الحساب.", "Profile URL."],
      ["mainLogo", "الشعار الرئيسي (رابط/مسار)", "Main logo URL", "صورة الشعار للواجهة.", "Logo for UI."],
      ["secondaryLogo", "شعار ثانوي", "Secondary logo", "شعار إضافي اختياري.", "Optional secondary logo."],
      ["reportHeaderImage", "ترويسة التقارير", "Report header image", "صورة أعلى تقارير PDF.", "PDF report header."],
      ["reportFooterImage", "تذييل التقارير", "Report footer image", "صورة أسفل التقارير.", "PDF report footer."],
      ["certificateSignatureName", "اسم الموقّع على الشهادة", "Certificate signatory name", "الاسم تحت التوقيع.", "Name under signature."],
      ["certificateSignatureTitle", "منصب الموقّع", "Signatory title", "المسمى الوظيفي.", "Job title on certificate."],
      ["certificateSignatureImage", "صورة التوقيع", "Signature image URL", "صورة التوقيع الرقمية.", "Signature image asset."],
      ["officialStampImage", "صورة الختم", "Official stamp image", "ختم المدرسة على الشهادة.", "School stamp image."],
    ] as const
  ).map(
    ([key, labelAr, labelEn, shortAr, shortEn]): PlatUiField => ({
      group: "branding",
      section: "branding",
      key,
      kind: key === "latitude" || key === "longitude" ? "number" : "string",
      labelAr,
      labelEn,
      descriptionAr: shortAr,
      descriptionEn: shortEn,
      tooltipAr: shortAr,
      tooltipEn: shortEn,
    })
  ),
]);

export const fieldsByGroup = (g: SettingsGroupId): PlatUiField[] =>
  PLATFORM_UI_FIELDS.filter((f) => f.group === g);
