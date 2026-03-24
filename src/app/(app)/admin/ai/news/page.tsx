"use client";

import { useState } from "react";
import PageContainer from "@/components/layout/PageContainer";
import { getLocale } from "@/lib/i18n";
import { Loader2 } from "lucide-react";

const AdminAiNewsPage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [achievementId, setAchievementId] = useState("");
  const [outputType, setOutputType] = useState("official_news");
  const [language, setLanguage] = useState("ar");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/ai/generate-news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ achievementId, outputType, language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setResult((data.result || {}) as Record<string, unknown>);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  const copy = () => {
    if (!result) return;
    void navigator.clipboard.writeText(JSON.stringify(result, null, 2));
  };

  return (
    <PageContainer>
      <h1 className="text-2xl font-black text-text">
        {isAr ? "إنشاء خبر بالذكاء الاصطناعي" : "AI news generation"}
      </h1>
      <p className="mt-1 text-sm text-text-light">
        {isAr ? "اختر إنجازًا معتمدًا — لا يُنشر خارج المنصة تلقائيًا" : "Internal use only"}
      </p>

      <div className="mt-6 space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <input
          className="w-full rounded-lg border px-3 py-2"
          placeholder={isAr ? "معرّف الإنجاز (_id)" : "Achievement MongoDB id"}
          value={achievementId}
          onChange={(e) => setAchievementId(e.target.value.trim())}
        />
        <select
          className="w-full rounded-lg border px-3 py-2"
          value={outputType}
          onChange={(e) => setOutputType(e.target.value)}
        >
          <option value="official_news">{isAr ? "خبر رسمي" : "Official news"}</option>
          <option value="social">{isAr ? "سوشال" : "Social"}</option>
          <option value="bilingual">{isAr ? "ثنائي اللغة" : "Bilingual"}</option>
        </select>
        <select
          className="w-full rounded-lg border px-3 py-2"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        >
          <option value="ar">العربية</option>
          <option value="en">English</option>
          <option value="both">{isAr ? "الاثنان" : "Both"}</option>
        </select>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading || !achievementId}
            onClick={handleGenerate}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-bold text-white disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isAr ? "توليد" : "Generate"}
          </button>
          <button type="button" onClick={copy} disabled={!result} className="rounded-xl border px-4 py-2 font-semibold">
            {isAr ? "نسخ JSON" : "Copy JSON"}
          </button>
        </div>
        {result ? (
          <pre className="mt-4 max-h-96 overflow-auto rounded-lg bg-gray-50 p-4 text-xs">{JSON.stringify(result, null, 2)}</pre>
        ) : null}
      </div>
    </PageContainer>
  );
};

export default AdminAiNewsPage;
