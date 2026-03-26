import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import type { PublicPortfolioPageCopy } from "@/lib/public-portfolio-page-dictionary";
import type { PublicPortfolioProfileExtras } from "@/lib/student-portfolio-content";

type Props = {
  profile: PublicPortfolioProfileExtras | null;
  copy: PublicPortfolioPageCopy;
  lang: Locale;
  dir: "rtl" | "ltr";
  textMain: string;
};

const sectionShell = "mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-md sm:p-8";

const fmtTrainingHours = (lang: Locale, n: number) =>
  lang === "ar" ? `${n} ساعة تدريبية` : `${n} training hour${n === 1 ? "" : "s"}`;

const fmtActivityHours = (lang: Locale, n: number) =>
  lang === "ar" ? `${n} ساعة` : `${n} hour${n === 1 ? "" : "s"}`;

const PublicPortfolioProfileBlocks = ({ profile, copy, lang, dir, textMain }: Props) => {
  if (!profile) return null;

  const { bio, technicalSkills, personalSkills, courses, activities, contactEmail, contactPhone } = profile;
  const hasBio = Boolean(bio && bio.trim());
  const hasTech = technicalSkills.length > 0;
  const hasPers = personalSkills.length > 0;
  const hasSkillsSection = hasTech || hasPers;
  const hasCourses = courses.length > 0;
  const hasActivities = activities.length > 0;
  const hasContact = Boolean(contactEmail || contactPhone);

  if (!hasBio && !hasSkillsSection && !hasCourses && !hasActivities && !hasContact) {
    return null;
  }

  return (
    <>
      {hasBio ? (
        <section className={sectionShell} dir={dir}>
          <h2 className={`mb-3 text-lg font-bold text-slate-900 sm:text-xl ${textMain}`}>
            {copy.profileBioTitle}
          </h2>
          <p className={`whitespace-pre-wrap text-sm leading-relaxed text-slate-700 ${textMain}`}>{bio}</p>
        </section>
      ) : null}

      {hasSkillsSection ? (
        <section className={sectionShell} dir={dir}>
          <h2 className={`mb-4 text-lg font-bold text-slate-900 sm:text-xl ${textMain}`}>
            {copy.profileSkillsTitle}
          </h2>
          <div className="space-y-5">
            {hasTech ? (
              <div>
                <h3 className={`mb-2 text-sm font-bold text-slate-800 ${textMain}`}>
                  {copy.profileSkillsTechnical}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {technicalSkills.map((s) => (
                    <span
                      key={`t-${s}`}
                      className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-950 ring-1 ring-sky-200/90"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {hasPers ? (
              <div>
                <h3 className={`mb-2 text-sm font-bold text-slate-800 ${textMain}`}>
                  {copy.profileSkillsPersonal}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {personalSkills.map((s) => (
                    <span
                      key={`p-${s}`}
                      className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-950 ring-1 ring-emerald-200/90"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {hasCourses ? (
        <section className={sectionShell} dir={dir}>
          <h2 className={`mb-4 text-lg font-bold text-slate-900 sm:text-xl ${textMain}`}>
            {copy.profileCoursesTitle}
          </h2>
          <ul className="space-y-4">
            {courses.map((c, idx) => (
              <li
                key={`c-${idx}-${c.title}-${c.provider}`}
                className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 ring-1 ring-slate-100"
              >
                {c.title ? <p className={`font-bold text-slate-900 ${textMain}`}>{c.title}</p> : null}
                <dl className={`mt-2 space-y-1.5 text-sm ${textMain}`}>
                  {c.provider ? (
                    <div>
                      <dt className="text-[11px] font-bold text-slate-500">{copy.profileLblProvider}</dt>
                      <dd className="font-medium text-slate-800">{c.provider}</dd>
                    </div>
                  ) : null}
                  {c.type ? (
                    <div>
                      <dt className="text-[11px] font-bold text-slate-500">{copy.profileLblType}</dt>
                      <dd className="font-medium text-slate-800">{c.type}</dd>
                    </div>
                  ) : null}
                  {c.trainingHours != null && c.trainingHours > 0 ? (
                    <div>
                      <dt className="text-[11px] font-bold text-slate-500">{copy.profileLblTrainingHours}</dt>
                      <dd className="font-medium text-slate-800">{fmtTrainingHours(lang, c.trainingHours)}</dd>
                    </div>
                  ) : null}
                  {c.date ? (
                    <div>
                      <dt className="text-[11px] font-bold text-slate-500">{copy.profileLblDate}</dt>
                      <dd className="font-medium text-slate-800">{c.date}</dd>
                    </div>
                  ) : null}
                  {c.url ? (
                    <div>
                      <dt className="text-[11px] font-bold text-slate-500">{copy.profileLblLink}</dt>
                      <dd className="break-all">
                        <Link
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-sky-700 underline hover:text-sky-900"
                          dir="ltr"
                        >
                          {c.url}
                        </Link>
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {hasActivities ? (
        <section className={sectionShell} dir={dir}>
          <h2 className={`mb-4 text-lg font-bold text-slate-900 sm:text-xl ${textMain}`}>
            {copy.profileActivitiesTitle}
          </h2>
          <ul className="space-y-4">
            {activities.map((a, idx) => (
              <li
                key={`a-${idx}-${a.title}-${a.organization}`}
                className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 ring-1 ring-slate-100"
              >
                {a.title ? <p className={`font-bold text-slate-900 ${textMain}`}>{a.title}</p> : null}
                <dl className={`mt-2 space-y-1.5 text-sm ${textMain}`}>
                  {a.type ? (
                    <div>
                      <dt className="text-[11px] font-bold text-slate-500">{copy.profileLblType}</dt>
                      <dd className="font-medium text-slate-800">{a.type}</dd>
                    </div>
                  ) : null}
                  {a.organization ? (
                    <div>
                      <dt className="text-[11px] font-bold text-slate-500">{copy.profileLblOrganization}</dt>
                      <dd className="font-medium text-slate-800">{a.organization}</dd>
                    </div>
                  ) : null}
                  {a.description ? (
                    <div>
                      <dt className="text-[11px] font-bold text-slate-500">{copy.profileLblDescription}</dt>
                      <dd className="whitespace-pre-wrap font-medium text-slate-800">{a.description}</dd>
                    </div>
                  ) : null}
                  {a.hours != null && a.hours > 0 ? (
                    <div>
                      <dt className="text-[11px] font-bold text-slate-500">{copy.profileLblHours}</dt>
                      <dd className="font-medium text-slate-800">{fmtActivityHours(lang, a.hours)}</dd>
                    </div>
                  ) : null}
                  {a.date ? (
                    <div>
                      <dt className="text-[11px] font-bold text-slate-500">{copy.profileLblDate}</dt>
                      <dd className="font-medium text-slate-800">{a.date}</dd>
                    </div>
                  ) : null}
                </dl>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {hasContact ? (
        <section className={sectionShell} dir={dir}>
          <h2 className={`mb-3 text-lg font-bold text-slate-900 sm:text-xl ${textMain}`}>
            {copy.profileContactTitle}
          </h2>
          <ul className={`space-y-2 text-sm ${textMain}`}>
            {contactEmail ? (
              <li>
                <span className="font-bold text-slate-600">
                  {lang === "ar" ? "البريد الإلكتروني: " : "Email: "}
                </span>
                <a
                  href={`mailto:${contactEmail}`}
                  className="break-all font-medium text-sky-700 underline hover:text-sky-900"
                  dir="ltr"
                >
                  {contactEmail}
                </a>
              </li>
            ) : null}
            {contactPhone ? (
              <li dir="ltr" className={textMain}>
                <span className="font-bold text-slate-600">{lang === "ar" ? "الجوال: " : "Phone: "}</span>
                <a href={`tel:${contactPhone.replace(/\s/g, "")}`} className="font-medium text-sky-700 underline">
                  {contactPhone}
                </a>
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}
    </>
  );
};

export default PublicPortfolioProfileBlocks;
