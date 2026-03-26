"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PageContainer from "@/components/layout/PageContainer";
import { getLocale } from "@/lib/i18n";
import {
  Loader2,
  Save,
  Info,
  RotateCcw,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  SETTINGS_GROUP_HEADERS,
  fieldsByGroup,
  type PlatUiField,
  type SettingsGroupId,
} from "@/lib/platform-settings-ui-meta";

type SettingsState = {
  schoolYearPolicy: Record<string, unknown>;
  branding: Record<string, unknown>;
  ai: Record<string, unknown>;
  certificate: Record<string, unknown>;
  workflow: Record<string, unknown>;
};

const emptyState = (): SettingsState => ({
  schoolYearPolicy: {},
  branding: {},
  ai: {},
  certificate: {},
  workflow: {},
});

const GROUP_ORDER: SettingsGroupId[] = [
  "achievements",
  "certificates",
  "ai",
  "branding",
  "schoolYear",
];

const isLikelyValidUrl = (raw: string): boolean => {
  const t = raw.trim();
  if (!t) return true;
  const u = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const p = new URL(u);
    return p.protocol === "http:" || p.protocol === "https:";
  } catch {
    return false;
  }
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^(\+966|0)?5\d{8}$/;
const isLikelyMapEmbedUrl = (raw: string): boolean => {
  const t = raw.trim();
  if (!t) return true;
  if (/<iframe/i.test(t)) return false;
  try {
    const u = new URL(t);
    const host = u.hostname.toLowerCase();
    return u.protocol === "https:" && (host.includes("google.com") || host.includes("google.co")) && u.pathname.toLowerCase().includes("/maps");
  } catch {
    return false;
  }
};

