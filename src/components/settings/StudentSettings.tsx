"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import {
  User,
  Lock,
  Globe,
  Bell,
  Save,
  ArrowLeft,
  Phone,
  Camera,
  AlertCircle,
  Shield,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  PlusCircle,
  Star,
} from "lucide-react";
import {
  normalizeStudentPortfolioContentFromDoc,
  type StudentPortfolioContent,
} from "@/lib/student-portfolio-content";
import { initLocale } from "@/lib/i18n";
import { getTranslation } from "@/locales";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import Image from "next/image";
import { GRADE_OPTIONS, normalizeGrade } from "@/constants/grades";
import {
  mergeNotificationPrefs,
  mergePrivacyPrefs,
  evaluatePasswordStrength,
  newPasswordMeetsPolicy,
  isValidSaMobile,
  type NotificationPreferences,
  type PrivacyPreferences,
} from "@/lib/user-account-preferences";

const fieldClass =
  "w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

const labelClass = "mb-1.5 block text-sm font-semibold text-text";

const lockHint = (isAr: boolean) =>
  isAr
    ? "لا يمكن تعديل هذا الحقل لأنه يُستخدم كمعرّف أساسي في النظام"
    : "This field cannot be edited because it is used as a primary identifier in the system";

type PortfolioCourseForm = {
  title: string;
  provider: string;
  type: string;
  trainingHoursStr: string;
  date: string;
  url: string;
};

type PortfolioActivityForm = {
  title: string;
  type: string;
  organization: string;
  description: string;
  hoursStr: string;
  date: string;
};

const emptyCourseRow = (): PortfolioCourseForm => ({
  title: "",
  provider: "",
  type: "",
  trainingHoursStr: "",
  date: "",
  url: "",
});

const emptyActivityRow = (): PortfolioActivityForm => ({
  title: "",
  type: "",
  organization: "",
  description: "",
  hoursStr: "",
  date: "",
});

const linesToSkills = (s: string) =>
  s
    .split(/[\n\r,،;]+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 40);

const portfolioStateFromApi = (raw: unknown) => {
  const c = normalizeStudentPortfolioContentFromDoc(raw);
  const courses =
    c.courses.length > 0
      ? c.courses.map((x) => ({
          title: x.title,
          provider: x.provider,
          type: x.type,
          trainingHoursStr: x.trainingHours != null ? String(x.trainingHours) : "",
          date: x.date,
          url: x.url,
        }))
      : [emptyCourseRow()];
  const activities =
    c.activities.length > 0
      ? c.activities.map((x) => ({
          title: x.title,
          type: x.type,
          organization: x.organization,
          description: x.description,
          hoursStr: x.hours != null ? String(x.hours) : "",
          date: x.date,
        }))
      : [emptyActivityRow()];
  return {
    portfolioBio: c.bio,
    portfolioTechLines: c.technicalSkills.join("\n"),
    portfolioPersLines: c.personalSkills.join("\n"),
    portfolioCourses: courses,
    portfolioActivities: activities,
    portfolioShowEmail: c.portfolioContact.showEmail,
    portfolioShowPhone: c.portfolioContact.showPhone,
  };
};

const buildPortfolioContentForSave = (
  bio: string,
  techLines: string,
  persLines: string,
  courses: PortfolioCourseForm[],
  activities: PortfolioActivityForm[],
  showEmail: boolean,
  showPhone: boolean
): StudentPortfolioContent => {
  const parseNum = (s: string) => {
    const t = s.trim();
    if (!t) return null;
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.round(n * 100) / 100;
  };
  return {
    bio: bio.trim().slice(0, 4000),
    technicalSkills: linesToSkills(techLines).map((x) => (x.length > 120 ? x.slice(0, 120) : x)),
    personalSkills: linesToSkills(persLines).map((x) => (x.length > 120 ? x.slice(0, 120) : x)),
    courses: courses
      .map((r) => ({
        title: r.title.trim(),
        provider: r.provider.trim(),
        type: r.type.trim(),
        trainingHours: parseNum(r.trainingHoursStr),
        date: r.date.trim(),
        url: r.url.trim(),
      }))
      .filter(
        (x) =>
          x.title ||
          x.provider ||
          x.type ||
          x.date ||
          x.url ||
          x.trainingHours != null
      )
      .slice(0, 25),
    activities: activities
      .map((r) => ({
        title: r.title.trim(),
        type: r.type.trim(),
        organization: r.organization.trim(),
        description: r.description.trim(),
        hours: parseNum(r.hoursStr),
        date: r.date.trim(),
      }))
      .filter(
        (x) =>
          x.title || x.type || x.organization || x.description || x.date || x.hours != null
      )
      .slice(0, 25),
    portfolioContact: { showEmail, showPhone },
  };
};

