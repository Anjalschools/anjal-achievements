"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Eye,
  EyeOff,
  UserPlus,
  Mail,
  User,
  Lock,
  Phone,
  BadgeInfo,
  Camera,
} from "lucide-react";
import PlatformLogo from "@/components/branding/PlatformLogo";
import { initLocale } from "@/lib/i18n";
import { getTranslation } from "@/locales";
import { GRADE_OPTIONS } from "@/constants/grades";
import { AlertCircle } from "lucide-react";

type Locale = "ar" | "en";

export default function RegisterPage() {
  const [locale, setLocale] = useState<Locale>("ar");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Student Info
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [fullNameAr, setFullNameAr] = useState("");
  const [fullNameEn, setFullNameEn] = useState("");
  const [studentId, setStudentId] = useState("");
  const [username, setUsername] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [section, setSection] = useState<"arabic" | "international" | "">("");
  const [grade, setGrade] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Guardian Info
  const [guardianName, setGuardianName] = useState("");
  const [guardianId, setGuardianId] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");

  // Login Info
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Agreements
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [notificationsAgreed, setNotificationsAgreed] = useState(false);

  const fullNameArRef = useRef<HTMLInputElement>(null);
  const fullNameEnRef = useRef<HTMLInputElement>(null);
  const studentIdRef = useRef<HTMLInputElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const genderMaleRef = useRef<HTMLInputElement>(null);
  const sectionArabicRef = useRef<HTMLInputElement>(null);
  const gradeSelectRef = useRef<HTMLSelectElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const guardianNameRef = useRef<HTMLInputElement>(null);
  const guardianIdRef = useRef<HTMLInputElement>(null);
  const guardianPhoneRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);
  const termsRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    initLocale();
    const savedLocale =
      typeof window !== "undefined"
        ? (localStorage.getItem("platform-locale") as Locale | null)
        : null;

    if (savedLocale === "ar" || savedLocale === "en") {
      setLocale(savedLocale);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("platform-locale", locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  const t = useMemo(() => getTranslation(locale), [locale]);
  const isArabic = locale === "ar";

  const validateStudentId = (id: string) => /^\d{10}$/.test(id);
  const validatePhone = (phoneValue: string) => /^05\d{8}$/.test(phoneValue);
  const validateEmail = (emailValue: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue);

  const focusRef = (r: React.RefObject<HTMLElement | null>) => {
    requestAnimationFrame(() => {
      const el = r.current;
      if (!el) return;
      el.focus({ preventScroll: false });
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!fullNameAr.trim()) {
      setError(isArabic ? "اسم الطالب بالعربية مطلوب" : "Student name in Arabic is required");
      focusRef(fullNameArRef);
      return;
    }

    if (!fullNameEn.trim()) {
      setError(isArabic ? "اسم الطالب بالإنجليزية مطلوب" : "Student name in English is required");
      focusRef(fullNameEnRef);
      return;
    }

    // Use Arabic name as fullName for backward compatibility
    const normalizedFullName = fullNameAr.trim();

    if (!studentId.trim()) {
      setError(t.register.requiredStudentId);
      focusRef(studentIdRef);
      return;
    }

    if (!validateStudentId(studentId)) {
      setError(t.register.invalidStudentId);
      focusRef(studentIdRef);
      return;
    }

    if (!username.trim()) {
      setError(t.register.requiredUsername);
      focusRef(usernameRef);
      return;
    }

    if (!gender) {
      setError(t.register.requiredGender);
      focusRef(genderMaleRef);
      return;
    }

    if (!section) {
      setError(t.register.requiredSection);
      focusRef(sectionArabicRef);
      return;
    }

    if (!grade) {
      setError(t.register.requiredGrade);
      focusRef(gradeSelectRef);
      return;
    }

    if (!email.trim()) {
      setError(t.register.requiredEmail);
      focusRef(emailRef);
      return;
    }

    if (!validateEmail(email)) {
      setError(t.register.invalidEmail);
      focusRef(emailRef);
      return;
    }

    if (!phone.trim()) {
      setError(t.register.requiredPhone);
      focusRef(phoneRef);
      return;
    }

    if (!validatePhone(phone)) {
      setError(t.register.invalidPhone);
      focusRef(phoneRef);
      return;
    }

    if (!guardianName.trim()) {
      setError(t.register.requiredGuardianName);
      focusRef(guardianNameRef);
      return;
    }

    if (!guardianId.trim()) {
      setError(t.register.requiredGuardianId);
      focusRef(guardianIdRef);
      return;
    }

    if (!validateStudentId(guardianId)) {
      setError(t.register.invalidGuardianId);
      focusRef(guardianIdRef);
      return;
    }

    if (!guardianPhone.trim()) {
      setError(t.register.requiredGuardianPhone);
      focusRef(guardianPhoneRef);
      return;
    }

    if (!validatePhone(guardianPhone)) {
      setError(t.register.invalidPhone);
      focusRef(guardianPhoneRef);
      return;
    }

    if (!password.trim()) {
      setError(t.register.requiredPassword);
      focusRef(passwordRef);
      return;
    }

    if (password.length < 8) {
      setError(t.register.passwordMinLength);
      focusRef(passwordRef);
      return;
    }

    if (!confirmPassword.trim()) {
      setError(t.register.requiredConfirmPassword);
      focusRef(confirmPasswordRef);
      return;
    }

    if (password !== confirmPassword) {
      setError(t.register.passwordMismatch);
      focusRef(confirmPasswordRef);
      return;
    }

    if (!termsAgreed) {
      setError(t.register.requiredTerms);
      focusRef(termsRef);
      return;
    }

    try {
      setIsSubmitting(true);

      const formData = new FormData();
      if (profilePhoto) formData.append("profilePhoto", profilePhoto);
      formData.append("fullName", normalizedFullName);
      formData.append("fullNameAr", fullNameAr.trim());
      formData.append("fullNameEn", fullNameEn.trim());
      formData.append("studentId", studentId);
      formData.append("username", username);
      formData.append("gender", gender);
      formData.append("section", section);
      formData.append("grade", grade);
      formData.append("email", email);
      formData.append("phone", phone);
      formData.append("guardianName", guardianName);
      formData.append("guardianId", guardianId);
      formData.append("guardianPhone", guardianPhone);
      formData.append("password", password);
      formData.append("termsAgreed", termsAgreed.toString());
      formData.append("notificationsAgreed", notificationsAgreed.toString());
      formData.append("preferredLanguage", locale);

      const response = await fetch("/api/auth/register", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || t.register.registrationError);
        return;
      }

      setSuccess(true);
      setError("");
      setTimeout(() => {
        window.location.href = "/login";
      }, 2000);
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.error("[register]", err);
      }
      setError(t.register.registrationError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStudentIdChange = (value: string) => {
    const numbersOnly = value.replace(/\D/g, "");
    if (numbersOnly.length <= 10) {
      setStudentId(numbersOnly);
    }
  };

  const handleGuardianIdChange = (value: string) => {
    const numbersOnly = value.replace(/\D/g, "");
    if (numbersOnly.length <= 10) {
      setGuardianId(numbersOnly);
    }
  };

  const handlePhoneChange = (value: string, setter: (val: string) => void) => {
    const numbersOnly = value.replace(/\D/g, "");
    if (numbersOnly.length <= 10) {
      setter(numbersOnly);
    }
  };

  return (
    <div className="min-h-[calc(100vh-120px)] bg-gradient-to-b from-sky-50 via-white to-blue-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
    <div className="mx-auto w-full max-w-4xl" dir={isArabic ? "rtl" : "ltr"}>
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex items-center justify-center">
              <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                <PlatformLogo variant="color" size={64} priority />
              </div>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              {t.register.title}
            </h1>
            <p className="mt-2 text-sm text-slate-500">{t.register.subtitle}</p>
          </div>

          <form noValidate onSubmit={handleSubmit} className="space-y-6">
            {(error || success) && (
              <div className="space-y-2">
                {error ? (
                  <div
                    className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                    role="alert"
                  >
                    {error}
                  </div>
                ) : null}
                {success ? (
                  <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                    {t.register.registrationSuccess}
                  </div>
                ) : null}
              </div>
            )}

            <div className="rounded-3xl border border-white/60 bg-white/90 p-6 shadow-xl shadow-sky-100 backdrop-blur sm:p-8">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100">
                  <User className="h-5 w-5 text-sky-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">
                  {t.register.studentInfo}
                </h2>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    {t.register.profilePhoto}
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="relative h-24 w-24 overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50">
                      {profilePhoto ? (
                        <Image
                          src={URL.createObjectURL(profilePhoto)}
                          alt="Profile"
                          fill
                          unoptimized
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Camera className="h-8 w-8 text-slate-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <input
                        type="file"
                        name="profilePhoto"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setProfilePhoto(file);
                        }}
                        className="hidden"
                        id="profile-photo"
                      />
                      <label
                        htmlFor="profile-photo"
                        className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        <Camera className="h-4 w-4" />
                        {isArabic ? "اختر صورة" : "Choose Photo"}
                      </label>
                      <p className="mt-1 text-xs text-slate-500">
                        {isArabic ? "اختياري" : "Optional"}
                      </p>
                    </div>
                  </div>
                  {/* Official Photo Notice */}
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
                    <p className="text-xs font-medium text-amber-800">
                      {isArabic
                        ? "يجب الالتزام برفع صورة رسمية للطالب، حيث سيتم استخدامها في العرض التقديمي للحفل، وأيضًا ستظهر في صفحة الطالب."
                        : "Please upload an official formal photo of the student, as it will be used in the ceremony presentation and will also appear on the student's page."}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    {isArabic ? "اسم الطالب بالعربية" : "Student Name in Arabic"} *
                  </label>
                  <div className="relative">
                    <span
                      className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400 ${
                        isArabic ? "right-3" : "left-3"
                      }`}
                    >
                      <User className="h-5 w-5" />
                    </span>
                    <input
                      ref={fullNameArRef}
                      id="register-fullNameAr"
                      name="fullNameAr"
                      type="text"
                      autoComplete="name"
                      value={fullNameAr}
                      onChange={(e) => setFullNameAr(e.target.value)}
                      placeholder={isArabic ? "أدخل اسم الطالب بالعربية" : "Enter student name in Arabic"}
                      className={`h-12 w-full rounded-2xl border border-slate-200 bg-white text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 ${
                        isArabic ? "pr-11 pl-4" : "pl-11 pr-4"
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    {isArabic ? "اسم الطالب بالإنجليزية" : "Student Name in English"} *
                  </label>
                  <div className="relative">
                    <span
                      className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400 ${
                        isArabic ? "right-3" : "left-3"
                      }`}
                    >
                      <User className="h-5 w-5" />
                    </span>
                    <input
                      ref={fullNameEnRef}
                      id="register-fullNameEn"
                      name="fullNameEn"
                      type="text"
                      autoComplete="name"
                      value={fullNameEn}
                      onChange={(e) => setFullNameEn(e.target.value)}
                      placeholder={isArabic ? "Enter student name in English" : "Enter student name in English"}
                      className={`h-12 w-full rounded-2xl border border-slate-200 bg-white text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 ${
                        isArabic ? "pr-11 pl-4" : "pl-11 pr-4"
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    {t.register.studentId} *
                  </label>
                  <div className="relative">
                    <span
                      className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400 ${
                        isArabic ? "right-3" : "left-3"
                      }`}
                    >
                      <BadgeInfo className="h-5 w-5" />
                    </span>
                    <input
                      ref={studentIdRef}
                      id="register-studentId"
                      name="studentId"
                      type="text"
                      inputMode="numeric"
                      value={studentId}
                      onChange={(e) => handleStudentIdChange(e.target.value)}
                      placeholder={t.register.studentIdPlaceholder}
                      maxLength={10}
                      className={`h-12 w-full rounded-2xl border border-slate-200 bg-white text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 ${
                        isArabic ? "pr-11 pl-4" : "pl-11 pr-4"
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    {t.register.username} *
                  </label>
                  <div className="relative">
                    <span
                      className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400 ${
                        isArabic ? "right-3" : "left-3"
                      }`}
                    >
                      <User className="h-5 w-5" />
                    </span>
                    <input
                      ref={usernameRef}
                      id="register-username"
                      name="username"
                      type="text"
                      autoComplete="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder={t.register.usernamePlaceholder}
                      className={`h-12 w-full rounded-2xl border border-slate-200 bg-white text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 ${
                        isArabic ? "pr-11 pl-4" : "pl-11 pr-4"
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    {t.register.gender} *
                  </label>
                  <div className="flex gap-3">
                    <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-sky-300">
                      <input
                        ref={genderMaleRef}
                        type="radio"
                        name="gender"
                        value="male"
                        checked={gender === "male"}
                        onChange={(e) =>
                          setGender(e.target.value as "male" | "female")
                        }
                        className="h-4 w-4 text-sky-600 focus:ring-sky-500"
                      />
                      <span className="text-sm font-medium text-slate-700">
                        {t.register.genderMale}
                      </span>
                    </label>
                    <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-sky-300">
                      <input
                        type="radio"
                        name="gender"
                        value="female"
                        checked={gender === "female"}
                        onChange={(e) =>
                          setGender(e.target.value as "male" | "female")
                        }
                        className="h-4 w-4 text-sky-600 focus:ring-sky-500"
                        required
                      />
                      <span className="text-sm font-medium text-slate-700">
                        {t.register.genderFemale}
                      </span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    {t.register.section} *
                  </label>
                  <div className="flex gap-3">
                    <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-sky-300">
                      <input
                        ref={sectionArabicRef}
                        type="radio"
                        name="section"
                        value="arabic"
                        checked={section === "arabic"}
                        onChange={(e) =>
                          setSection(e.target.value as "arabic" | "international")
                        }
                        className="h-4 w-4 text-sky-600 focus:ring-sky-500"
                      />
                      <span className="text-sm font-medium text-slate-700">
                        {t.register.sectionArabic}
                      </span>
                    </label>
                    <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-sky-300">
                      <input
                        type="radio"
                        name="section"
                        value="international"
                        checked={section === "international"}
                        onChange={(e) =>
                          setSection(e.target.value as "arabic" | "international")
                        }
                        className="h-4 w-4 text-sky-600 focus:ring-sky-500"
                        required
                      />
                      <span className="text-sm font-medium text-slate-700">
                        {t.register.sectionInternational}
                      </span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    {t.register.grade} *
                  </label>
                  <div className="relative">
                    <span
                      className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400 ${
                        isArabic ? "right-3" : "left-3"
                      }`}
                    >
                      <User className="h-5 w-5" />
                    </span>
                    <select
                      ref={gradeSelectRef}
                      id="register-grade"
                      name="grade"
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      className={`h-12 w-full appearance-none rounded-2xl border border-slate-200 bg-white text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100 ${
                        isArabic ? "pr-11 pl-4" : "pl-11 pr-4"
                      }`}
                    >
                      <option value="">{t.register.gradePlaceholder}</option>
                      {GRADE_OPTIONS.map((g) => (
                        <option key={g.value} value={g.value}>
                          {isArabic ? g.ar : g.en}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    {t.register.email} *
                  </label>
                  <div className="relative">
                    <span
                      className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400 ${
                        isArabic ? "right-3" : "left-3"
                      }`}
                    >
                      <Mail className="h-5 w-5" />
                    </span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t.register.emailPlaceholder}
                      className={`h-12 w-full rounded-2xl border border-slate-200 bg-white text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 ${
                        isArabic ? "pr-11 pl-4" : "pl-11 pr-4"
                      }`}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    {t.register.phone} *
                  </label>
                  <div className="relative">
                    <span
                      className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400 ${
                        isArabic ? "right-3" : "left-3"
                      }`}
                    >
                      <Phone className="h-5 w-5" />
                    </span>
                    <input
                      ref={phoneRef}
                      id="register-phone"
                      name="phone"
                      type="text"
                      inputMode="numeric"
                      value={phone}
                      onChange={(e) => handlePhoneChange(e.target.value, setPhone)}
                      placeholder={t.register.phonePlaceholder}
                      maxLength={10}
                      className={`h-12 w-full rounded-2xl border border-slate-200 bg-white text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 ${
                        isArabic ? "pr-11 pl-4" : "pl-11 pr-4"
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/60 bg-white/90 p-6 shadow-xl shadow-sky-100 backdrop-blur sm:p-8">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100">
                  <User className="h-5 w-5 text-sky-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">
                  {t.register.guardianInfo}
                </h2>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    {t.register.guardianName} *
                  </label>
                  <div className="relative">
                    <span
                      className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400 ${
                        isArabic ? "right-3" : "left-3"
                      }`}
                    >
                      <User className="h-5 w-5" />
                    </span>
                    <input
                      ref={guardianNameRef}
                      id="register-guardianName"
                      name="guardianName"
                      type="text"
                      value={guardianName}
                      onChange={(e) => setGuardianName(e.target.value)}
                      placeholder={t.register.guardianNamePlaceholder}
                      className={`h-12 w-full rounded-2xl border border-slate-200 bg-white text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 ${
                        isArabic ? "pr-11 pl-4" : "pl-11 pr-4"
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    {t.register.guardianId} *
                  </label>
                  <div className="relative">
                    <span
                      className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400 ${
                        isArabic ? "right-3" : "left-3"
                      }`}
                    >
                      <BadgeInfo className="h-5 w-5" />
                    </span>
                    <input
                      ref={guardianIdRef}
                      id="register-guardianId"
                      name="guardianId"
                      type="text"
                      inputMode="numeric"
                      value={guardianId}
                      onChange={(e) => handleGuardianIdChange(e.target.value)}
                      placeholder={t.register.guardianIdPlaceholder}
                      maxLength={10}
                      className={`h-12 w-full rounded-2xl border border-slate-200 bg-white text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 ${
                        isArabic ? "pr-11 pl-4" : "pl-11 pr-4"
                      }`}
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    {t.register.guardianPhone} *
                  </label>
                  <div className="relative">
                    <span
                      className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400 ${
                        isArabic ? "right-3" : "left-3"
                      }`}
                    >
                      <Phone className="h-5 w-5" />
                    </span>
                    <input
                      ref={guardianPhoneRef}
                      id="register-guardianPhone"
                      name="guardianPhone"
                      type="text"
                      inputMode="numeric"
                      value={guardianPhone}
                      onChange={(e) =>
                        handlePhoneChange(e.target.value, setGuardianPhone)
                      }
                      placeholder={t.register.guardianPhonePlaceholder}
                      maxLength={10}
                      className={`h-12 w-full rounded-2xl border border-slate-200 bg-white text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 ${
                        isArabic ? "pr-11 pl-4" : "pl-11 pr-4"
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/60 bg-white/90 p-6 shadow-xl shadow-sky-100 backdrop-blur sm:p-8">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100">
                  <Lock className="h-5 w-5 text-sky-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">
                  {t.register.loginInfo}
                </h2>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    {t.register.password} *
                  </label>
                  <div className="relative">
                    <span
                      className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400 ${
                        isArabic ? "right-3" : "left-3"
                      }`}
                    >
                      <Lock className="h-5 w-5" />
                    </span>
                    <input
                      ref={passwordRef}
                      id="register-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t.register.passwordPlaceholder}
                      className={`h-12 w-full rounded-2xl border border-slate-200 bg-white text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 ${
                        isArabic ? "pr-11 pl-12" : "pl-11 pr-12"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className={`absolute top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-sky-600 ${
                        isArabic ? "left-3" : "right-3"
                      }`}
                      aria-label={
                        showPassword
                          ? t.register.hidePassword
                          : t.register.showPassword
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    {t.register.confirmPassword} *
                  </label>
                  <div className="relative">
                    <span
                      className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400 ${
                        isArabic ? "right-3" : "left-3"
                      }`}
                    >
                      <Lock className="h-5 w-5" />
                    </span>
                    <input
                      ref={confirmPasswordRef}
                      id="register-confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder={t.register.confirmPasswordPlaceholder}
                      className={`h-12 w-full rounded-2xl border border-slate-200 bg-white text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 ${
                        isArabic ? "pr-11 pl-12" : "pl-11 pr-12"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className={`absolute top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-sky-600 ${
                        isArabic ? "left-3" : "right-3"
                      }`}
                      aria-label={
                        showConfirmPassword
                          ? t.register.hidePassword
                          : t.register.showPassword
                      }
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/60 bg-white/90 p-6 shadow-xl shadow-sky-100 backdrop-blur sm:p-8">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100">
                  <User className="h-5 w-5 text-sky-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">
                  {t.register.agreements}
                </h2>
              </div>

              <div className="space-y-4">
                <label
                  htmlFor="terms-agreement"
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-sky-300 ${
                    isArabic ? "flex-row-reverse" : ""
                  }`}
                >
                  <input
                    ref={termsRef}
                    id="terms-agreement"
                    name="termsAgreed"
                    type="checkbox"
                    checked={termsAgreed}
                    onChange={(e) => setTermsAgreed(e.target.checked)}
                    className={`mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 ${
                      isArabic ? "ml-3" : "mr-3"
                    }`}
                  />
                  <span className="flex-1 text-sm text-slate-700">
                    {t.register.termsAgreement}
                  </span>
                </label>

                <label
                  htmlFor="notifications-agreement"
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-sky-300 ${
                    isArabic ? "flex-row-reverse" : ""
                  }`}
                >
                  <input
                    id="notifications-agreement"
                    name="notificationsAgreed"
                    type="checkbox"
                    checked={notificationsAgreed}
                    onChange={(e) => setNotificationsAgreed(e.target.checked)}
                    className={`mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 ${
                      isArabic ? "ml-3" : "mr-3"
                    }`}
                  />
                  <span className="flex-1 text-sm text-slate-700">
                    {t.register.notificationsAgreement}
                  </span>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 px-5 text-sm font-bold text-white shadow-lg shadow-sky-200 transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <UserPlus className="h-4 w-4" />
              {isSubmitting ? "..." : t.register.createAccount}
            </button>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
              <p className="text-sm text-slate-600">
                {t.register.haveAccount}{" "}
                <Link
                  href="/login"
                  className="font-bold text-sky-700 underline-offset-2 transition hover:text-sky-900 hover:underline"
                >
                  {t.register.signIn}
                </Link>
              </p>
            </div>
          </form>
    </div>
      </div>
    </div>
  );
}