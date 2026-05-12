"use client";

import { useCallback, useMemo, useState } from "react";
import { Copy } from "lucide-react";
import { sanitizeCampaignHtml } from "@/lib/alumni/sanitize-campaign-html";
import {
  CAMPAIGN_TEMPLATE_VARIABLES,
  applyCampaignPreviewPlaceholders,
  DEFAULT_CAMPAIGN_PREVIEW_SAMPLE,
} from "@/lib/alumni/campaign-template";

type CampaignEmailBodyEditorProps = {
  value: string;
  onChange: (next: string) => void;
};

export const CampaignEmailBodyEditor = ({ value, onChange }: CampaignEmailBodyEditorProps) => {
  const [sample] = useState(DEFAULT_CAMPAIGN_PREVIEW_SAMPLE);

  const previewHtml = useMemo(() => {
    const merged = applyCampaignPreviewPlaceholders(value, sample);
    return sanitizeCampaignHtml(merged);
  }, [value, sample]);

  const handleCopyToken = useCallback(async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        <div>
          <span className="text-sm font-bold text-slate-800">محتوى HTML (محرر LTR)</span>
          <textarea
            dir="ltr"
            lang="en"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={14}
            spellCheck={false}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left font-mono text-xs leading-relaxed text-slate-900 [unicode-bidi:plaintext]"
            aria-label="محتوى HTML للبريد"
          />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" dir="rtl">
          <p className="text-xs font-black text-slate-800">متغيرات القالب</p>
          <ul className="mt-3 space-y-3">
            {CAMPAIGN_TEMPLATE_VARIABLES.map((v) => (
              <li key={v.key} className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                <code dir="ltr" className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-900">
                  {v.token}
                </code>
                <span className="flex-1 text-xs text-slate-600">{v.descriptionAr}</span>
                <button
                  type="button"
                  onClick={() => void handleCopyToken(v.token)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                  aria-label={`نسخ المتغير ${v.token}`}
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                  نسخ
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="space-y-3">
        <span className="text-sm font-bold text-slate-800">معاينة مباشرة (RTL)</span>
        <div
          dir="rtl"
          className="min-h-[14rem] rounded-xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-900 shadow-inner [&_a]:font-bold [&_a]:text-primary [&_a]:underline"
          dangerouslySetInnerHTML={{
            __html:
              previewHtml.trim() ||
              "<p class=\"text-slate-400 text-center py-8\">لا توجد معاينة بعد — أضف HTML أعلاه</p>",
          }}
        />
        <p className="text-[11px] text-slate-500">تُعرض المعاينة بعد التعقيم بنفس قواعد الحفظ على الخادم.</p>
      </div>
    </div>
  );
};
