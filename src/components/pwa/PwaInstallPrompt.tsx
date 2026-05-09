"use client";

import { useEffect, useRef, useState } from "react";

/** Registers SW + captures install prompt (push-ready architecture — no push subscription yet). */
export const PwaInstallPrompt = () => {
  const [visible, setVisible] = useState(false);
  /** Chromium BeforeInstallPromptEvent — not in TS lib by default */
  const deferredRef = useRef<{ prompt: () => Promise<void> } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const registerSw = async () => {
      try {
        if ("serviceWorker" in navigator) {
          await navigator.serviceWorker.register("/sw.js");
        }
      } catch {
        /* optional */
      }
    };
    void registerSw();

    const onBip = (e: Event) => {
      e.preventDefault();
      deferredRef.current = e as unknown as { prompt: () => Promise<void> };
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBip as EventListener);
    return () => window.removeEventListener("beforeinstallprompt", onBip as EventListener);
  }, []);

  const handleInstall = async () => {
    const ev = deferredRef.current;
    if (!ev?.prompt) return;
    await ev.prompt();
    deferredRef.current = null;
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[70] md:left-auto md:right-4 md:max-w-sm">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
        <p className="text-sm font-bold text-slate-900">تثبيت تطبيق الويب</p>
        <p className="mt-1 text-xs text-slate-600">شغّل المنصة كتطبيق على جهازك للوصول السريع.</p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => void handleInstall()}
            className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white"
          >
            تثبيت
          </button>
          <button
            type="button"
            onClick={() => setVisible(false)}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700"
          >
            لاحقًا
          </button>
        </div>
      </div>
    </div>
  );
};
