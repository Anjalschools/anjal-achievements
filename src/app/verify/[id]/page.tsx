"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getLocale } from "@/lib/i18n";
import VerificationCard, {
  type CertificateVerifySuccess,
} from "@/components/verification/VerificationCard";

type VerifyApiError = {
  valid: false;
  code?: string;
  message?: string;
};

const isSuccessPayload = (j: unknown): j is CertificateVerifySuccess =>
  typeof j === "object" &&
  j !== null &&
  (j as { valid?: boolean }).valid === true &&
  typeof (j as { certificateId?: unknown }).certificateId === "string";

const VerifyByCertificateIdPage = () => {
  const params = useParams<{ id: string }>();
  const locale = getLocale() === "en" ? "en" : "ar";
  const rawId = params?.id;

  const decodedId = useMemo(() => {
    if (!rawId || typeof rawId !== "string") return "";
    try {
      return decodeURIComponent(rawId).trim();
    } catch {
      return String(rawId).trim();
    }
  }, [rawId]);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CertificateVerifySuccess | null>(null);
  const [valid, setValid] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [errorCode, setErrorCode] = useState<string | undefined>();
  const [copyDone, setCopyDone] = useState(false);

  const verifyUrl =
    typeof window !== "undefined" && decodedId
      ? `${window.location.origin}/verify/${encodeURIComponent(decodedId)}`
      : "";

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!decodedId) {
        setLoading(false);
        setValid(false);
        setData(null);
        setErrorMessage(
          locale === "ar" ? "لم يتم تقديم رقم شهادة صالح" : "No valid certificate reference was provided"
        );
        setErrorCode("missing");
        return;
      }

      setLoading(true);
      setCopyDone(false);
      try {
        const q = new URLSearchParams({ locale });
        const res = await fetch(
          `/api/certificates/verify/${encodeURIComponent(decodedId)}?${q.toString()}`,
          { cache: "no-store" }
        );
        const j: unknown = await res.json().catch(() => ({ valid: false }));

        if (cancelled) return;

        if (isSuccessPayload(j)) {
          setValid(true);
          setData(j);
          setErrorMessage(undefined);
          setErrorCode(undefined);
        } else {
          setValid(false);
          setData(null);
          const err = j as VerifyApiError;
          setErrorMessage(
            typeof err.message === "string"
              ? err.message
              : locale === "ar"
                ? "هذه الشهادة غير موجودة أو تم التلاعب بها"
                : "This certificate is not valid or does not exist"
          );
          setErrorCode(typeof err.code === "string" ? err.code : undefined);
        }
      } catch {
        if (!cancelled) {
          setValid(false);
          setData(null);
          setErrorMessage(locale === "ar" ? "تعذر الاتصال بالخادم" : "Could not reach the server");
          setErrorCode("network");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [decodedId, locale]);

  const handleCopy = useCallback(async () => {
    const text = data?.certificateId || decodedId;
    if (!text || typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopyDone(true);
      window.setTimeout(() => setCopyDone(false), 2000);
    } catch {
      setCopyDone(false);
    }
  }, [data?.certificateId, decodedId]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleShare = useCallback(async () => {
    const url = verifyUrl || (typeof window !== "undefined" ? window.location.href : "");
    if (!url) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: locale === "ar" ? "التحقق من الشهادة" : "Certificate verification",
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        setCopyDone(true);
        window.setTimeout(() => setCopyDone(false), 2000);
      }
    } catch {
      /* user cancelled share */
    }
  }, [locale, verifyUrl]);

  return (
    <main className="flex flex-1 flex-col bg-neutral-100/80 py-8 md:py-12">
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 md:px-6">
        <div className="mb-6 text-center">
          <h1 className="text-lg font-bold text-primary md:text-xl">
            {locale === "ar" ? "التحقق من شهادة شكر وتقدير" : "Appreciation certificate verification"}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {locale === "ar"
              ? "تحقق رسمي من صحة بيانات الشهادة الصادرة عبر منصة تميز الأنجال"
              : "Official verification for certificates issued through the Al-Anjal Excellence Platform"}
          </p>
        </div>

        {loading ? (
          <div
            className="flex flex-col items-center justify-center gap-3 rounded-xl border border-neutral-200 bg-white py-20 shadow-sm"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
            <p className="text-sm font-medium text-text-muted">
              {locale === "ar" ? "جاري التحقق…" : "Verifying…"}
            </p>
          </div>
        ) : (
          <VerificationCard
            locale={locale}
            data={data}
            valid={valid}
            errorMessage={errorMessage}
            errorCode={errorCode}
            verifyUrl={verifyUrl}
            onCopy={valid && data ? handleCopy : undefined}
            copyDone={copyDone}
            onPrint={valid && data ? handlePrint : undefined}
            onShare={valid && data ? handleShare : undefined}
          />
        )}
      </div>
    </main>
  );
};

export default VerifyByCertificateIdPage;
