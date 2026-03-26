"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import {
  User,
  Lock,
  Bell,
  Save,
  ArrowLeft,
  Phone,
  Camera,
  Shield,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { initLocale } from "@/lib/i18n";
import { getTranslation } from "@/locales";
import Image from "next/image";
import {
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_PRIVACY_PREFS,
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

const AdminSettings = () => {
  const router = useRouter();
  const [locale, setLocale] = useState<"ar" | "en">("ar");
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState("");

  const [notifications, setNotifications] =
    useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFS);
  const [privacy, setPrivacy] = useState<PrivacyPreferences>(DEFAULT_PRIVACY_PREFS);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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

    const load = async () => {
      try {
        const res = await fetch("/api/user/profile");
        if (!res.ok) return;
        const data = await res.json();
        setFullName(data.fullName || data.fullNameAr || "");
        setUsername(data.username || "");
        setEmail(data.email || "");
        setPhone((data.phone || "").replace(/\D/g, ""));
        setProfilePhotoPreview(data.profilePhoto || "");
        setNotifications(mergeNotificationPrefs(data.notifications));
        setPrivacy(mergePrivacyPrefs(data.privacy));
      } catch {
        /* ignore */
      }
    };
    void load();
  }, []);

  const t = getTranslation(locale);
  const isAr = locale === "ar";

  const pwdStrength = useMemo(() => evaluatePasswordStrength(newPassword), [newPassword]);
  const passwordMismatch =
    newPassword.length > 0 && confirmPassword.length > 0 && newPassword !== confirmPassword;

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {};
    if (!fullName.trim()) {
      errs.fullName = isAr ? "الاسم مطلوب" : "Full name is required";
    }
    const ph = phone.replace(/\D/g, "");
    if (!ph) {
      errs.phone = isAr ? "رقم الجوال مطلوب" : "Phone is required";
    } else if (!isValidSaMobile(ph)) {
      errs.phone = isAr ? "أدخل رقمًا صالحًا (10 أرقام تبدأ بـ 05)" : "Enter a valid number (10 digits starting with 05)";
    }
    if (newPassword.length > 0 || confirmPassword.length > 0 || currentPassword.length > 0) {
      if (!currentPassword) {
        errs.currentPassword = isAr ? "أدخل كلمة المرور الحالية" : "Enter current password";
      }
      if (!newPasswordMeetsPolicy(newPassword)) {
        errs.newPassword = isAr
          ? "8 أحرف على الأقل، مع حرف كبير ورقم"
          : "At least 8 characters, one uppercase letter and one number";
      }
      if (newPassword !== confirmPassword) {
        errs.confirmPassword = isAr ? "غير متطابقة" : "Does not match";
      }
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }, [fullName, phone, newPassword, confirmPassword, currentPassword, isAr]);

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
      if (profilePhoto) {
        profilePhotoBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (typeof reader.result === "string") resolve(reader.result);
            else reject(new Error("read"));
          };
          reader.onerror = reject;
          reader.readAsDataURL(profilePhoto);
        });
      }

      const updatePayload: Record<string, unknown> = {
        fullName: fullName.trim(),
        fullNameAr: fullName.trim(),
        phone: phone.replace(/\D/g, ""),
        preferredLanguage: locale,
        notifications,
        privacy,
      };

      if (profilePhotoBase64) updatePayload.profilePhoto = profilePhotoBase64;

      if (newPassword && currentPassword) {
        updatePayload.currentPassword = currentPassword;
        updatePayload.newPassword = newPassword;
      }

      const response = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload),
      });

      const updated = await response.json();
      if (!response.ok) {
        throw new Error(updated.error || "Failed");
      }

      setFullName(updated.fullName || fullName);
      setPhone((updated.phone || "").replace(/\D/g, ""));
      setProfilePhotoPreview(updated.profilePhoto || profilePhotoPreview);
      setProfilePhoto(null);
      setNotifications(mergeNotificationPrefs(updated.notifications));
      setPrivacy(mergePrivacyPrefs(updated.privacy));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setFieldErrors({});
      router.refresh();
      setToast({ kind: "ok", text: isAr ? "✅ تم الحفظ بنجاح" : "✅ Saved successfully" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      setToast({
        kind: "err",
        text: (isAr ? "❌ فشل الحفظ — " : "❌ Save failed — ") + msg,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleNotif = (key: keyof NotificationPreferences) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const togglePrivacy = (key: keyof PrivacyPreferences) => {
    setPrivacy((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const pwdBarColor = (i: number) =>
    pwdStrength.score > i ? "bg-primary" : "bg-gray-200";

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
              disabled={isSaving || (newPassword.length > 0 && passwordMismatch)}
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
                  {profilePhotoPreview ? (
                    <Image
                      src={profilePhotoPreview}
                      alt=""
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
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    id="admin-profile-photo"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setProfilePhoto(file);
                        setProfilePhotoPreview(URL.createObjectURL(file));
                      }
                    }}
                  />
                  <label
                    htmlFor="admin-profile-photo"
                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-text transition hover:bg-gray-50"
                  >
                    <Camera className="h-4 w-4" />
                    {isAr ? "اختر صورة" : "Choose photo"}
                  </label>
                  <p className="mt-1 text-xs text-text-light">{isAr ? "اختياري" : "Optional"}</p>
                </div>
              </div>
            </div>

            <div>
              <span className={labelClass}>{isAr ? "الاسم الكامل" : "Full name"} *</span>
              <input
                type="text"
                dir={isAr ? "rtl" : "ltr"}
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  setFieldErrors((x) => {
                    const { fullName: _, ...r } = x;
                    return r;
                  });
                }}
                className={`${fieldClass} ${fieldErrors.fullName ? "border-red-400" : ""}`}
              />
              {fieldErrors.fullName ? (
                <p className="mt-1 text-sm text-red-600" role="alert">
                  {fieldErrors.fullName}
                </p>
              ) : null}
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <span className={labelClass}>{isAr ? "اسم المستخدم" : "Username"}</span>
                <input
                  type="text"
                  dir="ltr"
                  value={username}
                  disabled
                  className={`${fieldClass} cursor-not-allowed bg-gray-100 text-gray-600`}
                  autoComplete="username"
                />
                <p className="mt-1 text-xs text-text-light">{lockHint(isAr)}</p>
              </div>
              <div>
                <span className={labelClass}>{isAr ? "البريد الإلكتروني" : "Email"}</span>
                <input
                  type="email"
                  dir="ltr"
                  value={email}
                  disabled
                  className={`${fieldClass} cursor-not-allowed bg-gray-100 text-gray-600`}
                  autoComplete="email"
                />
                <p className="mt-1 text-xs text-text-light">{lockHint(isAr)}</p>
              </div>
            </div>

            <div>
              <span className={labelClass}>{isAr ? "رقم الهاتف" : "Phone"} *</span>
              <div className="relative" dir="ltr">
                <Phone className="pointer-events-none absolute end-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => {
                    const d = e.target.value.replace(/\D/g, "");
                    if (d.length <= 10) setPhone(d);
                    setFieldErrors((x) => {
                      const { phone: _, ...r } = x;
                      return r;
                    });
                  }}
                  maxLength={10}
                  className={`${fieldClass} pe-11 ${fieldErrors.phone ? "border-red-400" : ""}`}
                  placeholder="05xxxxxxxx"
                />
              </div>
              {fieldErrors.phone ? (
                <p className="mt-1 text-sm text-red-600" role="alert">
                  {fieldErrors.phone}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-gray-100 bg-gray-50/80 p-4">
              <div>
                <p className="text-sm font-semibold text-text">{isAr ? "اللغة" : "Language"}</p>
                <p className="mt-1 text-sm text-text-light">
                  {isAr ? "لغة واجهة المنصة." : "Platform interface language."}
                </p>
              </div>
              <LanguageSwitcher />
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
              ? "اترك الحقول فارغة إن لم ترد التغيير. عند التغيير: 8 أحرف على الأقل، حرف كبير، ورقم."
              : "Leave blank to keep password. If changing: at least 8 characters, one uppercase letter, and one number."}
          </p>

          <div className="space-y-5" dir="ltr">
            {(
              [
                ["currentPassword", currentPassword, setCurrentPassword, "cur", "current-password"],
                ["newPassword", newPassword, setNewPassword, "nw", "new-password"],
                ["confirmPassword", confirmPassword, setConfirmPassword, "cf", "new-password"],
              ] as const
            ).map(([key, val, setVal, sk, auto]) => (
              <div key={key}>
                <label htmlFor={`adm-pw-${key}`} className={labelClass}>
                  {key === "currentPassword"
                    ? isAr
                      ? "كلمة المرور الحالية"
                      : "Current password"
                    : key === "newPassword"
                      ? isAr
                        ? "كلمة المرور الجديدة"
                        : "New password"
                      : isAr
                        ? "تأكيد كلمة المرور"
                        : "Confirm password"}
                </label>
                <div className="relative">
                  <input
                    id={`adm-pw-${key}`}
                    type={showPw[sk as keyof typeof showPw] ? "text" : "password"}
                    autoComplete={auto}
                    value={val}
                    onChange={(e) => {
                      setVal(e.target.value);
                      setFieldErrors((x) => {
                        const { [key]: _, ...r } = x;
                        return r;
                      });
                    }}
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
            ))}

            {newPassword.length > 0 ? (
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
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-text">{isAr ? "الإشعارات" : "Notifications"}</h2>
          </div>
          <div className="space-y-6">
            {(
              [
                ["news", isAr ? "إشعارات الأخبار" : "News notifications", isAr ? "تنبيهات الأخبار والتحديثات العامة." : "Alerts for news and general updates."],
                ["review", isAr ? "إشعارات المراجعة" : "Review notifications", isAr ? "طلبات المراجعة والاعتماد المتعلقة بعملك." : "Review and approval items related to your role."],
                ["system", isAr ? "إشعارات النظام" : "System notifications", isAr ? "تنبيهات مهمة من المنصة (الصيانة، الأمان، إلخ)." : "Important platform notices (maintenance, security, etc.)."],
                ["email", isAr ? "إشعارات البريد الإلكتروني" : "Email notifications", isAr ? "إرسال التنبيهات إلى بريدك المسجّل." : "Send alerts to your registered email."],
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
                    checked={notifications[k]}
                    onChange={() => toggleNotif(k)}
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
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-text">{isAr ? "الخصوصية" : "Privacy"}</h2>
          </div>
          <div className="space-y-6">
            {(
              [
                [
                  "showNameInSystem",
                  isAr ? "عرض الاسم في النظام" : "Show name in the system",
                  isAr
                    ? "يظهر اسمك في القوائم والنتائج الداخلية للمستخدمين المصرّح لهم."
                    : "Your name appears in internal lists and results for authorized users.",
                ],
                [
                  "showEmailToSupervisors",
                  isAr ? "عرض البريد للمشرفين" : "Show email to supervisors",
                  isAr
                    ? "يُسمح للمشرفين والإدارة برؤية بريدك عند الحاجة التشغيلية."
                    : "Supervisors and admins may see your email when needed for operations.",
                ],
                [
                  "showProfileInAdminPanel",
                  isAr ? "عرض الملف في لوحة الإدارة" : "Show profile in admin panel",
                  isAr
                    ? "يظهر ملفك في أدوات الإدارة (تقارير، مراجعة، دعم)."
                    : "Your profile is visible in admin tools (reports, review, support).",
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
                    checked={privacy[k]}
                    onChange={() => togglePrivacy(k)}
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

export default AdminSettings;
