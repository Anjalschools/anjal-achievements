"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import { getLocale } from "@/lib/i18n";
import { getNewsEditorialStatusLabel } from "@/lib/achievement-display-labels";
import type { NewsPostApi } from "@/lib/news-serialize";
import { evaluateNewsQuality, validateNews } from "@/lib/news-quality";
import {
  Loader2,
  Sparkles,
  Save,
  Send,
  CheckCircle,
  Globe,
  Instagram,
  CalendarClock,
  RefreshCw,
  Plug,
  Copy,
  Download,
  FileJson,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";

type SocialRow = {
  provider: string;
  status: string;
  accountLabel?: string;
  hasStoredTokens: boolean;
  tokenEncryptionConfigured: boolean;
};

type AiPlatform = "website" | "instagram" | "x";

const SOURCE_OPTIONS: { v: NewsPostApi["sourceType"]; ar: string; en: string }[] = [
  { v: "approved_achievement", ar: "إنجاز معتمد", en: "Approved achievement" },
  { v: "certificate", ar: "شهادة", en: "Certificate" },
  { v: "event", ar: "فعالية / مناسبة", en: "Event" },
  { v: "manual", ar: "خبر يدوي", en: "Manual" },
  { v: "achievement_bundle", ar: "تجميع عدة إنجازات", en: "Achievement bundle" },
];

const OUT_TABS = [
  { id: "website", ar: "خبر الموقع", en: "Website article" },
  { id: "instagram", ar: "Instagram", en: "Instagram" },
  { id: "x", ar: "X", en: "X" },
  { id: "snapchat", ar: "Snapchat", en: "Snapchat" },
  { id: "tiktok", ar: "TikTok", en: "TikTok" },
  { id: "bilingual", ar: "ثنائي اللغة", en: "Bilingual" },
] as const;

const STEPS = [
  { id: "source", ar: "مصدر الخبر", en: "Source" },
  { id: "data", ar: "بيانات الخبر", en: "News data" },
  { id: "outputs", ar: "المخرجات", en: "Outputs" },
  { id: "quality", ar: "فحص الجودة", en: "Quality" },
  { id: "workflow", ar: "الاعتماد والنشر", en: "Approve & publish" },
] as const;

const parseApiErrorMessage = (data: Record<string, unknown>): string => {
  const err = data.error;
  if (err && typeof err === "object" && err !== null && "message" in err) {
    return String((err as { message?: string }).message || "");
  }
  if (typeof err === "string") return err;
  if (typeof data.message === "string") return data.message;
  return "";
};

const NewsMediaConsole = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const loc = isAr ? "ar" : "en";
  const L = (ar: string, en: string) => (isAr ? ar : en);

  const [step, setStep] = useState(0);
  const [outTab, setOutTab] = useState<(typeof OUT_TABS)[number]["id"]>("website");
  const [previewTab, setPreviewTab] = useState<"website" | "instagram" | "x">("website");
  const [list, setList] = useState<NewsPostApi[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [item, setItem] = useState<NewsPostApi | null>(null);
  const [integrations, setIntegrations] = useState<SocialRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [itemLoading, setItemLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [generateErr, setGenerateErr] = useState<string | null>(null);
  const [sourceIdsText, setSourceIdsText] = useState("");
  const [hashtagsText, setHashtagsText] = useState("");
  const [publishTargets, setPublishTargets] = useState<string[]>(["website"]);
  const [scheduleIso, setScheduleIso] = useState("");
  const [aiPlatform, setAiPlatform] = useState<AiPlatform>("website");
  const [aiLanguage, setAiLanguage] = useState<string>("ar");

  const loadList = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await fetch("/api/admin/news?limit=50", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(parseApiErrorMessage(data) || "Failed");
      setList((data.items || []) as NewsPostApi[]);
    } catch {
      setList([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  const loadIntegrations = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/social-integrations", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setIntegrations((data.items || []) as SocialRow[]);
    } catch {
      setIntegrations([]);
    }
  }, []);

  const loadItem = useCallback(async (id: string) => {
    setItemLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/news/${id}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(parseApiErrorMessage(data) || "Failed");
      const it = data.item as NewsPostApi;
      setItem(it);
      setSourceIdsText((it.sourceIds || []).join(", "));
      setHashtagsText((it.hashtags || []).join(", "));
      setAiLanguage(it.locale === "en" ? "en" : it.locale === "bilingual" ? "both" : "ar");
    } catch (e: unknown) {
      setItem(null);
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setItemLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
    void loadIntegrations();
  }, [loadList, loadIntegrations]);

  useEffect(() => {
    if (currentId) void loadItem(currentId);
    else {
      setItem(null);
      setSourceIdsText("");
      setHashtagsText("");
    }
  }, [currentId, loadItem]);

  const integrationConnected = useCallback(
    (target: string) => {
      if (target === "website") return true;
      const row = integrations.find((i) => i.provider === target);
      return row?.status === "connected";
    },
    [integrations]
  );

  useEffect(() => {
    if (!integrations.length) return;
    setPublishTargets((prev) => {
      const next = prev.filter((t) => integrationConnected(t));
      return next.length > 0 ? next : ["website"];
    });
  }, [integrations, integrationConnected]);

  const patchLocal = useCallback((partial: Partial<NewsPostApi>) => {
    setItem((prev) => (prev ? { ...prev, ...partial } : prev));
  }, []);

  const parseIds = (s: string) =>
    s
      .split(/[\s,]+/)
      .map((x) => x.trim())
      .filter(Boolean);

  const strictPublish = useMemo(() => {
    if (!item) return { ok: false, blocks: [] as string[] };
    return validateNews({
      title: item.title,
      websiteBody: item.websiteBody,
      coverImage: item.coverImage,
    });
  }, [item]);

  const handleSaveDraft = async () => {
    if (!item || !currentId) return;
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const sourceIds = parseIds(sourceIdsText);
      const hashtags = parseIds(hashtagsText).map((h) => h.replace(/^#/, ""));
      const res = await fetch(`/api/admin/news/${currentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: item.title,
          subtitle: item.subtitle,
          locale: item.locale,
          tone: item.tone,
          audience: item.audience,
          category: item.category,
          schoolSection: item.schoolSection,
          namesOrEntities: item.namesOrEntities,
          summary: item.summary,
          rawNotes: item.rawNotes,
          eventDate: item.eventDate,
          location: item.location,
          websiteBody: item.websiteBody,
          instagramCaption: item.instagramCaption,
          xPostText: item.xPostText,
          snapchatText: item.snapchatText,
          tiktokCaption: item.tiktokCaption,
          bilingualBody: item.bilingualBody,
          hashtags,
          coverImage: item.coverImage,
          attachments: item.attachments || [],
          sourceType: item.sourceType,
          sourceIds,
        }),
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) throw new Error(parseApiErrorMessage(data) || "Failed");
      setItem(data.item as NewsPostApi);
      setMsg(L("تم حفظ المسودة", "Draft saved"));
      void loadList();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : L("فشل الحفظ", "Save failed"));
    } finally {
      setBusy(false);
    }
  };

  const handleNewDraft = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: L("مسودة خبر جديدة", "New draft"), sourceType: "manual" }),
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) throw new Error(parseApiErrorMessage(data) || "Failed");
      const it = data.item as NewsPostApi;
      setCurrentId(it.id);
      setItem(it);
      setMsg(L("تم إنشاء مسودة", "Draft created"));
      void loadList();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const handleGenerateAi = async () => {
    if (!currentId) return;
    setIsGenerating(true);
    setErr(null);
    setGenerateErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/news/${currentId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: aiPlatform,
          language: aiLanguage,
        }),
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        const m =
          parseApiErrorMessage(data) ||
          L("فشل توليد المحتوى", "Content generation failed");
        throw new Error(m);
      }
      if (data.item) setItem(data.item as NewsPostApi);
      void loadList();
      setMsg(L("تم التوليد بنجاح", "Generated successfully"));
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : L("فشل توليد المحتوى", "Content generation failed");
      setGenerateErr(m);
    } finally {
      setIsGenerating(false);
    }
  };

  const postAction = async (path: string, body?: Record<string, unknown>) => {
    if (!currentId) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/news/${currentId}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {}),
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        throw new Error(parseApiErrorMessage(data) || String(data.error || "Failed"));
      }
      if (data.item) setItem(data.item as NewsPostApi);
      void loadList();
      setMsg(L("تمت العملية", "Done"));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const quality = useMemo(() => {
    if (!item) return [];
    return evaluateNewsQuality(
      {
        title: item.title,
        coverImage: item.coverImage,
        websiteBody: item.websiteBody,
        instagramCaption: item.instagramCaption,
        xPostText: item.xPostText,
        tiktokCaption: item.tiktokCaption,
        snapchatText: item.snapchatText,
        namesOrEntities: item.namesOrEntities,
      },
      isAr
    );
  }, [item, isAr]);

  const integrationStatus = (provider: string) => {
    const row = integrations.find((x) => x.provider === provider);
    if (!row) return L("غير معروف", "Unknown");
    if (row.status === "connected") return L("متصل", "Connected");
    return L("غير متصل", "Disconnected");
  };

  const publishTargetsValid =
    publishTargets.length > 0 && publishTargets.every((t) => integrationConnected(t));

  const canPublish =
    !!item &&
    publishTargetsValid &&
    strictPublish.ok &&
    ["approved", "scheduled", "published"].includes(item.status);

  const blockLabel = (code: string) => {
    const map: Record<string, { ar: string; en: string }> = {
      no_title: { ar: "العنوان مطلوب", en: "Title required" },
      no_body: { ar: "النص الأساسي قصير جدًا أو فارغ", en: "Body too short or empty" },
      no_cover: { ar: "صورة الغلاف مطلوبة للنشر", en: "Cover image required" },
    };
    return L(map[code]?.ar || code, map[code]?.en || code);
  };

  const handleStepKey = (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setStep(idx);
    }
  };

  const snapExportPayload = useMemo(() => {
    if (!item) return "";
    return JSON.stringify(
      {
        title: item.title,
        snapchatText: item.snapchatText || "",
        hashtags: item.hashtags || [],
        coverImage: item.coverImage || "",
      },
      null,
      2
    );
  }, [item]);

  const handleSnapExport = () => {
    const blob = new Blob([snapExportPayload], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `snapchat-pack-${currentId || "draft"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6" dir={isAr ? "rtl" : "ltr"}>
      <header className="rounded-2xl border border-gray-200 bg-gradient-to-br from-[#071a3d]/5 to-white p-6 shadow-sm">
        <h1 className="text-2xl font-black text-text">{L("إنشاء خبر بالذكاء الاصطناعي", "AI news studio")}</h1>
        <p className="mt-2 max-w-3xl text-sm text-text-light">
          {L(
            "توليد وصياغة واعتماد ونشر الأخبار المدرسية للموقع والمنصات الاجتماعية",
            "Generate, edit, approve, and publish school news for the website and social channels."
          )}
        </p>
      </header>

      {generateErr ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          <p className="font-semibold">{generateErr}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg bg-red-800 px-3 py-1.5 text-xs font-bold text-white"
              onClick={() => void handleGenerateAi()}
              disabled={isGenerating || !currentId}
            >
              {L("إعادة محاولة التوليد", "Retry generation")}
            </button>
            <button
              type="button"
              className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-bold text-red-900"
              onClick={() => setGenerateErr(null)}
            >
              {L("إخفاء", "Dismiss")}
            </button>
          </div>
        </div>
      ) : null}
      {err ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="status">
          <p className="font-semibold">{err}</p>
          <button
            type="button"
            className="mt-2 rounded-lg border border-amber-400 px-3 py-1.5 text-xs font-bold"
            onClick={() => setErr(null)}
          >
            {L("إخفاء", "Dismiss")}
          </button>
        </div>
      ) : null}
      {msg ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {msg}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleNewDraft()}
          disabled={busy || isGenerating}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {L("مسودة جديدة", "New draft")}
        </button>
        <button
          type="button"
          onClick={() => void loadList()}
          className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold hover:bg-gray-50"
        >
          {L("تحديث القائمة", "Refresh list")}
        </button>
      </div>

      <nav
        className="flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
        aria-label="Workflow steps"
      >
        {STEPS.map((s, idx) => (
          <div key={s.id} className="flex items-center gap-2">
            <button
              type="button"
              tabIndex={0}
              onClick={() => setStep(idx)}
              onKeyDown={(e) => handleStepKey(e, idx)}
              className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold transition ${
                step === idx
                  ? "bg-primary text-white ring-2 ring-primary/30"
                  : "bg-gray-100 text-text hover:bg-gray-200"
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] ${
                  step === idx ? "bg-white/20" : "bg-white"
                }`}
              >
                {idx + 1}
              </span>
              {L(s.ar, s.en)}
            </button>
            {idx < STEPS.length - 1 ? (
              <ChevronRight className="h-4 w-4 text-gray-300 rtl:rotate-180" aria-hidden />
            ) : null}
          </div>
        ))}
      </nav>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
          <h2 className="px-2 text-xs font-bold uppercase tracking-wide text-text-light">
            {L("المسودات الأخيرة", "Recent drafts")}
          </h2>
          {listLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
            </div>
          ) : (
            <ul className="mt-2 max-h-[420px] space-y-1 overflow-y-auto">
              {list.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => setCurrentId(n.id)}
                    className={`w-full rounded-lg px-3 py-2 text-start text-sm transition ${
                      currentId === n.id ? "bg-primary/10 font-bold text-primary" : "hover:bg-gray-50"
                    }`}
                  >
                    <span className="line-clamp-2">{n.title}</span>
                    <span className="mt-0.5 block text-[10px] text-text-light">
                      {getNewsEditorialStatusLabel(n.status, loc)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm lg:p-6">
          {!currentId || !item ? (
            <p className="py-12 text-center text-text-light">
              {L("اختر خبرًا من القائمة أو أنشئ مسودة جديدة.", "Pick a post or create a new draft.")}
            </p>
          ) : itemLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
            </div>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap justify-between gap-2">
                <button
                  type="button"
                  disabled={step <= 0}
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-bold disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
                  {L("السابق", "Back")}
                </button>
                <button
                  type="button"
                  disabled={step >= STEPS.length - 1}
                  onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-bold disabled:opacity-40"
                >
                  {L("التالي", "Next")}
                  <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
                </button>
              </div>

              {step === 0 ? (
                <div className="space-y-4">
                  <label className="block text-sm font-bold text-text">{L("نوع المصدر", "Source type")}</label>
                  <select
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    value={item.sourceType}
                    onChange={(e) => patchLocal({ sourceType: e.target.value as NewsPostApi["sourceType"] })}
                  >
                    {SOURCE_OPTIONS.map((o) => (
                      <option key={o.v} value={o.v}>
                        {L(o.ar, o.en)}
                      </option>
                    ))}
                  </select>
                  {(item.sourceType === "approved_achievement" ||
                    item.sourceType === "certificate" ||
                    item.sourceType === "achievement_bundle") && (
                    <div>
                      <label className="block text-sm font-bold text-text">
                        {L("معرّفات مرتبطة (فاصلة أو سطر)", "Linked IDs (comma)")}
                      </label>
                      <textarea
                        className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-mono"
                        rows={3}
                        value={sourceIdsText}
                        onChange={(e) => setSourceIdsText(e.target.value)}
                        placeholder="507f1f77bcf86cd799439011"
                      />
                    </div>
                  )}
                </div>
              ) : null}

              {step === 1 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    ["title", L("العنوان الرئيسي", "Title"), "text"],
                    ["subtitle", L("عنوان فرعي", "Subtitle"), "text"],
                    ["category", L("نوع الخبر", "News type"), "text"],
                    ["audience", L("الجمهور", "Audience"), "text"],
                    ["schoolSection", L("المدرسة / القسم / المرحلة", "School / section"), "text"],
                    ["namesOrEntities", L("أسماء الطلاب أو الجهات", "Students / entities"), "text"],
                    ["location", L("المكان", "Location"), "text"],
                  ].map(([key, label, type]) => (
                    <label key={key} className="block text-sm">
                      <span className="font-bold text-text">{label}</span>
                      <input
                        type={type}
                        className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                        value={String((item as unknown as Record<string, unknown>)[key] ?? "")}
                        onChange={(e) => patchLocal({ [key]: e.target.value } as Partial<NewsPostApi>)}
                      />
                    </label>
                  ))}
                  <label className="block text-sm md:col-span-2">
                    <span className="font-bold text-text">{L("اللغة", "Language")}</span>
                    <select
                      className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                      value={item.locale}
                      onChange={(e) => patchLocal({ locale: e.target.value as NewsPostApi["locale"] })}
                    >
                      <option value="ar">العربية</option>
                      <option value="en">English</option>
                      <option value="bilingual">{L("ثنائي", "Bilingual")}</option>
                    </select>
                  </label>
                  <label className="block text-sm md:col-span-2">
                    <span className="font-bold text-text">{L("النبرة", "Tone")}</span>
                    <select
                      className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                      value={item.tone || "formal"}
                      onChange={(e) => patchLocal({ tone: e.target.value })}
                    >
                      <option value="formal">{L("رسمية", "Formal")}</option>
                      <option value="celebratory">{L("احتفالية", "Celebratory")}</option>
                      <option value="informative">{L("إعلامية", "Informative")}</option>
                      <option value="brief">{L("مختصرة", "Brief")}</option>
                    </select>
                  </label>
                  <label className="block text-sm md:col-span-2">
                    <span className="font-bold text-text">{L("التاريخ", "Date")}</span>
                    <input
                      type="datetime-local"
                      className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                      value={item.eventDate ? item.eventDate.slice(0, 16) : ""}
                      onChange={(e) =>
                        patchLocal({
                          eventDate: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                        })
                      }
                    />
                  </label>
                  <label className="block text-sm md:col-span-2">
                    <span className="font-bold text-text">{L("الوصف / نقاط خام", "Summary / raw notes")}</span>
                    <textarea
                      className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                      rows={4}
                      value={item.summary || ""}
                      onChange={(e) => patchLocal({ summary: e.target.value })}
                    />
                  </label>
                  <label className="block text-sm md:col-span-2">
                    <span className="font-bold text-text">{L("صورة الغلاف (رابط)", "Cover image URL")}</span>
                    <input
                      type="url"
                      className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                      value={item.coverImage || ""}
                      onChange={(e) => patchLocal({ coverImage: e.target.value })}
                    />
                  </label>
                  <label className="block text-sm md:col-span-2">
                    <span className="font-bold text-text">{L("وسوم / هاشتاق", "Hashtags")}</span>
                    <input
                      className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                      value={hashtagsText}
                      onChange={(e) => setHashtagsText(e.target.value)}
                      placeholder="#تميز #مدرسة"
                    />
                  </label>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="grid gap-6 xl:grid-cols-2">
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {OUT_TABS.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setOutTab(t.id)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                            outTab === t.id ? "bg-primary text-white" : "bg-gray-100"
                          }`}
                        >
                          {L(t.ar, t.en)}
                        </button>
                      ))}
                    </div>

                    <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-4">
                      <p className="text-xs font-bold text-violet-900">{L("إعدادات التوليد", "Generation")}</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <label className="block text-xs font-semibold">
                          {L("المنصة المستهدفة", "Target platform")}
                          <select
                            className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-2 text-sm"
                            value={aiPlatform}
                            onChange={(e) => setAiPlatform(e.target.value as AiPlatform)}
                          >
                            <option value="website">{L("الموقع", "Website")}</option>
                            <option value="instagram">Instagram</option>
                            <option value="x">X</option>
                          </select>
                        </label>
                        <label className="block text-xs font-semibold">
                          {L("لغة المخرجات", "Output language")}
                          <select
                            className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-2 text-sm"
                            value={aiLanguage}
                            onChange={(e) => setAiLanguage(e.target.value)}
                          >
                            <option value="ar">العربية</option>
                            <option value="en">English</option>
                            <option value="both">{L("ثنائي", "Bilingual")}</option>
                          </select>
                        </label>
                      </div>
                      <button
                        type="button"
                        disabled={isGenerating || busy}
                        onClick={() => void handleGenerateAi()}
                        className="mt-3 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                      >
                        {isGenerating ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        ) : (
                          <Sparkles className="h-4 w-4" aria-hidden />
                        )}
                        {L("توليد بالذكاء الاصطناعي", "Generate with AI")}
                      </button>
                    </div>

                    {outTab === "website" ? (
                      <textarea
                        className="min-h-[200px] w-full rounded-xl border border-gray-200 px-3 py-2 text-sm leading-relaxed"
                        value={item.websiteBody || ""}
                        onChange={(e) => patchLocal({ websiteBody: e.target.value })}
                      />
                    ) : null}
                    {outTab === "instagram" ? (
                      <textarea
                        className="min-h-[160px] w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                        value={item.instagramCaption || ""}
                        onChange={(e) => patchLocal({ instagramCaption: e.target.value })}
                      />
                    ) : null}
                    {outTab === "x" ? (
                      <textarea
                        className="min-h-[100px] w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                        value={item.xPostText || ""}
                        onChange={(e) => patchLocal({ xPostText: e.target.value })}
                        maxLength={280}
                      />
                    ) : null}
                    {outTab === "snapchat" ? (
                      <div className="space-y-3">
                        <textarea
                          className="min-h-[100px] w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                          value={item.snapchatText || ""}
                          onChange={(e) => patchLocal({ snapchatText: e.target.value })}
                        />
                        <p className="text-xs text-text-light">
                          {L(
                            "انسخ النص أو صدّر الحزمة للنشر اليدوي على سناب شات.",
                            "Copy or export for manual posting to Snapchat."
                          )}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold"
                            onClick={() => void navigator.clipboard.writeText(item.snapchatText || "")}
                          >
                            <Copy className="h-3.5 w-3.5" aria-hidden />
                            {L("نسخ النص", "Copy text")}
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold"
                            onClick={handleSnapExport}
                          >
                            <FileJson className="h-3.5 w-3.5" aria-hidden />
                            {L("تصدير JSON", "Export JSON")}
                          </button>
                          {item.coverImage ? (
                            <a
                              href={item.coverImage}
                              download
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white"
                            >
                              <Download className="h-3.5 w-3.5" aria-hidden />
                              {L("تنزيل الوسائط", "Download media")}
                            </a>
                          ) : (
                            <span className="text-xs text-amber-700">
                              {L("أضف رابط صورة للتنزيل", "Add cover URL to download media")}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : null}
                    {outTab === "tiktok" ? (
                      <textarea
                        className="min-h-[100px] w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                        value={item.tiktokCaption || ""}
                        onChange={(e) => patchLocal({ tiktokCaption: e.target.value })}
                      />
                    ) : null}
                    {outTab === "bilingual" ? (
                      <textarea
                        className="min-h-[200px] w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                        value={item.bilingualBody || ""}
                        onChange={(e) => patchLocal({ bilingualBody: e.target.value })}
                      />
                    ) : null}
                  </div>

                  <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/80 p-4">
                    <p className="text-sm font-black text-text">{L("معاينة", "Preview")}</p>
                    <div className="mt-2 flex gap-2">
                      {(["website", "instagram", "x"] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPreviewTab(p)}
                          className={`rounded-lg px-2 py-1 text-xs font-bold ${
                            previewTab === p ? "bg-primary text-white" : "bg-white text-text ring-1 ring-gray-200"
                          }`}
                        >
                          {p === "website" ? L("الموقع", "Web") : p === "instagram" ? "IG" : "X"}
                        </button>
                      ))}
                    </div>
                    {previewTab === "website" ? (
                      <article className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                        {item.coverImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.coverImage}
                            alt=""
                            className="mb-3 max-h-40 w-full rounded-lg object-cover"
                          />
                        ) : null}
                        <h3 className="text-lg font-bold text-[#071a3d]">{item.title || "—"}</h3>
                        <div className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
                          {(item.websiteBody || "").slice(0, 600)}
                          {(item.websiteBody || "").length > 600 ? "…" : ""}
                        </div>
                      </article>
                    ) : null}
                    {previewTab === "instagram" ? (
                      <div className="mx-auto mt-4 max-w-[280px] rounded-2xl border border-gray-300 bg-white p-3 shadow-md">
                        <div className="aspect-square w-full overflow-hidden rounded-lg bg-gray-100">
                          {item.coverImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.coverImage} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs text-gray-400">
                              Image
                            </div>
                          )}
                        </div>
                        <p className="mt-2 line-clamp-6 text-xs text-gray-800">
                          {item.instagramCaption || "—"}
                        </p>
                      </div>
                    ) : null}
                    {previewTab === "x" ? (
                      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                        <p className="text-sm text-gray-900">{item.xPostText || "—"}</p>
                        <p className="mt-2 text-xs text-gray-400">{item.xPostText?.length || 0}/280</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="space-y-3">
                  {!strictPublish.ok ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                      <p className="font-bold">{L("لا يمكن النشر حتى يُستكمل:", "Cannot publish until fixed:")}</p>
                      <ul className="mt-2 list-inside list-disc">
                        {strictPublish.blocks.map((b) => (
                          <li key={b}>{blockLabel(b)}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <ul className="space-y-2">
                    {quality.map((q) => (
                      <li
                        key={q.id}
                        className={`rounded-xl border px-3 py-2 text-sm ${
                          q.blocking ? "border-amber-300 bg-amber-50" : "border-gray-200 bg-gray-50"
                        }`}
                      >
                        <span className="font-bold">{q.blocking ? "● " : "○ "}</span>
                        {L(q.ar, q.en)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {step === 4 ? (
                <div className="space-y-6">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-text">
                      {getNewsEditorialStatusLabel(item.status, loc)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy || isGenerating}
                      onClick={() => void handleSaveDraft()}
                      className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2 text-sm font-bold hover:bg-gray-50 disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" aria-hidden />
                      {L("حفظ كمسودة", "Save draft")}
                    </button>
                    <button
                      type="button"
                      disabled={busy || isGenerating}
                      onClick={() => void handleGenerateAi()}
                      className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-bold text-violet-900 disabled:opacity-50"
                    >
                      <RefreshCw className="h-4 w-4" aria-hidden />
                      {L("إعادة توليد", "Regenerate")}
                    </button>
                    <button
                      type="button"
                      disabled={busy || isGenerating || !["draft", "failed"].includes(item.status)}
                      onClick={() => void postAction("/submit-review")}
                      className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2 text-sm font-bold disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" aria-hidden />
                      {L("إرسال للمراجعة", "Submit for review")}
                    </button>
                    <button
                      type="button"
                      disabled={busy || isGenerating || item.status !== "pending_review"}
                      onClick={() => void postAction("/approve")}
                      className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-900 disabled:opacity-50"
                    >
                      <CheckCircle className="h-4 w-4" aria-hidden />
                      {L("اعتماد الخبر", "Approve")}
                    </button>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4">
                    <p className="text-sm font-bold text-text">{L("أهداف النشر", "Publish targets")}</p>
                    <p className="mt-1 text-xs text-text-light">
                      {L(
                        "المنصات غير المتصلة معطّلة. يجب اختيار منصة جاهزة على الأقل.",
                        "Disconnected platforms are disabled. Pick at least one ready target."
                      )}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-3">
                      {[
                        { id: "website", icon: Globe, label: L("الموقع", "Website") },
                        { id: "instagram", icon: Instagram, label: "Instagram" },
                        { id: "x", label: "X" },
                        { id: "tiktok", label: "TikTok" },
                        { id: "snapchat", label: "Snapchat" },
                      ].map((row) => {
                        const connected = integrationConnected(row.id);
                        const checked = publishTargets.includes(row.id);
                        const disabled = !connected;
                        const tip = disabled ? L("غير متصل", "Not connected") : undefined;
                        return (
                          <label
                            key={row.id}
                            title={tip}
                            className={`flex items-center gap-2 text-sm ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={disabled}
                              title={tip}
                              aria-label={`${row.label}${tip ? ` — ${tip}` : ""}`}
                              onChange={(e) => {
                                setPublishTargets((prev) =>
                                  e.target.checked ? [...prev, row.id] : prev.filter((x) => x !== row.id)
                                );
                              }}
                            />
                            {"icon" in row && row.icon ? (
                              <row.icon className="h-4 w-4 text-primary" aria-hidden />
                            ) : null}
                            {row.label}
                          </label>
                        );
                      })}
                    </div>
                    {!publishTargetsValid ? (
                      <p className="mt-2 text-xs font-bold text-amber-800">
                        {L("اختر منصة متصلة للنشر.", "Select a connected platform.")}
                      </p>
                    ) : null}
                    {!strictPublish.ok ? (
                      <p className="mt-2 text-xs font-bold text-red-800">
                        {L("أكمل العنوان والصورة والنص قبل النشر.", "Complete title, cover image, and body.")}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      disabled={busy || isGenerating || !canPublish}
                      onClick={() => void postAction("/publish", { targets: publishTargets })}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                    >
                      {L("نشر على المحدد", "Publish to selected")}
                    </button>
                  </div>

                  <div className="rounded-xl border border-gray-200 p-4">
                    <label className="block text-sm font-bold">{L("جدولة", "Schedule")}</label>
                    <input
                      type="datetime-local"
                      className="mt-2 rounded-xl border border-gray-200 px-3 py-2 text-sm"
                      value={scheduleIso}
                      onChange={(e) => setScheduleIso(e.target.value)}
                    />
                    <button
                      type="button"
                      disabled={busy || isGenerating || !scheduleIso || item.status !== "approved"}
                      onClick={() =>
                        void postAction("/schedule", {
                          scheduledFor: new Date(scheduleIso).toISOString(),
                        })
                      }
                      className="mt-3 inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2 text-sm font-bold disabled:opacity-50"
                    >
                      <CalendarClock className="h-4 w-4" aria-hidden />
                      {L("جدولة النشر", "Schedule")}
                    </button>
                  </div>

                  <div className="rounded-xl border border-gray-200 p-4">
                    <p className="text-sm font-bold">{L("التكاملات", "Integrations")}</p>
                    <ul className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                      <li>
                        <Globe className="me-1 inline h-4 w-4" aria-hidden />
                        {L("الموقع: جاهز", "Website: ready")}
                      </li>
                      <li>Instagram — {integrationStatus("instagram")}</li>
                      <li>X — {integrationStatus("x")}</li>
                      <li>TikTok — {integrationStatus("tiktok")}</li>
                      <li className="sm:col-span-2">Snapchat — {integrationStatus("snapchat")}</li>
                    </ul>
                    <a
                      href="/admin/settings/social-integrations"
                      className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-primary underline"
                    >
                      <Plug className="h-4 w-4" aria-hidden />
                      {L("إعدادات التكاملات", "Integration settings")}
                    </a>
                  </div>

                  {item.publishResults?.length ? (
                    <div className="rounded-xl border border-gray-200 p-4">
                      <p className="text-sm font-bold">{L("نتائج النشر", "Publish results")}</p>
                      <ul className="mt-2 space-y-1 text-xs">
                        {item.publishResults.slice(-8).map((r, i) => (
                          <li key={`${r.target}-${i}`}>
                            {r.target}: {r.success ? "OK" : "—"} {r.errorMessage ? `(${r.errorMessage})` : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {step !== 4 ? (
                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    disabled={busy || isGenerating}
                    onClick={() => void handleSaveDraft()}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" aria-hidden />
                    {L("حفظ التغييرات", "Save changes")}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default NewsMediaConsole;
