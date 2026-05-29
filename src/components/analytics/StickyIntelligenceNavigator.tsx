"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUp, Menu, X } from "lucide-react";
import { EXECUTIVE_NAV_REGISTRY } from "@/lib/analytics/executive-nav-registry";
import {
  registerExecutiveScrollSpy,
  scrollToExecutiveAnchor,
} from "@/lib/analytics/executive-scroll-tracking";
import { useIntelligenceWorkspace } from "@/lib/analytics/intelligence-workspace-context";
import { t } from "@/lib/analytics/analytics-semantic-registry";
import { useAnalyticsPerspective } from "@/lib/analytics/analytics-perspective-context";
import { useClientMounted } from "@/hooks/useClientMounted";

const StickyIntelligenceNavigator = ({ isAr }: { isAr: boolean }) => {
  const { loc } = useAnalyticsPerspective();
  const { activeSection, setActiveSection } = useIntelligenceWorkspace();
  const mounted = useClientMounted();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [miniNav, setMiniNav] = useState(false);
  const [visibleEntries, setVisibleEntries] = useState(EXECUTIVE_NAV_REGISTRY);

  useEffect(() => {
    if (!mounted) return;
    const refresh = () => setVisibleEntries(
      EXECUTIVE_NAV_REGISTRY.filter((e) => document.getElementById(e.anchorId))
    );
    refresh();
    const tmr = window.setTimeout(refresh, 400);
    return () => window.clearTimeout(tmr);
  }, [mounted]);

  const progress = useMemo(() => {
    const idx = visibleEntries.findIndex((e) => e.anchorId === activeSection);
    if (idx < 0) return 0;
    return Math.round(((idx + 1) / visibleEntries.length) * 100);
  }, [activeSection, visibleEntries]);

  useEffect(() => {
    if (!mounted) return;
    return registerExecutiveScrollSpy("sticky-nav", visibleEntries, (anchorId) => {
      setActiveSection(anchorId);
    });
  }, [mounted, visibleEntries, setActiveSection]);

  useEffect(() => {
    if (!mounted) return;
    const onScroll = () => setMiniNav(window.scrollY > 320);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [mounted]);

  const scrollTo = useCallback(
    (anchorId: string) => {
      scrollToExecutiveAnchor(anchorId);
      setActiveSection(anchorId);
      setDrawerOpen(false);
    },
    [setActiveSection]
  );

  const navItems = (
    <nav className="flex flex-wrap gap-1" aria-label={t("workspace.nav.title", loc)}>
      {visibleEntries.map((s) => {
        const active = activeSection === s.anchorId;
        return (
          <button
            key={s.execId}
            type="button"
            onClick={() => scrollTo(s.anchorId)}
            className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition ${
              active
                ? "bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-300"
                : "bg-white/90 text-slate-700 ring-1 ring-slate-200 hover:bg-indigo-50"
            }`}
          >
            {isAr ? s.titleAr : s.titleEn}
          </button>
        );
      })}
    </nav>
  );

  return (
    <>
      <div
        className={`sticky top-0 z-30 border-b border-slate-200/90 bg-white/95 backdrop-blur-md print:hidden lg:block ${
          miniNav ? "px-1 py-1" : "px-2 py-2"
        }`}
        dir={isAr ? "rtl" : "ltr"}
      >
        <div className="mb-1 h-0.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full bg-indigo-500 transition-all"
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        {miniNav ? (
          <div className="flex gap-1 overflow-x-auto pb-0.5">{navItems}</div>
        ) : (
          navItems
        )}
      </div>

      <div className="fixed bottom-4 end-4 z-40 flex flex-col gap-2 lg:hidden print:hidden" dir={isAr ? "rtl" : "ltr"}>
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-white shadow-lg"
          aria-label={isAr ? "العودة للأعلى" : "Back to top"}
        >
          <ArrowUp className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setDrawerOpen((p) => !p)}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg"
          aria-label={t("workspace.nav.title", loc)}
          aria-expanded={drawerOpen}
        >
          {drawerOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        {drawerOpen ? (
          <div className="absolute bottom-28 end-0 max-h-[60vh] w-56 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
            <p className="mb-2 text-[10px] font-black text-slate-800">
              {t("workspace.nav.title", loc)} ({progress}%)
            </p>
            <div className="flex flex-col gap-1">
              {visibleEntries.map((s) => {
                const active = activeSection === s.anchorId;
                return (
                  <button
                    key={s.execId}
                    type="button"
                    onClick={() => scrollTo(s.anchorId)}
                    className={`rounded-lg px-2.5 py-2 text-start text-[10px] font-bold ${
                      active ? "bg-indigo-600 text-white" : "bg-slate-50 text-slate-700"
                    }`}
                  >
                    {isAr ? s.titleAr : s.titleEn}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="fixed bottom-4 start-4 z-30 hidden h-10 items-center gap-1 rounded-full bg-slate-800 px-3 text-[10px] font-bold text-white shadow-lg lg:flex print:hidden"
        aria-label={isAr ? "ذكاء أعلى الصفحة" : "Top intelligence"}
      >
        <ArrowUp className="h-3.5 w-3.5" />
        {isAr ? "أعلى" : "Top"}
      </button>
    </>
  );
};

export default StickyIntelligenceNavigator;
