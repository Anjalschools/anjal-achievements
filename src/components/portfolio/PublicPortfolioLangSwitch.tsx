import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { localeFlags } from "@/lib/i18n";
import type { PublicPortfolioPageCopy } from "@/lib/public-portfolio-page-dictionary";

export type PublicPortfolioLangSwitchProps = {
  lang: Locale;
  hrefForLang: (target: Locale) => string;
  copy: PublicPortfolioPageCopy;
};

export const PublicPortfolioLangSwitch = ({
  lang,
  hrefForLang,
  copy,
}: PublicPortfolioLangSwitchProps) => {
  const itemClass = (active: boolean) =>
    [
      "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold transition",
      active
        ? "bg-[#0a2744] text-white shadow-sm"
        : "text-slate-700 hover:bg-slate-100",
    ].join(" ");

  return (
    <nav
      className="flex w-full justify-center px-2 py-3 sm:justify-end sm:px-0 sm:py-2"
      aria-label={copy.langSwitcherAria}
    >
      <div className="inline-flex rounded-xl border border-slate-200 bg-white/95 p-0.5 shadow-sm backdrop-blur-sm">
        <Link
          href={hrefForLang("ar")}
          className={itemClass(lang === "ar")}
          lang="ar"
          prefetch={false}
        >
          <span aria-hidden>{localeFlags.ar}</span>
          {copy.langAr}
        </Link>
        <Link
          href={hrefForLang("en")}
          className={itemClass(lang === "en")}
          lang="en"
          prefetch={false}
        >
          <span aria-hidden>{localeFlags.en}</span>
          {copy.langEn}
        </Link>
      </div>
    </nav>
  );
};
