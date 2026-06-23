"use client";

import { useMemo, useState } from "react";
import SectionCard from "@/components/layout/SectionCard";
import { attachmentDisplayUrl } from "@/lib/partnerships/training-completion-upload";
import {
  isRatingFalsePositive,
  pickInstitutionReportDetectionFeedback,
  resolveInstitutionReportVisualEvidence,
  type InstitutionReportVisualEvidenceRegion,
} from "@/lib/partnerships/institution-final-report-visual-evidence";
import { Check, ExternalLink, Eye, X } from "lucide-react";

type InstitutionReportVisualEvidencePanelProps = {
  extractionMeta: Record<string, unknown> | null | undefined;
  reportFileKey?: string;
  locale: "ar" | "en";
  recordId?: string | null;
  onDetectionFeedback?: (target: "stamp" | "signature" | "rating", ratingKey?: string) => void | Promise<void>;
  feedbackLoading?: boolean;
};

const regionStatusLabel = (region: InstitutionReportVisualEvidenceRegion, isAr: boolean) => {
  if (region.id === "stamp") {
    return region.detected
      ? isAr
        ? "منطقة الختم المكتشفة"
        : "Detected stamp area"
      : isAr
        ? "منطقة الختم — لم يُكتشف ختم"
        : "Stamp area — not detected";
  }
  if (region.id === "signature") {
    return region.detected
      ? isAr
        ? "منطقة التوقيع المكتشفة"
        : "Detected signature area"
      : isAr
        ? "منطقة التوقيع — لم يُكتشف توقيع"
        : "Signature area — not detected";
  }
  return region.detected
    ? isAr
      ? "منطقة التقييمات المكتشفة"
      : "Detected rating matrix area"
    : isAr
      ? "منطقة التقييمات — غير مكتملة"
      : "Rating matrix area — incomplete";
};

