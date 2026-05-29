import { EXECUTIVE_TYPOGRAPHY } from "@/lib/pdf/tokens/executive-typography";
import {
  telemetryExportFailure,
  telemetryExportSuccess,
  telemetryRenderTime,
} from "@/lib/pdf/governance/executive-pdf-telemetry";

export type ExecutivePdfSandboxOptions = {
  headerImagePath?: string;
  reportId?: string;
  orientation?: "portrait" | "landscape";
  rowCount?: number;
  columnCount?: number;
  printDelayMs?: number;
  cleanupDelayMs?: number;
};

const waitForImages = (doc: Document): Promise<void> =>
  new Promise((resolve) => {
    const imgs = Array.from(doc.querySelectorAll("img"));
    const pending = imgs.filter((im) => !im.complete);
    if (pending.length === 0) {
      requestAnimationFrame(() => resolve());
      return;
    }
    let left = pending.length;
    const done = () => {
      left -= 1;
      if (left <= 0) requestAnimationFrame(() => resolve());
    };
    for (const im of pending) {
      im.addEventListener("load", done, { once: true });
      im.addEventListener("error", done, { once: true });
    }
    window.setTimeout(() => resolve(), 12_000);
  });

const injectFontPreload = (doc: Document, isAr: boolean): void => {
  const link = doc.createElement("link");
  link.rel = "preload";
  link.as = "font";
  link.crossOrigin = "anonymous";
  link.setAttribute("data-ep-font-fallback", "1");
  doc.head.appendChild(link);
  const style = doc.createElement("style");
  style.textContent = `body { font-family: ${isAr ? EXECUTIVE_TYPOGRAPHY.fontFamilyAr : EXECUTIVE_TYPOGRAPHY.fontFamilyEn}; }`;
  doc.head.appendChild(style);
};

/**
 * Unified print sandbox — iframe lifecycle, asset readiness, synchronized print.
 */
export const runExecutivePdfPrintSandbox = async (
  html: string,
  opts?: ExecutivePdfSandboxOptions
): Promise<void> => {
  const t0 = performance.now();
  const reportId = opts?.reportId ?? "executive-pdf";
  const isAr = /dir="rtl"/i.test(html) || /lang="ar"/i.test(html);

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.setAttribute("title", "Executive PDF print sandbox");
  iframe.style.cssText =
    "position:fixed;width:0;height:0;opacity:0;left:-10000px;pointer-events:none;border:0";
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = win?.document;
  if (!doc || !win) {
    iframe.remove();
    const err = "Print sandbox unavailable";
    telemetryExportFailure({ reportId, orientation: opts?.orientation ?? "landscape", err });
    throw new Error(err);
  }

  try {
    doc.open();
    doc.write(html);
    doc.close();
    injectFontPreload(doc, isAr);
    await waitForImages(doc);
    const t1 = performance.now();
    telemetryRenderTime({
      reportId,
      orientation: opts?.orientation ?? "landscape",
      rowCount: opts?.rowCount,
      columnCount: opts?.columnCount,
      renderTimeMs: Math.round(t1 - t0),
    });
    await new Promise<void>((resolve) => {
      window.setTimeout(() => {
        win.focus();
        win.print();
        resolve();
      }, opts?.printDelayMs ?? 320);
    });
    telemetryExportSuccess({
      reportId,
      orientation: opts?.orientation ?? "landscape",
      rowCount: opts?.rowCount,
      columnCount: opts?.columnCount,
      renderTimeMs: Math.round(performance.now() - t0),
    });
  } catch (e) {
    telemetryExportFailure({
      reportId,
      orientation: opts?.orientation ?? "landscape",
      err: e instanceof Error ? e.message : "print_failed",
    });
    throw e;
  } finally {
    window.setTimeout(() => iframe.remove(), opts?.cleanupDelayMs ?? 6000);
  }
};
