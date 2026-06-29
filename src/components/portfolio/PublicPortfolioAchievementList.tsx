"use client";

import Link from "next/link";

import type { PublicPortfolioAchievementItem } from "@/lib/public-portfolio-service";
import type { PublicPortfolioPageCopy } from "@/lib/public-portfolio-page-dictionary";
import PublicPortfolioAchievementEvidence from "@/components/portfolio/PublicPortfolioAchievementEvidence";

type PublicPortfolioAchievementListProps = {
  achievements: PublicPortfolioAchievementItem[];
  slug: string;
  token: string;
  lang: "ar" | "en";
  copy: PublicPortfolioPageCopy;
  cardSkin: (colorKey: PublicPortfolioAchievementItem["colorKey"]) => string;
  pickTitle: (item: PublicPortfolioAchievementItem) => string;
  pickDescription: (item: PublicPortfolioAchievementItem) => string;
};

const PublicPortfolioAchievementList = ({
  achievements,
  slug,
  token,
  lang,
  copy,
  cardSkin,
  pickTitle,
  pickDescription,
}: PublicPortfolioAchievementListProps) => {
  const isAr = lang === "ar";
  const textMain = isAr ? "text-right" : "text-left";

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {achievements.map((achievement) => {
        const title = pickTitle(achievement);
        const desc = pickDescription(achievement);
        return (
          <article
            key={achievement.id}
            className={`flex h-full flex-col rounded-2xl border p-4 shadow-sm transition hover:shadow-md ${cardSkin(
              achievement.colorKey
            )}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className={`text-base font-bold text-slate-900 ${textMain}`}>{title}</h3>
              {achievement.isFeatured ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                  {copy.badgeFeatured}
                </span>
              ) : null}
            </div>
            {achievement.highlightBadgeAr || achievement.highlightBadgeEn ? (
              <p className="mt-1 text-xs font-semibold text-violet-800">
                {isAr ? achievement.highlightBadgeAr : achievement.highlightBadgeEn}
              </p>
            ) : null}
            <dl className={`mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600 ${textMain}`}>
              <div>
                <dt className="font-medium text-slate-500">{copy.dlCategory}</dt>
                <dd className="font-semibold text-slate-800">
                  {isAr ? achievement.categoryLabelAr : achievement.categoryLabelEn}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">{copy.dlLevel}</dt>
                <dd className="font-semibold text-slate-800">
                  {isAr ? achievement.levelLabelAr : achievement.levelLabelEn}
                </dd>
              </div>
            </dl>
            <p className={`mt-3 flex-1 text-sm leading-relaxed text-slate-600 ${textMain}`}>{desc}</p>

            <PublicPortfolioAchievementEvidence
              items={achievement.evidence}
              slug={slug}
              token={token}
              isAr={isAr}
              achievementId={achievement.id}
            />

            <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200/80 pt-4">
              {achievement.certificateVerificationPath ? (
                <>
                  <Link
                    href={achievement.certificateVerificationPath}
                    className="inline-flex flex-1 items-center justify-center rounded-xl bg-[#0a2744] px-3 py-2 text-center text-xs font-bold text-white hover:bg-[#0d3355] sm:flex-none"
                  >
                    {copy.btnVerifyCertificate}
                  </Link>
                  <Link
                    href={achievement.certificateVerificationPath}
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
  );
};

export default PublicPortfolioAchievementList;
