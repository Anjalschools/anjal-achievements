"use client";

import { useCallback, useEffect, useState } from "react";
import PageContainer from "@/components/layout/PageContainer";
import { getLocale } from "@/lib/i18n";
import { Loader2, Save } from "lucide-react";

type TabId = "year" | "brand" | "ai" | "cert" | "workflow";

const AdminSettingsPage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [tab, setTab] = useState<TabId>("year");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [settings, setSettings] = useState<Record<string, unknown>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setSettings((data.settings || {}) as Record<string, unknown>);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = async (partial: Record<string, unknown>) => {
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partial),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setSettings((data.settings || {}) as Record<string, unknown>);
      setOk(isAr ? "تم الحفظ" : "Saved");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const tabs: { id: TabId; labelAr: string; labelEn: string }[] = [
    { id: "year", labelAr: "العام الدراسي", labelEn: "School year" },
    { id: "brand", labelAr: "الهوية المؤسسية", labelEn: "Branding" },
    { id: "ai", labelAr: "الذكاء الاصطناعي", labelEn: "AI" },
    { id: "cert", labelAr: "الشهادات والتحقق", labelEn: "Certificates" },
    { id: "workflow", labelAr: "سير العمل", labelEn: "Workflow" },
  ];

  const ai = (settings.ai || {}) as Record<string, unknown>;
  const branding = (settings.branding || {}) as Record<string, unknown>;
  const certificate = (settings.certificate || {}) as Record<string, unknown>;
  const workflow = (settings.workflow || {}) as Record<string, unknown>;
  const schoolYearPolicy = (settings.schoolYearPolicy || {}) as Record<string, unknown>;

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
      <div className="mb-6">
        <h1 className="text-2xl font-black text-text">{isAr ? "إعدادات المنصة" : "Platform settings"}</h1>
        <p className="mt-1 text-sm text-text-light">
          {isAr ? "تبويبات الإعدادات الإدارية — يتطلب صلاحية مشرف/مدير" : "Admin configuration"}
        </p>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
      ) : null}
      {ok ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{ok}</div>
      ) : null}

      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              tab === t.id ? "bg-primary text-white" : "bg-gray-100 text-text hover:bg-gray-200"
            }`}
          >
            {isAr ? t.labelAr : t.labelEn}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        {tab === "year" && (
          <div className="space-y-3">
            <p className="text-sm text-text-light">
              {isAr
                ? "إدارة الأعوام الدراسية من واجهة مستقلة عبر API. يمكنك استخدام نفس الصلاحيات لربط العام الحالي بالتقارير."
                : "Manage school years via /api/admin/school-years"}
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={schoolYearPolicy.autoArchivePreviousWhenActivating === true}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    schoolYearPolicy: {
                      ...(s.schoolYearPolicy as object),
                      autoArchivePreviousWhenActivating: e.target.checked,
                    },
                  }))
                }
              />
              {isAr ? "أرشفة العام السابق تلقائيًا عند التفعيل" : "Auto-archive previous year when activating"}
            </label>
            <button
              type="button"
              disabled={saving}
              onClick={() =>
                patch({
                  schoolYearPolicy: {
                    autoArchivePreviousWhenActivating: schoolYearPolicy.autoArchivePreviousWhenActivating === true,
                  },
                })
              }
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white"
            >
              <Save className="h-4 w-4" />
              {isAr ? "حفظ السياسة" : "Save policy"}
            </button>
          </div>
        )}

        {tab === "brand" && (
          <div className="grid gap-3 md:grid-cols-2">
            {(["schoolNameAr", "schoolNameEn", "websiteUrl"] as const).map((key) => (
              <label key={key} className="block text-sm">
                <span className="font-semibold text-text">{key}</span>
                <input
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
                  value={String(branding[key] ?? "")}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      branding: { ...(s.branding as object), [key]: e.target.value },
                    }))
                  }
                />
              </label>
            ))}
            <button
              type="button"
              disabled={saving}
              onClick={() => patch({ branding })}
              className="md:col-span-2 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white"
            >
              <Save className="h-4 w-4" />
              {isAr ? "حفظ الهوية" : "Save branding"}
            </button>
          </div>
        )}

        {tab === "ai" && (
          <div className="space-y-3">
            {(
              [
                "aiEnabled",
                "aiFieldSuggestionEnabled",
                "aiDuplicateDetectionEnabled",
                "aiAttachmentReviewEnabled",
                "aiMediaGenerationEnabled",
                "aiInsightsEnabled",
              ] as const
            ).map((key) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={ai[key] !== false}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      ai: { ...(s.ai as object), [key]: e.target.checked },
                    }))
                  }
                />
                {key}
              </label>
            ))}
            <button
              type="button"
              disabled={saving}
              onClick={() => patch({ ai })}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white"
            >
              <Save className="h-4 w-4" />
              {isAr ? "حفظ إعدادات AI" : "Save AI settings"}
            </button>
          </div>
        )}

        {tab === "cert" && (
          <div className="grid gap-3 md:grid-cols-2">
            {(["certificateTitleAr", "certificatePrefix", "verificationSuccessMessageAr"] as const).map((key) => (
              <label key={key} className="block text-sm md:col-span-2">
                <span className="font-semibold">{key}</span>
                <input
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
                  value={String(certificate[key] ?? "")}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      certificate: { ...(s.certificate as object), [key]: e.target.value },
                    }))
                  }
                />
              </label>
            ))}
            <button
              type="button"
              disabled={saving}
              onClick={() => patch({ certificate })}
              className="md:col-span-2 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white"
            >
              <Save className="h-4 w-4" />
              {isAr ? "حفظ الشهادات" : "Save certificate settings"}
            </button>
          </div>
        )}

        {tab === "workflow" && (
          <div className="space-y-3">
            {(
              [
                "adminCanDirectApprove",
                "showApprovedDirectlyInHallOfFame",
                "allowEditApprovedAchievementByAdmin",
              ] as const
            ).map((key) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={workflow[key] !== false}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      workflow: { ...(s.workflow as object), [key]: e.target.checked },
                    }))
                  }
                />
                {key}
              </label>
            ))}
            <button
              type="button"
              disabled={saving}
              onClick={() => patch({ workflow })}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white"
            >
              <Save className="h-4 w-4" />
              {isAr ? "حفظ السياسات" : "Save workflow"}
            </button>
          </div>
        )}
      </div>
    </PageContainer>
  );
};

export default AdminSettingsPage;
