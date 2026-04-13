import connectDB from "@/lib/mongodb";
import LetterRequest from "@/models/LetterRequest";
import QRCode from "qrcode";
import Link from "next/link";
import { getBaseUrl } from "@/lib/get-base-url";
import { PUBLIC_IMG } from "@/lib/publicImages";
import LetterFormalDocument from "@/components/letters/LetterFormalDocument";
import type { LetterRequestedAuthorRole, LetterRequestLanguage, LetterRequestType } from "@/lib/letter-request-types";

type PageProps = { params: { token: string } };

const BackLink = () => (
  <Link
    href="/"
    className="mt-6 inline-flex items-center justify-center rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-sky-700"
  >
    العودة للرئيسية
  </Link>
);

const VerifyHeader = () => (
  <header className="border-b border-slate-200 bg-white px-3 py-4 sm:px-6">
    <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-[5rem] flex-1 flex-col items-center gap-1 sm:items-start">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={PUBLIC_IMG.verificationMoe}
          alt=""
          className="h-12 w-auto max-w-[6.25rem] object-contain sm:h-[52px]"
          width={120}
          height={48}
        />
      </div>
      <div className="flex flex-1 flex-col items-center gap-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={PUBLIC_IMG.verificationAnjal}
          alt=""
          className="h-14 w-auto object-contain sm:h-16"
          width={160}
          height={64}
        />
        <span className="text-center text-[10px] font-semibold text-slate-700">مدارس الأنجال الأهلية</span>
      </div>
      <div className="flex min-w-[5rem] flex-1 flex-col items-center gap-1 sm:items-end">
        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={PUBLIC_IMG.verificationMawhiba}
            alt=""
            className="h-11 w-auto max-w-[5rem] object-contain opacity-95"
            width={80}
            height={40}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={PUBLIC_IMG.verificationCognia}
            alt=""
            className="h-11 w-auto max-w-[5rem] object-contain opacity-95"
            width={80}
            height={40}
          />
        </div>
      </div>
    </div>
  </header>
);

