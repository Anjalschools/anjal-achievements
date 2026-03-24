import Link from "next/link";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { getBaseUrlFromHeaders } from "@/lib/get-base-url-from-headers";
import { PUBLIC_IMG } from "@/lib/publicImages";
import { loadPublicPortfolioPayload, type PublicPortfolioAchievementItem } from "@/lib/public-portfolio-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: { slug: string };
  searchParams: Record<string, string | string[] | undefined>;
};

const absAsset = (url: string | null | undefined, base: string): string | null => {
  if (!url || !url.trim()) return null;
  const u = url.trim();
  if (u.startsWith("http://") || u.startsWith("https://") || u.startsWith("data:")) return u;
  const path = u.startsWith("/") ? u : `/${u}`;
  return `${base.replace(/\/$/, "")}${path}`;
};

const VerifyHeader = () => (
  <header className="border-b border-slate-200 bg-white px-3 py-4 sm:px-6">
    <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-[5rem] flex-1 flex-col items-center gap-1 sm:items-start">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={PUBLIC_IMG.verificationMoe}
          alt="وزارة التعليم"
          className="h-12 w-auto max-w-[6.25rem] object-contain sm:h-[52px]"
          width={120}
          height={48}
        />
      </div>
      <div className="flex flex-1 flex-col items-center gap-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={PUBLIC_IMG.verificationAnjal}
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
            src={PUBLIC_IMG.verificationMawhiba}
            alt="موهبة"
            className="h-11 w-auto max-w-[5rem] object-contain opacity-95"
            width={80}
            height={40}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={PUBLIC_IMG.verificationCognia}
            alt="Cognia"
            className="h-11 w-auto max-w-[5rem] object-contain opacity-95"
            width={80}
            height={40}
          />
        </div>
      </div>
    </div>
  </header>
);

const cardSkin = (c: PublicPortfolioAchievementItem["colorKey"]) => {
  const m: Record<PublicPortfolioAchievementItem["colorKey"], string> = {
    school: "border-sky-200/90 bg-gradient-to-br from-sky-50/90 to-white",
    province: "border-emerald-200/90 bg-gradient-to-br from-emerald-50/90 to-white",
    kingdom: "border-violet-200/90 bg-gradient-to-br from-violet-50/90 to-white",
    international: "border-amber-300/80 bg-gradient-to-br from-amber-50/90 to-white",
    other: "border-slate-200/90 bg-gradient-to-br from-slate-50/90 to-white",
  };
  return m[c] || m.other;
};

const fmtDate = (iso: string | null) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("ar-SA", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "—";
  }
};

const AccessShell = ({
  title,
  subtitle,
  hint,
}: {
  title: string;
  subtitle: string;
  hint: string;
}) => (
  <div className="flex min-h-[60vh] flex-col bg-gradient-to-b from-slate-100 to-slate-50" dir="rtl">
    <VerifyHeader />
    <div className="flex flex-1 flex-col items-center px-4 py-12 text-center md:py-16">
      <span className="inline-flex rounded-full bg-slate-200 px-4 py-1.5 text-sm font-bold text-slate-800 ring-1 ring-slate-300">
        وصول مقيد
      </span>
      <h1 className="mt-6 text-xl font-bold text-slate-900">{title}</h1>
      <p className="mt-3 max-w-md text-slate-600">{subtitle}</p>
      <p className="mt-1 max-w-md text-sm text-slate-500">{hint}</p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center justify-center rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-sky-700"
      >
        العودة للرئيسية
      </Link>
    </div>
  </div>
);

