"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function AlumniAnnouncementDetailPage() {
  const params = useParams();
  const slug = String(params?.slug || "");
  const [html, setHtml] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    let m = true;
    void (async () => {
      try {
        const res = await fetch(`/api/public/alumni-announcement/${slug}`);
        const json = (await res.json()) as { ok?: boolean; item?: { title?: string; content?: string } };
        if (m && json.ok && json.item) {
          setTitle(json.item.title || "");
          setHtml(json.item.content || "");
        }
      } finally {
        if (m) setLoading(false);
      }
    })();
    return () => {
      m = false;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      </div>
    );
  }

  return (
    <article dir="rtl" className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/alumni/announcements" className="text-sm font-bold text-primary hover:underline">
        ← العودة للإعلانات
      </Link>
      <h1 className="mt-4 text-3xl font-black text-slate-900">{title}</h1>
      <div className="prose prose-slate mt-6 max-w-none whitespace-pre-wrap text-slate-800">{html}</div>
    </article>
  );
}
