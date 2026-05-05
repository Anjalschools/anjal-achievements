"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, KeyRound, Mail } from "lucide-react";
import PlatformLogo from "@/components/branding/PlatformLogo";
import { initLocale } from "@/lib/i18n";
import { getTranslation } from "@/locales";

type Locale = "ar" | "en";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordPage() {
  const [locale, setLocale] = useState<Locale>("ar");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
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
  const tf = t.forgotPassword;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError(tf.invalidEmail);
      return;
    }
    if (!EMAIL_RE.test(trimmed)) {
      setError(tf.invalidEmail);
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });

      const data = (await response.json()) as { ok?: boolean; message?: string; error?: string };

      if (response.status === 429) {
        setError(tf.rateLimited);
        return;
      }

      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : tf.genericError);
        return;
      }

      setSuccess(true);
    } catch {
      setError(tf.genericError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-120px)] bg-gradient-to-b from-sky-50 via-white to-blue-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <section className="order-2 lg:order-1">
            <div className="mx-auto w-full max-w-xl rounded-3xl border border-white/60 bg-white/90 p-6 shadow-xl shadow-sky-100 backdrop-blur sm:p-8">
              <div className="mb-8 flex items-center gap-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                  <PlatformLogo variant="color" size={64} priority alt={tf.title} />
                </div>
                <div>
                  <h1 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
                    {tf.title}
                  </h1>
                  <p className="mt-1 text-sm text-slate-500">{tf.subtitle}</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="forgot-email">
                    {tf.emailLabel}
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
                      id="forgot-email"
                      type="email"
                      name="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={tf.emailPlaceholder}
                      className={`h-12 w-full rounded-2xl border border-slate-200 bg-white text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 ${
                        isArabic ? "pr-11 pl-4" : "pl-11 pr-4"
                      }`}
                    />
                  </div>
                </div>

                {success && (
                  <div
                    className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
                    role="status"
                  >
                    {tf.successMessage}
                  </div>
                )}

                {error && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 px-5 text-sm font-bold text-white shadow-lg shadow-sky-200 transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <KeyRound className="h-4 w-4" />
                  {isSubmitting ? "…" : tf.submit}
                </button>

                <div className="text-center">
                  <Link
                    href="/login"
                    className={`inline-flex items-center gap-2 text-sm font-semibold text-sky-700 transition hover:text-sky-900 ${
                      isArabic ? "flex-row-reverse" : ""
                    }`}
                  >
                    <ArrowLeft className={`h-4 w-4 ${isArabic ? "rotate-180" : ""}`} />
                    {tf.backToLogin}
                  </Link>
                </div>
              </form>
            </div>
          </section>

          <section className="order-1 lg:order-2">
            <div className="mx-auto max-w-2xl rounded-[2rem] bg-gradient-to-br from-sky-700 via-sky-600 to-blue-900 p-8 text-white shadow-2xl shadow-sky-200 sm:p-10">
              <div className="mb-8 flex items-center gap-4">
                <div className="rounded-2xl bg-white/10 p-2 ring-1 ring-white/20">
                  <PlatformLogo variant="white" size={64} priority alt={tf.title} />
                </div>
                <div>
                  <p className="text-sm font-medium text-sky-100">
                    {locale === "ar" ? "منصة تميز الأنجال" : "Anjal Excellence Platform"}
                  </p>
                  <h2 className="text-2xl font-extrabold sm:text-3xl">
                    {locale === "ar" ? "استعادة الوصول" : "Account recovery"}
                  </h2>
                </div>
              </div>
              <p className="max-w-xl text-sm leading-7 text-sky-50 sm:text-base">
                {locale === "ar"
                  ? "لأسباب أمنية لا نُظهر ما إذا كان البريد مسجّلًا. إن وُجد حساب مرتبط بهذا البريد، ستصلك تعليمات إعادة التعيين."
                  : "For security, we do not indicate whether an email is registered. If an account exists, you will receive reset instructions."}
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
