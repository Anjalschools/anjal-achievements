"use client";

import Link from "next/link";
import Image from "next/image";
import { CheckCircle2, GraduationCap } from "lucide-react";

type AlumniJoinSuccessProps = {
  isAr?: boolean;
};

const stepsAr = [
  "مراجعة بيانات الخريج والتحقق منها",
  "اعتماد الحساب من إدارة المنصة",
  "إرسال بيانات الدخول عبر البريد الإلكتروني",
  "تفعيل الحساب والاستفادة من خدمات مجتمع الخريجين",
];

const servicesAr = [
  "فرص الإرشاد",
  "التواصل المهني",
  "الفعاليات واللقاءات",
  "فرص التدريب والعمل",
  "مجتمع خريجي الأنجال",
  "قصص النجاح",
];

export const AlumniJoinSuccess = ({ isAr = true }: AlumniJoinSuccessProps) => {
  return (
    <main dir={isAr ? "rtl" : "ltr"} className="min-h-screen bg-gradient-to-b from-slate-950 via-primary-dark to-slate-900 py-8 sm:py-12">
      <div className="mx-auto flex max-w-lg flex-col items-center px-4 sm:px-6">
        <div className="w-full rounded-3xl border border-white/10 bg-white p-6 shadow-2xl sm:p-8">
          <div className="flex flex-col items-center text-center">
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 ring-4 ring-emerald-100/80">
              <CheckCircle2 className="h-11 w-11 text-emerald-600" strokeWidth={2.2} aria-hidden />
              <span className="sr-only">{isAr ? "تم الإرسال بنجاح" : "Submitted successfully"}</span>
            </div>
            <div className="relative mt-4 h-12 w-12 shrink-0">
              <Image
                src="/logow.png"
                alt={isAr ? "شعار مدارس الأنجال" : "Al-Anjal logo"}
                fill
                sizes="48px"
                className="object-contain"
              />
            </div>
            <h1 className="mt-4 text-xl font-black leading-snug text-slate-900 sm:text-2xl">
              شكراً لانضمامك إلى مجتمع خريجي الأنجال 🎓
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
              تم استلام طلب التسجيل الخاص بك بنجاح، ويجري الآن مراجعته واعتماد بياناتك من قبل إدارة مدارس الأنجال الأهلية.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
              بعد اعتماد الطلب سيتم إرسال بيانات الدخول إلى بريدك الإلكتروني المسجل، لتتمكن من الدخول إلى حسابك والاستفادة من خدمات مجتمع الخريجين.
            </p>
          </div>

          <div className="mt-8 border-t border-slate-100 pt-6">
            <h2 className="flex items-center justify-center gap-2 text-sm font-black text-slate-800">
              <GraduationCap className="h-4 w-4 text-primary" aria-hidden />
              الخطوات القادمة
            </h2>
            <ol className="mt-4 space-y-3 text-start text-sm text-slate-700">
              {stepsAr.map((line, i) => (
                <li key={line} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-black text-primary">
                    {i + 1}
                  </span>
                  <span className="pt-0.5 leading-relaxed">{line}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-8 rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
            <h3 className="text-center text-sm font-black text-slate-900">ماذا يتيح لك مجتمع الخريجين؟</h3>
            <ul className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
              {servicesAr.map((s) => (
                <li key={s} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 shadow-sm ring-1 ring-slate-100">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                  {s}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/alumni"
              className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-5 py-3.5 text-center text-sm font-black text-white shadow-[0_8px_18px_rgba(30,64,175,0.25)] transition hover:bg-primary-dark sm:w-auto"
            >
              استعراض مجتمع الخريجين
            </Link>
            <Link
              href="/"
              className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-center text-sm font-black text-slate-800 transition hover:bg-slate-50 sm:w-auto"
            >
              العودة للرئيسية
            </Link>
          </div>

          <p className="mt-6 text-center text-[11px] text-slate-400">إدارة مدارس الأنجال الأهلية</p>
        </div>
      </div>
    </main>
  );
};

export default AlumniJoinSuccess;
