"use client";

import { useCallback, useEffect, useState } from "react";
import PageContainer from "@/components/layout/PageContainer";
import { getLocale } from "@/lib/i18n";
import { Loader2, Plug, Unplug, FlaskConical } from "lucide-react";

type Row = {
  provider: string;
  status: string;
  accountLabel?: string;
  hasStoredTokens: boolean;
  tokenEncryptionConfigured: boolean;
};

const LABELS: Record<string, { ar: string; en: string }> = {
  instagram: { ar: "إنستغرام", en: "Instagram" },
  x: { ar: "إكس (X)", en: "X" },
  tiktok: { ar: "تيك توك", en: "TikTok" },
  snapchat: { ar: "سناب شات", en: "Snapchat" },
};

const AdminSocialIntegrationsPage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const L = (ar: string, en: string) => (isAr ? ar : en);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Row[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tokens, setTokens] = useState<Record<string, { access: string; refresh: string; label: string }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/social-integrations", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setItems((data.items || []) as Row[]);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const post = async (body: Record<string, unknown>) => {
    setBusy(String(body.provider || ""));
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/admin/social-integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setMsg(typeof data.messageAr === "string" ? data.messageAr : L("تمت العملية", "Done"));
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <PageContainer>
      <header className="mb-6">
        <h1 className="text-2xl font-black text-text">{L("التكاملات الاجتماعية", "Social integrations")}</h1>
        <p className="mt-1 text-sm text-text-light">
          {L(
            "ربط الحسابات عبر OAuth أو رموز وصول رسمية فقط — لا تُخزَّن كلمات مرور. يتطلب تشفير الرموز مفتاح SOCIAL_TOKEN_ENCRYPTION_KEY.",
            "Connect via OAuth or official access tokens only — no passwords. Token storage requires SOCIAL_TOKEN_ENCRYPTION_KEY."
          )}
        </p>
      </header>

      {err ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
      ) : null}
      {msg ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {msg}
        </div>
      ) : null}

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center gap-2 text-text-light">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
        </div>
      ) : (
        <ul className="space-y-6">
          {items.map((row) => {
            const lab = LABELS[row.provider] || { ar: row.provider, en: row.provider };
            const t = tokens[row.provider] || { access: "", refresh: "", label: "" };
            return (
              <li
                key={row.provider}
                className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
                dir={isAr ? "rtl" : "ltr"}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-bold text-text">{L(lab.ar, lab.en)}</h2>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      row.status === "connected" ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {row.status === "connected" ? L("متصل", "Connected") : L("غير متصل", "Disconnected")}
                  </span>
                </div>
                {!row.tokenEncryptionConfigured ? (
                  <p className="mt-3 text-sm text-amber-800">
                    {L("مفتاح التشفير غير مضبوط — لا يمكن حفظ الرموز بأمان.", "Encryption key not set — cannot store tokens safely.")}
                  </p>
                ) : null}
                <p className="mt-2 text-xs text-text-light">
                  {L("للإنتاج: أكمل OAuth الرسمي للمنصة وأرسل الرموز عبر مسار آمن.", "Production: complete official OAuth and deliver tokens through a secure path.")}
                </p>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="block text-sm">
                    <span className="font-semibold">{L("تسمية الحساب", "Account label")}</span>
                    <input
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      value={t.label}
                      onChange={(e) =>
                        setTokens((prev) => ({
                          ...prev,
                          [row.provider]: { ...t, label: e.target.value },
                        }))
                      }
                      placeholder="@school"
                    />
                  </label>
                  <label className="block text-sm md:col-span-2">
                    <span className="font-semibold">Access token (OAuth)</span>
                    <input
                      type="password"
                      autoComplete="off"
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono"
                      value={t.access}
                      onChange={(e) =>
                        setTokens((prev) => ({
                          ...prev,
                          [row.provider]: { ...t, access: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className="block text-sm md:col-span-2">
                    <span className="font-semibold">Refresh token ({L("اختياري", "optional")})</span>
                    <input
                      type="password"
                      autoComplete="off"
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono"
                      value={t.refresh}
                      onChange={(e) =>
                        setTokens((prev) => ({
                          ...prev,
                          [row.provider]: { ...t, refresh: e.target.value },
                        }))
                      }
                    />
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy !== null || !row.tokenEncryptionConfigured}
                    onClick={() =>
                      void post({
                        action: "connect",
                        provider: row.provider,
                        accessToken: t.access,
                        refreshToken: t.refresh || undefined,
                        accountLabel: t.label || undefined,
                      })
                    }
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                  >
                    <Plug className="h-4 w-4" aria-hidden />
                    {L("ربط", "Connect")}
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void post({ action: "disconnect", provider: row.provider })}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2 text-sm font-bold hover:bg-gray-50"
                  >
                    <Unplug className="h-4 w-4" aria-hidden />
                    {L("فصل", "Disconnect")}
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void post({ action: "test", provider: row.provider })}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2 text-sm font-bold hover:bg-gray-50"
                  >
                    <FlaskConical className="h-4 w-4" aria-hidden />
                    {L("اختبار", "Test")}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </PageContainer>
  );
};

export default AdminSocialIntegrationsPage;
