"use client";

import type { ReactNode } from "react";
import { CheckCircle2, Copy, Printer, Share2, XCircle } from "lucide-react";

export type CertificateVerifySuccess = {
  valid: true;
  studentNameAr: string;
  studentNameEn: string;
  gradeAr: string;
  gradeEn: string;
  achievementTitleAr: string;
  achievementTitleEn: string;
  resultAr: string;
  resultEn: string;
  levelAr: string;
  levelEn: string;
  dateAr: string;
  dateEn: string;
  school: string;
  schoolAr: string;
  certificateId: string;
  certificateStatus: string;
};

type VerificationCardProps = {
  locale: "ar" | "en";
  data: CertificateVerifySuccess | null;
  valid: boolean;
  errorMessage?: string;
  errorCode?: string;
  verifyUrl: string;
  onCopy?: () => void;
  copyDone?: boolean;
  onPrint?: () => void;
  onShare?: () => void;
};

const Row = ({
  labelAr,
  labelEn,
  valueAr,
  valueEn,
  locale,
}: {
  labelAr: string;
  labelEn: string;
  valueAr: string;
  valueEn: string;
  locale: "ar" | "en";
}) => (
  <div className="border-b border-neutral-100 py-3 last:border-0">
    <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
      {locale === "ar" ? labelAr : labelEn}
    </p>
    <p className="mt-1 text-sm font-semibold text-neutral-900" dir="auto">
      {locale === "ar" ? valueAr || valueEn : valueEn || valueAr}
    </p>
    {(locale === "ar" ? valueEn && valueEn !== valueAr : valueAr && valueAr !== valueEn) ? (
      <p className="mt-0.5 text-xs text-neutral-600" dir="auto">
        {locale === "ar" ? valueEn : valueAr}
      </p>
    ) : null}
  </div>
);

const ActionBtn = ({
  onClick,
  children,
  ariaLabel,
}: {
  onClick: () => void;
  children: ReactNode;
  ariaLabel: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={ariaLabel}
    className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary/30 bg-white px-3 py-2 text-sm font-semibold text-primary shadow-sm transition hover:bg-primary/5"
  >
    {children}
  </button>
);

const VerificationCard = ({
  locale,
  data,
  valid,
  errorMessage,
  verifyUrl,
  onCopy,
  copyDone,
  onPrint,
  onShare,
}: VerificationCardProps) => {
  const isAr = locale === "ar";

  if (!valid || !data) {
    return (
      <div
        className="verification-print-target mx-auto w-full max-w-[600px] rounded-xl border-2 border-red-200 bg-white p-8 shadow-md md:p-10"
        dir="rtl"
      >
        <div className="flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600 ring-2 ring-red-100">
            <XCircle className="h-9 w-9" strokeWidth={2} aria-hidden />
          </span>
          <h2 className="mt-5 text-xl font-bold text-red-800 md:text-2xl">شهادة غير صالحة</h2>
          <p className="mt-1 text-lg font-semibold text-red-700/90 md:text-xl">Invalid certificate</p>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-neutral-600 md:text-base">
            {errorMessage ||
              (isAr
                ? "هذه الشهادة غير موجودة أو تم التلاعب بها"
                : "This certificate is not valid or does not exist")}
          </p>
          <p className="mt-2 text-xs text-neutral-500" dir="ltr">
            {isAr
              ? "This certificate is not valid or does not exist"
              : "هذه الشهادة غير موجودة أو تم التلاعب بها"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="verification-print-target mx-auto w-full max-w-[600px] overflow-hidden rounded-xl border-2 border-emerald-200 bg-white shadow-md"
      dir="rtl"
    >
      <div className="bg-gradient-to-l from-emerald-700 to-emerald-800 px-6 py-5 text-center text-white md:px-8 md:py-6">
        <div className="flex justify-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 ring-2 ring-white/30">
            <CheckCircle2 className="h-7 w-7 text-white" strokeWidth={2.5} aria-hidden />
          </span>
        </div>
        <h2 className="mt-3 text-lg font-bold md:text-xl">تم التحقق من الشهادة بنجاح</h2>
        <p className="mt-1 text-sm font-medium text-emerald-100">Certificate verified successfully</p>
      </div>

      <div className="space-y-0 px-6 py-2 md:px-8">
        <Row
          locale={locale}
          labelAr="اسم الطالب"
          labelEn="Student name"
          valueAr={data.studentNameAr}
          valueEn={data.studentNameEn}
        />
        <Row
          locale={locale}
          labelAr="الصف"
          labelEn="Grade"
          valueAr={data.gradeAr}
          valueEn={data.gradeEn}
        />
        <Row
          locale={locale}
          labelAr="اسم الإنجاز"
          labelEn="Achievement"
          valueAr={data.achievementTitleAr}
          valueEn={data.achievementTitleEn}
        />
        <Row
          locale={locale}
          labelAr="النتيجة"
          labelEn="Result"
          valueAr={data.resultAr}
          valueEn={data.resultEn}
        />
        <Row
          locale={locale}
          labelAr="المستوى"
          labelEn="Level"
          valueAr={data.levelAr}
          valueEn={data.levelEn}
        />
        <Row
          locale={locale}
          labelAr="التاريخ"
          labelEn="Date"
          valueAr={data.dateAr}
          valueEn={data.dateEn}
        />
        <Row
          locale={locale}
          labelAr="المدرسة"
          labelEn="School"
          valueAr={data.schoolAr}
          valueEn={data.school}
        />
        <div className="border-b border-neutral-100 py-3 last:border-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            {isAr ? "رقم الشهادة" : "Certificate ID"}
          </p>
          <p className="mt-1 font-mono text-sm font-bold tracking-wide text-neutral-900" dir="ltr">
            {data.certificateId}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-neutral-100 bg-neutral-50/80 px-6 py-4 print:hidden md:flex-row md:flex-wrap md:justify-center md:gap-3">
        {onCopy ? (
          <ActionBtn
            onClick={onCopy}
            ariaLabel={isAr ? "نسخ رقم الشهادة" : "Copy certificate ID"}
          >
            <Copy className="h-4 w-4" aria-hidden />
            {copyDone ? (isAr ? "تم النسخ" : "Copied") : isAr ? "نسخ الرقم" : "Copy ID"}
          </ActionBtn>
        ) : null}
        {onPrint ? (
          <ActionBtn onClick={onPrint} ariaLabel={isAr ? "طباعة" : "Print"}>
            <Printer className="h-4 w-4" aria-hidden />
            {isAr ? "طباعة" : "Print"}
          </ActionBtn>
        ) : null}
        {onShare ? (
          <ActionBtn onClick={onShare} ariaLabel={isAr ? "مشاركة الرابط" : "Share link"}>
            <Share2 className="h-4 w-4" aria-hidden />
            {isAr ? "مشاركة الرابط" : "Share"}
          </ActionBtn>
        ) : null}
      </div>

      <p className="px-6 pb-4 text-center text-[10px] text-neutral-400 print:hidden" dir="ltr">
        {verifyUrl}
      </p>
    </div>
  );
};

export default VerificationCard;