const StudentSettings = () => {
  const router = useRouter();
  const [locale, setLocale] = useState<"ar" | "en">("ar");
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    profilePhoto: null as File | null,
    profilePhotoPreview: "",
    fullName: "",
    fullNameAr: "",
    fullNameEn: "",
    studentId: "",
    username: "",
    email: "",
    nationalId: "",
    gender: "" as "male" | "female" | "",
    section: "" as "arabic" | "international" | "",
    grade: "",
    phone: "",
    guardianName: "",
    guardianPhone: "",
    guardianNationalId: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    notifications: mergeNotificationPrefs(null),
    privacy: mergePrivacyPrefs(null),
    portfolioBio: "",
    portfolioTechLines: "",
    portfolioPersLines: "",
    portfolioCourses: [emptyCourseRow()] as PortfolioCourseForm[],
    portfolioActivities: [emptyActivityRow()] as PortfolioActivityForm[],
    portfolioShowEmail: false,
    portfolioShowPhone: false,
  });

  const [showPw, setShowPw] = useState({ cur: false, nw: false, cf: false });

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    initLocale();
    const savedLocale =
      typeof window !== "undefined"
        ? (localStorage.getItem("platform-locale") as "ar" | "en" | null)
        : null;
    if (savedLocale === "ar" || savedLocale === "en") {
      setLocale(savedLocale);
    }

    const fetchUserData = async () => {
      try {
        const response = await fetch("/api/user/profile");
        if (response.ok) {
          const data = await response.json();
          setFormData((prev) => ({
            ...prev,
            fullName: data.fullName || "",
            fullNameAr: data.fullNameAr || data.fullName || "",
            fullNameEn: data.fullNameEn || "",
            email: data.email || "",
            username: data.username || "",
            studentId: data.studentId || "",
            nationalId: data.nationalId || "",
            gender: data.gender || "",
            section:
              data.section === "عربي"
                ? "arabic"
                : data.section === "دولي"
                  ? "international"
                  : data.sectionRaw || "",
            grade: data.grade || "",
            phone: (data.phone || "").replace(/\D/g, ""),
            guardianName: data.guardianName || "",
            guardianPhone: (data.guardianPhone || "").replace(/\D/g, ""),
            guardianNationalId: data.guardianNationalId || "",
            profilePhotoPreview: data.profilePhoto || "",
            notifications: mergeNotificationPrefs(data.notifications),
            privacy: mergePrivacyPrefs(data.privacy),
            ...portfolioStateFromApi(data.studentPortfolioContent),
          }));
        }
      } catch {
        /* ignore */
      }
    };
    fetchUserData();
  }, []);

  const t = getTranslation(locale);
  const isAr = locale === "ar";

  const pwdStrength = useMemo(
    () => evaluatePasswordStrength(formData.newPassword),
    [formData.newPassword]
  );

  const passwordMismatch =
    formData.newPassword.length > 0 &&
    formData.confirmPassword.length > 0 &&
    formData.newPassword !== formData.confirmPassword;

  const handleChange = (field: string, value: string | boolean | File | null) => {
    if (field === "profilePhoto" && value instanceof File) {
      setFormData((prev) => ({
        ...prev,
        profilePhoto: value,
        profilePhotoPreview: URL.createObjectURL(value),
      }));
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }));
    }
    setFieldErrors((e) => {
      if (!e[field]) return e;
      const { [field]: _, ...rest } = e;
      return rest;
    });
  };

  const setNotif = (key: keyof NotificationPreferences, value: boolean) => {
    setFormData((prev) => ({
      ...prev,
      notifications: { ...prev.notifications, [key]: value },
    }));
  };

  const setPriv = (key: keyof PrivacyPreferences, value: boolean) => {
    setFormData((prev) => ({
      ...prev,
      privacy: { ...prev.privacy, [key]: value },
    }));
  };

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.fullNameAr.trim()) {
      errs.fullNameAr = isAr ? "مطلوب" : "Required";
    }
    if (!formData.fullNameEn.trim()) {
      errs.fullNameEn = isAr ? "مطلوب" : "Required";
    }
    if (!formData.gender) {
      errs.gender = isAr ? "اختر الجنس" : "Select gender";
    }
    if (!formData.grade) {
      errs.grade = isAr ? "اختر الصف" : "Select grade";
    }
    if (!formData.section) {
      errs.section = isAr ? "اختر القسم" : "Select section";
    }
    const ph = formData.phone.replace(/\D/g, "");
    if (!ph) errs.phone = isAr ? "مطلوب" : "Required";
    else if (!isValidSaMobile(ph)) {
      errs.phone = isAr ? "رقم غير صالح (05xxxxxxxx)" : "Invalid number (05xxxxxxxx)";
    }
    if (!formData.guardianName.trim()) {
      errs.guardianName = isAr ? "مطلوب" : "Required";
    }
    const gp = formData.guardianPhone.replace(/\D/g, "");
    if (!gp) errs.guardianPhone = isAr ? "مطلوب" : "Required";
    else if (!isValidSaMobile(gp)) {
      errs.guardianPhone = isAr ? "رقم غير صالح" : "Invalid number";
    }

    if (
      formData.newPassword.length > 0 ||
      formData.confirmPassword.length > 0 ||
      formData.currentPassword.length > 0
    ) {
      if (!formData.currentPassword) {
        errs.currentPassword = isAr ? "أدخل كلمة المرور الحالية" : "Enter current password";
      }
      if (!newPasswordMeetsPolicy(formData.newPassword)) {
        errs.newPassword = isAr
          ? "8 أحرف، حرف كبير، ورقم"
          : "8+ chars, uppercase, number";
      }
      if (formData.newPassword !== formData.confirmPassword) {
        errs.confirmPassword = isAr ? "غير متطابقة" : "Does not match";
      }
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }, [formData, isAr]);

  const handleSave = async () => {
    if (!validate()) {
      setToast({
        kind: "err",
        text: isAr ? "صحح الأخطاء قبل الحفظ" : "Fix errors before saving",
      });
      return;
    }

    setIsSaving(true);
    try {
      let profilePhotoBase64: string | undefined;
      if (formData.profilePhoto) {
        profilePhotoBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (typeof reader.result === "string") resolve(reader.result);
            else reject(new Error("read"));
          };
          reader.onerror = reject;
          reader.readAsDataURL(formData.profilePhoto!);
        });
      }

      const updatePayload: Record<string, unknown> = {
        fullName: formData.fullNameAr || formData.fullName,
        fullNameAr: formData.fullNameAr,
        fullNameEn: formData.fullNameEn,
        phone: formData.phone.replace(/\D/g, ""),
        gender: formData.gender,
        section: formData.section,
        grade: normalizeGrade(formData.grade) || formData.grade,
        guardianName: formData.guardianName,
        guardianPhone: formData.guardianPhone.replace(/\D/g, ""),
        guardianNationalId: formData.guardianNationalId,
        preferredLanguage: locale,
        notifications: formData.notifications,
        privacy: formData.privacy,
        studentPortfolioContent: buildPortfolioContentForSave(
          formData.portfolioBio,
          formData.portfolioTechLines,
          formData.portfolioPersLines,
          formData.portfolioCourses,
          formData.portfolioActivities,
          formData.portfolioShowEmail,
          formData.portfolioShowPhone
        ),
      };

      if (profilePhotoBase64) updatePayload.profilePhoto = profilePhotoBase64;
      if (formData.newPassword && formData.currentPassword) {
        updatePayload.currentPassword = formData.currentPassword;
        updatePayload.newPassword = formData.newPassword;
      }

      const response = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save");
      }

      const updatedData = await response.json();
      setFormData((prev) => ({
        ...prev,
        fullName: updatedData.fullName || prev.fullName,
        fullNameAr: updatedData.fullNameAr || prev.fullNameAr,
        fullNameEn: updatedData.fullNameEn || prev.fullNameEn,
        email: updatedData.email || prev.email,
        username: updatedData.username || prev.username,
        phone: (updatedData.phone || "").replace(/\D/g, ""),
        gender: updatedData.gender || prev.gender,
        section:
          updatedData.section === "عربي"
            ? "arabic"
            : updatedData.section === "دولي"
              ? "international"
              : prev.section,
        grade: updatedData.grade || prev.grade,
        guardianName: updatedData.guardianName || prev.guardianName,
        guardianPhone: (updatedData.guardianPhone || "").replace(/\D/g, ""),
        guardianNationalId: updatedData.guardianNationalId || prev.guardianNationalId,
        profilePhotoPreview: updatedData.profilePhoto || prev.profilePhotoPreview,
        profilePhoto: null,
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
        notifications: mergeNotificationPrefs(updatedData.notifications),
        privacy: mergePrivacyPrefs(updatedData.privacy),
        ...portfolioStateFromApi(
          (updatedData as { studentPortfolioContent?: unknown }).studentPortfolioContent
        ),
      }));
      setFieldErrors({});

      router.refresh();
      setToast({ kind: "ok", text: isAr ? "✅ تم الحفظ بنجاح" : "✅ Saved successfully" });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "";
      setToast({
        kind: "err",
        text: (isAr ? "❌ فشل الحفظ — " : "❌ Save failed — ") + message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const pwdBarColor = (i: number) => (pwdStrength.score > i ? "bg-primary" : "bg-gray-200");

  return (
    <PageContainer className="!max-w-4xl py-6 md:py-8">
      {toast ? (
        <div
          className={`fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
            toast.kind === "ok"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border border-red-200 bg-red-50 text-red-900"
          }`}
          role="status"
        >
          {toast.kind === "ok" ? (
            <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden />
          ) : (
            <XCircle className="h-5 w-5 shrink-0" aria-hidden />
          )}
          {toast.text}
        </div>
      ) : null}

      <PageHeader
        title={t.settings.title}
        subtitle={t.settings.subtitle}
        actions={
          <div className="flex flex-wrap gap-3">
            <Link
              href="/profile"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-text transition-colors hover:bg-gray-50"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{isAr ? "رجوع" : "Back"}</span>
            </Link>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || passwordMismatch}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
            >
              {isSaving ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span>{t.settings.save}</span>
            </button>
          </div>
        }
      />

      <div className="space-y-8">
        <SectionCard>
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-text">
              {isAr ? "المعلومات الشخصية" : "Personal information"}
            </h2>
          </div>

          <div className="space-y-5">
            <div>
              <span className={labelClass}>{isAr ? "الصورة الشخصية" : "Profile photo"}</span>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50">
                  {formData.profilePhotoPreview ? (
                    <Image
                      src={formData.profilePhotoPreview}
                      alt={isAr ? "معاينة الصورة" : "Profile preview"}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Camera className="h-8 w-8 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleChange("profilePhoto", file);
                    }}
                    className="hidden"
                    id="profile-photo"
                  />
                  <label
                    htmlFor="profile-photo"
                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-text transition hover:bg-gray-50"
                  >
                    <Camera className="h-4 w-4" />
                    {isAr ? "اختر صورة" : "Choose photo"}
                  </label>
                  <p className="text-xs text-text-light">{isAr ? "اختياري" : "Optional"}</p>
                </div>
              </div>
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
                <p className="text-xs font-medium text-amber-800">
                  {isAr
                    ? "يجب الالتزام برفع صورة رسمية للطالب، حيث سيتم استخدامها في العرض التقديمي للحفل، وأيضًا ستظهر في صفحة الطالب."
                    : "Please upload an official formal photo of the student, as it will be used in the ceremony presentation and will also appear on the student's page."}
                </p>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <span className={labelClass}>
                  {isAr ? "اسم الطالب بالعربية" : "Student name (Arabic)"} *
                </span>
                <input
                  type="text"
                  dir="rtl"
                  lang="ar"
                  value={formData.fullNameAr}
                  onChange={(e) => handleChange("fullNameAr", e.target.value)}
                  className={`${fieldClass} ${fieldErrors.fullNameAr ? "border-red-400" : ""}`}
                  placeholder={isAr ? "أدخل اسم الطالب بالعربية" : "Enter student name in Arabic"}
                />
                {fieldErrors.fullNameAr ? (
                  <p className="mt-1 text-sm text-red-600" role="alert">
                    {fieldErrors.fullNameAr}
                  </p>
                ) : null}
              </div>

              <div className="sm:col-span-2">
                <span className={labelClass}>
                  {isAr ? "اسم الطالب بالإنجليزية" : "Student name (English)"} *
                </span>
                <input
                  type="text"
                  dir="ltr"
                  lang="en"
                  autoComplete="name"
                  value={formData.fullNameEn}
                  onChange={(e) => handleChange("fullNameEn", e.target.value)}
                  className={`${fieldClass} ${fieldErrors.fullNameEn ? "border-red-400" : ""}`}
                  placeholder={isAr ? "أدخل اسم الطالب بالإنجليزية" : "Enter student name in English"}
                />
                {fieldErrors.fullNameEn ? (
                  <p className="mt-1 text-sm text-red-600" role="alert">
                    {fieldErrors.fullNameEn}
                  </p>
                ) : null}
              </div>

              <div>
                <span className={labelClass}>{isAr ? "رقم هوية الطالب" : "Student ID"}</span>
                <input
                  type="text"
                  dir="ltr"
                  value={formData.studentId}
                  disabled
                  className={`${fieldClass} cursor-not-allowed bg-gray-100 text-gray-600`}
                />
                <p className="mt-1 text-xs text-text-light">{lockHint(isAr)}</p>
              </div>

              {formData.nationalId ? (
                <div>
                  <span className={labelClass}>{isAr ? "رقم الهوية" : "National ID"}</span>
                  <input
                    type="text"
                    dir="ltr"
                    value={formData.nationalId}
                    disabled
                    className={`${fieldClass} cursor-not-allowed bg-gray-100 text-gray-600`}
                  />
                  <p className="mt-1 text-xs text-text-light">{lockHint(isAr)}</p>
                </div>
              ) : null}

              <div>
                <span className={labelClass}>{isAr ? "اسم المستخدم" : "Username"}</span>
                <input
                  type="text"
                  dir="ltr"
                  autoComplete="username"
                  value={formData.username}
                  disabled
                  className={`${fieldClass} cursor-not-allowed bg-gray-100 text-gray-600`}
                />
                <p className="mt-1 text-xs text-text-light">{lockHint(isAr)}</p>
              </div>

              <div>
                <span className={labelClass}>{isAr ? "البريد الإلكتروني" : "Email"}</span>
                <input
                  type="email"
                  dir="ltr"
                  lang="en"
                  autoComplete="email"
                  value={formData.email}
                  disabled
                  className={`${fieldClass} cursor-not-allowed bg-gray-100 text-gray-600`}
                />
                <p className="mt-1 text-xs text-text-light">{lockHint(isAr)}</p>
              </div>

              <div className="sm:col-span-2">
                <span className={labelClass}>{isAr ? "الجنس" : "Gender"} *</span>
                <p className="mb-3 text-xs text-text-light">{isAr ? "اختر واحداً" : "Select one"}</p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <label className="flex flex-1 cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 transition hover:border-primary">
                    <input
                      type="radio"
                      name="gender"
                      value="male"
                      checked={formData.gender === "male"}
                      onChange={(e) => handleChange("gender", e.target.value as "male")}
                      className="h-4 w-4 shrink-0 text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-medium text-text">{isAr ? "ذكر" : "Male"}</span>
                  </label>
                  <label className="flex flex-1 cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 transition hover:border-primary">
                    <input
                      type="radio"
                      name="gender"
                      value="female"
                      checked={formData.gender === "female"}
                      onChange={(e) => handleChange("gender", e.target.value as "female")}
                      className="h-4 w-4 shrink-0 text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-medium text-text">{isAr ? "أنثى" : "Female"}</span>
                  </label>
                </div>
                {fieldErrors.gender ? (
                  <p className="mt-1 text-sm text-red-600" role="alert">
                    {fieldErrors.gender}
                  </p>
                ) : null}
              </div>

              <div className="sm:col-span-2">
                <span className={`${labelClass} mb-3`}>{isAr ? "الصف والقسم" : "Grade & section"}</span>
                <div className="grid gap-5 rounded-xl border border-gray-100 bg-gray-50/90 p-4 sm:grid-cols-2">
                  <div>
                    <span className={labelClass}>{isAr ? "الصف الدراسي" : "Grade"} *</span>
                    <select
                      value={formData.grade}
                      onChange={(e) => handleChange("grade", e.target.value)}
                      className={`${fieldClass} ${fieldErrors.grade ? "border-red-400" : ""}`}
                    >
                      <option value="">{isAr ? "اختر الصف الدراسي" : "Select grade"}</option>
                      {GRADE_OPTIONS.map((grade) => (
                        <option key={grade.value} value={grade.value}>
                          {isAr ? grade.ar : grade.en}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.grade ? (
                      <p className="mt-1 text-sm text-red-600" role="alert">
                        {fieldErrors.grade}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <span className={labelClass}>{isAr ? "القسم" : "Section"} *</span>
                    <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                      <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-xl border border-gray-200 bg-white p-3 transition hover:border-primary">
                        <input
                          type="radio"
                          name="section"
                          value="arabic"
                          checked={formData.section === "arabic"}
                          onChange={(e) => handleChange("section", e.target.value as "arabic")}
                          className="h-4 w-4 text-primary focus:ring-primary"
                        />
                        <span className="text-sm font-medium text-text">{isAr ? "عربي" : "Arabic"}</span>
                      </label>
                      <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-xl border border-gray-200 bg-white p-3 transition hover:border-primary">
                        <input
                          type="radio"
                          name="section"
                          value="international"
                          checked={formData.section === "international"}
                          onChange={(e) =>
                            handleChange("section", e.target.value as "international")
                          }
                          className="h-4 w-4 text-primary focus:ring-primary"
                        />
                        <span className="text-sm font-medium text-text">
                          {isAr ? "دولي" : "International"}
                        </span>
                      </label>
                    </div>
                    {fieldErrors.section ? (
                      <p className="mt-1 text-sm text-red-600" role="alert">
                        {fieldErrors.section}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="sm:col-span-2">
                <span className={labelClass}>{isAr ? "رقم جوال الطالب" : "Student phone"} *</span>
                <div className="relative" dir="ltr">
                  <Phone className="pointer-events-none absolute end-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="tel"
                    value={formData.phone}
                    onChange={(e) => {
                      const numbersOnly = e.target.value.replace(/\D/g, "");
                      if (numbersOnly.length <= 10) {
                        handleChange("phone", numbersOnly);
                      }
                    }}
                    maxLength={10}
                    className={`${fieldClass} pe-11 ${fieldErrors.phone ? "border-red-400" : ""}`}
                    placeholder={isAr ? "مثال: 05xxxxxxxx" : "e.g. 05xxxxxxxx"}
                  />
                </div>
                {fieldErrors.phone ? (
                  <p className="mt-1 text-sm text-red-600" role="alert">
                    {fieldErrors.phone}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard>
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-text">
              {isAr ? "بيانات ولي الأمر" : "Guardian information"}
            </h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <span className={labelClass}>{isAr ? "اسم ولي الأمر" : "Guardian name"} *</span>
              <input
                type="text"
                dir="rtl"
                lang="ar"
                value={formData.guardianName}
                onChange={(e) => handleChange("guardianName", e.target.value)}
                className={`${fieldClass} ${fieldErrors.guardianName ? "border-red-400" : ""}`}
                placeholder={isAr ? "أدخل اسم ولي الأمر" : "Enter guardian name"}
              />
              {fieldErrors.guardianName ? (
                <p className="mt-1 text-sm text-red-600" role="alert">
                  {fieldErrors.guardianName}
                </p>
              ) : null}
            </div>

            <div>
              <span className={labelClass}>{isAr ? "رقم هوية ولي الأمر" : "Guardian national ID"}</span>
              <div dir="ltr">
                <input
                  type="text"
                  inputMode="numeric"
                  value={formData.guardianNationalId}
                  onChange={(e) => {
                    const numbersOnly = e.target.value.replace(/\D/g, "");
                    if (numbersOnly.length <= 10) {
                      handleChange("guardianNationalId", numbersOnly);
                    }
                  }}
                  maxLength={10}
                  className={fieldClass}
                  placeholder={isAr ? "أرقام فقط" : "Digits only"}
                />
              </div>
            </div>

            <div>
              <span className={labelClass}>{isAr ? "رقم جوال ولي الأمر" : "Guardian phone"} *</span>
              <div className="relative" dir="ltr">
                <Phone className="pointer-events-none absolute end-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="tel"
                  value={formData.guardianPhone}
                  onChange={(e) => {
                    const numbersOnly = e.target.value.replace(/\D/g, "");
                    if (numbersOnly.length <= 10) {
                      handleChange("guardianPhone", numbersOnly);
                    }
                  }}
                  maxLength={10}
                  className={`${fieldClass} pe-11 ${fieldErrors.guardianPhone ? "border-red-400" : ""}`}
                  placeholder={isAr ? "مثال: 05xxxxxxxx" : "e.g. 05xxxxxxxx"}
                />
              </div>
              {fieldErrors.guardianPhone ? (
                <p className="mt-1 text-sm text-red-600" role="alert">
                  {fieldErrors.guardianPhone}
                </p>
              ) : null}
            </div>
          </div>
        </SectionCard>

        <SectionCard>
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-text">{isAr ? "الأمان" : "Security"}</h2>
          </div>
          <h3 className="mb-3 text-sm font-bold text-text">
            {isAr ? "تغيير كلمة المرور" : "Change password"}
          </h3>
          <p className="mb-5 text-sm text-text-light">
            {isAr
              ? "اترك حقول كلمة المرور فارغة إن لم ترد تغييرها. عند التغيير: 8 أحرف على الأقل، حرف كبير، ورقم."
              : "Leave password fields blank to keep your password. To change: at least 8 characters, one uppercase letter, and one number."}
          </p>
          <div className="space-y-5" dir="ltr">
            {(
              [
                ["currentPassword", "current-password"],
                ["newPassword", "new-password"],
                ["confirmPassword", "new-password"],
              ] as const
            ).map(([key, auto]) => {
              const val =
                key === "currentPassword"
                  ? formData.currentPassword
                  : key === "newPassword"
                    ? formData.newPassword
                    : formData.confirmPassword;
              const setVal = (v: string) => handleChange(key, v);
              const sk = key === "currentPassword" ? "cur" : key === "newPassword" ? "nw" : "cf";
              return (
                <div key={key}>
                  <label htmlFor={`stu-pw-${key}`} className={labelClass}>
                    {key === "currentPassword"
                      ? isAr
                        ? "كلمة المرور الحالية"
                        : "Current password"
                      : key === "newPassword"
                        ? isAr
                          ? "كلمة المرور الجديدة"
                          : "New password"
                        : isAr
                          ? "تأكيد كلمة المرور الجديدة"
                          : "Confirm new password"}
                  </label>
                  <div className="relative">
                    <input
                      id={`stu-pw-${key}`}
                      type={showPw[sk as keyof typeof showPw] ? "text" : "password"}
                      autoComplete={auto}
                      value={val}
                      onChange={(e) => setVal(e.target.value)}
                      className={`${fieldClass} pe-12 ${fieldErrors[key] ? "border-red-400" : ""} ${key === "confirmPassword" && passwordMismatch ? "border-red-400" : ""}`}
                    />
                    <button
                      type="button"
                      tabIndex={0}
                      aria-label={isAr ? "إظهار أو إخفاء" : "Show or hide password"}
                      className="absolute end-3 top-1/2 -translate-y-1/2 rounded p-1 text-gray-500 hover:bg-gray-100"
                      onClick={() =>
                        setShowPw((p) => ({ ...p, [sk]: !p[sk as keyof typeof p] }))
                      }
                    >
                      {showPw[sk as keyof typeof showPw] ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                  {fieldErrors[key] ? (
                    <p className="mt-1 text-sm text-red-600" role="alert">
                      {fieldErrors[key]}
                    </p>
                  ) : null}
                </div>
              );
            })}
            {formData.newPassword.length > 0 ? (
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <p className="mb-2 text-xs font-semibold text-text">
                  {isAr ? "قوة كلمة المرور" : "Password strength"}
                </p>
                <div className="mb-2 flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className={`h-2 flex-1 rounded-full transition-colors ${pwdBarColor(i)}`}
                    />
                  ))}
                </div>
                <ul className="space-y-1 text-xs text-text-light">
                  <li className={pwdStrength.passesMinLength ? "text-emerald-700" : ""}>
                    {isAr ? "• 8 أحرف على الأقل" : "• At least 8 characters"}
                  </li>
                  <li className={pwdStrength.passesUpper ? "text-emerald-700" : ""}>
                    {isAr ? "• حرف كبير (إنجليزي)" : "• One uppercase letter"}
                  </li>
                  <li className={pwdStrength.passesNumber ? "text-emerald-700" : ""}>
                    {isAr ? "• رقم واحد على الأقل" : "• One number"}
                  </li>
                </ul>
              </div>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard>
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Star className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-text">
              {isAr ? "ملف الإنجاز العام — محتوى إضافي" : "Public portfolio — extra profile"}
            </h2>
          </div>
          <p className="mb-6 text-sm text-text-light">
            {isAr
              ? "يظهر ما تدخله هنا في صفحة ملف الإنجاز العام عند تفعيله. اترك الحقول فارغة لإخفاء القسم."
              : "What you enter here appears on your public achievement portfolio when enabled. Leave fields empty to hide sections."}
          </p>
          <div className="space-y-6">
            <div>
              <label htmlFor="stu-portfolio-bio" className={labelClass}>
                {isAr ? "نبذة عن الطالب" : "Short bio"}
              </label>
              <textarea
                id="stu-portfolio-bio"
                value={formData.portfolioBio}
                onChange={(e) => handleChange("portfolioBio", e.target.value)}
                rows={4}
                className={fieldClass}
                maxLength={4000}
              />
            </div>
            <div>
              <label htmlFor="stu-portfolio-tech" className={labelClass}>
                {isAr ? "المهارات التقنية (سطر لكل مهارة)" : "Technical skills (one per line)"}
              </label>
              <textarea
                id="stu-portfolio-tech"
                value={formData.portfolioTechLines}
                onChange={(e) => handleChange("portfolioTechLines", e.target.value)}
                rows={3}
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="stu-portfolio-pers" className={labelClass}>
                {isAr ? "المهارات الشخصية (سطر لكل مهارة)" : "Personal skills (one per line)"}
              </label>
              <textarea
                id="stu-portfolio-pers"
                value={formData.portfolioPersLines}
                onChange={(e) => handleChange("portfolioPersLines", e.target.value)}
                rows={3}
                className={fieldClass}
              />
            </div>
            <div>
              <p className={`${labelClass} mb-2`}>{isAr ? "الدورات والشهادات" : "Courses & certificates"}</p>
              <div className="space-y-4">
                {formData.portfolioCourses.map((row, idx) => (
                  <div
                    key={`pc-${idx}`}
                    className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 space-y-3"
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        placeholder={isAr ? "العنوان" : "Title"}
                        value={row.title}
                        onChange={(e) =>
                          setFormData((p) => {
                            const next = [...p.portfolioCourses];
                            next[idx] = { ...next[idx], title: e.target.value };
                            return { ...p, portfolioCourses: next };
                          })
                        }
                        className={fieldClass}
                      />
                      <input
                        placeholder={isAr ? "المزود / الجهة" : "Provider"}
                        value={row.provider}
                        onChange={(e) =>
                          setFormData((p) => {
                            const next = [...p.portfolioCourses];
                            next[idx] = { ...next[idx], provider: e.target.value };
                            return { ...p, portfolioCourses: next };
                          })
                        }
                        className={fieldClass}
                      />
                      <input
                        placeholder={isAr ? "النوع" : "Type"}
                        value={row.type}
                        onChange={(e) =>
                          setFormData((p) => {
                            const next = [...p.portfolioCourses];
                            next[idx] = { ...next[idx], type: e.target.value };
                            return { ...p, portfolioCourses: next };
                          })
                        }
                        className={fieldClass}
                      />
                      <input
                        placeholder={isAr ? "ساعات تدريبية" : "Training hours"}
                        value={row.trainingHoursStr}
                        onChange={(e) =>
                          setFormData((p) => {
                            const next = [...p.portfolioCourses];
                            next[idx] = { ...next[idx], trainingHoursStr: e.target.value };
                            return { ...p, portfolioCourses: next };
                          })
                        }
                        className={fieldClass}
                        dir="ltr"
                      />
                      <input
                        placeholder={isAr ? "التاريخ" : "Date"}
                        value={row.date}
                        onChange={(e) =>
                          setFormData((p) => {
                            const next = [...p.portfolioCourses];
                            next[idx] = { ...next[idx], date: e.target.value };
                            return { ...p, portfolioCourses: next };
                          })
                        }
                        className={fieldClass}
                      />
                      <input
                        placeholder={isAr ? "رابط" : "URL"}
                        value={row.url}
                        onChange={(e) =>
                          setFormData((p) => {
                            const next = [...p.portfolioCourses];
                            next[idx] = { ...next[idx], url: e.target.value };
                            return { ...p, portfolioCourses: next };
                          })
                        }
                        className={fieldClass}
                        dir="ltr"
                      />
                    </div>
                    {formData.portfolioCourses.length > 1 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((p) => ({
                            ...p,
                            portfolioCourses: p.portfolioCourses.filter((_, i) => i !== idx),
                          }))
                        }
                        className="text-xs font-bold text-red-600 hover:underline"
                      >
                        {isAr ? "حذف هذا الصف" : "Remove this row"}
                      </button>
                    ) : null}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setFormData((p) =>
                      p.portfolioCourses.length >= 25
                        ? p
                        : { ...p, portfolioCourses: [...p.portfolioCourses, emptyCourseRow()] }
                    )
                  }
                  disabled={formData.portfolioCourses.length >= 25}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-text hover:bg-gray-50 disabled:opacity-40"
                >
                  <PlusCircle className="h-4 w-4" aria-hidden />
                  {isAr ? "إضافة دورة / شهادة" : "Add course / certificate"}
                </button>
              </div>
            </div>
            <div>
              <p className={`${labelClass} mb-2`}>{isAr ? "الأنشطة والتطوع" : "Activities & volunteering"}</p>
              <div className="space-y-4">
                {formData.portfolioActivities.map((row, idx) => (
                  <div
                    key={`pa-${idx}`}
                    className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 space-y-3"
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        placeholder={isAr ? "العنوان" : "Title"}
                        value={row.title}
                        onChange={(e) =>
                          setFormData((p) => {
                            const next = [...p.portfolioActivities];
                            next[idx] = { ...next[idx], title: e.target.value };
                            return { ...p, portfolioActivities: next };
                          })
                        }
                        className={fieldClass}
                      />
                      <input
                        placeholder={isAr ? "النوع" : "Type"}
                        value={row.type}
                        onChange={(e) =>
                          setFormData((p) => {
                            const next = [...p.portfolioActivities];
                            next[idx] = { ...next[idx], type: e.target.value };
                            return { ...p, portfolioActivities: next };
                          })
                        }
                        className={fieldClass}
                      />
                      <input
                        placeholder={isAr ? "الجهة / المنظمة" : "Organization"}
                        value={row.organization}
                        onChange={(e) =>
                          setFormData((p) => {
                            const next = [...p.portfolioActivities];
                            next[idx] = { ...next[idx], organization: e.target.value };
                            return { ...p, portfolioActivities: next };
                          })
                        }
                        className={fieldClass}
                      />
                      <input
                        placeholder={isAr ? "الساعات" : "Hours"}
                        value={row.hoursStr}
                        onChange={(e) =>
                          setFormData((p) => {
                            const next = [...p.portfolioActivities];
                            next[idx] = { ...next[idx], hoursStr: e.target.value };
                            return { ...p, portfolioActivities: next };
                          })
                        }
                        className={fieldClass}
                        dir="ltr"
                      />
                      <input
                        placeholder={isAr ? "التاريخ" : "Date"}
                        value={row.date}
                        onChange={(e) =>
                          setFormData((p) => {
                            const next = [...p.portfolioActivities];
                            next[idx] = { ...next[idx], date: e.target.value };
                            return { ...p, portfolioActivities: next };
                          })
                        }
                        className={fieldClass}
                      />
                    </div>
                    <textarea
                      placeholder={isAr ? "الوصف" : "Description"}
                      value={row.description}
                      onChange={(e) =>
                        setFormData((p) => {
                          const next = [...p.portfolioActivities];
                          next[idx] = { ...next[idx], description: e.target.value };
                          return { ...p, portfolioActivities: next };
                        })
                      }
                      rows={2}
                      className={fieldClass}
                    />
                    {formData.portfolioActivities.length > 1 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((p) => ({
                            ...p,
                            portfolioActivities: p.portfolioActivities.filter((_, i) => i !== idx),
                          }))
                        }
                        className="text-xs font-bold text-red-600 hover:underline"
                      >
                        {isAr ? "حذف هذا الصف" : "Remove this row"}
                      </button>
                    ) : null}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setFormData((p) =>
                      p.portfolioActivities.length >= 25
                        ? p
                        : { ...p, portfolioActivities: [...p.portfolioActivities, emptyActivityRow()] }
                    )
                  }
                  disabled={formData.portfolioActivities.length >= 25}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-text hover:bg-gray-50 disabled:opacity-40"
                >
                  <PlusCircle className="h-4 w-4" aria-hidden />
                  {isAr ? "إضافة نشاط" : "Add activity"}
                </button>
              </div>
            </div>
            <div className="space-y-4 rounded-xl border border-gray-100 bg-gray-50/50 p-4">
              <p className="text-sm font-semibold text-text">
                {isAr ? "الظهور في ملف الإنجاز العام" : "Visibility on public portfolio"}
              </p>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={formData.portfolioShowEmail}
                  onChange={(e) => handleChange("portfolioShowEmail", e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-primary"
                />
                <span className="text-sm text-text-light">
                  {isAr
                    ? "عرض البريد الإلكتروني في قسم معلومات التواصل (يظهر فقط عند وجود بريد مسجّل)."
                    : "Show email in the portfolio contact section (only if an email exists on your account)."}
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={formData.portfolioShowPhone}
                  onChange={(e) => handleChange("portfolioShowPhone", e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-primary"
                />
                <span className="text-sm text-text-light">
                  {isAr
                    ? "عرض رقم الجوال في قسم معلومات التواصل (يظهر فقط عند وجود رقم مسجّل)."
                    : "Show phone in the portfolio contact section (only if a phone exists on your account)."}
                </span>
              </label>
            </div>
          </div>
        </SectionCard>

        <SectionCard>
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-text">{t.settings.language}</h2>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-text">
                {isAr ? "اللغة المفضلة" : "Preferred language"}
              </p>
              <p className="mt-1 max-w-xl text-sm text-text-light">
                {isAr
                  ? "اختر اللغة التي تفضلها لعرض واجهة المنصة."
                  : "Choose the language used for the platform interface."}
              </p>
            </div>
            <LanguageSwitcher />
          </div>
        </SectionCard>

        <SectionCard>
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-text">{t.settings.notifications}</h2>
          </div>
          <div className="space-y-6">
            {(
              [
                ["news", isAr ? "إشعارات الأخبار" : "News notifications", isAr ? "تنبيهات الأخبار والتحديثات العامة." : "Alerts for news and general updates."],
                ["review", isAr ? "إشعارات المراجعة" : "Review notifications", isAr ? "تنبيهات طلبات المراجعة والاعتماد." : "Alerts for review and approval requests."],
                ["system", isAr ? "إشعارات النظام" : "System notifications", isAr ? "تنبيهات مهمة من المنصة." : "Important platform notices."],
                ["email", isAr ? "إشعارات البريد الإلكتروني" : "Email notifications", isAr ? "إرسال التنبيهات إلى بريدك." : "Send alerts to your email."],
              ] as const
            ).map(([k, title, desc]) => (
              <div
                key={k}
                className="flex flex-col gap-3 border-b border-gray-100 pb-6 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text">{title}</p>
                  <p className="mt-1 text-sm text-text-light">{desc}</p>
                </div>
                <label className="relative inline-flex shrink-0 cursor-pointer items-center self-start sm:self-center" dir="ltr">
                  <input
                    type="checkbox"
                    checked={formData.notifications[k]}
                    onChange={(e) => setNotif(k, e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="h-7 w-12 rounded-full bg-gray-300 transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30" />
                  <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
                </label>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard>
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-text">{t.settings.privacy}</h2>
          </div>
          <div className="space-y-6">
            {(
              [
                [
                  "showNameInSystem",
                  isAr ? "عرض الاسم في النظام" : "Show name in the system",
                  isAr
                    ? "يظهر اسمك في القوائم والنتائج للمستخدمين المصرّح لهم."
                    : "Your name appears in lists and results for authorized users.",
                ],
                [
                  "showEmailToSupervisors",
                  isAr ? "عرض البريد للمشرفين" : "Show email to supervisors",
                  isAr
                    ? "يُسمح للمشرفين برؤية بريدك عند الحاجة."
                    : "Supervisors may see your email when needed.",
                ],
                [
                  "showProfileInAdminPanel",
                  isAr ? "عرض الملف في لوحة الإدارة" : "Show profile in admin panel",
                  isAr
                    ? "يظهر ملفك في أدوات الإدارة والتقارير."
                    : "Your profile is visible in admin tools and reports.",
                ],
              ] as const
            ).map(([k, title, desc]) => (
              <div
                key={k}
                className="flex flex-col gap-3 border-b border-gray-100 pb-6 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text">{title}</p>
                  <p className="mt-1 text-sm text-text-light">{desc}</p>
                </div>
                <label className="relative inline-flex shrink-0 cursor-pointer items-center self-start sm:self-center" dir="ltr">
                  <input
                    type="checkbox"
                    checked={formData.privacy[k]}
                    onChange={(e) => setPriv(k, e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="h-7 w-12 rounded-full bg-gray-300 transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30" />
                  <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
                </label>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </PageContainer>
  );
};

export default StudentSettings;
