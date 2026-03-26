import type { Locale } from "@/lib/i18n";

export type PublicPortfolioPageCopy = {
  accessRestricted: string;
  backToHome: string;
  missingTokenTitle: string;
  missingTokenSubtitle: string;
  missingTokenHint: string;
  forbiddenTitle: string;
  forbiddenSubtitle: string;
  forbiddenHint: string;
  notFoundTitle: string;
  notFoundSubtitle: string;
  notFoundHint: string;
  platformTagline: string;
  portfolioTitle: string;
  portfolioTitleSecondary: string;
  heroDescription: string;
  badgeOfficialSchool: string;
  badgeOfficialSchoolAlt: string;
  qrAlt: string;
  langSwitcherAria: string;
  langAr: string;
  langEn: string;
  altMoe: string;
  altAnjal: string;
  altMawhiba: string;
  altCognia: string;
  schoolCaptionUnderLogo: string;
  fieldGrade: string;
  fieldStage: string;
  fieldTrack: string;
  fieldSectionGender: string;
  fieldPublishedAchievements: string;
  fieldFeaturedAchievements: string;
  fieldCertificatesIssued: string;
  fieldTotalPoints: string;
  fieldLastUpdated: string;
  fieldFilePublishedPrefix: string;
  sectionPublishedAchievements: string;
  emptyStateTitle: string;
  emptyStateBody: string;
  badgeFeatured: string;
  badgeVerified: string;
  badgeCertificateAvailable: string;
  dlCategory: string;
  dlLevel: string;
  dlResult: string;
  dlParticipation: string;
  dlDate: string;
  dlAcademicYear: string;
  btnVerifyCertificate: string;
  btnOpenVerifyPage: string;
  footerLegal: string;
  footerLastUpdated: string;
  backToHomeFooter: string;
  profileBioTitle: string;
  profileSkillsTitle: string;
  profileSkillsTechnical: string;
  profileSkillsPersonal: string;
  profileCoursesTitle: string;
  profileActivitiesTitle: string;
  profileContactTitle: string;
  profileLblProvider: string;
  profileLblType: string;
  profileLblTrainingHours: string;
  profileLblLink: string;
  profileLblOrganization: string;
  profileLblDescription: string;
  profileLblHours: string;
  profileLblDate: string;
};

const ar: PublicPortfolioPageCopy = {
  accessRestricted: "وصول مقيد",
  backToHome: "العودة للرئيسية",
  missingTokenTitle: "ملف الإنجاز العام",
  missingTokenSubtitle: "لا يمكن عرض هذا الملف بدون رمز الوصول الصحيح.",
  missingTokenHint:
    "تأكد من استخدام الرابط الكامل الذي زودتك به المدرسة (يتضمن معامل token).",
  forbiddenTitle: "رفض الوصول",
  forbiddenSubtitle: "رمز الوصول غير صحيح أو الملف غير مفعّل للنشر العام.",
  forbiddenHint:
    "إذا كنت تعتقد أن هذا خطأ، تواصل مع إدارة المدرسة للحصول على رابط محدّث.",
  notFoundTitle: "الملف غير متاح",
  notFoundSubtitle: "لم يتم العثور على ملف إنجاز مطابق لهذا الرابط.",
  notFoundHint: "تحقق من صحة الرابط أو تواصل مع المدرسة.",
  platformTagline: "منصة تميز الأنجال",
  portfolioTitle: "ملف الإنجاز",
  portfolioTitleSecondary: "Student Achievement Portfolio",
  heroDescription:
    "وثيقة رقمية تعرض إنجازات الطالب المنشورة رسميًا من المدرسة، مع إمكانية التحقق من الشهادات المعتمدة.",
  badgeOfficialSchool: "ملف موثق من المدرسة",
  badgeOfficialSchoolAlt: "Official school portfolio",
  qrAlt: "رمز الاستجابة السريعة لرابط الملف",
  langSwitcherAria: "اختيار لغة العرض",
  langAr: "العربية",
  langEn: "English",
  altMoe: "وزارة التعليم — المملكة العربية السعودية",
  altAnjal: "مدارس الأنجال الأهلية",
  altMawhiba: "موهبة",
  altCognia: "Cognia",
  schoolCaptionUnderLogo: "مدارس الأنجال الأهلية",
  fieldGrade: "الصف",
  fieldStage: "المرحلة",
  fieldTrack: "المسار",
  fieldSectionGender: "القسم / النوع",
  fieldPublishedAchievements: "إنجازات منشورة",
  fieldFeaturedAchievements: "إنجازات مميزة",
  fieldCertificatesIssued: "شهادات صادرة",
  fieldTotalPoints: "مجموع النقاط",
  fieldLastUpdated: "آخر تحديث",
  fieldFilePublishedPrefix: "نُشر الملف:",
  sectionPublishedAchievements: "الإنجازات المنشورة",
  emptyStateTitle: "لا توجد إنجازات منشورة في هذا الملف حاليًا",
  emptyStateBody:
    "تم تفعيل ملف الإنجاز العام، ولم يُنشر بعد أي إنجاز مؤهل للعرض العام وفق سياسة المدرسة. قد يُحدّث هذا الملف لاحقًا عند اعتماد إنجازات جديدة.",
  badgeFeatured: "مميز",
  badgeVerified: "موثق",
  badgeCertificateAvailable: "شهادة متاحة",
  dlCategory: "التصنيف",
  dlLevel: "المستوى",
  dlResult: "النتيجة",
  dlParticipation: "نوع المشاركة",
  dlDate: "التاريخ",
  dlAcademicYear: "السنة الدراسية",
  btnVerifyCertificate: "التحقق من الشهادة",
  btnOpenVerifyPage: "عرض صفحة التحقق",
  footerLegal:
    "هذا الملف يُعرض للجمهور بموجب تفويض المدرسة ولا يُعتمد إلا مع رمز الوصول السري.",
  footerLastUpdated: "آخر تحديث للبيانات المعروضة:",
  backToHomeFooter: "العودة للصفحة الرئيسية",
  profileBioTitle: "نبذة عن الطالب",
  profileSkillsTitle: "المهارات",
  profileSkillsTechnical: "المهارات التقنية",
  profileSkillsPersonal: "المهارات الشخصية",
  profileCoursesTitle: "الدورات والشهادات",
  profileActivitiesTitle: "الأنشطة والتطوع",
  profileContactTitle: "معلومات التواصل",
  profileLblProvider: "الجهة / المزود",
  profileLblType: "النوع",
  profileLblTrainingHours: "الساعات التدريبية",
  profileLblLink: "الرابط",
  profileLblOrganization: "الجهة",
  profileLblDescription: "الوصف",
  profileLblHours: "الساعات",
  profileLblDate: "التاريخ",
};

