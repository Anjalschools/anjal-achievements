"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Mail, MapPin, Phone } from "lucide-react";
import { getLocale } from "@/lib/i18n";
import { normalizeMapEmbedUrl } from "@/lib/platform-settings-validation";

type InquiryType = "general" | "achievements" | "activities" | "judging" | "technical";

const inquiryOptions: Array<{ id: InquiryType; ar: string; en: string }> = [
  { id: "general", ar: "استفسار عام", en: "General inquiry" },
  { id: "achievements", ar: "الإنجازات", en: "Achievements" },
  { id: "activities", ar: "الأنشطة", en: "Activities" },
  { id: "judging", ar: "التحكيم", en: "Judging" },
  { id: "technical", ar: "دعم تقني", en: "Technical support" },
];

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^(\+966|0)?5\d{8}$/;

export default function ContactPage() {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [inquiryType, setInquiryType] = useState<InquiryType>("general");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [contactSettings, setContactSettings] = useState<{
    mapEmbedUrl: string | null;
    mapTitleAr: string | null;
    mapTitleEn: string | null;
    mapLocationLabelAr: string | null;
    mapLocationLabelEn: string | null;
    contactEmailPrimary: string | null;
    contactEmailSecondary: string | null;
    contactPhonePrimary: string | null;
    contactPhoneSecondary: string | null;
    contactAddressAr: string | null;
    contactAddressEn: string | null;
    contactInfoTitleAr: string | null;
    contactInfoTitleEn: string | null;
    contactPageIntroAr: string | null;
    contactPageIntroEn: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/public/settings/map", { cache: "no-store" });
        const j = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          data?: Record<string, string | null | undefined>;
        };
        if (!res.ok || j.ok === false) return;
        if (cancelled) return;
        setContactSettings({
          mapEmbedUrl: (j.data?.mapEmbedUrl as string | null) ?? null,
          mapTitleAr: (j.data?.mapTitleAr as string | null) ?? null,
          mapTitleEn: (j.data?.mapTitleEn as string | null) ?? null,
          mapLocationLabelAr: (j.data?.mapLocationLabelAr as string | null) ?? null,
          mapLocationLabelEn: (j.data?.mapLocationLabelEn as string | null) ?? null,
          contactEmailPrimary: (j.data?.contactEmailPrimary as string | null) ?? null,
          contactEmailSecondary: (j.data?.contactEmailSecondary as string | null) ?? null,
          contactPhonePrimary: (j.data?.contactPhonePrimary as string | null) ?? null,
          contactPhoneSecondary: (j.data?.contactPhoneSecondary as string | null) ?? null,
          contactAddressAr: (j.data?.contactAddressAr as string | null) ?? null,
          contactAddressEn: (j.data?.contactAddressEn as string | null) ?? null,
          contactInfoTitleAr: (j.data?.contactInfoTitleAr as string | null) ?? null,
          contactInfoTitleEn: (j.data?.contactInfoTitleEn as string | null) ?? null,
          contactPageIntroAr: (j.data?.contactPageIntroAr as string | null) ?? null,
          contactPageIntroEn: (j.data?.contactPageIntroEn as string | null) ?? null,
        });
      } catch {
        // keep fallback
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const canSubmit = useMemo(() => {
    return (
      fullName.trim().length >= 3 &&
      phoneRegex.test(phone.trim()) &&
      emailRegex.test(email.trim()) &&
      subject.trim().length >= 4 &&
      message.trim().length >= 10
    );
  }, [email, fullName, message, phone, subject]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!canSubmit) {
      setError(
        isAr
          ? "يرجى تعبئة الحقول المطلوبة بشكل صحيح (الاسم، الجوال، البريد، العنوان، الرسالة)."
          : "Please complete all required fields with valid values."
      );
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/public/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          subject: subject.trim(),
          inquiryType,
          message: message.trim(),
        }),
      });
      const json = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        setError(
          json.error || (isAr ? "تعذر إرسال الرسالة. حاول مرة أخرى." : "Could not send your message.")
        );
        return;
      }
      setSuccess(
        json.message ||
          (isAr
            ? "تم إرسال رسالتك بنجاح. سيتم التواصل معك قريبًا."
            : "Your message has been sent successfully. We will contact you soon.")
      );
      setFullName("");
      setPhone("");
      setEmail("");
      setSubject("");
      setInquiryType("general");
      setMessage("");
    } catch {
      setError(isAr ? "حدث خطأ غير متوقع أثناء الإرسال." : "Unexpected error while sending.");
    } finally {
      setLoading(false);
    }
  };

  const infoTitle =
    (isAr ? contactSettings?.contactInfoTitleAr : contactSettings?.contactInfoTitleEn)?.trim() ||
    (isAr ? "معلومات التواصل" : "Contact details");
  const introText =
    (isAr ? contactSettings?.contactPageIntroAr : contactSettings?.contactPageIntroEn)?.trim() ||
    (isAr
      ? "يسعدنا استقبال استفساراتكم وملاحظاتكم حول المنصة والخدمات."
      : "We welcome your inquiries and feedback about the platform.");
  const primaryEmail = contactSettings?.contactEmailPrimary?.trim() || "info@al-anjal.sch.sa";
  const secondaryEmail = contactSettings?.contactEmailSecondary?.trim() || "";
  const primaryPhone = contactSettings?.contactPhonePrimary?.trim() || "011-000-0000";
  const secondaryPhone = contactSettings?.contactPhoneSecondary?.trim() || "";
  const addressText =
    (isAr ? contactSettings?.contactAddressAr : contactSettings?.contactAddressEn)?.trim() ||
    (isAr ? "مدارس الأنجال الأهلية - الرياض" : "Al Anjal Schools - Riyadh");
  const mapTitle =
    (isAr ? contactSettings?.mapTitleAr : contactSettings?.mapTitleEn)?.trim() ||
    (isAr ? "خريطة مدارس الأنجال" : "Al Anjal map");
  const mapSrc =
    normalizeMapEmbedUrl(contactSettings?.mapEmbedUrl?.trim() || "") ||
    "https://www.google.com/maps?q=Riyadh&output=embed";
  const mapLocationLabel =
    (isAr ? contactSettings?.mapLocationLabelAr : contactSettings?.mapLocationLabelEn)?.trim() ||
    addressText;

  return (
    <main className="bg-[#f5f7fb] py-10 sm:py-14">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
          <h1 className="text-2xl font-black text-text sm:text-3xl">
            {isAr ? "اتصل بنا" : "Contact us"}
          </h1>
          <p className="mt-2 text-sm text-text-light sm:text-base">
            {introText}
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-text">
                  {isAr ? "الاسم الكامل *" : "Full name *"}
                </label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-primary"
                  placeholder={isAr ? "اكتب الاسم الكامل" : "Enter full name"}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-text">
                  {isAr ? "الجوال *" : "Mobile *"}
                </label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-primary"
                  placeholder="05XXXXXXXX"
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-text">
                  {isAr ? "البريد الإلكتروني *" : "Email *"}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-primary"
                  placeholder="name@example.com"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-text">
                  {isAr ? "نوع الاستفسار *" : "Inquiry type *"}
                </label>
                <select
                  value={inquiryType}
                  onChange={(e) => setInquiryType(e.target.value as InquiryType)}
                  className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-primary"
                >
                  {inquiryOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {isAr ? opt.ar : opt.en}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-text">
                {isAr ? "عنوان الرسالة *" : "Subject *"}
              </label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-primary"
                placeholder={isAr ? "عنوان مختصر للرسالة" : "Short message subject"}
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-text">
                {isAr ? "نص الرسالة *" : "Message *"}
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                className="w-full rounded-lg border border-gray-300 p-3 text-sm outline-none focus:border-primary"
                placeholder={isAr ? "اكتب تفاصيل استفسارك هنا..." : "Write your message details here..."}
                required
              />
            </div>

            {error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
            {success ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p> : null}

            <button
              type="submit"
              disabled={loading || !canSubmit}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isAr ? "إرسال الرسالة" : "Send message"}
            </button>
          </form>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-text">{infoTitle}</h2>
            <div className="mt-4 space-y-3 text-sm">
              <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /> {primaryEmail}</p>
              {secondaryEmail ? (
                <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /> {secondaryEmail}</p>
              ) : null}
              <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-primary" /> {primaryPhone}</p>
              {secondaryPhone ? (
                <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-primary" /> {secondaryPhone}</p>
              ) : null}
              <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> {addressText}</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-text">
              {mapLocationLabel}
            </div>
            <div className="h-80 w-full">
              <iframe
                title={mapTitle}
                src={mapSrc}
                className="h-full w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
