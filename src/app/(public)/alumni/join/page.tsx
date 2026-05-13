"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Briefcase,
  GraduationCap,
  Loader2,
  Sparkles,
  UserRound,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";
import { getLocale } from "@/lib/i18n";
import {
  ALUMNI_ONBOARDING_DEGREE_OPTIONS,
  type AlumniOnboardingRequestInput,
} from "@/lib/alumni/onboarding-types";
import AlumniJoinSuccess from "@/components/alumni/AlumniJoinSuccess";
import { getPostLoginDestination } from "@/lib/auth-default-route";

type SubmitState = "idle" | "submitting" | "success" | "error";

const DEGREE_OTHER = "أخرى";
const MIN_PASSWORD_LEN = 8;

/** Form draft allows unset graduation year until the user selects from the dropdown. */
type JoinFormState = Omit<AlumniOnboardingRequestInput, "graduationYear"> & {
  graduationYear?: number;
};

const currentYear = new Date().getFullYear();
const MIN_GRAD_SELECT = 1985;
const MAX_GRAD_SELECT = currentYear + 2;

const emptyForm = (): JoinFormState => ({
  fullName: "",
  email: "",
  password: "",
  passwordConfirm: "",
  phone: "",
  universityName: "",
  major: "",
  degree: "",
  customDegree: "",
  studyCountry: "",
  currentCompany: "",
  currentPosition: "",
  industry: "",
  linkedinUrl: "",
  city: "",
  country: "",
  bio: "",
  services: {
    mentoring: false,
    internships: false,
    jobs: false,
    workshops: false,
    judging: false,
    sponsorship: false,
  },
});

