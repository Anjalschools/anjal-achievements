"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, KeyRound, Lock } from "lucide-react";
import PlatformLogo from "@/components/branding/PlatformLogo";
import { initLocale } from "@/lib/i18n";
import { getTranslation } from "@/locales";

type Locale = "ar" | "en";

const MIN_LEN = 8;

/** Prefer bar URL (source of truth) over hook to avoid hydration / prefetch mismatches */
const readTokenFromLocation = (): string => {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("token")?.trim() ?? "";
};

const ResetPasswordForm = () => {
  const searchParams = useSearchParams();
  const [resolvedToken, setResolvedToken] = useState<string | null>(null);

  const [locale, setLocale] = useState<Locale>("ar");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const syncTokenFromUrl = useCallback(() => {
    const fromBar = readTokenFromLocation();
    const fromHook = searchParams.get("token")?.trim() ?? "";
    setResolvedToken(fromBar || fromHook || "");
  }, [searchParams]);

  useEffect(() => {
    syncTokenFromUrl();
    const id = window.setTimeout(syncTokenFromUrl, 0);
    return () => window.clearTimeout(id);
  }, [syncTokenFromUrl]);

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
  const tr = t.resetPassword;
  const isArabic = locale === "ar";

  const getTokenForSubmit = (): string =>
    readTokenFromLocation() || searchParams.get("token")?.trim() || "";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    const token = getTokenForSubmit();

    if (!token) {
      setError(tr.missingToken);
      return;
    }
    if (password.length < MIN_LEN) {
      setError(tr.tooShort);
      return;
    }
    if (password !== confirm) {
      setError(tr.mismatch);
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
        code?: string;
      };

      if (response.status === 429) {
        setError(tr.rateLimited);
        return;
      }

      if (!response.ok) {
        if (data.code === "PASSWORD_TOO_SHORT") {
          setError(tr.tooShort);
          return;
        }
        if (data.code === "TOKEN_MISSING") {
          setError(tr.missingToken);
          return;
        }
        if (data.code === "TOKEN_EXPIRED") {
          setError(tr.linkExpired);
          return;
        }
        setError(typeof data.error === "string" ? data.error : tr.genericError);
        return;
      }

      setSuccess(true);
    } catch {
      setError(tr.genericError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const showHydrating = resolvedToken === null;
  const hasToken = Boolean(resolvedToken);

  return (
    <div className="min-h-[calc(100vh-120px)] bg-gradient-to-b from-sky-50 via-white to-blue-50 py-8">
      <div className="mx-auto max-w-xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-white/60 bg-white/90 p-6 shadow-xl shadow-sky-100 backdrop-blur sm:p-8">
          <div className="mb-6 flex items-center gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
              <PlatformLogo variant="color" size={56} priority alt={tr.title} />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 sm:text-2xl">{tr.title}</h1>
              <p className="mt-1 text-sm text-slate-500">{tr.subtitle}</p>
            </div>
          </div>

          {showHydrating ? (
            <div className="py-8 text-center text-sm text-slate-500">…</div>
          ) : !hasToken ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {tr.missingToken}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="reset-password">
                  {tr.newPassword}
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
                    id="reset-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`h-12 w-full rounded-2xl border border-slate-200 bg-white text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 ${
                      isArabic ? "pr-11 pl-12" : "pl-11 pr-12"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className={`absolute top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-sky-600 ${
                      isArabic ? "left-3" : "right-3"
                    }`}
                    aria-label={showPassword ? tr.hidePassword : tr.showPassword}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label
                  className="mb-2 block text-sm font-semibold text-slate-700"
                  htmlFor="reset-password-confirm"
                >
                  {tr.confirmPassword}
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
                    id="reset-password-confirm"
                    type={showConfirm ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className={`h-12 w-full rounded-2xl border border-slate-200 bg-white text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 ${
                      isArabic ? "pr-11 pl-12" : "pl-11 pr-12"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((p) => !p)}
                    className={`absolute top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-sky-600 ${
                      isArabic ? "left-3" : "right-3"
                    }`}
                    aria-label={showConfirm ? tr.hidePassword : tr.showPassword}
                  >
                    {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {success && (
                <div
                  className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
                  role="status"
                >
                  {tr.success}
                </div>
              )}

              {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || success}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 px-5 text-sm font-bold text-white shadow-lg shadow-sky-200 transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <KeyRound className="h-4 w-4" />
                {isSubmitting ? "…" : tr.submit}
              </button>

              <div className="text-center">
                <Link
                  href="/login"
                  className={`inline-flex items-center gap-2 text-sm font-semibold text-sky-700 transition hover:text-sky-900 ${
                    isArabic ? "flex-row-reverse" : ""
                  }`}
                >
                  <ArrowLeft className={`h-4 w-4 ${isArabic ? "rotate-180" : ""}`} />
                  {tr.backToLogin}
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

const ResetPasswordFallback = () => (
  <div className="min-h-[calc(100vh-120px)] bg-gradient-to-b from-sky-50 via-white to-blue-50 py-8">
    <div className="mx-auto max-w-xl px-4 py-12 text-center text-sm text-slate-500">…</div>
  </div>
);

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
