"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, LogIn, Mail, User, Lock, Briefcase, GraduationCap } from "lucide-react";
import PlatformLogo from "@/components/branding/PlatformLogo";
import { initLocale } from "@/lib/i18n";
import { getPostLoginDestination } from "@/lib/auth-default-route";
import { sanitizeInternalCallbackPath } from "@/lib/requireAuthRedirect";
import { getTranslation } from "@/locales";

export type LoginShellMode = "student" | "alumni";

type Props = { mode: LoginShellMode };

type Locale = "ar" | "en";

const LoginShell = ({ mode }: Props) => {
  const [locale, setLocale] = useState<Locale>("ar");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  const isAlumni = mode === "alumni";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!identifier.trim()) {
      setError(
        isAlumni
          ? locale === "ar"
            ? "يرجى إدخال البريد الإلكتروني أو اسم المستخدم."
            : "Please enter your email or username."
          : locale === "ar"
            ? "يرجى إدخال رقم الهوية أو البريد الإلكتروني أو اسم المستخدم."
            : "Please enter your national ID, email, or username."
      );
      return;
    }

    if (!password.trim()) {
      setError(locale === "ar" ? "يرجى إدخال كلمة المرور." : "Please enter your password.");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password, rememberMe }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || (locale === "ar" ? "تعذر تسجيل الدخول حاليًا." : "Unable to sign in right now."));
        return;
      }

      const role = typeof data.user?.role === "string" ? data.user.role : "";
      const accountType = typeof data.user?.accountType === "string" ? data.user.accountType : "";
      const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
      const next = sanitizeInternalCallbackPath(params.get("callbackUrl"));
      if (data.user?.mustChangePassword === true) {
        window.location.href = "/settings";
        return;
      }
      window.location.href = next ?? getPostLoginDestination({ role, accountType });
    } catch {
      setError(locale === "ar" ? "تعذر تسجيل الدخول حاليًا." : "Unable to sign in right now.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const portalSwitch = (
    <div
      className="mb-6 flex rounded-2xl border border-slate-200 bg-slate-50/80 p-1"
      role="navigation"
      aria-label={isArabic ? "نوع الدخول" : "Sign-in portal"}
    >
      <Link
        href="/login/student"
        className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition sm:text-sm ${
          !isAlumni ? "bg-white text-primary shadow-sm" : "text-slate-600 hover:text-slate-900"
        }`}
      >
        <GraduationCap className="h-4 w-4 shrink-0" aria-hidden />
        {isArabic ? "دخول الطلاب" : "Students"}
      </Link>
      <Link
        href="/login/alumni"
        className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition sm:text-sm ${
          isAlumni ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:text-slate-900"
        }`}
      >
        <Briefcase className="h-4 w-4 shrink-0" aria-hidden />
        {isArabic ? "دخول الخريجين" : "Alumni"}
      </Link>
    </div>
  );

  const studentHero = (
    <>
      <p className="max-w-xl text-sm leading-7 text-sky-50 sm:text-base">
        {locale === "ar"
          ? "من خلال حسابك يمكنك متابعة مشاركاتك، رفع إنجازاتك، ومراجعة الشهادات والجوائز في مكان واحد."
          : "Access your student profile, track your achievements, and review certificates and awards in one place."}
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur-sm">
          <p className="text-xs text-sky-100">{isArabic ? "ملف الطالب" : "Student profile"}</p>
          <p className="mt-2 text-lg font-bold">{isArabic ? "إنجازاتك" : "Achievements"}</p>
        </div>
        <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur-sm">
          <p className="text-xs text-sky-100">{isArabic ? "المشاركات" : "Activities"}</p>
          <p className="mt-2 text-lg font-bold">{isArabic ? "مشاركاتك" : "Participation"}</p>
        </div>
        <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur-sm">
          <p className="text-xs text-sky-100">{isArabic ? "الشهادات" : "Certificates"}</p>
          <p className="mt-2 text-lg font-bold">{isArabic ? "جوائزك" : "Awards"}</p>
        </div>
      </div>
    </>
  );

  const alumniHero = (
    <>
      <p className="max-w-xl text-sm leading-7 text-slate-100 sm:text-base">
        {locale === "ar"
          ? "بوابة احترافية لخريجي الأنجال: شبكتك المهنية، الفرص، الإرشاد، والمرشد الأكاديمي الذكي — بنفس حسابك الموثوق."
          : "Your alumni hub for networking, opportunities, mentorship, and the smart academic advisor — one trusted account."}
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/20 backdrop-blur-sm">
          <p className="text-xs text-slate-300">{isArabic ? "الشبكة" : "Network"}</p>
          <p className="mt-2 text-lg font-bold text-white">{isArabic ? "خريجو الأنجال" : "Alumni network"}</p>
        </div>
        <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/20 backdrop-blur-sm">
          <p className="text-xs text-slate-300">{isArabic ? "المسار المهني" : "Career"}</p>
          <p className="mt-2 text-lg font-bold text-white">{isArabic ? "فرص وإرشاد" : "Mentorship & jobs"}</p>
        </div>
        <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/20 backdrop-blur-sm">
          <p className="text-xs text-slate-300">{isArabic ? "ذكاء مهني" : "Guidance"}</p>
          <p className="mt-2 text-lg font-bold text-white">{isArabic ? "مرشد أكاديمي" : "Smart advisor"}</p>
        </div>
      </div>
    </>
  );

  const formTitle = isAlumni
    ? locale === "ar"
      ? "تسجيل دخول الخريجين"
      : "Alumni sign in"
    : t.login.title;

  const formSubtitle = isAlumni
    ? locale === "ar"
      ? "نفس بيانات الدخول المعتمدة في المنصة."
      : "Use your existing platform credentials."
    : t.login.subtitle;

  return (
    <div className="min-h-[calc(100vh-120px)] bg-gradient-to-b from-sky-50 via-white to-blue-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <section className="order-2 lg:order-1">
            <div className="mx-auto w-full max-w-xl rounded-3xl border border-white/60 bg-white/90 p-6 shadow-xl shadow-sky-100 backdrop-blur sm:p-8">
              {portalSwitch}
              <div className="mb-8 flex items-center gap-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                  <PlatformLogo variant="color" size={64} priority alt={formTitle} />
                </div>
                <div>
                  <h1 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">{formTitle}</h1>
                  <p className="mt-1 text-sm text-slate-500">{formSubtitle}</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    {isAlumni
                      ? locale === "ar"
                        ? "البريد الإلكتروني أو اسم المستخدم"
                        : "Email or username"
                      : locale === "ar"
                        ? "رقم الهوية / البريد الإلكتروني / اسم المستخدم"
                        : "National ID / Email / Username"}
                  </label>
                  <div className="relative">
                    <span
                      className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400 ${
                        isArabic ? "right-3" : "left-3"
                      }`}
                    >
                      {identifier.includes("@") ? <Mail className="h-5 w-5" /> : <User className="h-5 w-5" />}
                    </span>
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder={
                        isAlumni
                          ? locale === "ar"
                            ? "مثال: بريدك@example.com أو اسم المستخدم"
                            : "e.g. your@email.com or username"
                          : locale === "ar"
                            ? "أدخل رقم الهوية أو البريد الإلكتروني أو اسم المستخدم"
                            : "Enter your national ID, email, or username"
                      }
                      className={`h-12 w-full rounded-2xl border border-slate-200 bg-white text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 ${
                        isArabic ? "pr-11 pl-4" : "pl-11 pr-4"
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">{t.login.password}</label>
                  <div className="relative">
                    <span
                      className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400 ${
                        isArabic ? "right-3" : "left-3"
                      }`}
                    >
                      <Lock className="h-5 w-5" />
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t.login.passwordPlaceholder}
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
                          ? locale === "ar"
                            ? "إخفاء كلمة المرور"
                            : "Hide password"
                          : locale === "ar"
                            ? "إظهار كلمة المرور"
                            : "Show password"
                      }
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={() => setRememberMe((prev) => !prev)}
                      className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                    <span>{t.login.rememberMe}</span>
                  </label>
                  <Link href="/forgot-password" className="text-sm font-medium text-sky-700 transition hover:text-sky-900">
                    {t.login.forgotPassword}
                  </Link>
                </div>

                {error && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl px-5 text-sm font-bold text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-70 ${
                    isAlumni
                      ? "bg-slate-900 shadow-slate-300 hover:bg-slate-800"
                      : "bg-sky-600 shadow-sky-200 hover:bg-sky-700"
                  }`}
                >
                  <LogIn className="h-4 w-4" />
                  {isSubmitting ? "..." : t.login.loginButton}
                </button>

                <div className="text-center">
                  {isAlumni ? (
                    <p className="text-sm text-slate-600">
                      {locale === "ar" ? "لست خريجاً مسجلاً بعد؟ " : "Not registered as alumni yet? "}
                      <Link href="/alumni/join" className="font-semibold text-slate-900 underline decoration-primary/40 hover:text-primary">
                        {locale === "ar" ? "طلب الانضمام" : "Request access"}
                      </Link>
                    </p>
                  ) : (
                    <p className="text-sm text-slate-600">
                      {t.login.noAccount}{" "}
                      <Link href="/register" className="font-semibold text-sky-700 transition hover:text-sky-900">
                        {t.login.signUp}
                      </Link>
                    </p>
                  )}
                </div>
              </form>
            </div>
          </section>

          <section className="order-1 lg:order-2">
            <div
              className={`mx-auto max-w-2xl rounded-[2rem] p-8 text-white shadow-2xl sm:p-10 ${
                isAlumni
                  ? "bg-gradient-to-br from-slate-900 via-slate-800 to-primary shadow-slate-400/30"
                  : "bg-gradient-to-br from-sky-700 via-sky-600 to-blue-900 shadow-sky-200"
              }`}
            >
              <div className="mb-8 flex items-center gap-4">
                <div
                  className={`rounded-2xl p-2 ring-1 ${isAlumni ? "bg-white/10 ring-white/25" : "bg-white/10 ring-white/20"}`}
                >
                  <PlatformLogo variant="white" size={64} priority alt={formTitle} />
                </div>
                <div>
                  <p className={`text-sm font-medium ${isAlumni ? "text-slate-300" : "text-sky-100"}`}>
                    {locale === "ar" ? "مدارس الأنجال الأهلية" : "Al-Anjal National Schools"}
                  </p>
                  <h2 className="text-2xl font-extrabold sm:text-3xl">
                    {isAlumni
                      ? locale === "ar"
                        ? "مجتمع الخريجين المهني"
                        : "Alumni professional hub"
                      : locale === "ar"
                        ? "منصة تميز الأنجال"
                        : "Anjal Excellence Platform"}
                  </h2>
                </div>
              </div>
              {isAlumni ? alumniHero : studentHero}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default LoginShell;