export default async function VerifyLetterPage({ params }: PageProps) {
  const token = params.token?.trim();
  if (!token || token.length < 16) {
    return (
      <div className="flex min-h-[60vh] flex-col bg-gradient-to-b from-slate-100 to-slate-50" dir="rtl">
        <VerifyHeader />
        <div className="flex flex-1 flex-col items-center px-4 py-12 text-center md:py-16">
          <h1 className="text-xl font-bold text-slate-900">تحقق من خطاب</h1>
          <p className="mt-3 max-w-md text-slate-600">الرابط غير صالح أو غير موجود.</p>
          <BackLink />
        </div>
      </div>
    );
  }

  await connectDB();
  const doc = await LetterRequest.findOne({ verificationToken: token }).lean();

  if (!doc || doc.status !== "approved" || !doc.finalApprovedText) {
    return (
      <div className="flex min-h-[60vh] flex-col bg-gradient-to-b from-slate-100 to-slate-50" dir="rtl">
        <VerifyHeader />
        <div className="flex flex-1 flex-col items-center px-4 py-12 text-center md:py-16">
          <h1 className="text-xl font-bold text-slate-900">تحقق من خطاب</h1>
          <p className="mt-3 max-w-md text-slate-600">لم يتم العثور على سجل معتمد مطابق لهذا الرمز.</p>
          <BackLink />
        </div>
      </div>
    );
  }

  const d = doc as unknown as Record<string, unknown>;
  const language = (d.language === "en" ? "en" : "ar") as LetterRequestLanguage;
  const requestType = (d.requestType === "recommendation" ? "recommendation" : "testimonial") as LetterRequestType;
  const requestedAuthorRole = (["teacher", "supervisor", "school_administration"].includes(
    String(d.requestedAuthorRole)
  )
    ? d.requestedAuthorRole
    : "school_administration") as LetterRequestedAuthorRole;

  const snap = (d.studentSnapshot as Record<string, string | undefined>) || {};
  const studentName =
    language === "ar"
      ? snap.fullNameAr || snap.fullName || snap.fullNameEn || "—"
      : snap.fullNameEn || snap.fullName || snap.fullNameAr || "—";

  const gradeLine =
    snap.grade || snap.section
      ? language === "ar"
        ? [snap.grade ? `الصف: ${snap.grade}` : "", snap.section ? `المسار: ${snap.section}` : ""].filter(Boolean).join(" · ")
        : [snap.grade ? `Grade: ${snap.grade}` : "", snap.section ? `Track: ${snap.section}` : ""].filter(Boolean).join(" · ")
      : undefined;

  const issued = d.approvedAt
    ? new Date(d.approvedAt as Date).toLocaleDateString(language === "ar" ? "ar-SA" : "en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—";

  const refCode = `LR-${String(d._id).slice(-8).toUpperCase()}`;
  const verifyPath = `/verify/letter/${token}`;
  const verifyUrl = `${getBaseUrl()}${verifyPath}`;

  let qrSrc = "";
  try {
    qrSrc = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 200 });
  } catch {
    qrSrc = "";
  }

  const typeLabelAr = requestType === "testimonial" ? "إفادة" : "خطاب توصية";
  const typeLabelEn = requestType === "testimonial" ? "Testimonial" : "Recommendation letter";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-50" dir="rtl">
      <VerifyHeader />
      <div className="mx-auto w-full max-w-3xl px-4 py-8 md:py-10">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg">
          <div className="bg-[#0a2744] px-6 py-6 text-center text-white">
            <p className="text-sm font-medium text-slate-200">منصة تميز الأنجال</p>
            <h1 className="mt-2 text-xl font-bold sm:text-2xl">تحقق من خطاب رسمي</h1>
            <p className="mt-1 text-xs text-emerald-200 sm:text-sm" dir="ltr" lang="en">
              Official letter verification
            </p>
          </div>

          <div className="space-y-5 px-6 py-6 text-right">
            <div className="flex justify-center">
              <span className="inline-flex rounded-full bg-emerald-100 px-4 py-1.5 text-sm font-bold text-emerald-900 ring-1 ring-emerald-200">
                سجل صالح — Verified
              </span>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold text-slate-500">نوع الخطاب</p>
                  <p className="font-bold text-slate-900">{typeLabelAr}</p>
                  <p className="text-xs text-slate-600" dir="ltr" lang="en">
                    {typeLabelEn}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500">اسم الطالب</p>
                  <p className="font-bold text-slate-900">{studentName}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500">الجهة الموجهة</p>
                  <p className="font-medium text-slate-800">{String(d.targetOrganization || "—")}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500">تاريخ الاعتماد</p>
                  <p className="font-medium text-slate-800">{issued}</p>
                </div>
              </div>
            </div>

            {qrSrc ? (
              <div className="flex flex-col items-center gap-2 border-t border-slate-100 pt-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrSrc} alt="" width={200} height={200} className="rounded-lg bg-white p-2 ring-1 ring-slate-100" />
                <p className="max-w-full break-all text-center text-[11px] text-slate-500" dir="ltr">
                  {verifyUrl}
                </p>
              </div>
            ) : null}
          </div>

          <footer className="border-t border-slate-100 bg-slate-50 px-6 py-4 text-center">
            <p className="text-sm font-semibold text-slate-800">إدارة مدارس الأنجال الأهلية</p>
            <p className="mt-1 text-xs text-slate-500" dir="ltr">
              Ref: {refCode}
            </p>
          </footer>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" dir={language === "ar" ? "rtl" : "ltr"} lang={language === "ar" ? "ar" : "en"}>
          <h2 className="mb-3 text-center text-lg font-bold text-slate-900">
            {language === "ar" ? "نسخة العرض" : "Letter display"}
          </h2>
          <LetterFormalDocument
            language={language}
            requestType={requestType}
            studentName={studentName}
            targetOrganization={String(d.targetOrganization || "")}
            bodyText={String(d.finalApprovedText || "")}
            issuedDateLabel={issued}
            referenceCode={refCode}
            verifyPath={verifyPath}
            requestedAuthorRole={requestedAuthorRole}
            gradeLine={gradeLine}
            showQr={false}
          />
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          هذه الصفحة للتحقق الرقمي من الخطابات المعتمدة ضمن المنصة فقط.
        </p>
        <div className="mt-4 flex justify-center">
          <BackLink />
        </div>
      </div>
    </div>
  );
}
