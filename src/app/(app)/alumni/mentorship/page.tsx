"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

type Mentor = {
  id: string;
  fullName?: string;
  universityName?: string | null;
  company?: string | null;
};

const MentorshipForm = () => {
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
    <div dir="rtl" className="alumni-mobile-shell mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-black text-slate-900">طلب إرشاد</h1>
      <p className="mt-2 text-sm text-slate-600">
        اختر مرشدًا من القائمة وأرسل رسالة قصيرة. يمكنك متابعة الطلبات من{" "}
        <Link href="/alumni/mentorship/requests" className="font-bold text-primary underline">
          صفحة المتابعة
        </Link>
        .
      </p>

      {loading ? (
        <Loader2 className="mt-8 h-8 w-8 animate-spin text-primary" />
      ) : (
        <div className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="block text-sm font-bold text-slate-800">
            المرشد
            <select
              value={mentorId}
              onChange={(e) => setMentorId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">— اختر مرشدًا —</option>
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
            الفئة
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-bold text-slate-800">
            الرسالة
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
            إرسال الطلب
          </button>
          {status === "done" ? <p className="text-sm font-bold text-emerald-700">تم إرسال الطلب.</p> : null}
          {status === "err" ? <p className="text-sm font-bold text-red-700">تعذر الإرسال. تأكد من تسجيل الدخول.</p> : null}
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
