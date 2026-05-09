"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function AlumniEventDetailPage() {
  const params = useParams();
  const slug = String(params?.slug || "");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [eventId, setEventId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    let m = true;
    void (async () => {
      try {
        const res = await fetch(`/api/public/alumni-events/${slug}`);
        const json = (await res.json()) as {
          ok?: boolean;
          item?: { id?: string; title?: string; content?: string };
        };
        if (json.ok && json.item) {
          setTitle(json.item.title || "");
          setContent(json.item.content || "");
          if (json.item.id) setEventId(json.item.id);
        }
      } finally {
        if (m) setLoading(false);
      }
    })();
    return () => {
      m = false;
    };
  }, [slug]);

  const rsvp = async () => {
    if (!eventId) return;
    await fetch(`/api/alumni/events/${eventId}/rsvp`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "going" }),
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      </div>
    );
  }

  return (
    <article dir="rtl" className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/alumni/events" className="text-sm font-bold text-primary hover:underline">
        ← الفعاليات
      </Link>
      <h1 className="mt-4 text-3xl font-black text-slate-900">{title}</h1>
      <div className="prose prose-slate mt-6 max-w-none whitespace-pre-wrap text-slate-800">{content}</div>
      <button
        type="button"
        onClick={() => void rsvp()}
        className="mt-8 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white"
      >
        تأكيد الحضور (RSVP)
      </button>
      <p className="mt-2 text-xs text-slate-500">يتطلب تسجيل الدخول كخريج معتمد.</p>
    </article>
  );
}