const InstitutionReportVisualEvidencePanel = ({
  extractionMeta,
  reportFileKey,
  locale,
  recordId,
  onDetectionFeedback,
  feedbackLoading = false,
}: InstitutionReportVisualEvidencePanelProps) => {
  const isAr = locale === "ar";
  const [activeRegionId, setActiveRegionId] = useState<string | null>(null);

  const evidence = useMemo(
    () => resolveInstitutionReportVisualEvidence(extractionMeta, reportFileKey),
    [extractionMeta, reportFileKey]
  );
  const feedback = pickInstitutionReportDetectionFeedback(extractionMeta);

  if (!evidence) {
    return (
      <SectionCard className="!p-4">
        <h4 className="mb-2 text-sm font-black text-slate-900">
          {isAr ? "الأدلة البصرية للفحص" : "Visual scan evidence"}
        </h4>
        <p className="text-xs text-slate-500">
          {isAr ? "لا تتوفر أدلة بصرية لهذا التقرير." : "No visual evidence available for this report."}
        </p>
      </SectionCard>
    );
  }

  const previewBase = reportFileKey ? attachmentDisplayUrl(reportFileKey) : "";
  const activeRegion = evidence.regions.find((region) => region.id === activeRegionId) ?? evidence.regions[0];
  const explanation = evidence.confidenceExplanation;

  const handleOpenPreview = (region: InstitutionReportVisualEvidenceRegion) => {
    if (!previewBase) return;
    window.open(`${previewBase}${region.previewAnchor}`, "_blank", "noopener,noreferrer");
  };

  return (
    <SectionCard className="!p-4">
      <h4 className="mb-3 text-sm font-black text-slate-900">
        {isAr ? "الأدلة البصرية للفحص" : "Visual scan evidence"}
      </h4>

      <ul className="mb-4 space-y-2" aria-label={isAr ? "مناطق الأدلة البصرية" : "Visual evidence regions"}>
        {evidence.regions.map((region) => {
          const falsePositive =
            (region.id === "stamp" && feedback?.falsePositiveStamp) ||
            (region.id === "signature" && feedback?.falsePositiveSignature);
          return (
            <li
              key={region.id}
              className={`rounded-xl border px-3 py-2 text-xs ${
                region.highlight === "success"
                  ? "border-emerald-200 bg-emerald-50"
                  : region.highlight === "missing"
                    ? "border-orange-300 bg-orange-50"
                    : "border-slate-200 bg-slate-50"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setActiveRegionId(region.id)}
                  className="flex min-w-0 flex-1 items-start gap-2 text-start"
                  aria-label={regionStatusLabel(region, isAr)}
                >
                  {region.detected ? (
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
                  ) : (
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-orange-700" aria-hidden />
                  )}
                  <span className="font-bold text-slate-900">{regionStatusLabel(region, isAr)}</span>
                </button>
                {previewBase ? (
                  <button
                    type="button"
                    onClick={() => handleOpenPreview(region)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 font-bold text-primary"
                  >
                    <Eye className="h-3.5 w-3.5" aria-hidden />
                    {isAr ? "معاينة" : "Preview"}
                    <ExternalLink className="h-3 w-3" aria-hidden />
                  </button>
                ) : null}
              </div>
              {region.messageAr ? (
                <p className="mt-2 text-orange-800">{isAr ? region.messageAr : region.messageEn}</p>
              ) : null}
              {falsePositive ? (
                <p className="mt-2 font-bold text-red-700">
                  {isAr ? "مُعلَّم: اكتشاف غير صحيح" : "Marked: incorrect detection"}
                </p>
              ) : null}
              {recordId && onDetectionFeedback && region.detected && !falsePositive && region.id !== "rating_matrix" ? (
                <button
                  type="button"
                  disabled={feedbackLoading}
                  onClick={() =>
                    void onDetectionFeedback(region.id === "stamp" ? "stamp" : "signature")
                  }
                  className="mt-2 rounded-lg border border-red-200 bg-white px-2 py-1 text-[11px] font-bold text-red-700 disabled:opacity-60"
                >
                  {isAr ? "اكتشاف غير صحيح" : "Incorrect detection"}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>

      {activeRegion && previewBase ? (
        <div className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
          <div className="relative aspect-[1/1.35] w-full max-w-md bg-white">
            <div className="absolute inset-0 bg-gradient-to-b from-slate-50 to-white" aria-hidden />
            <div
              className={`absolute rounded-md border-2 ${
                activeRegion.highlight === "success"
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-orange-500 bg-orange-500/15"
              }`}
              style={{
                top: `${activeRegion.box.topPct}%`,
                left: `${activeRegion.box.leftPct}%`,
                width: `${activeRegion.box.widthPct}%`,
                height: `${activeRegion.box.heightPct}%`,
              }}
              aria-label={isAr ? activeRegion.labelAr : activeRegion.labelEn}
            />
            <p className="absolute bottom-2 start-2 end-2 rounded-lg bg-black/60 px-2 py-1 text-[10px] font-bold text-white">
              {isAr ? `صفحة ${activeRegion.pageHint} — ${activeRegion.labelAr}` : `Page ${activeRegion.pageHint} — ${activeRegion.labelEn}`}
            </p>
          </div>
        </div>
      ) : null}

      <div className="mb-4">
        <p className="mb-2 text-xs font-black text-slate-800">
          {isAr ? "مصفوفة التقييم — الموضع المكتشف" : "Rating matrix — detected positions"}
        </p>
        <ul className="space-y-1">
          {evidence.ratingMatrix.map((row) => {
            const falsePositive = isRatingFalsePositive(feedback, row.key);
            return (
              <li
                key={row.key}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-1 text-xs ${
                  row.detected ? "bg-emerald-50 text-emerald-900" : "bg-orange-50 text-orange-900"
                }`}
              >
                <span>
                  {row.labelAr}
                  {row.detected && row.selectedRating
                    ? ` → ${row.selectedRating}`
                    : isAr
                      ? " → غير مقيم"
                      : " → not rated"}
                  {row.detected && row.checkboxColumn
                    ? isAr
                      ? ` (عمود ${row.checkboxColumn})`
                      : ` (column ${row.checkboxColumn})`
                    : ""}
                </span>
                <div className="flex items-center gap-2">
                  {falsePositive ? (
                    <span className="font-bold text-red-700">
                      {isAr ? "اكتشاف غير صحيح" : "Incorrect detection"}
                    </span>
                  ) : null}
                  {recordId && onDetectionFeedback && row.detected && !falsePositive ? (
                    <button
                      type="button"
                      disabled={feedbackLoading}
                      onClick={() => void onDetectionFeedback("rating", row.key)}
                      className="rounded border border-red-200 bg-white px-2 py-0.5 text-[10px] font-bold text-red-700 disabled:opacity-60"
                    >
                      {isAr ? "اكتشاف غير صحيح" : "Incorrect"}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs">
        <p className="mb-2 font-black text-slate-800">
          {isAr ? "شرح درجة الثقة" : "Confidence explanation"}
        </p>
        <ul className="space-y-1 text-slate-700">
          <li>
            {isAr ? "OCR" : "OCR"}: {explanation.ocrConfidence}%
          </li>
          <li>
            {isAr ? "Vision" : "Vision"}: {explanation.visionConfidence}%
          </li>
          <li>
            {isAr ? "اكتشاف الختم" : "Stamp detection"}: {explanation.stampDetectionConfidence ?? "—"}%
          </li>
          <li>
            {isAr ? "اكتشاف التوقيع" : "Signature detection"}: {explanation.signatureDetectionConfidence ?? "—"}%
          </li>
          <li className="font-black text-slate-900">
            {isAr ? "الإجمالي" : "Overall"}: {explanation.overallConfidence}%
          </li>
        </ul>
      </div>
    </SectionCard>
  );
};

export default InstitutionReportVisualEvidencePanel;
