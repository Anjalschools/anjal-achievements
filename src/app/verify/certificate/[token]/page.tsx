import connectDB from "@/lib/mongodb";
import Achievement from "@/models/Achievement";
import User from "@/models/User";
import QRCode from "qrcode";
import Link from "next/link";
import {
  type AchievementCertificateLike,
  isCertificateVerificationChainOk,
  isLegacyCertificateRecord,
  labelCertificateIssuerRole,
} from "@/lib/certificate-eligibility";
import {
  formatCertificateDisplayId,
  getAchievementDisplayData,
} from "@/lib/achievement-verify-display";
import { getBaseUrl } from "@/lib/get-base-url";
import { PUBLIC_IMG } from "@/lib/publicImages";

type PageProps = { params: { token: string } };

const ACH_FIELDS =
  "status certificateIssued certificateIssuedAt certificateRevokedAt certificateSnapshot certificateVersion certificateSupersededTokens pendingReReview certificateApprovedByRole certificateApprovedAt certificateId certificateVerificationToken achievementName nameAr nameEn title achievementLevel level achievementYear userId achievementType customAchievementName";

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
          src={PUBLIC_IMG.saudiFlag}
          alt="وزارة التعليم"
          className="h-11 w-auto max-w-[5.5rem] object-contain sm:h-12"
          width={120}
          height={48}
        />
        <span className="text-center text-[10px] font-semibold text-slate-600 sm:text-start">وزارة التعليم</span>
      </div>
      <div className="flex flex-1 flex-col items-center gap-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={PUBLIC_IMG.logoColor}
          alt="مدارس الأنجال الأهلية"
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
            src={PUBLIC_IMG.faceSchools}
            alt=""
            className="h-10 w-auto max-w-[4.5rem] object-contain opacity-95"
            width={80}
            height={40}
          />
        </div>
        <span className="text-center text-[9px] font-medium leading-tight text-slate-500 sm:text-end">
          موهبة · Cognia
        </span>
      </div>
    </div>
  </header>
);

const StatusBadge = ({ ok }: { ok: boolean }) => (
  <div className="flex justify-center">
    <span
      className={`inline-flex rounded-full px-4 py-1.5 text-sm font-bold ${
        ok ? "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200" : "bg-red-100 text-red-900 ring-1 ring-red-200"
      }`}
    >
      {ok ? "سجل صالح" : "سجل غير صالح"}
    </span>
  </div>
);

