"use client";

import { useCallback, useEffect, useState } from "react";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import { getLocale } from "@/lib/i18n";
import { Bell, Building2, Loader2, Mail, Phone, Save, User } from "lucide-react";

type NotificationSettings = {
  newStudents: boolean;
  interviews: boolean;
  documents: boolean;
  messages: boolean;
  decisions: boolean;
  finalReports: boolean;
};

type SettingsPayload = {
  organization: {
    name: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
  };
  notificationSettings: NotificationSettings;
};

const toggleClass = (on: boolean) =>
  `relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition ${
    on ? "bg-primary" : "bg-gray-300"
  }`;

const InstitutionSettingsPage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<SettingsPayload | null>(null);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/institution/profile", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      const payload = {
        organization: {
          name: json.organization?.name || "",
          contactName: json.organization?.contactName || "",
          contactEmail: json.organization?.contactEmail || "",
          contactPhone: json.organization?.contactPhone || "",
        },
        notificationSettings: json.notificationSettings as NotificationSettings,
      };
      setData(payload);
      setSettings(payload.notificationSettings);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const handleToggle = (key: keyof NotificationSettings) => {
    setSettings((prev) => (prev ? { ...prev, [key]: !prev[key] } : prev));
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/institution/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setToast(isAr ? "تم حفظ الإعدادات" : "Settings saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const notificationRows: Array<{ key: keyof NotificationSettings; ar: string; en: string }> = [
    { key: "newStudents", ar: "إشعارات الطلاب الجدد", en: "New student notifications" },
    { key: "interviews", ar: "إشعارات المقابلات", en: "Interview notifications" },
    { key: "documents", ar: "إشعارات المستندات", en: "Document notifications" },
    { key: "messages", ar: "إشعارات الرسائل", en: "Message notifications" },
    { key: "decisions", ar: "إشعارات القبول والرفض", en: "Accept/reject notifications" },
    { key: "finalReports", ar: "إشعارات التقارير النهائية", en: "Final report notifications" },
  ];

  return (
    <PageContainer>
      <PageHeader
        title={isAr ? "إعدادات المؤسسة" : "Institution settings"}
        subtitle={isAr ? "تفضيلات الإشعارات وبيانات التواصل" : "Notification preferences and contact visibility"}
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-text-light">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        </div>
      ) : error && !data ? (
        <SectionCard>
          <p className="py-8 text-center text-red-600">{error}</p>
        </SectionCard>
      ) : data && settings ? (
        <div className="space-y-4">
          {toast ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900">
              {toast}
            </p>
          ) : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <SectionCard>
            <h3 className="mb-2 text-base font-bold text-foreground">
              {isAr ? "بيانات مرئية دائماً للمشرفين" : "Always visible to school supervisors"}
            </h3>
            <p className="mb-4 text-xs text-text-light">
              {isAr
                ? "لا يمكن للمؤسسة إخفاء هذه البيانات عن إدارة المدرسة."
                : "The institution cannot hide this information from school administration."}
            </p>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-2 rounded-xl border border-border bg-gray-50 px-3 py-2 text-sm">
                <Building2 className="h-4 w-4 text-primary" aria-hidden />
                <span className="font-semibold">{data.organization.name}</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-gray-50 px-3 py-2 text-sm">
                <User className="h-4 w-4 text-primary" aria-hidden />
                <span>{data.organization.contactName || "—"}</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-gray-50 px-3 py-2 text-sm">
                <Mail className="h-4 w-4 text-primary" aria-hidden />
                <span>{data.organization.contactEmail || "—"}</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-gray-50 px-3 py-2 text-sm">
                <Phone className="h-4 w-4 text-primary" aria-hidden />
                <span>{data.organization.contactPhone || "—"}</span>
              </div>
            </dl>
          </SectionCard>

          <SectionCard>
            <h3 className="mb-4 text-base font-bold text-foreground">
              {isAr ? "إشعارات المؤسسة" : "Institution notifications"}
            </h3>
            <ul className="space-y-3">
              {notificationRows.map((row) => (
                <li key={row.key} className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Bell className="h-4 w-4 text-primary" aria-hidden />
                    {isAr ? row.ar : row.en}
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings[row.key]}
                    aria-label={isAr ? row.ar : row.en}
                    onClick={() => handleToggle(row.key)}
                    className={toggleClass(settings[row.key])}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                        settings[row.key] ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-primary bg-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              <Save className="h-4 w-4" aria-hidden />
              {saving ? (isAr ? "جاري الحفظ…" : "Saving…") : isAr ? "حفظ الإعدادات" : "Save settings"}
            </button>
          </SectionCard>
        </div>
      ) : null}
    </PageContainer>
  );
};

export default InstitutionSettingsPage;
