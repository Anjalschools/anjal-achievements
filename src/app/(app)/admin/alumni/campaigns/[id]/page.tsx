"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function AdminAlumniCampaignDetailPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<{
    title: string;
    subject: string;
    bodyHtml: string;
    bodyText: string;
    audienceFilter: Record<string, unknown>;
    status: string;
    stats: { delivered: number; opened: number; clicked: number; failed: number };
  } | null>(null);
  const [filterJson, setFilterJson] = useState("{}");
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/alumni/campaigns/${id}`, { credentials: "include" });
    const json = (await res.json()) as { ok?: boolean; item?: any };
    if (json.ok && json.item) {
      setItem(json.item);
      setFilterJson(JSON.stringify(json.item.audienceFilter || {}, null, 2));
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let m = true;
    void (async () => {
      try {
        await load();
      } finally {
        if (m) setLoading(false);
      }
    })();
    return () => {
      m = false;
    };
  }, [id, load]);

  const handleSave = async () => {
    setMsg(null);
    let audienceFilter: Record<string, unknown> = {};
    try {
      audienceFilter = JSON.parse(filterJson) as Record<string, unknown>;
    } catch {
      setMsg("JSON غير صالح للجمهور");
      return;
    }
    const res = await fetch(`/api/admin/alumni/campaigns/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: item?.title,
        subject: item?.subject,
        bodyHtml: item?.bodyHtml,
        bodyText: item?.bodyText,
        audienceFilter,
      }),
    });
    setMsg(res.ok ? "تم الحفظ." : "تعذر الحفظ.");
  };

  const preview = async () => {
    setMsg(null);
    const res = await fetch(`/api/admin/alumni/campaigns/${id}/preview`, { credentials: "include" });
    const json = (await res.json()) as { ok?: boolean; totalMatched?: number; sample?: { fullName: string }[] };
    if (json.ok) setMsg(`معاينة: ${json.totalMatched} مستخدم مطابق · عينة: ${json.sample?.map((s) => s.fullName).join("، ")}`);
  };

  const testSend = async () => {
    const email = window.prompt("بريد الاختبار") || "";
    if (!email.includes("@")) return;
    const res = await fetch(`/api/admin/alumni/campaigns/${id}/send`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ testEmail: email }),
    });
    const json = await res.json();
    setMsg(JSON.stringify(json));
  };

  const fullSend = async () => {
    if (!window.confirm("تأكيد الإرسال وتوليد طابور الرسائل؟")) return;
    const res = await fetch(`/api/admin/alumni/campaigns/${id}/send`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const json = await res.json();
    setMsg(JSON.stringify(json));
    void load();
  };

  if (loading || !item) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      </div>
    );
  }

  return (
    <div dir="rtl" className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <Link href="/admin/alumni/campaigns" className="text-sm font-bold text-primary hover:underline">
        ← الحملات
      </Link>
      <h1 className="text-2xl font-black text-slate-900">{item.title}</h1>
      <p className="text-xs text-slate-500">الحالة: {item.status}</p>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["تسليم", item.stats.delivered],
          ["فتح", item.stats.opened],
          ["نقرة", item.stats.clicked],
          ["فشل", item.stats.failed],
        ].map(([k, v]) => (
          <div key={String(k)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold text-slate-500">{k}</p>
            <p className="mt-1 text-2xl font-black tabular-nums">{v}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="block text-sm font-bold text-slate-800">
          الموضوع
          <input
            value={item.subject}
            onChange={(e) => setItem({ ...item, subject: e.target.value })}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm font-bold text-slate-800">
          HTML
          <textarea
            value={item.bodyHtml}
            onChange={(e) => setItem({ ...item, bodyHtml: e.target.value })}
            rows={10}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs"
          />
        </label>
        <label className="block text-sm font-bold text-slate-800">
          مرشح الجمهور (JSON)
          <textarea value={filterJson} onChange={(e) => setFilterJson(e.target.value)} rows={6} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs" />
        </label>
        <p className="text-[11px] text-slate-500">
          مثال: {"{"} &quot;verifiedOnly&quot;: true {"}"} أو {"{"} &quot;cohortYear&quot;: 2020, &quot;country&quot;: &quot;SA&quot; {"}"}
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void handleSave()} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">
            حفظ
          </button>
          <button type="button" onClick={() => void preview()} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-800">
            معاينة الجمهور
          </button>
          <button type="button" onClick={() => void testSend()} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-950">
            إرسال تجريبي
          </button>
          <button type="button" onClick={() => void fullSend()} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white">
            إرسال / طابور
          </button>
        </div>
        {msg ? <p className="text-sm font-bold text-slate-800">{msg}</p> : null}
      </div>
    </div>
  );
}