const JoinAlumniPage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [state, setState] = useState<SubmitState>("idle");
  const [errorText, setErrorText] = useState("");
  const [form, setForm] = useState<JoinFormState>(() => emptyForm());
  const [successEmail, setSuccessEmail] = useState("");
  const [successShowLoginHint, setSuccessShowLoginHint] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  const copy = useMemo(
    () =>
      isAr
        ? {
            title: "انضم إلى مجتمع خريجي الأنجال",
            subtitle:
              "أنشئ حسابك كخريج فورًا — بدون انتظار اعتماد. استخدم بريدك كاسم مستخدم وكلمة مرورك الخاصة.",
            submit: "إنشاء الحساب والانضمام",
            pwdSection: "كلمة المرور",
            pwd: "كلمة المرور *",
            pwdConfirm: "تأكيد كلمة المرور *",
          }
        : {
            title: "Join Al-Anjal Alumni Community",
            subtitle:
              "Create your alumni account instantly — no admin wait. Your email is your username; choose your own password.",
            submit: "Create account & join",
            pwdSection: "Password",
            pwd: "Password *",
            pwdConfirm: "Confirm password *",
          },
    [isAr]
  );

  const graduationYearOptions = useMemo(() => {
    const years: number[] = [];
    for (let y = MAX_GRAD_SELECT; y >= MIN_GRAD_SELECT; y -= 1) {
      years.push(y);
    }
    return years;
  }, []);

  const setField = <K extends keyof JoinFormState>(key: K, value: JoinFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const setService = (key: keyof NonNullable<AlumniOnboardingRequestInput["services"]>, checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      services: {
        ...(prev.services || {}),
        [key]: checked,
      },
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const gy = form.graduationYear;
    if (typeof gy !== "number" || !Number.isFinite(gy)) {
      setErrorText(isAr ? "يرجى اختيار سنة التخرج." : "Please select a graduation year.");
      setState("error");
      return;
    }

    const deg = String(form.degree || "").trim();
    if (!deg) {
      setErrorText(isAr ? "يرجى اختيار الدرجة العلمية." : "Please select a degree.");
      setState("error");
      return;
    }
    if (!ALUMNI_ONBOARDING_DEGREE_OPTIONS.includes(deg as (typeof ALUMNI_ONBOARDING_DEGREE_OPTIONS)[number])) {
      setErrorText(isAr ? "الدرجة العلمية غير صالحة." : "Invalid degree selection.");
      setState("error");
      return;
    }
    if (deg === DEGREE_OTHER) {
      const c = String(form.customDegree || "").trim();
      if (!c) {
        setErrorText(isAr ? "يرجى كتابة الدرجة العلمية عند اختيار «أخرى»." : "Please enter your degree when selecting Other.");
        setState("error");
        return;
      }
    }

    const pwd = String(form.password || "");
    const pwd2 = String(form.passwordConfirm || "");
    if (!pwd || !pwd2) {
      setErrorText(isAr ? "يرجى إدخال كلمة المرور وتأكيدها." : "Please enter and confirm your password.");
      setState("error");
      return;
    }
    if (pwd.length < MIN_PASSWORD_LEN) {
      setErrorText(
        isAr
          ? `كلمة المرور يجب أن تكون ${MIN_PASSWORD_LEN} أحرف على الأقل.`
          : `Password must be at least ${MIN_PASSWORD_LEN} characters.`
      );
      setState("error");
      return;
    }
    if (pwd !== pwd2) {
      setErrorText(isAr ? "كلمتا المرور غير متطابقتين." : "Passwords do not match.");
      setState("error");
      return;
    }

    setState("submitting");
    setErrorText("");
    const { graduationYear: _yearUnset, password: plainPassword, passwordConfirm: _pc, ...rest } = form;
    void _yearUnset;
    void _pc;
    const emailForLogin = String(form.email || "")
      .trim()
      .toLowerCase();

    const payload: AlumniOnboardingRequestInput = {
      ...rest,
      graduationYear: gy,
      degree: deg,
      customDegree: deg === DEGREE_OTHER ? String(form.customDegree || "").trim() : undefined,
      password: plainPassword,
      passwordConfirm: pwd2,
    };
    try {
      const response = await fetch("/api/alumni/onboarding-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      if (response.status === 409 && json.error === "EMAIL_ALREADY_EXISTS") {
        setErrorText(
          isAr
            ? "هذا البريد الإلكتروني مسجّل مسبقًا. سجّل الدخول أو استخدم بريدًا آخر."
            : "This email is already registered. Sign in or use a different email."
        );
        setState("error");
        return;
      }
      if (response.status === 400 && json.error === "PASSWORD_MISMATCH") {
        setErrorText(isAr ? "كلمتا المرور غير متطابقتين." : "Passwords do not match.");
        setState("error");
        return;
      }
      if (response.status === 400 && json.error === "PASSWORD_TOO_SHORT") {
        setErrorText(
          isAr
            ? `كلمة المرور قصيرة جدًا (الحد الأدنى ${MIN_PASSWORD_LEN}).`
            : `Password is too short (minimum ${MIN_PASSWORD_LEN}).`
        );
        setState("error");
        return;
      }
      if (response.status === 400 && json.error === "MISSING_PASSWORD") {
        setErrorText(isAr ? "يرجى إدخال كلمة المرور." : "Please enter a password.");
        setState("error");
        return;
      }
      if (response.status === 400 && json.error === "CUSTOM_DEGREE_REQUIRED") {
        setErrorText(isAr ? "يرجى كتابة الدرجة العلمية." : "Please enter the custom degree.");
        setState("error");
        return;
      }
      if (response.status === 400 && json.error === "INVALID_DEGREE") {
        setErrorText(isAr ? "يرجى اختيار درجة علمية صالحة." : "Please select a valid degree.");
        setState("error");
        return;
      }
      if (!response.ok) {
        setErrorText(isAr ? "تعذر إتمام التسجيل. تأكد من البيانات ثم حاول مجددًا." : "Unable to complete signup. Check inputs and try again.");
        setState("error");
        return;
      }

      setForm(emptyForm());
      setShowPassword(false);
      setShowPasswordConfirm(false);

      try {
        const loginRes = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            identifier: emailForLogin,
            password: plainPassword,
            rememberMe: true,
          }),
        });
        const loginJson = (await loginRes.json().catch(() => ({}))) as {
          user?: { role?: string; accountType?: string; mustChangePassword?: boolean };
        };

        if (loginRes.ok && loginJson.user && loginJson.user.mustChangePassword !== true) {
          const dest = getPostLoginDestination({
            role: loginJson.user.role,
            accountType: loginJson.user.accountType,
          });
          window.location.href = dest;
          return;
        }
      } catch {
        /* fall through to success screen with manual sign-in */
      }

      setSuccessEmail(emailForLogin);
      setSuccessShowLoginHint(true);
      setState("success");
    } catch {
      setErrorText(isAr ? "حدث خطأ غير متوقع أثناء الإرسال." : "Unexpected submission error.");
      setState("error");
    }
  };

  if (state === "success") {
    return (
      <AlumniJoinSuccess isAr={isAr} email={successEmail} showLoginHint={successShowLoginHint} />
    );
  }

  return (
    <main dir={isAr ? "rtl" : "ltr"} className="min-h-screen bg-gradient-to-b from-slate-950 via-primary-dark to-slate-900 py-8 sm:py-10">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <section className="rounded-3xl border border-white/10 bg-white/10 p-5 text-white shadow-2xl backdrop-blur-xl sm:p-7">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative h-10 w-10 shrink-0 sm:h-11 sm:w-11">
              <Image
                src="/logow.png"
                alt={isAr ? "شعار مدارس الأنجال" : "Al-Anjal logo"}
                fill
                sizes="44px"
                className="object-contain drop-shadow-[0_4px_14px_rgba(0,0,0,0.35)]"
                priority
              />
            </div>
            <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.2em] text-sky-200">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              {isAr ? "مجتمع خريجي الأنجال" : "Alumni Community"}
            </p>
          </div>
          <h1 className="mt-3 text-2xl font-black leading-tight sm:text-3xl">{copy.title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-sky-50/90 sm:text-base">{copy.subtitle}</p>
          <div className="mt-5 flex flex-wrap gap-3 text-xs">
            <Link href="/alumni" className="rounded-full border border-white/20 px-4 py-2 font-semibold text-white/90 hover:bg-white/10">
              {isAr ? "العودة لصفحة الخريجين" : "Back to alumni page"}
            </Link>
            <Link href="/login/alumni" className="rounded-full border border-white/20 px-4 py-2 font-semibold text-white/90 hover:bg-white/10">
              {isAr ? "لديك حساب؟ تسجيل الدخول" : "Already have an account? Sign in"}
            </Link>
          </div>
        </section>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)] sm:p-5">
            <h2 className="inline-flex items-center gap-2 text-lg font-black text-slate-900">
              <UserRound className="h-4 w-4 text-primary" aria-hidden />
              {isAr ? "1) البيانات الأساسية" : "1) Basic info"}
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <input required value={form.fullName} onChange={(e) => setField("fullName", e.target.value)} placeholder={isAr ? "الاسم الكامل *" : "Full name *"} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-primary/20 focus:ring" />
              <input required type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} placeholder={isAr ? "البريد الإلكتروني *" : "Email *"} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-primary/20 focus:ring" autoComplete="email" />
              <input value={form.phone || ""} onChange={(e) => setField("phone", e.target.value)} placeholder={isAr ? "رقم الجوال" : "Phone"} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-primary/20 focus:ring" />
              <select
                required
                value={form.graduationYear === undefined ? "" : String(form.graduationYear)}
                onChange={(e) => {
                  const raw = e.target.value;
                  setField("graduationYear", raw === "" ? undefined : Number(raw));
                }}
                aria-label={isAr ? "سنة التخرج" : "Graduation year"}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none ring-primary/20 focus:ring"
              >
                <option value="">{isAr ? "اختر سنة التخرج *" : "Select graduation year *"}</option>
                {graduationYearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)] sm:p-5">
            <h2 className="inline-flex items-center gap-2 text-lg font-black text-slate-900">
              <Lock className="h-4 w-4 text-primary" aria-hidden />
              {copy.pwdSection}
            </h2>
            <p className="mt-2 text-xs text-slate-600 sm:text-sm">
              {isAr
                ? "سيصبح بريدك الإلكتروني اسم المستخدم. احتفظ بكلمة مرور قوية ولا تشاركها."
                : "Your email will be your username. Use a strong password and keep it private."}
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="relative sm:col-span-1">
                <input
                  required
                  type={showPassword ? "text" : "password"}
                  value={form.password || ""}
                  onChange={(e) => setField("password", e.target.value)}
                  placeholder={copy.pwd}
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-slate-200 py-2.5 pe-11 ps-3 text-sm outline-none ring-primary/20 focus:ring"
                  aria-label={copy.pwd}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute end-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  aria-label={showPassword ? (isAr ? "إخفاء كلمة المرور" : "Hide password") : isAr ? "إظهار كلمة المرور" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="relative sm:col-span-1">
                <input
                  required
                  type={showPasswordConfirm ? "text" : "password"}
                  value={form.passwordConfirm || ""}
                  onChange={(e) => setField("passwordConfirm", e.target.value)}
                  placeholder={copy.pwdConfirm}
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-slate-200 py-2.5 pe-11 ps-3 text-sm outline-none ring-primary/20 focus:ring"
                  aria-label={copy.pwdConfirm}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordConfirm((v) => !v)}
                  className="absolute end-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  aria-label={
                    showPasswordConfirm ? (isAr ? "إخفاء التأكيد" : "Hide confirm password") : isAr ? "إظهار التأكيد" : "Show confirm password"
                  }
                >
                  {showPasswordConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)] sm:p-5">
            <h2 className="inline-flex items-center gap-2 text-lg font-black text-slate-900">
              <GraduationCap className="h-4 w-4 text-primary" aria-hidden />
              {isAr ? "2) الرحلة الأكاديمية" : "2) Academic journey"}
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <input value={form.universityName || ""} onChange={(e) => setField("universityName", e.target.value)} placeholder={isAr ? "الجامعة" : "University"} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-primary/20 focus:ring" />
              <input value={form.major || ""} onChange={(e) => setField("major", e.target.value)} placeholder={isAr ? "التخصص" : "Major"} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-primary/20 focus:ring" />
              <div className="sm:col-span-2">
                <select
                  required
                  value={form.degree || ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setField("degree", v);
                    if (v !== DEGREE_OTHER) setField("customDegree", "");
                  }}
                  aria-label={isAr ? "الدرجة العلمية" : "Degree"}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none ring-primary/20 focus:ring"
                >
                  <option value="">{isAr ? "اختر الدرجة العلمية" : "Select degree"}</option>
                  {ALUMNI_ONBOARDING_DEGREE_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                {form.degree === DEGREE_OTHER ? (
                  <input
                    value={form.customDegree || ""}
                    onChange={(e) => setField("customDegree", e.target.value)}
                    placeholder={isAr ? "يرجى كتابة الدرجة العلمية" : "Please specify your degree"}
                    className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-primary/20 focus:ring"
                    aria-required
                  />
                ) : null}
              </div>
              <input value={form.studyCountry || ""} onChange={(e) => setField("studyCountry", e.target.value)} placeholder={isAr ? "دولة الدراسة" : "Study country"} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-primary/20 focus:ring" />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)] sm:p-5">
            <h2 className="inline-flex items-center gap-2 text-lg font-black text-slate-900">
              <Briefcase className="h-4 w-4 text-primary" aria-hidden />
              {isAr ? "3) المسار المهني" : "3) Career info"}
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <input value={form.currentCompany || ""} onChange={(e) => setField("currentCompany", e.target.value)} placeholder={isAr ? "جهة العمل الحالية" : "Current company"} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-primary/20 focus:ring" />
              <input value={form.currentPosition || ""} onChange={(e) => setField("currentPosition", e.target.value)} placeholder={isAr ? "المسمى الوظيفي" : "Current position"} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-primary/20 focus:ring" />
              <input value={form.industry || ""} onChange={(e) => setField("industry", e.target.value)} placeholder={isAr ? "القطاع" : "Industry"} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-primary/20 focus:ring" />
              <input value={form.linkedinUrl || ""} onChange={(e) => setField("linkedinUrl", e.target.value)} placeholder={isAr ? "رابط LinkedIn (اختياري)" : "LinkedIn URL (optional)"} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-primary/20 focus:ring" />
              <input value={form.city || ""} onChange={(e) => setField("city", e.target.value)} placeholder={isAr ? "المدينة" : "City"} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-primary/20 focus:ring" />
              <input value={form.country || ""} onChange={(e) => setField("country", e.target.value)} placeholder={isAr ? "الدولة" : "Country"} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-primary/20 focus:ring" />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)] sm:p-5">
            <h2 className="text-lg font-black text-slate-900">{isAr ? "4) مساهمة الخريج" : "4) Alumni contribution"}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                ["mentoring", isAr ? "الإرشاد" : "Mentoring"],
                ["internships", isAr ? "فرص التدريب" : "Internships"],
                ["jobs", isAr ? "الفرص الوظيفية" : "Job opportunities"],
                ["workshops", isAr ? "الورش" : "Workshops"],
                ["judging", isAr ? "التحكيم" : "Judging"],
                ["sponsorship", isAr ? "الرعاية" : "Sponsorship"],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(form.services?.[key as keyof NonNullable<AlumniOnboardingRequestInput["services"]>])}
                    onChange={(e) =>
                      setService(
                        key as keyof NonNullable<AlumniOnboardingRequestInput["services"]>,
                        e.target.checked
                      )
                    }
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)] sm:p-5">
            <h2 className="text-lg font-black text-slate-900">{isAr ? "5) نبذة شخصية" : "5) Bio / About"}</h2>
            <textarea value={form.bio || ""} onChange={(e) => setField("bio", e.target.value)} rows={5} placeholder={isAr ? "اكتب نبذة مختصرة عن رحلتك الأكاديمية والمهنية..." : "Write a short bio about your academic and professional journey..."} className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-primary/20 focus:ring" />
          </section>

          {state === "error" ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900">{errorText}</div>
          ) : null}

          <div className="sticky bottom-3 z-20 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
            <button
              type="submit"
              disabled={state === "submitting"}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-black text-white shadow-[0_8px_18px_rgba(30,64,175,0.25)] transition duration-200 hover:-translate-y-0.5 hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {state === "submitting" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {copy.submit}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
};

export default JoinAlumniPage;
