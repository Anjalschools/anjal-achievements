"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import SectionCard from "@/components/layout/SectionCard";
import { resolveAttachmentDisplayUrl } from "@/lib/partnerships/attachment-display-url";
import {
  isPreviewableInstitutionReport,
  previewUnavailableMessage,
} from "@/lib/partnerships/final-report-review-ux-constants";
import { Download, ExternalLink, Eye, FileText, X } from "lucide-react";

type InstitutionReportPreviewActionsProps = {
  fileName?: string;
  fileKey?: string;
  locale: "ar" | "en";
};

const InstitutionReportPreviewActions = ({
  fileName = "",
  fileKey = "",
  locale,
}: InstitutionReportPreviewActionsProps) => {
  const isAr = locale === "ar";
  const resolved = useMemo(() => resolveAttachmentDisplayUrl(fileKey), [fileKey]);
  const displayUrl = resolved.url;
  const canPreview = resolved.resolvable && isPreviewableInstitutionReport(fileName);
  const isPdf = /\.pdf$/i.test(fileName);
  const [previewOpen, setPreviewOpen] = useState(false);

  const handleOpenNewTab = useCallback(() => {
    if (!displayUrl) return;
    window.open(displayUrl, "_blank", "noopener,noreferrer");
  }, [displayUrl]);

  const handleDownload = useCallback(() => {
    if (!displayUrl) return;
    const anchor = document.createElement("a");
    anchor.href = displayUrl;
    anchor.download = fileName || "institution-report";
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }, [displayUrl, fileName]);

  useEffect(() => {
    if (!previewOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewOpen]);

  if (!fileKey) {
    return (
      <SectionCard className="!p-4">
        <h4 className="mb-2 text-sm font-black text-slate-900">
          {isAr ? "تقرير المؤسسة" : "Institution report"}
        </h4>
        <p className="text-xs text-slate-500">
          {isAr ? "لم يُرفع تقرير مؤسسة بعد." : "No institution report uploaded yet."}
        </p>
      </SectionCard>
    );
  }

  const previewFallbackReason = !fileKey
    ? isAr
      ? "لم يُرفع ملف بعد."
      : "No file uploaded yet."
    : !resolved.resolvable
      ? resolved.reason === "unconfigured_base"
        ? isAr
          ? "تعذر إنشاء المعاينة — رابط التخزين غير مهيأ."
          : "Preview unavailable — storage base URL is not configured."
        : previewUnavailableMessage(locale, isAr ? "رابط الملف غير متاح." : "File URL is unavailable.")
      : !isPreviewableInstitutionReport(fileName)
        ? isAr
          ? "صيغة الملف لا تدعم المعاينة المباشرة."
          : "This file type does not support inline preview."
        : undefined;

  return (
    <>
      <SectionCard className="!p-4">
        <div className="mb-3">
          <h4 className="text-sm font-black text-slate-900">
            {isAr ? "تقرير المؤسسة المرفوع" : "Uploaded institution report"}
          </h4>
          <p className="mt-1 flex items-center gap-1 text-xs text-slate-600">
            <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{fileName || fileKey}</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            disabled={!canPreview}
            aria-label={isAr ? "معاينة التقرير" : "Preview report"}
            className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-white px-3 py-2 text-xs font-bold text-primary hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
          >
            <Eye className="h-3.5 w-3.5" aria-hidden />
            {isAr ? "معاينة التقرير" : "Preview report"}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={!displayUrl}
            aria-label={isAr ? "تحميل التقرير" : "Download report"}
            className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            {isAr ? "تحميل التقرير" : "Download report"}
          </button>
          <button
            type="button"
            onClick={handleOpenNewTab}
            disabled={!displayUrl}
            aria-label={isAr ? "فتح في نافذة جديدة" : "Open in new window"}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            {isAr ? "فتح في نافذة جديدة" : "Open in new window"}
          </button>
        </div>

        {!canPreview ? (
          <p className="mt-3 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-900" role="status">
            {previewUnavailableMessage(locale, previewFallbackReason)}
          </p>
        ) : null}
      </SectionCard>

      {previewOpen ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="institution-report-preview-title"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            dir={isAr ? "rtl" : "ltr"}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2 id="institution-report-preview-title" className="text-sm font-black text-slate-900">
                {isAr ? "معاينة تقرير المؤسسة" : "Institution report preview"}
              </h2>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                aria-label={isAr ? "إغلاق المعاينة" : "Close preview"}
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="min-h-[50vh] flex-1 overflow-auto bg-slate-100 p-2">
              {isPdf ? (
                <iframe
                  title={isAr ? "معاينة تقرير المؤسسة" : "Institution report preview"}
                  src={displayUrl}
                  className="h-[75vh] w-full rounded-lg bg-white"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={displayUrl}
                  alt={fileName || (isAr ? "تقرير المؤسسة" : "Institution report")}
                  className="mx-auto max-h-[75vh] w-auto max-w-full rounded-lg object-contain"
                />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default InstitutionReportPreviewActions;
