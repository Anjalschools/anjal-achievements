"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const KINDS = [
  ["email_campaign", "بريد"],
  ["alumni_engagement", "تفاعل خريجين"],
  ["reunion_invitation", "دعوة لقاء"],
  ["mentorship_invitation", "دعوة إرشاد"],
  ["graduation_reminder", "تذكير تخرج"],
  ["event_promotion", "ترويج فعالية"],
] as const;

export default function AdminAlumniCampaignNewPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<string>("email_campaign");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("<p>مرحبًا {{name}}،</p>");
  const [bodyText, setBodyText] = useState("");
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/alumni/campaigns", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          kind,
          subject,
          bodyHtml,
          bodyText: bodyText || bodyHtml.replace(/<[^>]+>/g, " "),
          audienceFilter: {},
        }),
      });
      const json = (await res.json()) as { ok?: boolean; id?: string };
      if (res.ok && json.ok && json.id) router.replace(`/admin/alumni/campaigns/${json.id}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div dir="rtl" className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <Link href="/admin/alumni/campaigns" className="text-sm font-bold text-primary hover:underline">
        ← الحملات
      </Link>
      <h1 className="text-2xl font-black text-slate-900">إنشاء حملة</h1>

      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="block text-sm font-bold text-slate-800">
          العنوان
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        </label>
        <label className="block text-sm font-bold text-slate-800">
          النوع
          <select value={kind} onChange={(e) => setKind(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
            {KINDS.map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-bold text-slate-800">
          الموضوع
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        </label>
        <label className="block text-sm font-bold text-slate-800">
          المحتوى HTML
          <textarea value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)} rows={8} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs" />
        </label>
        <label className="block text-sm font-bold text-slate-800">
          نص بديل (اختياري)
          <textarea value={bodyText} onChange={(e) => setBodyText(e.target.value)} rows={4} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        </label>
        <button
          type="button"
          disabled={busy || !title.trim() || !subject.trim()}
          onClick={() => void handleCreate()}
          className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          حفظ كمسودة
        </button>
      </div>
    </div>
  );
}
