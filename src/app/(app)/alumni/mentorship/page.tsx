"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, UserRoundSearch } from "lucide-react";
import { getLocale } from "@/lib/i18n";
import AlumniPageHeader from "@/components/alumni/AlumniPageHeader";

type Mentor = {
  id: string;
  fullName?: string;
  universityName?: string | null;
  company?: string | null;
};

const MentorshipForm = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const dir = isAr ? "rtl" : "ltr";
  const searchParams = useSearchParams();
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [loading, setLoading] = useState(true);
  const [mentorId, setMentorId] = useState("");
  const [category, setCategory] = useState("academic");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "err">("idle");

  useEffect(() => {
    const pre = searchParams.get("mentor");
    if (pre) setMentorId(pre);
  }, [searchParams]);

  useEffect(() => {
    let m = true;
    void (async () => {
      try {
        const res = await fetch("/api/public/alumni-mentors");
        const json = (await res.json()) as { ok?: boolean; items?: Mentor[] };
        if (m && json.ok && json.items) setMentors(json.items);
      } finally {
        if (m) setLoading(false);
      }
    })();
    return () => {
      m = false;
    };
  }, []);

  const handleSubmit = async () => {
    if (!mentorId || !message.trim()) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/alumni/mentorship-requests", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mentorId, category, message: message.trim() }),
      });
      setStatus(res.ok ? "done" : "err");
    } catch {
      setStatus("err");
    }
  };

  return (
    <div dir={dir} className="alumni-mobile-shell mx-auto max-w-3xl space-y-6 px-4 py-8">
      <AlumniPageHeader
        title={isAr ? "طلب إرشاد" : "Mentorship request"}
        description={
          isAr
            ? "اختر مرشدًا وأرسل رسالة قصيرة. تابع الطلبات من صفحة المتابعة."
            : "Choose a mentor and send a short message. Track requests from the follow-up page."
        }
        smartBack
        backLabel={isAr ? "رجوع" : "Back"}
        icon={<UserRoundSearch className="h-6 w-6 text-white" aria-hidden />}
        breadcrumb={[
          { label: isAr ? "الخريجون" : "Alumni", href: "/alumni" },
          { label: isAr ? "الإرشاد" : "Mentoring" },
        ]}
        dir={dir}
      />

      <p className="text-sm text-slate-600">
        {isAr ? (
          <>
            يمكنك متابعة الطلبات من{" "}
            <Link href="/alumni/mentorship/requests" className="font-bold text-primary underline">
              صفحة المتابعة
            </Link>
            .
          </>
        ) : (
          <>
            Track your requests on the{" "}
            <Link href="/alumni/mentorship/requests" className="font-bold text-primary underline">
              requests page
            </Link>
            .
          </>
        )}
      </p>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
        </div>
      ) : (
        <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-md">
          <label className="block text-sm font-bold text-slate-800">
            {isAr ? "المرشد" : "Mentor"}
            <select
              value={mentorId}
              onChange={(e) => setMentorId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">{isAr ? "— اختر مرشدًا —" : "— Select a mentor —"}</option>
              {mentors.map((x) => (
                <option key={x.id} value={x.id}>
                  {(x.fullName || x.id) +
                    (x.universityName ? ` — ${x.universityName}` : "") +
                    (x.company ? ` — ${x.company}` : "")}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-bold text-slate-800">
            {isAr ? "الفئة" : "Category"}
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-bold text-slate-800">
            {isAr ? "الرسالة" : "Message"}
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={status === "sending"}
            className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {isAr ? "إرسال الطلب" : "Submit request"}
          </button>
          {status === "done" ? (
            <p className="text-sm font-bold text-emerald-700">{isAr ? "تم إرسال الطلب." : "Request sent."}</p>
          ) : null}
          {status === "err" ? (
            <p className="text-sm font-bold text-red-700">
              {isAr ? "تعذر الإرسال. تأكد من تسجيل الدخول." : "Could not send. Please sign in."}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default function AlumniMentorshipPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
        </div>
      }
    >
      <MentorshipForm />
    </Suspense>
  );
}