const en: PublicPortfolioPageCopy = {
  accessRestricted: "Restricted access",
  backToHome: "Back to home",
  missingTokenTitle: "Public achievement portfolio",
  missingTokenSubtitle: "This portfolio cannot be viewed without a valid access token.",
  missingTokenHint:
    "Use the full link provided by the school (it must include the token parameter).",
  forbiddenTitle: "Access denied",
  forbiddenSubtitle: "The access token is invalid or public sharing is disabled for this portfolio.",
  forbiddenHint:
    "If you believe this is a mistake, contact the school administration for an updated link.",
  notFoundTitle: "Portfolio unavailable",
  notFoundSubtitle: "No achievement portfolio matches this link.",
  notFoundHint: "Check the link or contact the school for assistance.",
  platformTagline: "Al-Anjal Achievements Platform",
  portfolioTitle: "Student achievement portfolio",
  portfolioTitleSecondary: "ملف الإنجاز",
  heroDescription:
    "An official digital record of the student’s published achievements from the school, including verification options for approved certificates.",
  badgeOfficialSchool: "Official school portfolio",
  badgeOfficialSchoolAlt: "ملف موثق من المدرسة",
  qrAlt: "QR code for portfolio link",
  langSwitcherAria: "Choose display language",
  langAr: "العربية",
  langEn: "English",
  altMoe: "Ministry of Education — Saudi Arabia",
  altAnjal: "Al Anjal Private Schools",
  altMawhiba: "Mawhiba",
  altCognia: "Cognia",
  schoolCaptionUnderLogo: "Al Anjal Private Schools",
  fieldGrade: "Grade",
  fieldStage: "Stage",
  fieldTrack: "Track",
  fieldSectionGender: "Section / type",
  fieldPublishedAchievements: "Published achievements",
  fieldFeaturedAchievements: "Featured achievements",
  fieldCertificatesIssued: "Certificates issued",
  fieldTotalPoints: "Total points",
  fieldLastUpdated: "Last updated",
  fieldFilePublishedPrefix: "Portfolio published:",
  sectionPublishedAchievements: "Published achievements",
  emptyStateTitle: "No published achievements in this portfolio yet",
  emptyStateBody:
    "The public portfolio is active, but no achievements currently qualify for public display under school policy. This page may update when new achievements are approved.",
  badgeFeatured: "Featured",
  badgeVerified: "Verified",
  badgeCertificateAvailable: "Certificate available",
  dlCategory: "Category",
  dlLevel: "Level",
  dlResult: "Result",
  dlParticipation: "Participation",
  dlDate: "Date",
  dlAcademicYear: "Academic year",
  btnVerifyCertificate: "Verify certificate",
  btnOpenVerifyPage: "Open verification page",
  footerLegal:
    "This portfolio is shown to the public under school authorization and should only be relied on together with the secret access token.",
  footerLastUpdated: "Last data update:",
  backToHomeFooter: "Back to home page",
  profileBioTitle: "About the student",
  profileSkillsTitle: "Skills",
  profileSkillsTechnical: "Technical skills",
  profileSkillsPersonal: "Personal skills",
  profileCoursesTitle: "Courses & certificates",
  profileActivitiesTitle: "Activities & volunteering",
  profileContactTitle: "Contact",
  profileLblProvider: "Provider",
  profileLblType: "Type",
  profileLblTrainingHours: "Training hours",
  profileLblLink: "Link",
  profileLblOrganization: "Organization",
  profileLblDescription: "Description",
  profileLblHours: "Hours",
  profileLblDate: "Date",
};

export const getPublicPortfolioPageCopy = (locale: Locale): PublicPortfolioPageCopy =>
  locale === "en" ? en : ar;
