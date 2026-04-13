"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import PageContainer from "@/components/layout/PageContainer";
import SectionCard from "@/components/layout/SectionCard";
import LetterFormalDocument from "@/components/letters/LetterFormalDocument";
import { getLocale } from "@/lib/i18n";
import type { LetterRequestedAuthorRole, LetterRequestLanguage, LetterRequestType } from "@/lib/letter-request-types";
import { buildLetterPreviewDisplay, type LetterPreviewSource } from "@/lib/letter-request-preview-utils";
import "@/styles/letter-print.css";
import { Printer } from "lucide-react";

type Snap = { fullName?: string; fullNameAr?: string; fullNameEn?: string; grade?: string; section?: string };

type Item = {
  _id: string;
  status: string;
  language: LetterRequestLanguage;
  requestType: LetterRequestType;
  targetOrganization: string;
  requestBody?: string;
  finalApprovedText?: string;
  aiDraftText?: string;
  verificationPath?: string;
  approvedAt?: string;
  requestedAuthorRole: LetterRequestedAuthorRole;
  studentSnapshot?: Snap;
};

const AdminLetterPreviewPage = () => {
  const params = useParams<{ id: string }>();
  const locale = getLocale();
  const isAr = locale === "ar";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [previewSource, setPreviewSource] = useState<LetterPreviewSource>("none");

  const load = useCallback(async () => {
    if (!params?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/letter-requests/${params.id}`, { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Failed");
      const it = j.item as Item;
      const snap = it.studentSnapshot || {};
      const studentDisplayName =
        it.language === "ar"
          ? snap.fullNameAr || snap.fullName || snap.fullNameEn || "—"
          : snap.fullNameEn || snap.fullName || snap.fullNameAr || "—";

      const { bodyText, source } = buildLetterPreviewDisplay(
        it.finalApprovedText,
        it.aiDraftText,
        it.requestBody,
        {
          language: it.language,
          requestType: it.requestType,
          targetOrganization: it.targetOrganization || "",
          studentDisplayName,
        }
      );

      if (source === "none" || !bodyText.trim()) {
        throw new Error(isAr ? "لا يوجد نص للمعاينة" : "No letter text to preview");
      }

      setItem(it);
      setPreviewSource(source);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setItem(null);
      setPreviewSource("none");
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

  if (loading) {
    return (
      <PageContainer>
        <p className="py-12 text-center text-text-light">{isAr ? "جاري التحميل…" : "Loading…"}</p>
      </PageContainer>
    );
  }

  if (error || !item) {
    return (
      <PageContainer>
        <SectionCard>
          <p className="text-sm text-red-600">{error}</p>
          <Link href={`/admin/letter-requests/${params?.id}`} className="mt-3 inline-block text-sm font-semibold text-primary">
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

  const { bodyText } = buildLetterPreviewDisplay(
    item.finalApprovedText,
    item.aiDraftText,
    item.requestBody,
    {
      language: item.language,
      requestType: item.requestType,
      targetOrganization: item.targetOrganization || "",
      studentDisplayName: studentName,
    }
  );

  const issued = item.approvedAt
    ? new Date(item.approvedAt).toLocaleDateString(item.language === "ar" ? "ar-SA" : "en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : isAr
      ? "مسودة — لم يُعتمد بعد"
      : "Draft — not approved yet";

  const refCode = `LR-${String(item._id).slice(-8).toUpperCase()}`;
  const showQr = item.status === "approved" && Boolean(item.verificationPath);

  const sourceBanner =
    previewSource === "final"
      ? null
      : previewSource === "ai"
        ? isAr
          ? "معاينة من مسودة الذكاء الاصطناعي — لم يُعتمد بعد"
          : "Preview from AI draft — not approved"
        : isAr
          ? "معاينة أولية من النص المرجعي للطالب — لم يُعتمد بعد"
          : "Initial preview from student reference — not approved";

  return (
    <PageContainer className="print:mx-0 print:max-w-none print:px-0 print:py-0">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-4" dir={isAr ? "rtl" : "ltr"}>
        <Link href={`/admin/letter-requests/${item._id}`} className="text-sm font-semibold text-primary hover:underline">
          {isAr ? "العودة للمراجعة" : "Back to review"}
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white"
        >
          <Printer className="h-4 w-4" aria-hidden />
          {isAr ? "طباعة" : "Print"}
        </button>
      </div>

      {sourceBanner ? (
        <p
          className="no-print mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs font-semibold text-amber-900"
          dir={isAr ? "rtl" : "ltr"}
        >
          {sourceBanner}
        </p>
      ) : null}

      <LetterFormalDocument
        language={item.language}
        requestType={item.requestType}
        studentName={studentName}
        targetOrganization={item.targetOrganization}
        bodyText={bodyText}
        issuedDateLabel={issued}
        referenceCode={refCode}
        verifyPath={item.verificationPath || ""}
        requestedAuthorRole={item.requestedAuthorRole}
        gradeLine={gradeLine}
        showQr={showQr}
      />
    </PageContainer>
  );
};

export default AdminLetterPreviewPage;