export default async function VerifyCertificatePage({ params }: PageProps) {
  const token = params.token?.trim();
  if (!token) {
    return (
      <div className="flex min-h-[60vh] flex-col bg-gradient-to-b from-slate-100 to-slate-50" dir="rtl">
        <VerifyHeader />
        <div className="flex flex-1 flex-col items-center px-4 py-12 text-center md:py-16">
          <StatusBadge ok={false} />
          <h1 className="mt-6 text-xl font-bold text-slate-900">تحقق من شهادة شكر وتقدير</h1>
          <p className="mt-3 max-w-md text-slate-600">الشهادة غير موجودة أو غير صالحة</p>
          <p className="mt-1 text-sm text-slate-500">رمز التحقق غير صالح.</p>
          <BackLink />
        </div>
      </div>
    );
  }

  await connectDB();
  const doc = await Achievement.findOne({
    $or: [{ certificateVerificationToken: token }, { certificateSupersededTokens: token }],
  })
    .select(ACH_FIELDS)
    .lean();

  if (!doc) {
    return (
      <div className="flex min-h-[60vh] flex-col bg-gradient-to-b from-slate-100 to-slate-50" dir="rtl">
        <VerifyHeader />
        <div className="flex flex-1 flex-col items-center px-4 py-12 text-center md:py-16">
          <StatusBadge ok={false} />
          <h1 className="mt-6 text-xl font-bold text-slate-900">تحقق من شهادة شكر وتقدير</h1>
          <p className="mt-3 max-w-md text-slate-600">الشهادة غير موجودة أو غير صالحة</p>
          <p className="mt-1 text-sm text-slate-500">لم يتم العثور على سجل مطابق لهذا الرمز.</p>
          <BackLink />
        </div>
      </div>
    );
  }

  const d = doc as unknown as Record<string, unknown>;
  const isSuperseded =
    Array.isArray(d.certificateSupersededTokens) &&
    (d.certificateSupersededTokens as string[]).includes(token) &&
    String(d.certificateVerificationToken || "") !== token;

  if (isSuperseded) {
    return (
      <div className="flex min-h-[60vh] flex-col bg-gradient-to-b from-slate-100 to-slate-50" dir="rtl">
        <VerifyHeader />
        <div className="flex flex-1 flex-col items-center px-4 py-12 text-center md:py-16">
          <StatusBadge ok={false} />
          <h1 className="mt-6 text-xl font-bold text-slate-900">تحقق من شهادة شكر وتقدير</h1>
          <p className="mt-3 max-w-md font-semibold text-amber-900">الرابط لم يعد فعّالاً</p>
          <p className="mt-1 text-sm text-slate-600">أُصدرت نسخة أحدث أو أُلغيت الشهادة السابقة.</p>
          <BackLink />
        </div>
      </div>
    );
  }

  const like = doc as AchievementCertificateLike;
  const chainOk = isCertificateVerificationChainOk(like);
  if (!chainOk) {
    const revoked = Boolean(d.certificateRevokedAt);
    return (
      <div className="flex min-h-[60vh] flex-col bg-gradient-to-b from-slate-100 to-slate-50" dir="rtl">
        <VerifyHeader />
        <div className="flex flex-1 flex-col items-center px-4 py-12 text-center md:py-16">
          <StatusBadge ok={false} />
          <h1 className="mt-6 text-xl font-bold text-slate-900">تحقق من شهادة شكر وتقدير</h1>
          <p className="mt-3 max-w-md font-bold text-red-800">
            {revoked ? "الشهادة ملغاة" : "الشهادة غير موجودة أو غير صالحة"}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {revoked
              ? "تم إلغاء هذه الشهادة بعد تعديل الإنجاز أو إرجاعه للمراجعة."
              : "لا يمكن التحقق من هذه الشهادة بالحالة الحالية."}
          </p>
          <BackLink />
        </div>
      </div>
    );
  }

  const uid = doc.userId as { toString(): string };
  const user = await User.findById(uid).select("fullName fullNameAr fullNameEn name").lean();
  const u = user as Record<string, unknown> | null;
  const studentName =
    (typeof u?.fullNameAr === "string" && u.fullNameAr) ||
    (typeof u?.fullNameEn === "string" && u.fullNameEn) ||
    (typeof u?.fullName === "string" && u.fullName) ||
    (typeof u?.name === "string" && u.name) ||
    "—";

  const display = getAchievementDisplayData(d);
  const year = doc.achievementYear;
  const issued = doc.certificateIssuedAt
    ? new Date(doc.certificateIssuedAt).toLocaleDateString("ar-SA", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—";

  const verifyUrl = `${getBaseUrl()}/verify/certificate/${token}`;
  let qrSrc = "";
  try {
    qrSrc = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 200 });
  } catch {
    qrSrc = "";
  }

  const legacy = isLegacyCertificateRecord(like);
  const issuerRole = typeof d.certificateApprovedByRole === "string" ? d.certificateApprovedByRole : "";
  const issuerLabel = issuerRole
    ? labelCertificateIssuerRole(issuerRole, "ar")
    : legacy
      ? "سجل سابق"
      : "—";

  const certId = formatCertificateDisplayId(
    typeof d.certificateId === "string" && d.certificateId.trim() ? d.certificateId : String(doc._id)
  );
  const ver = typeof d.certificateVersion === "number" ? d.certificateVersion : 1;

  return (
    <div className="flex min-h-[60vh] flex-col bg-gradient-to-b from-slate-100 to-slate-50" dir="rtl">
      <VerifyHeader />

      <div className="mx-auto w-full max-w-xl flex-1 px-4 py-8 md:py-10">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg">
          <div className="bg-[#0a2744] px-6 py-6 text-center text-white">
            <p className="text-sm font-medium text-slate-200">منصة تميز الأنجال</p>
            <h1 className="mt-2 text-xl font-bold sm:text-2xl">تحقق من شهادة شكر وتقدير</h1>
            <p className="mt-1 text-xs text-emerald-200 sm:text-sm">Verified by Al-Anjal Platform</p>
          </div>

          <div className="space-y-5 px-6 py-6 text-right">
            <StatusBadge ok />

            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
              <div>
                <p className="text-xs font-semibold text-slate-500">اسم الطالب</p>
                <p className="text-lg font-bold text-slate-900">{studentName}</p>
              </div>
              <div className="mt-4 border-t border-slate-200 pt-4">
                <p className="text-xs font-semibold text-slate-500">اسم الإنجاز</p>
                <p className="text-base font-bold text-slate-900">{display.titleAr}</p>
                <p className="mt-1 text-sm text-slate-600" dir="ltr" lang="en">
                  {display.titleEn}
                </p>
              </div>
              <div className="mt-4 border-t border-slate-200 pt-4">
                <p className="text-xs font-semibold text-slate-500">المستوى</p>
                <p className="font-bold text-slate-900">{display.levelLabelAr}</p>
                <p className="mt-0.5 text-sm text-slate-600" dir="ltr" lang="en">
                  {display.levelLabelEn}
                </p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-200 pt-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500">السنة</p>
                  <p className="font-medium text-slate-800">{year}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500">تاريخ الإصدار</p>
                  <p className="font-medium text-slate-800">{issued}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 bg-white px-3 py-3 text-xs text-slate-700">
              <p className="font-semibold text-slate-900">إصدار الشهادة</p>
              <p className="mt-1">
                أصدرها أول اعتماد من: <span className="font-bold text-slate-900">{issuerLabel}</span>
              </p>
              <p className="mt-1 text-[10px] text-slate-600">
                الجهات المخوّلة: الإدارة، مدير المدرسة، رائد/مشرف النشاط، المحكم — يكفي واحد فقط لإصدار الشهادة.
              </p>
              {legacy ? (
                <p className="mt-1 text-[10px] text-slate-500">سجل أصدر قبل حفظ نوع الجهة المصدرة بالكامل.</p>
              ) : null}
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
              ID: {certId} · v{ver}
            </p>
          </footer>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          هذه الصفحة للتحقق الرقمي من السجل ضمن المنصة فقط.
        </p>
      </div>
    </div>
  );
}
