"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import PageContainer from "@/components/layout/PageContainer";
import SectionCard from "@/components/layout/SectionCard";
import LetterFormalDocument from "@/components/letters/LetterFormalDocument";
import { getLocale } from "@/lib/i18n";
import type { LetterRequestedAuthorRole, LetterRequestLanguage, LetterRequestType } from "@/lib/letter-request-types";
import "@/styles/letter-print.css";
import { Printer } from "lucide-react";

type Snap = {
  fullName?: string;
  fullNameAr?: string;
  fullNameEn?: string;
  grade?: string;
  section?: string;
};

type Item = {
  _id: string;
  status: string;
  language: LetterRequestLanguage;
  requestType: LetterRequestType;
  targetOrganization: string;
  finalApprovedText?: string;
  verificationPath?: string;
  approvedAt?: string;
  requestedAuthorRole: LetterRequestedAuthorRole;
  studentSnapshot?: Snap;
};

const LetterDocumentPage = () => {
  const params = useParams<{ id: string }>();
  const locale = getLocale();
  const isAr = locale === "ar";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState<Item | null>(null);

  const load = useCallback(async () => {
    if (!params?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/letter-requests/${params.id}`, { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Failed");
      const it = j.item as Item;
      if (it.status !== "approved" || !it.finalApprovedText || !it.verificationPath) {
        throw new Error(isAr ? "الخطاب غير معتمد بعد" : "Letter not approved yet");
      }
      setItem(it);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [params?.id, isAr]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("letter-print-doc");
    return () => {
      root.classList.remove("letter-print-doc");
    };
  }, []);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <PageContainer className="letter-page-shell">
        <p className="py-12 text-center text-text-light">{isAr ? "جاري التحميل…" : "Loading…"}</p>
      </PageContainer>
    );
  }

  if (error || !item) {
    return (
      <PageContainer>
        <SectionCard>
          <p className="text-sm text-red-600">{error || (isAr ? "تعذر العرض" : "Unable to display")}</p>
          <Link href={params?.id ? `/letter-requests/${params.id}` : "/letter-requests"} className="mt-3 inline-block text-sm font-semibold text-primary">
            {isAr ? "العودة" : "Back"}
          </Link>
        </SectionCard>
      </PageContainer>
    );
  }

  const snap = item.studentSnapshot || {};
  const studentName =
    item.language === "ar"
      ? snap.fullNameAr || snap.fullName || snap.fullNameEn || "—"
      : snap.fullNameEn || snap.fullName || snap.fullNameAr || "—";

  const gradeLine =
    snap.grade || snap.section
      ? item.language === "ar"
        ? [snap.grade ? `الصف: ${snap.grade}` : "", snap.section ? `المسار: ${snap.section}` : ""].filter(Boolean).join(" · ")
        : [snap.grade ? `Grade: ${snap.grade}` : "", snap.section ? `Track: ${snap.section}` : ""].filter(Boolean).join(" · ")
      : undefined;

  const issued = item.approvedAt
    ? new Date(item.approvedAt).toLocaleDateString(item.language === "ar" ? "ar-SA" : "en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—";

  const refCode = `LR-${String(item._id).slice(-8).toUpperCase()}`;

  return (
    <PageContainer className="letter-page-shell print:mx-0 print:max-w-none print:px-0 print:py-0">
      <div
        className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-4"
        dir={isAr ? "rtl" : "ltr"}
      >
        <Link href={`/letter-requests/${item._id}`} className="text-sm font-semibold text-primary hover:underline">
          {isAr ? "العودة للتفاصيل" : "Back to details"}
        </Link>
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-slate-800"
        >
          <Printer className="h-4 w-4" aria-hidden />
          {isAr ? "تنزيل PDF / طباعة" : "Print / Save as PDF"}
        </button>
      </div>

      <LetterFormalDocument
        language={item.language}
        requestType={item.requestType}
        studentName={studentName}
        targetOrganization={item.targetOrganization}
        bodyText={item.finalApprovedText || ""}
        issuedDateLabel={issued}
        referenceCode={refCode}
        verifyPath={item.verificationPath || ""}
        requestedAuthorRole={item.requestedAuthorRole}
        gradeLine={gradeLine}
        showQr
      />
      <p className="no-print mt-4 text-center text-xs text-slate-500">
        {isAr
          ? "استخدم «طباعة» ثم اختر حفظ كملف PDF من المتصفح."
          : "Use your browser print dialog and choose Save as PDF."}
      </p>
    </PageContainer>
  );
};

export default LetterDocumentPage;
