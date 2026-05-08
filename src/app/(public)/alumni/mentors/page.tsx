"use client";

import { useEffect, useState } from "react";
import { getLocale } from "@/lib/i18n";
import type { AlumniMentorItem } from "@/lib/alumni/alumni-ecosystem-types";
import { AlumniProfileCard } from "@/components/alumni/AlumniProfileCard";

const AlumniMentorsPage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [items, setItems] = useState<AlumniMentorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/public/alumni-mentors", { cache: "no-store" });
        const json = await response.json();
        setItems(Array.isArray(json.items) ? json.items : []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleInterest = async (mentor: AlumniMentorItem) => {
    const requesterName = window.prompt(isAr ? "اكتب اسمك:" : "Your name:");
    const requesterEmail = window.prompt(isAr ? "اكتب بريدك الإلكتروني:" : "Your email:");
    if (!requesterName || !requesterEmail) return;
    setSending(mentor.id);
    setNotice(null);
    try {
      const response = await fetch("/api/alumni/contact-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requesterName,
          requesterEmail,
          targetType: "mentor",
          targetId: mentor.id,
          message: isAr ? "طلب تواصل إرشادي" : "Mentorship interest request",
        }),
      });
      if (!response.ok) throw new Error();
      setNotice(isAr ? "تم إرسال طلب التواصل بنجاح." : "Contact interest sent successfully.");
    } catch {
      setNotice(isAr ? "تعذر إرسال الطلب حالياً." : "Unable to send request right now.");
    } finally {
      setSending(null);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:py-14" dir={isAr ? "rtl" : "ltr"}>
      <header className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 to-primary p-6 text-white sm:p-8">
        <h1 className="text-3xl font-black">{isAr ? "دليل المرشدين الخريجين" : "Alumni mentor directory"}</h1>
        <p className="mt-2 text-sm text-sky-100">
          {isAr ? "قائمة مرشدين معتمدين من إدارة المنصة — تواصل عبر طلب اهتمام آمن." : "Admin-moderated mentors listing with safe request-based contact flow."}
        </p>
      </header>

      {notice ? <p className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-sm">{notice}</p> : null}

      {loading ? (
        <p className="py-10 text-center text-slate-500">{isAr ? "جاري التحميل..." : "Loading..."}</p>
      ) : (
        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((mentor) => (
            <div key={mentor.id} className="space-y-3">
              <AlumniProfileCard locale={locale} profile={mentor} href={`/alumni/${mentor.id}`} />
              <button
                type="button"
                disabled={sending === mentor.id}
                onClick={() => void handleInterest(mentor)}
                className="w-full rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-dark disabled:opacity-60"
              >
                {sending === mentor.id
                  ? isAr
                    ? "جاري الإرسال..."
                    : "Sending..."
                  : isAr
                    ? "طلب تواصل"
                    : "Request contact"}
              </button>
            </div>
          ))}
        </section>
      )}
    </main>
  );
};

export default AlumniMentorsPage;
