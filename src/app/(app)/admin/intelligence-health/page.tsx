"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import { InstitutionalIntelligenceHealthCenter } from "@/components/admin/InstitutionalIntelligenceHealthCenter";
import { getLocale } from "@/lib/i18n";
import type { IntelligenceHealthMonitoringPayload } from "@/lib/school-improvement/intelligence-diagnostics-types";
import { Loader2, Shield } from "lucide-react";

const IntelligenceHealthPage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monitoring, setMonitoring] = useState<IntelligenceHealthMonitoringPayload | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/user/profile", { cache: "no-store" });
        if (!res.ok) {
          setAllowed(false);
          return;
        }
        const json = await res.json();
        setAllowed(String(json.role || "").trim() === "admin");
      } catch {
        setAllowed(false);
      }
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/intelligence-health", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setMonitoring(json.monitoring || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setMonitoring(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  if (allowed === false) {
    return (
      <PageContainer>
        <p className="py-12 text-center text-red-600">{isAr ? "غير مصرح" : "Forbidden"}</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title={isAr ? "مركز صحة الذكاء المؤسسي" : "Institutional intelligence health center"}
        subtitle={
          isAr
            ? "مراقبة نشطة — ماذا فشل، لماذا، متى، وكم مرة"
            : "Active monitoring — what failed, why, when, and how often"
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
          <Shield className="h-3 w-3" aria-hidden />
          {isAr ? "مسؤول النظام — مراقبة واستعادة" : "System admin — monitoring & recovery"}
        </span>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-xl border border-border px-3 py-1.5 text-xs font-semibold"
        >
          {isAr ? "تحديث" : "Refresh"}
        </button>
        <Link href="/admin/school-improvement-intelligence" className="text-xs font-semibold text-primary underline">
          {isAr ? "لوحة التحسين المدرسي" : "School improvement dashboard"}
        </Link>
      </div>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-text-light">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          <span>{isAr ? "جاري تحميل مركز الصحة…" : "Loading health center…"}</span>
        </div>
      ) : !monitoring ? (
        <p className="py-12 text-center text-text-light">
          {isAr
            ? "لا توجد لقطات صحية بعد. افتح لوحة ذكاء التحسين المدرسي لتوليد أول لقطة."
            : "No health snapshots yet. Open the school improvement dashboard to generate the first snapshot."}
        </p>
      ) : (
        <InstitutionalIntelligenceHealthCenter
          monitoring={monitoring}
          isAr={isAr}
          showAdminActions
          onRefresh={load}
        />
      )}
    </PageContainer>
  );
};

export default IntelligenceHealthPage;
