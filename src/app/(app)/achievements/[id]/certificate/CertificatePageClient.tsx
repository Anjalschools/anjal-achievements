"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import "@/styles/certificate-print.css";
import "@/styles/certificate-component.css";
import PageContainer from "@/components/layout/PageContainer";
import SectionCard from "@/components/layout/SectionCard";
import AppreciationCertificate, {
  type AppreciationCertificateContentInput,
} from "@/components/certificates/AppreciationCertificate";
import { getLocale } from "@/lib/i18n";
import { Loader2, Printer } from "lucide-react";

type CertificateApiOk = {
  verifyPath: string | null;
  certificateId?: string | null;
  certificateVersion?: number;
  content: AppreciationCertificateContentInput;
};

const CertificatePageClient = () => {
  const params = useParams<{ id: string }>();
  const achievementId = typeof params?.id === "string" ? params.id : "";
  const locale = getLocale();
  const isAr = locale === "ar";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<CertificateApiOk | null>(null);

  const load = useCallback(async () => {
    if (!achievementId) {
      setError(isAr ? "معرّف الإنجاز غير صالح" : "Invalid achievement id");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/achievements/${encodeURIComponent(achievementId)}/certificate`, {
        cache: "no-store",
      });
      const j = (await res.json().catch(() => ({}))) as CertificateApiOk & { error?: string };
      if (!res.ok) {
        throw new Error(typeof j.error === "string" ? j.error : "Failed");
      }
      if (!j.content || !j.verifyPath) {
        throw new Error(isAr ? "بيانات الشهادة غير مكتملة" : "Incomplete certificate data");
      }
      setData(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [achievementId, isAr]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.add("certificate-print-doc");
    return () => {
      root.classList.remove("certificate-print-doc");
    };
  }, []);

  const handlePrint = () => {
    if (typeof window !== "undefined") window.print();
  };

  if (!achievementId) {
    return (
      <PageContainer className="certificate-page-shell">
        <SectionCard>
          <p className="text-sm text-red-600">{isAr ? "معرّف الإنجاز غير صالح" : "Invalid achievement id"}</p>
        </SectionCard>
      </PageContainer>
    );
  }

  if (loading) {
    return (
      <PageContainer className="certificate-page-shell">
        <p className="flex items-center justify-center gap-2 py-12 text-text-light">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          {isAr ? "جاري التحميل…" : "Loading…"}
        </p>
      </PageContainer>
    );
  }

  if (error || !data?.content || !data.verifyPath) {
    return (
      <PageContainer className="certificate-page-shell">
        <SectionCard>
          <p className="text-sm text-red-600">
            {error || (isAr ? "تعذر عرض الشهادة" : "Unable to load certificate")}
          </p>
          <Link
            href={`/achievements/${achievementId}`}
            className="mt-4 inline-block text-sm font-semibold text-primary"
          >
            {isAr ? "العودة" : "Back"}
          </Link>
        </SectionCard>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="certificate-page-shell print:mx-0 print:max-w-none print:px-0 print:py-0">
      <div
        className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-4"
        dir={isAr ? "rtl" : "ltr"}
      >
        <Link
          href={`/achievements/${achievementId}`}
          className="text-sm font-semibold text-primary hover:underline"
        >
          {isAr ? "← العودة لتفاصيل الإنجاز" : "← Back to achievement"}
        </Link>
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
          aria-label={isAr ? "طباعة الشهادة" : "Print certificate"}
        >
          <Printer className="h-4 w-4 shrink-0" aria-hidden />
          {isAr ? "طباعة الشهادة" : "Print certificate"}
        </button>
      </div>

      <div className="no-print mx-auto mb-2 max-w-3xl text-center text-xs text-slate-500" dir={isAr ? "rtl" : "ltr"}>
        {isAr
          ? "للحصول على أفضل نتيجة، استخدم معاينة الطباعة ثم حفظ PDF من المتصفح."
          : "For best results, use Print Preview and save as PDF from your browser."}
      </div>

      <div className="certificate-page-print-host mx-auto flex w-full max-w-5xl justify-center rounded-2xl bg-slate-100/90 px-4 py-8 shadow-inner print:bg-transparent print:p-0 print:shadow-none md:px-8 md:py-10">
        <AppreciationCertificate
          content={data.content}
          verifyPath={data.verifyPath}
          certificateId={data.certificateId}
        />
      </div>
    </PageContainer>
  );
};

export default CertificatePageClient;
