import Link from "next/link";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { getBaseUrlFromHeaders } from "@/lib/get-base-url-from-headers";
import { PUBLIC_IMG } from "@/lib/publicImages";
import { loadPublicPortfolioPayload, type PublicPortfolioAchievementItem } from "@/lib/public-portfolio-service";
import { localeDirections, type Locale } from "@/lib/i18n";
import {
  getPublicPortfolioPageCopy,
  type PublicPortfolioPageCopy,
} from "@/lib/public-portfolio-page-dictionary";
import {
  appendLangToPortfolioUrl,
  achievementSecondaryTitle,
  buildPublicPortfolioHref,
  formatPortfolioDate,
  formatPortfolioNumber,
  parsePublicPortfolioLang,
  pickAchievementDescription,
  pickLocalizedText,
} from "@/lib/public-portfolio-page-locale";
import { PublicPortfolioLangSwitch } from "@/components/portfolio/PublicPortfolioLangSwitch";

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

const VerifyHeader = ({ copy, dir }: { copy: PublicPortfolioPageCopy; dir: "rtl" | "ltr" }) => (
  <header className="border-b border-slate-200 bg-white px-3 py-4 sm:px-6" dir={dir}>
    <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-[5rem] flex-1 flex-col items-center gap-1 sm:items-start">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={PUBLIC_IMG.verificationMoe}
          alt={copy.altMoe}
          className="h-12 w-auto max-w-[6.25rem] object-contain sm:h-[52px]"
          width={120}
          height={48}
        />
      </div>
      <div className="flex flex-1 flex-col items-center gap-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={PUBLIC_IMG.verificationAnjal}
          alt={copy.altAnjal}
          className="h-14 w-auto object-contain sm:h-16"
          width={160}
          height={64}
        />
        <span className="text-center text-[10px] font-semibold text-slate-700">
          {copy.schoolCaptionUnderLogo}
        </span>
      </div>
      <div
        className={`flex min-w-[5rem] flex-1 flex-col gap-1 ${
          dir === "rtl" ? "items-center sm:items-end" : "items-center sm:items-end"
        }`}
      >
        <div
          className={`flex flex-wrap items-center gap-2 ${
            dir === "rtl" ? "justify-center sm:justify-end" : "justify-center sm:justify-end"
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={PUBLIC_IMG.verificationMawhiba}
            alt={copy.altMawhiba}
            className="h-11 w-auto max-w-[5rem] object-contain opacity-95"
            width={80}
            height={40}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={PUBLIC_IMG.verificationCognia}
            alt={copy.altCognia}
            className="h-11 w-auto max-w-[5rem] object-contain opacity-95"
            width={80}
            height={40}
          />
        </div>
      </div>
    </div>
  </header>
);

const AccessShell = ({
  copy,
  dir,
  lang,
  slug,
  token,
  title,
  subtitle,
  hint,
}: {
  copy: PublicPortfolioPageCopy;
  dir: "rtl" | "ltr";
  lang: Locale;
  slug: string;
  token: string | null;
  title: string;
  subtitle: string;
  hint: string;
}) => {
  const hrefForLang = (target: Locale) =>
    token
      ? buildPublicPortfolioHref(slug, token, target)
      : `/portfolio/${encodeURIComponent(slug)}?lang=${encodeURIComponent(target)}`;

  return (
    <div
      className="flex min-h-[60vh] flex-col bg-gradient-to-b from-slate-100 to-slate-50"
      dir={dir}
      lang={lang}
    >
      <VerifyHeader copy={copy} dir={dir} />
      <PublicPortfolioLangSwitch lang={lang} hrefForLang={hrefForLang} copy={copy} />
      <div
        className={`flex flex-1 flex-col items-center px-4 py-10 text-center md:py-14 ${
          dir === "rtl" ? "sm:items-center" : "sm:items-center"
        }`}
      >
        <span className="inline-flex rounded-full bg-slate-200 px-4 py-1.5 text-sm font-bold text-slate-800 ring-1 ring-slate-300">
          {copy.accessRestricted}
        </span>
        <h1 className="mt-6 text-xl font-bold text-slate-900">{title}</h1>
        <p className="mt-3 max-w-md text-slate-600">{subtitle}</p>
        <p className="mt-1 max-w-md text-sm text-slate-500">{hint}</p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center justify-center rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-sky-700"
        >
          {copy.backToHome}
        </Link>
      </div>
    </div>
  );
};

export default async function PublicPortfolioPage({ params, searchParams }: PageProps) {
  const slug = String(params.slug || "").trim();
  const lang = parsePublicPortfolioLang(searchParams.lang);
  const dir = localeDirections[lang];
  const copy = getPublicPortfolioPageCopy(lang);

  const tokenRaw = searchParams.token;
  const tokenCandidate = Array.isArray(tokenRaw) ? tokenRaw[0] : tokenRaw;
  const token = typeof tokenCandidate === "string" ? tokenCandidate.trim() : "";

  if (!token) {
    return (
      <AccessShell
        copy={copy}
        dir={dir}
        lang={lang}
        slug={slug}
        token={null}
        title={copy.missingTokenTitle}
        subtitle={copy.missingTokenSubtitle}
        hint={copy.missingTokenHint}
      />
    );
  }

  const baseUrl = getBaseUrlFromHeaders();
  const data = await loadPublicPortfolioPayload(slug, token, { baseUrl });

  if (!data.ok && data.error === "moved") {
    redirect(
      `/portfolio/${encodeURIComponent(data.canonicalSlug)}?token=${encodeURIComponent(data.token)}&lang=${encodeURIComponent(lang)}`
    );
  }

  if (!data.ok) {
    const forbidden = data.error === "forbidden";
    return (
      <AccessShell
        copy={copy}
        dir={dir}
        lang={lang}
        slug={slug}
        token={token}
        title={forbidden ? copy.forbiddenTitle : copy.notFoundTitle}
        subtitle={forbidden ? copy.forbiddenSubtitle : copy.notFoundSubtitle}
        hint={forbidden ? copy.forbiddenHint : copy.notFoundHint}
      />
    );
  }

  const { branding, student, stats, achievements, portfolioUrl } = data;
  const portfolioUrlWithLang = appendLangToPortfolioUrl(portfolioUrl, lang);
  const hrefForLang = (target: Locale) => buildPublicPortfolioHref(slug, token, target);

  let qrSrc = "";
  try {
    qrSrc = await QRCode.toDataURL(portfolioUrlWithLang, { margin: 1, width: 200 });
  } catch {
    qrSrc = "";
  }

  const logoMain = absAsset(branding.mainLogo, baseUrl);
  const logoSec = absAsset(branding.secondaryLogo, baseUrl);
  const headerImg = absAsset(branding.reportHeaderImage, baseUrl);
  const photo = absAsset(student.profilePhoto, baseUrl);

  const publishedLabel = student.publicPortfolioPublishedAt
    ? formatPortfolioDate(student.publicPortfolioPublishedAt, lang)
    : "—";
  const updatedLabel = student.lastUpdatedAt
    ? formatPortfolioDate(student.lastUpdatedAt, lang)
    : "—";

  const schoolPrimary = pickLocalizedText(lang, branding.schoolNameAr, branding.schoolNameEn);
  const schoolSecondaryRaw =
    lang === "ar" ? String(branding.schoolNameEn || "").trim() : String(branding.schoolNameAr || "").trim();
  const schoolSecondary =
    schoolSecondaryRaw && schoolSecondaryRaw !== schoolPrimary.trim() ? schoolSecondaryRaw : null;

  const studentPrimary = pickLocalizedText(lang, student.fullNameAr, student.fullNameEn);
  const studentSecondaryRaw =
    lang === "ar" ? String(student.fullNameEn || "").trim() : String(student.fullNameAr || "").trim();
  const studentSecondary =
    studentSecondaryRaw && studentSecondaryRaw !== studentPrimary.trim() ? studentSecondaryRaw : null;

  const textMain = dir === "rtl" ? "text-right" : "text-left";
  const heroAlign =
    dir === "rtl"
      ? "flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:text-right"
      : "flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:text-left";
  const badgeRow =
    dir === "rtl"
      ? "mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start"
      : "mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start";

  const initialLetter = studentPrimary.charAt(0) || "—";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-50" dir={dir} lang={lang}>
      <VerifyHeader copy={copy} dir={dir} />

      <div className="mx-auto max-w-6xl px-4">
        <PublicPortfolioLangSwitch lang={lang} hrefForLang={hrefForLang} copy={copy} />
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 md:py-8">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg">
          {headerImg ? (
            <div className="relative h-28 w-full overflow-hidden bg-slate-100 sm:h-36">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={headerImg} alt="" className="h-full w-full object-cover opacity-90" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a2744]/90 to-transparent" />
            </div>
          ) : (
            <div className="bg-[#0a2744] px-6 py-8 text-center text-white">
              <p className="text-sm text-sky-100">{copy.platformTagline}</p>
            </div>
          )}

          <div className={`px-4 py-6 sm:px-8 ${headerImg ? "-mt-16 relative" : ""}`}>
            <div className={heroAlign}>
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
              <div className={`min-w-0 flex-1 ${textMain}`}>
                <p className="text-lg font-bold text-slate-900 sm:text-xl">{schoolPrimary}</p>
                {schoolSecondary ? (
                  <p
                    className="mt-1 text-sm text-slate-600"
                    dir={lang === "ar" ? "ltr" : "rtl"}
                    lang={lang === "ar" ? "en" : "ar"}
                  >
                    {schoolSecondary}
                  </p>
                ) : null}
                <h1 className="mt-4 text-2xl font-black text-[#0a2744] sm:text-3xl">
                  {copy.portfolioTitle}
                </h1>
                <p
                  className="mt-1 text-sm font-semibold text-sky-800"
                  dir={lang === "ar" ? "ltr" : "rtl"}
                  lang={lang === "ar" ? "en" : "ar"}
                >
                  {copy.portfolioTitleSecondary}
                </p>
                <p
                  className={`mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 ${
                    dir === "rtl" ? "sm:mx-0" : "sm:mx-0"
                  }`}
                >
                  {copy.heroDescription}
                </p>
                <div className={badgeRow}>
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-900 ring-1 ring-emerald-200">
                    {copy.badgeOfficialSchool}
                  </span>
                  <span
                    className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
                    dir={lang === "ar" ? "ltr" : "rtl"}
                    lang={lang === "ar" ? "en" : "ar"}
                  >
                    {copy.badgeOfficialSchoolAlt}
                  </span>
                </div>
              </div>
              {qrSrc ? (
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrSrc} alt={copy.qrAlt} width={160} height={160} />
                  <p className="max-w-[200px] break-all text-center text-[10px] text-slate-500" dir="ltr">
                    {portfolioUrlWithLang}
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
                  {initialLetter}
                </div>
              )}
            </div>
            <div className={`min-w-0 flex-1 space-y-3 ${textMain}`}>
              <h2 className="text-2xl font-bold text-slate-900">{studentPrimary}</h2>
              {studentSecondary ? (
                <p
                  className="text-sm text-slate-600"
                  dir={lang === "ar" ? "ltr" : "rtl"}
                  lang={lang === "ar" ? "en" : "ar"}
                >
                  {studentSecondary}
                </p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                  <p className="text-[11px] font-bold text-slate-500">{copy.fieldGrade}</p>
                  <p className="text-sm font-bold text-slate-900">
                    {pickLocalizedText(lang, student.gradeLabelAr, student.gradeLabelEn)}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                  <p className="text-[11px] font-bold text-slate-500">{copy.fieldStage}</p>
                  <p className="text-sm font-bold text-slate-900">
                    {pickLocalizedText(lang, student.stageLabelAr, student.stageLabelEn)}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                  <p className="text-[11px] font-bold text-slate-500">{copy.fieldTrack}</p>
                  <p className="text-sm font-bold text-slate-900">
                    {pickLocalizedText(lang, student.trackLabelAr, student.trackLabelEn)}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                  <p className="text-[11px] font-bold text-slate-500">{copy.fieldSectionGender}</p>
                  <p className="text-sm font-bold text-slate-900">
                    {pickLocalizedText(lang, student.sectionOrGenderAr, student.sectionOrGenderEn)}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                  <p className="text-[11px] font-bold text-slate-500">{copy.fieldPublishedAchievements}</p>
                  <p className="text-sm font-bold text-slate-900">
                    {formatPortfolioNumber(stats.totalPublishedAchievements, lang)}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                  <p className="text-[11px] font-bold text-slate-500">{copy.fieldFeaturedAchievements}</p>
                  <p className="text-sm font-bold text-slate-900">
                    {formatPortfolioNumber(stats.totalFeaturedAchievements, lang)}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                  <p className="text-[11px] font-bold text-slate-500">{copy.fieldCertificatesIssued}</p>
                  <p className="text-sm font-bold text-slate-900">
                    {formatPortfolioNumber(stats.totalCertificates, lang)}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                  <p className="text-[11px] font-bold text-slate-500">{copy.fieldTotalPoints}</p>
                  <p className="text-sm font-bold text-slate-900">
                    {formatPortfolioNumber(stats.totalPoints, lang)}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100 sm:col-span-2 lg:col-span-1">
                  <p className="text-[11px] font-bold text-slate-500">{copy.fieldLastUpdated}</p>
                  <p className="text-sm font-bold text-slate-900">{updatedLabel}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    {copy.fieldFilePublishedPrefix} {publishedLabel}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="mb-4 text-center text-xl font-bold text-slate-900 sm:text-2xl">
            {copy.sectionPublishedAchievements}
          </h2>
          {achievements.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white/80 px-6 py-16 text-center shadow-inner">
              <p className="text-lg font-bold text-slate-800">{copy.emptyStateTitle}</p>
              <p className="mx-auto mt-3 max-w-lg text-sm text-slate-600">{copy.emptyStateBody}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {achievements.map((a) => {
                const titlePrimary = pickLocalizedText(lang, a.titleAr, a.titleEn);
                const titleSecondary = achievementSecondaryTitle(lang, a);
                const desc = pickAchievementDescription(lang, a);
                return (
                  <article
                    key={a.id}
                    className={`flex flex-col rounded-2xl border-2 p-5 shadow-sm transition hover:shadow-md ${cardSkin(a.colorKey)} ${
                      a.isFeatured ? "ring-2 ring-amber-400/50 ring-offset-2" : ""
                    }`}
                    dir={dir}
                  >
                    <div className="flex flex-wrap gap-1.5">
                      {a.isFeatured ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                          {copy.badgeFeatured}
                        </span>
                      ) : null}
                      {a.hasCertificate ? (
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-900">
                          {copy.badgeVerified}
                        </span>
                      ) : null}
                      {a.certificateVerificationPath ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-900">
                          {copy.badgeCertificateAvailable}
                        </span>
                      ) : null}
                    </div>
                    <h3 className={`mt-3 text-lg font-bold text-slate-900 ${textMain}`}>{titlePrimary}</h3>
                    {titleSecondary ? (
                      <p
                        className={`mt-1 text-xs text-slate-600 ${textMain}`}
                        dir={lang === "ar" ? "ltr" : "rtl"}
                        lang={lang === "ar" ? "en" : "ar"}
                      >
                        {titleSecondary}
                      </p>
                    ) : null}
                    <dl className={`mt-4 space-y-2 text-sm ${textMain}`}>
                      <div>
                        <dt className="text-[11px] font-bold text-slate-500">{copy.dlCategory}</dt>
                        <dd className="font-semibold text-slate-800">
                          {pickLocalizedText(lang, a.categoryLabelAr, a.categoryLabelEn)}
                        </dd>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <dt className="text-[11px] font-bold text-slate-500">{copy.dlLevel}</dt>
                          <dd className="font-semibold text-slate-800">
                            {pickLocalizedText(lang, a.levelLabelAr, a.levelLabelEn)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] font-bold text-slate-500">{copy.dlResult}</dt>
                          <dd className="font-semibold text-slate-800">
                            {pickLocalizedText(lang, a.resultLabelAr, a.resultLabelEn)}
                          </dd>
                        </div>
                      </div>
                      <div>
                        <dt className="text-[11px] font-bold text-slate-500">{copy.dlParticipation}</dt>
                        <dd className="font-semibold text-slate-800">
                          {pickLocalizedText(lang, a.participationLabelAr, a.participationLabelEn)}
                        </dd>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <dt className="text-[11px] font-bold text-slate-500">{copy.dlDate}</dt>
                          <dd className="font-semibold text-slate-800">
                            {formatPortfolioDate(a.achievementDate, lang)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] font-bold text-slate-500">{copy.dlAcademicYear}</dt>
                          <dd className="font-semibold text-slate-800">
                            {a.academicYear
                              ? formatPortfolioNumber(a.academicYear, lang)
                              : "—"}
                          </dd>
                        </div>
                      </div>
                    </dl>
                    <p className={`mt-3 flex-1 text-sm leading-relaxed text-slate-600 ${textMain}`}>
                      {desc}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200/80 pt-4">
                      {a.certificateVerificationPath ? (
                        <>
                          <Link
                            href={a.certificateVerificationPath}
                            className="inline-flex flex-1 items-center justify-center rounded-xl bg-[#0a2744] px-3 py-2 text-center text-xs font-bold text-white hover:bg-[#0d3355] sm:flex-none"
                          >
                            {copy.btnVerifyCertificate}
                          </Link>
                          <Link
                            href={a.certificateVerificationPath}
                            className="inline-flex flex-1 items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-center text-xs font-bold text-slate-800 hover:bg-slate-50 sm:flex-none"
                          >
                            {copy.btnOpenVerifyPage}
                          </Link>
                        </>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <footer className="mt-12 border-t border-slate-200 pt-8 text-center text-sm text-slate-600">
          <p className="font-bold text-slate-800">{schoolPrimary}</p>
          {schoolSecondary ? (
            <p
              className="mt-1 text-xs"
              dir={lang === "ar" ? "ltr" : "rtl"}
              lang={lang === "ar" ? "en" : "ar"}
            >
              {schoolSecondary}
            </p>
          ) : null}
          <p className="mt-3 text-xs text-slate-500">{copy.footerLegal}</p>
          <p className="mt-2 text-xs text-slate-500">
            {copy.footerLastUpdated} {updatedLabel}
          </p>
          <Link href="/" className="mt-4 inline-block text-sky-700 underline hover:text-sky-900">
            {copy.backToHomeFooter}
          </Link>
        </footer>
      </div>
    </div>
  );
}