export default async function PublicPortfolioPage({ params, searchParams }: PageProps) {
  const slug = String(params.slug || "").trim();
  const tokenRaw = searchParams.token;
  const tokenCandidate = Array.isArray(tokenRaw) ? tokenRaw[0] : tokenRaw;
  const token = typeof tokenCandidate === "string" ? tokenCandidate.trim() : "";

  if (!token) {
    return (
      <AccessShell
        title="ملف الإنجاز العام"
        subtitle="لا يمكن عرض هذا الملف بدون رمز الوصول الصحيح."
        hint="تأكد من استخدام الرابط الكامل الذي زودتك به المدرسة (يتضمن معامل token)."
      />
    );
  }

  const baseUrl = getBaseUrlFromHeaders();
  const data = await loadPublicPortfolioPayload(slug, token, { baseUrl });

  if (!data.ok && data.error === "moved") {
    redirect(
      `/portfolio/${encodeURIComponent(data.canonicalSlug)}?token=${encodeURIComponent(data.token)}`
    );
  }

  if (!data.ok) {
    const forbidden = data.error === "forbidden";
    return (
      <AccessShell
        title={forbidden ? "رفض الوصول" : "الملف غير متاح"}
        subtitle={
          forbidden
            ? "رمز الوصول غير صحيح أو الملف غير مفعّل للنشر العام."
            : "لم يتم العثور على ملف إنجاز مطابق لهذا الرابط."
        }
        hint={
          forbidden
            ? "إذا كنت تعتقد أن هذا خطأ، تواصل مع إدارة المدرسة للحصول على رابط محدّث."
            : "تحقق من صحة الرابط أو تواصل مع المدرسة."
        }
      />
    );
  }

  const { branding, student, stats, achievements, portfolioUrl } = data;

  let qrSrc = "";
  try {
    qrSrc = await QRCode.toDataURL(portfolioUrl, { margin: 1, width: 200 });
  } catch {
    qrSrc = "";
  }

  const logoMain = absAsset(branding.mainLogo, baseUrl);
  const logoSec = absAsset(branding.secondaryLogo, baseUrl);
  const headerImg = absAsset(branding.reportHeaderImage, baseUrl);
  const photo = absAsset(student.profilePhoto, baseUrl);

  const publishedLabel = student.publicPortfolioPublishedAt
    ? fmtDate(student.publicPortfolioPublishedAt)
    : "—";
  const updatedLabel = student.lastUpdatedAt ? fmtDate(student.lastUpdatedAt) : "—";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-50" dir="rtl">
      <VerifyHeader />

      <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg">
          {headerImg ? (
            <div className="relative h-28 w-full overflow-hidden bg-slate-100 sm:h-36">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={headerImg} alt="" className="h-full w-full object-cover opacity-90" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a2744]/90 to-transparent" />
            </div>
          ) : (
            <div className="bg-[#0a2744] px-6 py-8 text-center text-white">
              <p className="text-sm text-sky-100">منصة تميز الأنجال</p>
            </div>
          )}

          <div className={`px-4 py-6 sm:px-8 ${headerImg ? "-mt-16 relative" : ""}`}>
            <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:text-right">
              <div className="flex shrink-0 flex-wrap items-center justify-center gap-3">
                {logoMain ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoMain} alt="" className="h-16 w-auto max-w-[140px] object-contain" />
                ) : null}
                {logoSec ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoSec} alt="" className="h-14 w-auto max-w-[120px] object-contain" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold text-slate-900 sm:text-xl">{branding.schoolNameAr}</p>
                {branding.schoolNameEn ? (
                  <p className="mt-1 text-sm text-slate-600" dir="ltr" lang="en">
                    {branding.schoolNameEn}
                  </p>
                ) : null}
                <h1 className="mt-4 text-2xl font-black text-[#0a2744] sm:text-3xl">ملف الإنجاز</h1>
                <p className="mt-1 text-sm font-semibold text-sky-800" dir="ltr" lang="en">
                  Student Achievement Portfolio
                </p>
                <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
                  وثيقة رقمية تعرض إنجازات الطالب المنشورة رسميًا من المدرسة، مع إمكانية التحقق من الشهادات
                  المعتمدة.
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-900 ring-1 ring-emerald-200">
                    ملف موثق من المدرسة
                  </span>
                  <span
                    className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
                    dir="ltr"
                  >
                    Official school portfolio
                  </span>
                </div>
              </div>
              {qrSrc ? (
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrSrc} alt="رمز الاستجابة السريعة لرابط الملف" width={160} height={160} />
                  <p className="max-w-[200px] break-all text-center text-[10px] text-slate-500" dir="ltr">
                    {portfolioUrl}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-md sm:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-stretch">
            <div className="flex shrink-0 justify-center md:justify-start">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo}
                  alt=""
                  className="h-36 w-36 rounded-2xl border-4 border-white object-cover shadow-lg ring-2 ring-slate-100"
                />
              ) : (
                <div
                  className="flex h-36 w-36 items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 text-4xl font-bold text-slate-300"
                  aria-hidden
                >
                  {student.fullNameAr.slice(0, 1)}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-3 text-right">
              <h2 className="text-2xl font-bold text-slate-900">{student.fullNameAr}</h2>
              <p className="text-sm text-slate-600" dir="ltr" lang="en">
                {student.fullNameEn}
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                  <p className="text-[11px] font-bold text-slate-500">الصف</p>
                  <p className="text-sm font-bold text-slate-900">{student.gradeLabelAr}</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                  <p className="text-[11px] font-bold text-slate-500">المرحلة</p>
                  <p className="text-sm font-bold text-slate-900">{student.stageLabelAr}</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                  <p className="text-[11px] font-bold text-slate-500">المسار</p>
                  <p className="text-sm font-bold text-slate-900">{student.trackLabelAr}</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                  <p className="text-[11px] font-bold text-slate-500">القسم / النوع</p>
                  <p className="text-sm font-bold text-slate-900">{student.sectionOrGenderAr}</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                  <p className="text-[11px] font-bold text-slate-500">إنجازات منشورة</p>
                  <p className="text-sm font-bold text-slate-900">{stats.totalPublishedAchievements}</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                  <p className="text-[11px] font-bold text-slate-500">إنجازات مميزة</p>
                  <p className="text-sm font-bold text-slate-900">{stats.totalFeaturedAchievements}</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                  <p className="text-[11px] font-bold text-slate-500">شهادات صادرة</p>
                  <p className="text-sm font-bold text-slate-900">{stats.totalCertificates}</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                  <p className="text-[11px] font-bold text-slate-500">مجموع النقاط</p>
                  <p className="text-sm font-bold text-slate-900">{stats.totalPoints}</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100 sm:col-span-2 lg:col-span-1">
                  <p className="text-[11px] font-bold text-slate-500">آخر تحديث</p>
                  <p className="text-sm font-bold text-slate-900">{updatedLabel}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">نُشر الملف: {publishedLabel}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="mb-4 text-center text-xl font-bold text-slate-900 sm:text-2xl">الإنجازات المنشورة</h2>
          {achievements.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white/80 px-6 py-16 text-center shadow-inner">
              <p className="text-lg font-bold text-slate-800">لا توجد إنجازات منشورة في هذا الملف حاليًا</p>
              <p className="mx-auto mt-3 max-w-lg text-sm text-slate-600">
                تم تفعيل ملف الإنجاز العام، ولم يُنشر بعد أي إنجاز مؤهل للعرض العام وفق سياسة المدرسة. قد يُحدّث
                هذا الملف لاحقًا عند اعتماد إنجازات جديدة.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {achievements.map((a) => (
                <article
                  key={a.id}
                  className={`flex flex-col rounded-2xl border-2 p-5 shadow-sm transition hover:shadow-md ${cardSkin(a.colorKey)} ${
                    a.isFeatured ? "ring-2 ring-amber-400/50 ring-offset-2" : ""
                  }`}
                >
                  <div className="flex flex-wrap gap-1.5">
                    {a.isFeatured ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                        مميز
                      </span>
                    ) : null}
                    {a.hasCertificate ? (
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-900">
                        موثق
                      </span>
                    ) : null}
                    {a.certificateVerificationPath ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-900">
                        شهادة متاحة
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-3 text-lg font-bold text-slate-900">{a.titleAr}</h3>
                  <p className="mt-1 text-xs text-slate-600" dir="ltr" lang="en">
                    {a.titleEn}
                  </p>
                  <dl className="mt-4 space-y-2 text-right text-sm">
                    <div>
                      <dt className="text-[11px] font-bold text-slate-500">التصنيف</dt>
                      <dd className="font-semibold text-slate-800">{a.categoryLabelAr}</dd>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <dt className="text-[11px] font-bold text-slate-500">المستوى</dt>
                        <dd className="font-semibold text-slate-800">{a.levelLabelAr}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-bold text-slate-500">النتيجة</dt>
                        <dd className="font-semibold text-slate-800">{a.resultLabelAr}</dd>
                      </div>
                    </div>
                    <div>
                      <dt className="text-[11px] font-bold text-slate-500">نوع المشاركة</dt>
                      <dd className="font-semibold text-slate-800">{a.participationLabelAr}</dd>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <dt className="text-[11px] font-bold text-slate-500">التاريخ</dt>
                        <dd className="font-semibold text-slate-800">{fmtDate(a.achievementDate)}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-bold text-slate-500">السنة الدراسية</dt>
                        <dd className="font-semibold text-slate-800">{a.academicYear || "—"}</dd>
                      </div>
                    </div>
                  </dl>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600">{a.descriptionShortAr}</p>
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200/80 pt-4">
                    {a.certificateVerificationPath ? (
                      <>
                        <Link
                          href={a.certificateVerificationPath}
                          className="inline-flex flex-1 items-center justify-center rounded-xl bg-[#0a2744] px-3 py-2 text-center text-xs font-bold text-white hover:bg-[#0d3355] sm:flex-none"
                        >
                          التحقق من الشهادة
                        </Link>
                        <Link
                          href={a.certificateVerificationPath}
                          className="inline-flex flex-1 items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-center text-xs font-bold text-slate-800 hover:bg-slate-50 sm:flex-none"
                        >
                          عرض صفحة التحقق
                        </Link>
                      </>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="mt-12 border-t border-slate-200 pt-8 text-center text-sm text-slate-600">
          <p className="font-bold text-slate-800">{branding.schoolNameAr}</p>
          {branding.schoolNameEn ? (
            <p className="mt-1 text-xs" dir="ltr" lang="en">
              {branding.schoolNameEn}
            </p>
          ) : null}
          <p className="mt-3 text-xs text-slate-500">
            هذا الملف يُعرض للجمهور بموجب تفويض المدرسة ولا يُعتمد إلا مع رمز الوصول السري.
          </p>
          <p className="mt-2 text-xs text-slate-500">آخر تحديث للبيانات المعروضة: {updatedLabel}</p>
          <Link href="/" className="mt-4 inline-block text-sky-700 underline hover:text-sky-900">
            العودة للصفحة الرئيسية
          </Link>
        </footer>
      </div>
    </div>
  );
}
