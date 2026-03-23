"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import { User, Lock, Globe, Bell, Save, ArrowLeft, Phone, Camera, AlertCircle, Shield } from "lucide-react";
import { initLocale } from "@/lib/i18n";
import { getTranslation } from "@/locales";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import Image from "next/image";
import { GRADE_OPTIONS, normalizeGrade } from "@/constants/grades";

const fieldClass =
  "w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

const labelClass = "mb-1.5 block text-sm font-semibold text-text";

export default function SettingsPage() {
  const router = useRouter();
  const [locale, setLocale] = useState<"ar" | "en">("ar");
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    profilePhoto: null as File | null,
    profilePhotoPreview: "",
    fullName: "",
    fullNameAr: "",
    fullNameEn: "",
    studentId: "",
    username: "",
    nationalId: "",
    gender: "" as "male" | "female" | "",
    section: "" as "arabic" | "international" | "",
    grade: "",
    phone: "",
    email: "",
    guardianName: "",
    guardianPhone: "",
    guardianNationalId: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    emailNotifications: true,
    publicProfile: true,
  });

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
            section: data.section === "عربي" ? "arabic" : data.section === "دولي" ? "international" : data.section || "",
            grade: data.grade || "",
            phone: data.phone || "",
            guardianName: data.guardianName || "",
            guardianPhone: data.guardianPhone || "",
            guardianNationalId: data.guardianNationalId || "",
            profilePhotoPreview: data.profilePhoto || "",
          }));
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };
    fetchUserData();
  }, []);

  const t = getTranslation(locale);
  const isArabic = locale === "ar";

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
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (formData.newPassword) {
        if (formData.newPassword !== formData.confirmPassword) {
          alert(isArabic ? "كلمة المرور الجديدة وتأكيدها غير متطابقتين" : "New password and confirmation do not match");
          setIsSaving(false);
          return;
        }
        if (formData.newPassword.length < 8) {
          alert(isArabic ? "كلمة المرور يجب أن تكون 8 أحرف على الأقل" : "Password must be at least 8 characters");
          setIsSaving(false);
          return;
        }
      }

      let profilePhotoBase64: string | undefined = undefined;
      if (formData.profilePhoto) {
        const reader = new FileReader();
        profilePhotoBase64 = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => {
            if (typeof reader.result === "string") {
              resolve(reader.result);
            } else {
              reject(new Error("Failed to convert image to base64"));
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(formData.profilePhoto!);
        });
      }

      const updatePayload: Record<string, unknown> = {
        fullName: formData.fullName,
        fullNameAr: formData.fullNameAr,
        fullNameEn: formData.fullNameEn,
        phone: formData.phone,
        gender: formData.gender,
        section: formData.section,
        grade: normalizeGrade(formData.grade) || formData.grade,
        guardianName: formData.guardianName,
        guardianPhone: formData.guardianPhone,
        guardianNationalId: formData.guardianNationalId,
        preferredLanguage: locale,
      };

      if (profilePhotoBase64) {
        updatePayload.profilePhoto = profilePhotoBase64;
      }

      if (formData.newPassword && formData.currentPassword) {
        updatePayload.currentPassword = formData.currentPassword;
        updatePayload.newPassword = formData.newPassword;
      }

      const response = await fetch("/api/user/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
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
        phone: updatedData.phone || prev.phone,
        gender: updatedData.gender || prev.gender,
        section: updatedData.section === "عربي" ? "arabic" : updatedData.section === "دولي" ? "international" : prev.section,
        grade: updatedData.grade || prev.grade,
        guardianName: updatedData.guardianName || prev.guardianName,
        guardianPhone: updatedData.guardianPhone || prev.guardianPhone,
        guardianNationalId: updatedData.guardianNationalId || prev.guardianNationalId,
        profilePhotoPreview: updatedData.profilePhoto || prev.profilePhotoPreview,
        profilePhoto: null,
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      }));

      router.refresh();

      alert(isArabic ? "تم الحفظ بنجاح" : "Saved successfully");
    } catch (error: unknown) {
      console.error("Error saving:", error);
      const message = error instanceof Error ? error.message : "";
      alert(isArabic ? "حدث خطأ أثناء الحفظ" : message || "Error saving");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageContainer className="!max-w-4xl py-6 md:py-8">
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
              <span>{isArabic ? "رجوع" : "Back"}</span>
            </Link>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || passwordMismatch}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{t.settings.save}</span>
            </button>
          </div>
        }
      />

      <div className="space-y-8">
        {/* بيانات الطالب */}
        <SectionCard>
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-text">{isArabic ? "بيانات الطالب" : "Student information"}</h2>
          </div>

          <div className="space-y-5">
            <div>
              <span className={labelClass}>{isArabic ? "الصورة الشخصية" : "Profile photo"}</span>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50">
                  {formData.profilePhotoPreview ? (
                    <Image
                      src={formData.profilePhotoPreview}
                      alt={isArabic ? "معاينة الصورة" : "Profile preview"}
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
                    {isArabic ? "اختر صورة" : "Choose photo"}
                  </label>
                  <p className="text-xs text-text-light">{isArabic ? "اختياري" : "Optional"}</p>
                </div>
              </div>
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
                <p className="text-xs font-medium text-amber-800">
                  {isArabic
                    ? "يجب الالتزام برفع صورة رسمية للطالب، حيث سيتم استخدامها في العرض التقديمي للحفل، وأيضًا ستظهر في صفحة الطالب."
                    : "Please upload an official formal photo of the student, as it will be used in the ceremony presentation and will also appear on the student's page."}
                </p>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <span className={labelClass}>
                  {isArabic ? "اسم الطالب بالعربية" : "Student name (Arabic)"} *
                </span>
                <input
                  type="text"
                  dir="rtl"
                  lang="ar"
                  value={formData.fullNameAr}
                  onChange={(e) => handleChange("fullNameAr", e.target.value)}
                  className={fieldClass}
                  placeholder={isArabic ? "أدخل اسم الطالب بالعربية" : "Enter student name in Arabic"}
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <span className={labelClass}>
                  {isArabic ? "اسم الطالب بالإنجليزية" : "Student name (English)"} *
                </span>
                <input
                  type="text"
                  dir="ltr"
                  lang="en"
                  autoComplete="name"
                  value={formData.fullNameEn}
                  onChange={(e) => handleChange("fullNameEn", e.target.value)}
                  className={fieldClass}
                  placeholder={isArabic ? "أدخل اسم الطالب بالإنجليزية" : "Enter student name in English"}
                  required
                />
              </div>

              <div>
                <span className={labelClass}>{isArabic ? "رقم هوية الطالب" : "Student ID"}</span>
                <input
                  type="text"
                  dir="ltr"
                  value={formData.studentId}
                  disabled
                  className={`${fieldClass} cursor-not-allowed bg-gray-100 text-gray-600`}
                />
                <p className="mt-1 text-xs text-text-light">{isArabic ? "لا يمكن تعديل هذا الحقل" : "This field cannot be edited"}</p>
              </div>

              {formData.nationalId ? (
                <div>
                  <span className={labelClass}>{isArabic ? "رقم الهوية" : "National ID"}</span>
                  <input
                    type="text"
                    dir="ltr"
                    value={formData.nationalId}
                    disabled
                    className={`${fieldClass} cursor-not-allowed bg-gray-100 text-gray-600`}
                  />
                  <p className="mt-1 text-xs text-text-light">{isArabic ? "لا يمكن تعديل هذا الحقل" : "This field cannot be edited"}</p>
                </div>
              ) : null}

              <div>
                <span className={labelClass}>{isArabic ? "اسم المستخدم" : "Username"}</span>
                <input
                  type="text"
                  dir="ltr"
                  autoComplete="username"
                  value={formData.username}
                  disabled
                  className={`${fieldClass} cursor-not-allowed bg-gray-100 text-gray-600`}
                />
                <p className="mt-1 text-xs text-text-light">{isArabic ? "لا يمكن تعديل هذا الحقل" : "This field cannot be edited"}</p>
              </div>

              <div>
                <span className={labelClass}>{isArabic ? "البريد الإلكتروني" : "Email"}</span>
                <input
                  type="email"
                  dir="ltr"
                  lang="en"
                  autoComplete="email"
                  value={formData.email}
                  disabled
                  className={`${fieldClass} cursor-not-allowed bg-gray-100 text-gray-600`}
                />
                <p className="mt-1 text-xs text-text-light">{isArabic ? "لا يمكن تعديل هذا الحقل" : "This field cannot be edited"}</p>
              </div>

              <div className="sm:col-span-2">
                <span className={labelClass}>{isArabic ? "الجنس" : "Gender"} *</span>
                <p className="mb-3 text-xs text-text-light">{isArabic ? "اختر واحداً" : "Select one"}</p>
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
                    <span className="text-sm font-medium text-text">{isArabic ? "ذكر" : "Male"}</span>
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
                    <span className="text-sm font-medium text-text">{isArabic ? "أنثى" : "Female"}</span>
                  </label>
                </div>
              </div>

              <div className="sm:col-span-2">
                <span className={`${labelClass} mb-3`}>{isArabic ? "الصف والقسم" : "Grade & section"}</span>
                <div className="grid gap-5 rounded-xl border border-gray-100 bg-gray-50/90 p-4 sm:grid-cols-2">
                  <div>
                    <span className={labelClass}>{isArabic ? "الصف الدراسي" : "Grade"} *</span>
                    <select
                      value={formData.grade}
                      onChange={(e) => handleChange("grade", e.target.value)}
                      className={fieldClass}
                      required
                    >
                      <option value="">{isArabic ? "اختر الصف الدراسي" : "Select grade"}</option>
                      {GRADE_OPTIONS.map((grade) => (
                        <option key={grade.value} value={grade.value}>
                          {isArabic ? grade.ar : grade.en}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <span className={labelClass}>{isArabic ? "القسم" : "Section"} *</span>
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
                        <span className="text-sm font-medium text-text">{isArabic ? "عربي" : "Arabic"}</span>
                      </label>
                      <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-xl border border-gray-200 bg-white p-3 transition hover:border-primary">
                        <input
                          type="radio"
                          name="section"
                          value="international"
                          checked={formData.section === "international"}
                          onChange={(e) => handleChange("section", e.target.value as "international")}
                          className="h-4 w-4 text-primary focus:ring-primary"
                        />
                        <span className="text-sm font-medium text-text">{isArabic ? "دولي" : "International"}</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="sm:col-span-2">
                <span className={labelClass}>{isArabic ? "رقم جوال الطالب" : "Student phone"} *</span>
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
                    className={`${fieldClass} pe-11`}
                    placeholder={isArabic ? "مثال: 05xxxxxxxx" : "e.g. 05xxxxxxxx"}
                    required
                  />
                </div>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* بيانات ولي الأمر */}
        <SectionCard>
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-text">{isArabic ? "بيانات ولي الأمر" : "Guardian information"}</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <span className={labelClass}>{isArabic ? "اسم ولي الأمر" : "Guardian name"} *</span>
              <input
                type="text"
                dir="rtl"
                lang="ar"
                value={formData.guardianName}
                onChange={(e) => handleChange("guardianName", e.target.value)}
                className={fieldClass}
                placeholder={isArabic ? "أدخل اسم ولي الأمر" : "Enter guardian name"}
                required
              />
            </div>

            <div>
              <span className={labelClass}>{isArabic ? "رقم هوية ولي الأمر" : "Guardian national ID"}</span>
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
                  placeholder={isArabic ? "أرقام فقط" : "Digits only"}
                />
              </div>
            </div>

            <div>
              <span className={labelClass}>{isArabic ? "رقم جوال ولي الأمر" : "Guardian phone"} *</span>
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
                  className={`${fieldClass} pe-11`}
                  placeholder={isArabic ? "مثال: 05xxxxxxxx" : "e.g. 05xxxxxxxx"}
                  required
                />
              </div>
            </div>
          </div>
        </SectionCard>

        {/* بيانات الدخول */}
        <SectionCard>
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-text">{isArabic ? "بيانات الدخول" : "Login & password"}</h2>
          </div>
          <p className="mb-5 text-sm text-text-light">
            {isArabic
              ? "اترك حقول كلمة المرور فارغة إن لم ترد تغييرها. عند التغيير، أدخل كلمة المرور الحالية والجديدة معاً."
              : "Leave password fields blank to keep your current password. To change it, enter both your current and new password."}
          </p>
          <div className="space-y-5" dir="ltr">
            <div>
              <label htmlFor="settings-current-password" className={labelClass}>
                {isArabic ? "كلمة المرور الحالية" : "Current password"}
              </label>
              <input
                id="settings-current-password"
                type="password"
                autoComplete="current-password"
                value={formData.currentPassword}
                onChange={(e) => handleChange("currentPassword", e.target.value)}
                className={fieldClass}
                placeholder={isArabic ? "اختياري — مطلوب عند تغيير كلمة المرور" : "Optional — required only to set a new password"}
              />
            </div>
            <div>
              <label htmlFor="settings-new-password" className={labelClass}>
                {isArabic ? "كلمة المرور الجديدة" : "New password"}
              </label>
              <input
                id="settings-new-password"
                type="password"
                autoComplete="new-password"
                value={formData.newPassword}
                onChange={(e) => handleChange("newPassword", e.target.value)}
                className={fieldClass}
                placeholder={isArabic ? "اتركه فارغاً إن لم ترد التغيير (8 أحرف على الأقل)" : "Leave blank to skip (min. 8 characters if set)"}
              />
            </div>
            <div>
              <label htmlFor="settings-confirm-password" className={labelClass}>
                {isArabic ? "تأكيد كلمة المرور الجديدة" : "Confirm new password"}
              </label>
              <input
                id="settings-confirm-password"
                type="password"
                autoComplete="new-password"
                value={formData.confirmPassword}
                onChange={(e) => handleChange("confirmPassword", e.target.value)}
                className={`${fieldClass} ${passwordMismatch ? "border-red-400 focus:border-red-500 focus:ring-red-200" : ""}`}
                placeholder={isArabic ? "أعد إدخال كلمة المرور الجديدة مطابقةً للحقل أعلاه" : "Re-enter the same new password as above"}
              />
              {passwordMismatch ? (
                <p className="mt-1.5 text-sm font-medium text-red-600" role="alert">
                  {isArabic ? "كلمة المرور غير متطابقة" : "Passwords do not match"}
                </p>
              ) : null}
            </div>
          </div>
        </SectionCard>

        {/* اللغة */}
        <SectionCard>
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-text">{t.settings.language}</h2>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-text">{isArabic ? "اللغة المفضلة" : "Preferred language"}</p>
              <p className="mt-1 max-w-xl text-sm text-text-light">
                {isArabic ? "اختر اللغة التي تفضلها لعرض واجهة المنصة." : "Choose the language used for the platform interface."}
              </p>
            </div>
            <LanguageSwitcher />
          </div>
        </SectionCard>

        {/* الإشعارات */}
        <SectionCard>
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-text">{t.settings.notifications}</h2>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <label htmlFor="notify-email" className="text-sm font-semibold text-text">
                {isArabic ? "إشعارات البريد الإلكتروني" : "Email notifications"}
              </label>
              <p id="notify-email-hint" className="mt-1 max-w-xl text-sm text-text-light">
                {isArabic
                  ? "عند التفعيل، يمكن إرسال تنبيهات وتحديثات مهمة إلى بريدك المسجّل في النظام."
                  : "When enabled, important alerts and updates may be sent to the email on your account."}
              </p>
            </div>
            <div dir="ltr" className="shrink-0 self-start sm:self-center">
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  id="notify-email"
                  type="checkbox"
                  checked={formData.emailNotifications}
                  onChange={(e) => handleChange("emailNotifications", e.target.checked)}
                  className="peer sr-only"
                  aria-describedby="notify-email-hint"
                />
                <div className="h-7 w-12 rounded-full bg-gray-300 transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30" />
                <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
              </label>
            </div>
          </div>
        </SectionCard>

        {/* الخصوصية */}
        <SectionCard>
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-text">{t.settings.privacy}</h2>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <label htmlFor="privacy-public" className="text-sm font-semibold text-text">
                {isArabic ? "الملف الشخصي العام" : "Public profile"}
              </label>
              <p id="privacy-public-hint" className="mt-1 max-w-xl text-sm text-text-light">
                {isArabic
                  ? "يحدد ما إ كان بإمكان الآخرين الاطلاع على ملفك ضمن المنصة وفق سياسات العرض المعتمدة."
                  : "Controls whether others can view your profile within the platform under the approved display rules."}
              </p>
            </div>
            <div dir="ltr" className="shrink-0 self-start sm:self-center">
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  id="privacy-public"
                  type="checkbox"
                  checked={formData.publicProfile}
                  onChange={(e) => handleChange("publicProfile", e.target.checked)}
                  className="peer sr-only"
                  aria-describedby="privacy-public-hint"
                />
                <div className="h-7 w-12 rounded-full bg-gray-300 transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30" />
                <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
              </label>
            </div>
          </div>
        </SectionCard>
      </div>
    </PageContainer>
  );
}
