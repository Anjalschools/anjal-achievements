"use client";

import { useEffect, useState } from "react";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import { getLocale } from "@/lib/i18n";
import { Loader2, PlusCircle, Save, Trash2 } from "lucide-react";
import { DEFAULT_HOME_PAGE_CONTENT, type HomePageContentPayload } from "@/lib/home-page-content";

const EMPTY_FORM: HomePageContentPayload = DEFAULT_HOME_PAGE_CONTENT;

export default function HomeCeremonySettingsPage() {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<HomePageContentPayload>(EMPTY_FORM);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch("/api/admin/settings/home-ceremony", { cache: "no-store" });
        if (!res.ok) throw new Error("load_failed");
        const json = (await res.json()) as { ok?: boolean; data?: Partial<HomePageContentPayload> };
        if (!mounted || !json?.ok) return;
        setForm({ ...EMPTY_FORM, ...(json.data || {}) });
      } catch {
        if (!mounted) return;
        setNotice({
          kind: "err",
          text: isAr ? "تعذر تحميل إعدادات قسم الحفل." : "Failed to load ceremony section settings.",
        });
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [isAr]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings/home-ceremony", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("save_failed");
      const json = (await res.json()) as { ok?: boolean; data?: Partial<HomePageContentPayload> };
      if (!json?.ok) throw new Error("save_failed");
      setForm({ ...EMPTY_FORM, ...(json.data || {}) });
      setNotice({ kind: "ok", text: isAr ? "تم الحفظ بنجاح." : "Saved successfully." });
    } catch {
      setNotice({ kind: "err", text: isAr ? "فشل حفظ التعديلات." : "Failed to save changes." });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRecognitionItem = (
    lang: "ar" | "en",
    index: number,
    value: string
  ) => {
    if (lang === "ar") {
      setForm((prev) => {
        const next = [...prev.ceremonyRecognitionItemsAr];
        next[index] = value;
        return { ...prev, ceremonyRecognitionItemsAr: next };
      });
      return;
    }
    setForm((prev) => {
      const next = [...prev.ceremonyRecognitionItemsEn];
      next[index] = value;
      return { ...prev, ceremonyRecognitionItemsEn: next };
    });
  };

  const handleAddRecognitionItem = (lang: "ar" | "en") => {
    if (lang === "ar") {
      setForm((prev) => ({ ...prev, ceremonyRecognitionItemsAr: [...prev.ceremonyRecognitionItemsAr, ""] }));
      return;
    }
    setForm((prev) => ({ ...prev, ceremonyRecognitionItemsEn: [...prev.ceremonyRecognitionItemsEn, ""] }));
  };

  const handleRemoveRecognitionItem = (lang: "ar" | "en", index: number) => {
    if (lang === "ar") {
      setForm((prev) => ({
        ...prev,
        ceremonyRecognitionItemsAr: prev.ceremonyRecognitionItemsAr.filter((_, idx) => idx !== index),
      }));
      return;
    }
    setForm((prev) => ({
      ...prev,
      ceremonyRecognitionItemsEn: prev.ceremonyRecognitionItemsEn.filter((_, idx) => idx !== index),
    }));
  };

  if (loading) {
    return (
      <PageContainer className="py-8">
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-10">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>{isAr ? "جاري التحميل..." : "Loading..."}</span>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="py-8">
      <PageHeader
        title={isAr ? "تحرير الصفحة الرئيسية" : "Edit homepage"}
        subtitle={
          isAr
            ? "تحرير نصوص الرؤية والرسالة وقسم الحفل والدعوة في الصفحة الرئيسية."
            : "Edit vision, mission, ceremony, and invitation content shown on the homepage."
        }
        actions={
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isAr ? "حفظ" : "Save"}
          </button>
        }
      />

      {notice ? (
        <div
          className={`mb-4 rounded-xl px-4 py-3 text-sm font-semibold ${
            notice.kind === "ok" ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-800"
          }`}
        >
          {notice.text}
        </div>
      ) : null}

      <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-1 text-lg font-bold text-slate-900">{isAr ? "قسم الرؤية" : "Vision section"}</h2>
        <p className="mb-4 text-sm text-slate-500">
          {isAr ? "يظهر هذا النص في بطاقة الرؤية أعلى الصفحة الرئيسية." : "Displayed in the Vision card on the homepage."}
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            {isAr ? "الرؤية (عربي)" : "Vision (Arabic)"}
            <textarea
              value={form.visionAr}
              onChange={(e) => setForm((prev) => ({ ...prev, visionAr: e.target.value }))}
              rows={4}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            {isAr ? "الرؤية (إنجليزي)" : "Vision (English)"}
            <textarea
              value={form.visionEn}
              onChange={(e) => setForm((prev) => ({ ...prev, visionEn: e.target.value }))}
              rows={4}
              dir="ltr"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
        </div>
      </section>

      <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-1 text-lg font-bold text-slate-900">{isAr ? "قسم الرسالة" : "Mission section"}</h2>
        <p className="mb-4 text-sm text-slate-500">
          {isAr ? "يظهر هذا النص في بطاقة الرسالة بجانب الرؤية." : "Displayed in the Mission card next to Vision."}
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            {isAr ? "الرسالة (عربي)" : "Mission (Arabic)"}
            <textarea
              value={form.missionAr}
              onChange={(e) => setForm((prev) => ({ ...prev, missionAr: e.target.value }))}
              rows={4}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            {isAr ? "الرسالة (إنجليزي)" : "Mission (English)"}
            <textarea
              value={form.missionEn}
              onChange={(e) => setForm((prev) => ({ ...prev, missionEn: e.target.value }))}
              rows={4}
              dir="ltr"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
        </div>
      </section>

      <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-1 text-lg font-bold text-slate-900">{isAr ? "قسم الحفل" : "Ceremony section"}</h2>
        <p className="mb-4 text-sm text-slate-500">
          {isAr
            ? "العنوان والسطر الفرعي والوصف الظاهرين في بطاقة حفل التكريم."
            : "Title, subtitle, and description shown in the ceremony card."}
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700 md:col-span-2">
            {isAr ? "العنوان (عربي)" : "Title (Arabic)"}
            <input
              value={form.ceremonyTitleAr}
              onChange={(e) => setForm((prev) => ({ ...prev, ceremonyTitleAr: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700 md:col-span-2">
            {isAr ? "العنوان (إنجليزي)" : "Title (English)"}
            <input
              value={form.ceremonyTitleEn}
              onChange={(e) => setForm((prev) => ({ ...prev, ceremonyTitleEn: e.target.value }))}
              dir="ltr"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            {isAr ? "السطر الفرعي (عربي)" : "Subtitle (Arabic)"}
            <input
              value={form.ceremonySubtitleAr}
              onChange={(e) => setForm((prev) => ({ ...prev, ceremonySubtitleAr: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            {isAr ? "السطر الفرعي (إنجليزي)" : "Subtitle (English)"}
            <input
              value={form.ceremonySubtitleEn}
              onChange={(e) => setForm((prev) => ({ ...prev, ceremonySubtitleEn: e.target.value }))}
              dir="ltr"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700 md:col-span-2">
            {isAr ? "وصف القسم (عربي)" : "Description (Arabic)"}
            <textarea
              value={form.ceremonyDescriptionAr}
              onChange={(e) => setForm((prev) => ({ ...prev, ceremonyDescriptionAr: e.target.value }))}
              rows={3}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700 md:col-span-2">
            {isAr ? "وصف القسم (إنجليزي)" : "Description (English)"}
            <textarea
              value={form.ceremonyDescriptionEn}
              onChange={(e) => setForm((prev) => ({ ...prev, ceremonyDescriptionEn: e.target.value }))}
              rows={3}
              dir="ltr"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-1 text-lg font-bold text-slate-900">
          {isAr ? "نص الدعوة - التفاصيل" : "Invitation text details"}
        </h2>
        <p className="mb-4 text-sm text-slate-500">
          {isAr
            ? "تقسيم النص إلى فقرات مستقلة لتسهيل التحرير الدقيق في الصفحة الرئيسية."
            : "Segmented invitation paragraphs for precise editing on the homepage."}
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            {isAr ? "مقدمة الدعوة (عربي)" : "Invitation intro (Arabic)"}
            <textarea
              value={form.ceremonyInvitationIntroAr}
              onChange={(e) => setForm((prev) => ({ ...prev, ceremonyInvitationIntroAr: e.target.value }))}
              rows={3}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            {isAr ? "مقدمة الدعوة (إنجليزي)" : "Invitation intro (English)"}
            <textarea
              value={form.ceremonyInvitationIntroEn}
              onChange={(e) => setForm((prev) => ({ ...prev, ceremonyInvitationIntroEn: e.target.value }))}
              rows={3}
              dir="ltr"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>

          <label className="text-sm font-semibold text-slate-700">
            {isAr ? "تاريخ الحفل (عربي)" : "Ceremony date (Arabic)"}
            <input
              value={form.ceremonyInvitationDateAr}
              onChange={(e) => setForm((prev) => ({ ...prev, ceremonyInvitationDateAr: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            {isAr ? "تاريخ الحفل (إنجليزي)" : "Ceremony date (English)"}
            <input
              value={form.ceremonyInvitationDateEn}
              onChange={(e) => setForm((prev) => ({ ...prev, ceremonyInvitationDateEn: e.target.value }))}
              dir="ltr"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>

          <label className="text-sm font-semibold text-slate-700">
            {isAr ? "مكان الحفل (عربي)" : "Venue (Arabic)"}
            <input
              value={form.ceremonyInvitationVenueAr}
              onChange={(e) => setForm((prev) => ({ ...prev, ceremonyInvitationVenueAr: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            {isAr ? "مكان الحفل (إنجليزي)" : "Venue (English)"}
            <input
              value={form.ceremonyInvitationVenueEn}
              onChange={(e) => setForm((prev) => ({ ...prev, ceremonyInvitationVenueEn: e.target.value }))}
              dir="ltr"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
            <h3 className="text-sm font-bold text-slate-900">
              {isAr ? "بنود ويشمل التكريم (عربي)" : "Recognition items (Arabic)"}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {isAr
                ? "كل بند سيظهر في الصفحة الرئيسية في سطر مستقل مع علامة صح."
                : "Each item is displayed on the homepage as a separate line with a check icon."}
            </p>
            <div className="mt-3 space-y-2">
              {form.ceremonyRecognitionItemsAr.map((item, idx) => (
                <div key={`ar-item-${idx}`} className="flex items-center gap-2">
                  <input
                    value={item}
                    onChange={(e) => handleUpdateRecognitionItem("ar", idx, e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveRecognitionItem("ar", idx)}
                    className="inline-flex items-center justify-center rounded-lg border border-red-300 bg-white p-2 text-red-600"
                    aria-label={isAr ? "حذف بند" : "Remove item"}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => handleAddRecognitionItem("ar")}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"
              >
                <PlusCircle className="h-4 w-4" />
                {isAr ? "إضافة بند" : "Add item"}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
            <h3 className="text-sm font-bold text-slate-900">
              {isAr ? "بنود ويشمل التكريم (إنجليزي)" : "Recognition items (English)"}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {isAr
                ? "كل بند سيظهر في الصفحة الرئيسية في سطر مستقل مع علامة صح."
                : "Each item is displayed on the homepage as a separate line with a check icon."}
            </p>
            <div className="mt-3 space-y-2">
              {form.ceremonyRecognitionItemsEn.map((item, idx) => (
                <div key={`en-item-${idx}`} className="flex items-center gap-2">
                  <input
                    value={item}
                    onChange={(e) => handleUpdateRecognitionItem("en", idx, e.target.value)}
                    dir="ltr"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveRecognitionItem("en", idx)}
                    className="inline-flex items-center justify-center rounded-lg border border-red-300 bg-white p-2 text-red-600"
                    aria-label={isAr ? "حذف بند" : "Remove item"}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => handleAddRecognitionItem("en")}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"
              >
                <PlusCircle className="h-4 w-4" />
                {isAr ? "إضافة بند" : "Add item"}
              </button>
            </div>
          </div>

          <label className="text-sm font-semibold text-slate-700 md:col-span-2">
            {isAr ? "الجوائز / التفاصيل الإضافية (عربي)" : "Awards / extra details (Arabic)"}
            <textarea
              value={form.ceremonyInvitationAwardsAr}
              onChange={(e) => setForm((prev) => ({ ...prev, ceremonyInvitationAwardsAr: e.target.value }))}
              rows={3}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700 md:col-span-2">
            {isAr ? "الجوائز / التفاصيل الإضافية (إنجليزي)" : "Awards / extra details (English)"}
            <textarea
              value={form.ceremonyInvitationAwardsEn}
              onChange={(e) => setForm((prev) => ({ ...prev, ceremonyInvitationAwardsEn: e.target.value }))}
              rows={3}
              dir="ltr"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>

          <label className="text-sm font-semibold text-slate-700 md:col-span-2">
            {isAr ? "الخاتمة (عربي)" : "Closing text (Arabic)"}
            <textarea
              value={form.ceremonyInvitationClosingAr}
              onChange={(e) => setForm((prev) => ({ ...prev, ceremonyInvitationClosingAr: e.target.value }))}
              rows={2}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700 md:col-span-2">
            {isAr ? "الخاتمة (إنجليزي)" : "Closing text (English)"}
            <textarea
              value={form.ceremonyInvitationClosingEn}
              onChange={(e) => setForm((prev) => ({ ...prev, ceremonyInvitationClosingEn: e.target.value }))}
              rows={2}
              dir="ltr"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
        </div>
      </section>
    </PageContainer>
  );
}