const AdminSettingsPage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const L = useCallback(
    (ar: string, en: string) => (isAr ? ar : en),
    [isAr]
  );

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [settings, setSettings] = useState<SettingsState>(emptyState);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [aiOffModal, setAiOffModal] = useState<PlatUiField | null>(null);
  const [pendingAiValue, setPendingAiValue] = useState<boolean>(false);
  const [archiveModal, setArchiveModal] = useState(false);
  const [pendingArchiveValue, setPendingArchiveValue] = useState(false);
  const [resetModal, setResetModal] = useState(false);

  const showToast = useCallback((kind: "ok" | "err", text: string) => {
    setToast({ kind, text });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const load = useCallback(async () => {
    setLoading(true);
    setFieldErrors({});
    try {
      const res = await fetch("/api/admin/settings/get", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Failed");
      const d = (data.data || {}) as Record<string, unknown>;
      setReadOnly(data.meta?.readOnly === true);
      setSettings({
        schoolYearPolicy: (d.schoolYearPolicy || {}) as Record<string, unknown>,
        branding: (d.branding || {}) as Record<string, unknown>,
        ai: (d.ai || {}) as Record<string, unknown>,
        certificate: (d.certificate || {}) as Record<string, unknown>,
        workflow: (d.workflow || {}) as Record<string, unknown>,
      });
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : locale === "ar"
            ? "فشل التحميل"
            : "Load failed";
      showToast("err", msg);
    } finally {
      setLoading(false);
    }
  }, [locale, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const getSection = useCallback(
    (section: PlatUiField["section"]): Record<string, unknown> => {
      switch (section) {
        case "schoolYearPolicy":
          return settings.schoolYearPolicy;
        case "branding":
          return settings.branding;
        case "ai":
          return settings.ai;
        case "certificate":
          return settings.certificate;
        case "workflow":
          return settings.workflow;
        default:
          return {};
      }
    },
    [settings]
  );

  const setSectionKey = useCallback(
    (section: PlatUiField["section"], key: string, value: unknown) => {
      setSettings((prev) => {
        const next = { ...prev };
        const bag = { ...(next[section] as Record<string, unknown>) };
        bag[key] = value;
        (next as Record<string, Record<string, unknown>>)[section] = bag;
        return next;
      });
      setFieldErrors((e) => {
        const k = `${section}.${key}`;
        if (!e[k]) return e;
        const { [k]: _, ...rest } = e;
        return rest;
      });
    },
    []
  );

  const validateGroupClient = useCallback(
    (group: SettingsGroupId): boolean => {
      const errs: Record<string, string> = {};
      const fields = fieldsByGroup(group);
      for (const f of fields) {
        const sec = getSection(f.section);
        if (f.section === "branding" && f.key === "websiteUrl") {
          const v = String(sec.websiteUrl ?? "").trim();
          if (v && !isLikelyValidUrl(v)) {
            errs[`${f.section}.${f.key}`] = L("رابط غير صالح", "Invalid URL");
          }
        }
        if (f.section === "certificate" && f.key === "certificatePrefix") {
          const v = String(sec.certificatePrefix ?? "").trim();
          if (!v) errs[`${f.section}.${f.key}`] = L("مطلوب", "Required");
          else if (v.length > 10) errs[`${f.section}.${f.key}`] = L("الحد 10", "Max 10");
        }
        if (f.section === "branding" && f.key === "contactEmailPrimary") {
          const v = String(sec.contactEmailPrimary ?? "").trim();
          if (v && !EMAIL_RE.test(v)) errs[`${f.section}.${f.key}`] = L("بريد غير صالح", "Invalid email");
        }
        if (f.section === "branding" && f.key === "contactEmailSecondary") {
          const v = String(sec.contactEmailSecondary ?? "").trim();
          if (v && !EMAIL_RE.test(v)) errs[`${f.section}.${f.key}`] = L("بريد غير صالح", "Invalid email");
        }
        if (f.section === "branding" && f.key === "contactPhonePrimary") {
          const v = String(sec.contactPhonePrimary ?? "").trim();
          if (v && !PHONE_RE.test(v.replace(/\s+/g, ""))) errs[`${f.section}.${f.key}`] = L("هاتف غير صالح", "Invalid phone");
        }
        if (f.section === "branding" && f.key === "contactPhoneSecondary") {
          const v = String(sec.contactPhoneSecondary ?? "").trim();
          if (v && !PHONE_RE.test(v.replace(/\s+/g, ""))) errs[`${f.section}.${f.key}`] = L("هاتف غير صالح", "Invalid phone");
        }
        if (f.section === "branding" && f.key === "mapEmbedUrl") {
          const v = String(sec.mapEmbedUrl ?? "").trim();
          if (v && !isLikelyMapEmbedUrl(v)) {
            errs[`${f.section}.${f.key}`] = L(
              "أدخل رابط Google Maps Embed فقط (src) بدون iframe كامل",
              "Use Google Maps embed src URL only (no full iframe)"
            );
          }
        }
      }
      setFieldErrors((prev) => ({ ...prev, ...errs }));
      return Object.keys(errs).length === 0;
    },
    [getSection, L]
  );

  const saveGroup = async (group: SettingsGroupId) => {
    if (readOnly) return;
    if (!validateGroupClient(group)) {
      showToast("err", L("صحح الأخطاء قبل الحفظ", "Fix validation errors"));
      return;
    }
    setIsSaving(true);
    try {
      const fields = fieldsByGroup(group);
      const sections = new Set(fields.map((f) => f.section));
      const payload: Record<string, unknown> = {};
      if (sections.has("workflow")) payload.workflow = settings.workflow;
      if (sections.has("certificate")) payload.certificate = settings.certificate;
      if (sections.has("ai")) payload.ai = settings.ai;
      if (sections.has("branding")) payload.branding = settings.branding;
      if (sections.has("schoolYearPolicy")) payload.schoolYearPolicy = settings.schoolYearPolicy;

      const res = await fetch("/api/admin/settings/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.messageEn || L("فشل الحفظ", "Save failed"));
      }
      if (data.data) {
        const d = data.data as Record<string, unknown>;
        setSettings({
          schoolYearPolicy: (d.schoolYearPolicy || {}) as Record<string, unknown>,
          branding: (d.branding || {}) as Record<string, unknown>,
          ai: (d.ai || {}) as Record<string, unknown>,
          certificate: (d.certificate || {}) as Record<string, unknown>,
          workflow: (d.workflow || {}) as Record<string, unknown>,
        });
      }
      showToast("ok", L("✅ تم الحفظ بنجاح", "✅ Saved successfully"));
    } catch (e: unknown) {
      showToast("err", L("❌ فشل الحفظ — ", "❌ Save failed — ") + (e instanceof Error ? e.message : ""));
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (readOnly) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/admin/settings/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetToDefaults: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || L("فشل الاستعادة", "Reset failed"));
      if (data.data) {
        const d = data.data as Record<string, unknown>;
        setSettings({
          schoolYearPolicy: (d.schoolYearPolicy || {}) as Record<string, unknown>,
          branding: (d.branding || {}) as Record<string, unknown>,
          ai: (d.ai || {}) as Record<string, unknown>,
          certificate: (d.certificate || {}) as Record<string, unknown>,
          workflow: (d.workflow || {}) as Record<string, unknown>,
        });
      }
      setResetModal(false);
      showToast("ok", L("✅ تمت استعادة الافتراضي", "✅ Defaults restored"));
    } catch (e: unknown) {
      showToast("err", e instanceof Error ? e.message : L("فشل", "Failed"));
    } finally {
      setIsSaving(false);
    }
  };

  const onBoolChange = (f: PlatUiField, next: boolean) => {
    if (readOnly) return;
    if (!next && f.confirmBeforeOff) {
      setPendingAiValue(next);
      setAiOffModal(f);
      return;
    }
    if (next && f.warnBeforeOn) {
      setPendingArchiveValue(next);
      setArchiveModal(true);
      return;
    }
    setSectionKey(f.section, f.key, next);
  };

  const confirmAiOff = () => {
    if (aiOffModal) setSectionKey(aiOffModal.section, aiOffModal.key, pendingAiValue);
    setAiOffModal(null);
  };

  const confirmArchive = () => {
    setSectionKey("schoolYearPolicy", "autoArchivePreviousWhenActivating", pendingArchiveValue);
    setArchiveModal(false);
  };

  const renderField = (f: PlatUiField) => {
    const bag = getSection(f.section);
    const fk = `${f.section}.${f.key}`;
    const err = fieldErrors[fk];
    const label = L(f.labelAr, f.labelEn);
    const desc = L(f.descriptionAr, f.descriptionEn);
    const tip = L(f.tooltipAr, f.tooltipEn);

    if (f.kind === "boolean") {
      const checked = bag[f.key] !== false;
      return (
        <div
          key={fk}
          className="flex flex-col gap-1 rounded-xl border border-gray-100 bg-gray-50/60 p-4"
        >
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 shrink-0"
              disabled={readOnly || isSaving}
              checked={checked}
              onChange={(e) => onBoolChange(f, e.target.checked)}
            />
            <div className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2 font-bold text-text">
                {label}
                <span
                  className="inline-flex text-text-light"
                  title={tip}
                  aria-label={tip}
                >
                  <Info className="h-4 w-4" aria-hidden />
                </span>
              </span>
              <p className="mt-1 text-xs text-text-light">{desc}</p>
            </div>
          </label>
        </div>
      );
    }

    if (f.kind === "number") {
      const n = typeof bag[f.key] === "number" ? (bag[f.key] as number) : Number(bag[f.key] ?? 0);
      return (
        <div key={fk} className="rounded-xl border border-gray-100 bg-white p-4">
          <label className="block">
            <span className="flex items-center gap-2 text-sm font-bold text-text">
              {label}
              <span title={tip} aria-label={tip}>
                <Info className="h-4 w-4 text-text-light" />
              </span>
            </span>
            <p className="mt-1 text-xs text-text-light">{desc}</p>
            <input
              type="number"
              disabled={readOnly || isSaving}
              min={f.numberMin}
              max={f.numberMax}
              step={f.numberStep ?? 0.01}
              className="mt-2 w-full max-w-xs rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={Number.isFinite(n) ? n : 0}
              onChange={(e) => setSectionKey(f.section, f.key, parseFloat(e.target.value))}
            />
          </label>
        </div>
      );
    }

    const str = String(bag[f.key] ?? "");
    return (
      <div key={fk} className="rounded-xl border border-gray-100 bg-white p-4">
        <label className="block">
          <span className="flex items-center gap-2 text-sm font-bold text-text">
            {label}
            <span title={tip} aria-label={tip}>
              <Info className="h-4 w-4 text-text-light" />
            </span>
          </span>
          <p className="mt-1 text-xs text-text-light">{desc}</p>
          <input
            type="text"
            disabled={readOnly || isSaving}
            maxLength={f.inputMaxLength}
            className={`mt-2 w-full rounded-lg border px-3 py-2 text-sm ${
              err ? "border-red-400" : "border-gray-200"
            }`}
            value={str}
            onChange={(e) => setSectionKey(f.section, f.key, e.target.value)}
          />
          {err ? <p className="mt-1 text-xs text-red-600">{err}</p> : null}
        </label>
      </div>
    );
  };

  const cards = useMemo(
    () =>
      GROUP_ORDER.map((gid) => ({
        id: gid,
        header: SETTINGS_GROUP_HEADERS[gid],
        fields: fieldsByGroup(gid),
      })),
    []
  );

  const BRANDING_CONTACT_KEYS = new Set([
    "contactInfoTitleAr",
    "contactInfoTitleEn",
    "contactPageIntroAr",
    "contactPageIntroEn",
    "contactEmailPrimary",
    "contactEmailSecondary",
    "contactPhonePrimary",
    "contactPhoneSecondary",
    "contactAddressAr",
    "contactAddressEn",
    "mapEmbedUrl",
    "mapTitleAr",
    "mapTitleEn",
    "mapLocationLabelAr",
    "mapLocationLabelEn",
    "latitude",
    "longitude",
  ]);
  const BRANDING_SOCIAL_KEYS = new Set([
    "websiteUrl",
    "socialFacebook",
    "socialX",
    "socialYoutube",
    "socialInstagram",
  ]);
  const BRANDING_LOGO_KEYS = new Set([
    "mainLogo",
    "secondaryLogo",
    "reportHeaderImage",
    "reportFooterImage",
  ]);
  const BRANDING_CERT_KEYS = new Set([
    "certificateSignatureName",
    "certificateSignatureTitle",
    "certificateSignatureImage",
    "officialStampImage",
  ]);

  if (loading) {
    return (
      <PageContainer>
        <div className="flex min-h-[40vh] items-center justify-center gap-2 text-text-light">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-text">{L("إعدادات المنصة", "Platform settings")}</h1>
          <p className="mt-1 text-sm text-text-light">
            {L("لوحة إعدادات واضحة للمسؤولين — بدون مفاتيح تقنية ظاهرة", "Clear admin panel — no raw keys")}
          </p>
        </div>
        {!readOnly ? (
          <button
            type="button"
            disabled={isSaving}
            onClick={() => setResetModal(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-950 disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            {L("استعادة الإعدادات الافتراضية", "Reset to defaults")}
          </button>
        ) : null}
      </div>

      {readOnly ? (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          {L(
            "وضع العرض فقط — صلاحية المشرف (supervisor) لا تسمح بتعديل الإعدادات.",
            "Read-only: supervisor role cannot change platform settings."
          )}
        </div>
      ) : null}

      {toast ? (
        <div
          className={`fixed bottom-6 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-xl border px-5 py-3 text-sm font-bold shadow-lg ${
            toast.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
          role="status"
        >
          {toast.kind === "ok" ? (
            <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden />
          ) : (
            <XCircle className="h-5 w-5 shrink-0" aria-hidden />
          )}
          {toast.text}
        </div>
      ) : null}

      <div className="space-y-8">
        {cards.map(({ id, header, fields }) => (
          <section
            key={id}
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <div className="mb-4 border-b border-gray-100 pb-4">
              <h2 className="text-lg font-black text-text">{L(header.titleAr, header.titleEn)}</h2>
              <p className="mt-1 text-sm text-text-light">{L(header.descAr, header.descEn)}</p>
            </div>
            {id !== "branding" ? (
              <div className="grid gap-4 md:grid-cols-2">{fields.map((f) => renderField(f))}</div>
            ) : (
              <div className="space-y-5">
                <div className="rounded-xl border border-gray-100 bg-gray-50/40 p-4">
                  <h3 className="mb-3 text-sm font-black text-text">{L("بيانات التواصل والخريطة", "Contact data & map")}</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    {fields.filter((f) => BRANDING_CONTACT_KEYS.has(f.key)).map((f) => renderField(f))}
                  </div>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50/40 p-4">
                  <h3 className="mb-3 text-sm font-black text-text">{L("روابط الموقع والشبكات الاجتماعية", "Website & social links")}</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    {fields.filter((f) => BRANDING_SOCIAL_KEYS.has(f.key)).map((f) => renderField(f))}
                  </div>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50/40 p-4">
                  <h3 className="mb-3 text-sm font-black text-text">{L("الشعارات والهوية البصرية", "Logos & visual identity")}</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    {fields.filter((f) => BRANDING_LOGO_KEYS.has(f.key)).map((f) => renderField(f))}
                  </div>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50/40 p-4">
                  <h3 className="mb-3 text-sm font-black text-text">{L("التوقيع والختم الرسمي", "Signature & official stamp")}</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    {fields.filter((f) => BRANDING_CERT_KEYS.has(f.key)).map((f) => renderField(f))}
                  </div>
                </div>
              </div>
            )}
            {!readOnly ? (
              <div className="mt-6 flex justify-end border-t border-gray-100 pt-4">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void saveGroup(id)}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Save className="h-4 w-4" aria-hidden />
                  )}
                  {L("حفظ هذا القسم", "Save section")}
                </button>
              </div>
            ) : null}
          </section>
        ))}
      </div>

      {aiOffModal ? (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-w-md rounded-2xl bg-white p-6 shadow-xl" dir={isAr ? "rtl" : "ltr"}>
            <h3 className="text-lg font-black text-text">{L("تأكيد التعطيل", "Confirm disable")}</h3>
            <p className="mt-2 text-sm text-text-light">
              {L(
                "هل أنت متأكد من تعطيل هذا الخيار أو ميزات الذكاء الاصطناعي؟ قد يتوقف المساعدة والتحليل الآلي.",
                "Are you sure? Assistive and analytic features may stop for this option."
              )}
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold"
                onClick={() => setAiOffModal(null)}
              >
                {L("إلغاء", "Cancel")}
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white"
                onClick={confirmAiOff}
              >
                {L("نعم، عطّل", "Yes, disable")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {archiveModal ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4" role="dialog">
          <div className="max-w-md rounded-2xl bg-white p-6 shadow-xl" dir={isAr ? "rtl" : "ltr"}>
            <h3 className="text-lg font-black text-amber-900">{L("تنبيه أرشفة", "Archive warning")}</h3>
            <p className="mt-2 text-sm text-text">
              {L(
                "سيتم أرشفة جميع بيانات العام الحالي عند تفعيل عام جديد — تأكد من النسخ الاحتياطي والسياسة الداخلية.",
                "Current-year data will be archived when a new year is activated — confirm backups and policy."
              )}
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold"
                onClick={() => setArchiveModal(false)}
              >
                {L("إلغاء", "Cancel")}
              </button>
              <button
                type="button"
                className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-bold text-white"
                onClick={confirmArchive}
              >
                {L("متابعة", "Continue")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {resetModal ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4" role="dialog">
          <div className="max-w-md rounded-2xl bg-white p-6 shadow-xl" dir={isAr ? "rtl" : "ltr"}>
            <h3 className="text-lg font-black text-text">{L("استعادة الافتراضي", "Reset defaults")}</h3>
            <p className="mt-2 text-sm text-text-light">
              {L(
                "سيتم استبدال جميع أقسام الإعدادات بالقيم الافتراضية للنظام (بما فيها مسح حقول الهوية النصية). متابعة؟",
                "All settings sections will be replaced with system defaults (including clearing branding text). Continue?"
              )}
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold"
                onClick={() => setResetModal(false)}
              >
                {L("إلغاء", "Cancel")}
              </button>
              <button
                type="button"
                disabled={isSaving}
                className="rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                onClick={() => void handleReset()}
              >
                {L("استعادة", "Reset")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PageContainer>
  );
};

export default AdminSettingsPage;
