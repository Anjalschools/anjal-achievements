"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { getLocale } from "@/lib/i18n";
import type { AlumniOnboardingRequestInput } from "@/lib/alumni/onboarding-types";

type SubmitState = "idle" | "submitting" | "success" | "error" | "duplicate";

const currentYear = new Date().getFullYear();

const JoinAlumniPage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [state, setState] = useState<SubmitState>("idle");
  const [errorText, setErrorText] = useState("");
  const [form, setForm] = useState<AlumniOnboardingRequestInput>({
    fullName: "",
    email: "",
    phone: "",
    graduationYear: currentYear,
    universityName: "",
    major: "",
    degree: "",
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

  const copy = useMemo(
    () =>
      isAr
        ? {
            title: "انضم إلى مجتمع خريجي الأنجال",
            subtitle:
              "أكمل طلب الانضمام ليتم مراجعته من إدارة المنصة، وبعد الموافقة يتم تفعيل حسابك كخريج.",
            submit: "إرسال طلب الانضمام",
            done: "تم إرسال طلبك بنجاح وهو الآن قيد المراجعة.",
          }
        : {
            title: "Join Al-Anjal Alumni Community",
            subtitle:
              "Submit your onboarding request for admin review. Once approved, your account can be activated as alumni.",
            submit: "Submit onboarding request",
            done: "Your request was submitted successfully and is now pending review.",
          },
    [isAr]
  );

  const setField = <K extends keyof AlumniOnboardingRequestInput>(
    key: K,
    value: AlumniOnboardingRequestInput[K]
  ) => {
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
    setState("submitting");
    setErrorText("");
    try {
      const response = await fetch("/api/alumni/onboarding-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      if (response.status === 409 && json.error === "ALREADY_PENDING") {
        setState("duplicate");
        return;
      }
      if (!response.ok) {
        setErrorText(isAr ? "تعذر إرسال الطلب. تأكد من البيانات ثم حاول مجددًا." : "Unable to submit request. Check inputs and try again.");
        setState("error");
        return;
      }
      setState("success");
    } catch {
      setErrorText(isAr ? "حدث خطأ غير متوقع أثناء الإرسال." : "Unexpected submission error.");
      setState("error");
    }
  };

  return (
    <main dir={isAr ? "rtl" : "ltr"} className="min-h-screen bg-gradient-to-b from-slate-950 via-primary-dark to-slate-900 py-10 sm:py-14">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <section className="rounded-3xl border border-white/10 bg-white/10 p-6 text-white shadow-2xl backdrop-blur-xl sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-200">
            {isAr ? "مجتمع خريجي الأنجال" : "Alumni Community"}
          </p>
          <h1 className="mt-3 text-2xl font-black sm:text-3xl">{copy.title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-sky-50/90 sm:text-base">{copy.subtitle}</p>
          <div className="mt-5 flex flex-wrap gap-3 text-xs">
            <Link href="/alumni" className="rounded-full border border-white/20 px-4 py-2 font-semibold text-white/90 hover:bg-white/10">
              {isAr ? "العودة لصفحة الخريجين" : "Back to alumni page"}
            </Link>
          </div>
        </section>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-black text-slate-900">{isAr ? "1) البيانات الأساسية" : "1) Basic info"}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <input required value={form.fullName} onChange={(e) => setField("fullName", e.target.value)} placeholder={isAr ? "الاسم الكامل *" : "Full name *"} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-primary/20 focus:ring" />
              <input required type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} placeholder={isAr ? "البريد الإلكتروني *" : "Email *"} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-primary/20 focus:ring" />
              <input value={form.phone || ""} onChange={(e) => setField("phone", e.target.value)} placeholder={isAr ? "رقم الجوال" : "Phone"} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-primary/20 focus:ring" />
              <input required type="number" min={1950} max={currentYear + 2} value={form.graduationYear} onChange={(e) => setField("graduationYear", Number(e.target.value))} placeholder={isAr ? "سنة التخرج *" : "Graduation year *"} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-primary/20 focus:ring" />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-black text-slate-900">{isAr ? "2) الرحلة الأكاديمية" : "2) Academic journey"}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <input value={form.universityName || ""} onChange={(e) => setField("universityName", e.target.value)} placeholder={isAr ? "الجامعة" : "University"} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-primary/20 focus:ring" />
              <input value={form.major || ""} onChange={(e) => setField("major", e.target.value)} placeholder={isAr ? "التخصص" : "Major"} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-primary/20 focus:ring" />
              <input value={form.degree || ""} onChange={(e) => setField("degree", e.target.value)} placeholder={isAr ? "الدرجة العلمية" : "Degree"} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-primary/20 focus:ring" />
              <input value={form.studyCountry || ""} onChange={(e) => setField("studyCountry", e.target.value)} placeholder={isAr ? "دولة الدراسة" : "Study country"} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-primary/20 focus:ring" />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-black text-slate-900">{isAr ? "3) المسار المهني" : "3) Career info"}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <input value={form.currentCompany || ""} onChange={(e) => setField("currentCompany", e.target.value)} placeholder={isAr ? "جهة العمل الحالية" : "Current company"} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-primary/20 focus:ring" />
              <input value={form.currentPosition || ""} onChange={(e) => setField("currentPosition", e.target.value)} placeholder={isAr ? "المسمى الوظيفي" : "Current position"} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-primary/20 focus:ring" />
              <input value={form.industry || ""} onChange={(e) => setField("industry", e.target.value)} placeholder={isAr ? "القطاع" : "Industry"} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-primary/20 focus:ring" />
              <input value={form.linkedinUrl || ""} onChange={(e) => setField("linkedinUrl", e.target.value)} placeholder={isAr ? "رابط LinkedIn (اختياري)" : "LinkedIn URL (optional)"} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-primary/20 focus:ring" />
              <input value={form.city || ""} onChange={(e) => setField("city", e.target.value)} placeholder={isAr ? "المدينة" : "City"} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-primary/20 focus:ring" />
              <input value={form.country || ""} onChange={(e) => setField("country", e.target.value)} placeholder={isAr ? "الدولة" : "Country"} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-primary/20 focus:ring" />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
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

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-black text-slate-900">{isAr ? "5) نبذة شخصية" : "5) Bio / About"}</h2>
            <textarea value={form.bio || ""} onChange={(e) => setField("bio", e.target.value)} rows={5} placeholder={isAr ? "اكتب نبذة مختصرة عن رحلتك الأكاديمية والمهنية..." : "Write a short bio about your academic and professional journey..."} className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-primary/20 focus:ring" />
          </section>

          {state === "success" ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
              <div className="flex items-center gap-2 font-bold">
                <CheckCircle2 className="h-5 w-5" />
                <span>{copy.done}</span>
              </div>
            </div>
          ) : null}
          {state === "duplicate" ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
              {isAr
                ? "لديك طلب قيد المراجعة بالفعل. سنوافيك بالتحديث حال اعتماد الطلب."
                : "You already have a pending request. We will update you after review."}
            </div>
          ) : null}
          {state === "error" ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900">{errorText}</div>
          ) : null}

          <div className="sticky bottom-3 z-20 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
            <button
              type="submit"
              disabled={state === "submitting"}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-black text-white hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
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
