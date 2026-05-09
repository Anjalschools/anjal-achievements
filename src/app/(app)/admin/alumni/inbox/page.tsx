"use client";

import { useCallback, useEffect, useState } from "react";
import { Inbox, Loader2, RefreshCw, Send } from "lucide-react";

type Thread = {
  id: string;
  alumniId: string;
  subject: string;
  lastMessagePreview: string;
  unread: number;
};

type Msg = { id: string; body: string; createdAt: string | null };

export default function AdminAlumniInboxPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const loadThreads = useCallback(async () => {
    const res = await fetch("/api/alumni/inbox", { credentials: "include", cache: "no-store" });
    const json = (await res.json()) as { ok?: boolean; items?: Thread[] };
    if (json.ok && json.items) setThreads(json.items as Thread[]);
    else setThreads([]);
  }, []);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        await loadThreads();
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [loadThreads]);

  const openThread = async (id: string) => {
    setActiveId(id);
    const res = await fetch(`/api/alumni/inbox/${id}`, { credentials: "include" });
    const json = (await res.json()) as { ok?: boolean; messages?: Msg[] };
    if (json.ok && json.messages) setMessages(json.messages);
    await fetch(`/api/alumni/inbox/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "markRead" }),
    });
    void loadThreads();
  };

  const handleSend = async () => {
    if (!activeId || !reply.trim()) return;
    setSending(true);
    try {
      await fetch(`/api/alumni/inbox/${activeId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply.trim() }),
      });
      setReply("");
      await openThread(activeId);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      </div>
    );
  }

  return (
    <div dir="rtl" className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 lg:flex-row">
      <aside className="w-full shrink-0 lg:w-96">
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between gap-2 px-2 py-2">
            <div>
              <h1 className="text-lg font-black text-slate-900">بريد الخريجين</h1>
              <p className="text-[11px] font-bold text-slate-500">محادثات: {threads.length}</p>
            </div>
            <button
              type="button"
              onClick={() => void loadThreads()}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-2 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              تحديث
            </button>
          </div>
          {threads.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-12 text-center">
              <Inbox className="h-10 w-10 text-slate-300" aria-hidden />
              <p className="mt-3 text-sm font-bold text-slate-700">لا توجد محادثات</p>
              <p className="mt-1 text-xs text-slate-500">عند وصول رسائل من الخريجين ستظهر هنا.</p>
            </div>
          ) : (
          <ul className="max-h-[60vh] space-y-1 overflow-y-auto">
            {threads.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => void openThread(t.id)}
                  className={`w-full rounded-xl px-3 py-2 text-right text-sm transition ${
                    activeId === t.id ? "bg-primary/10 font-bold text-primary" : "hover:bg-slate-50"
                  }`}
                >
                  <span className="line-clamp-1">{t.subject}</span>
                  <span className="block text-[10px] text-slate-500">خريج: {t.alumniId}</span>
                  {t.unread > 0 ? (
                    <span className="mt-1 inline-block rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white">
                      {t.unread}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
          )}
        </div>
      </aside>
      <section className="min-h-[420px] flex-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {!activeId ? (
          <p className="text-center text-slate-500">اختر محادثة.</p>
        ) : (
          <div className="flex h-full flex-col">
            <div className="flex-1 space-y-3 overflow-y-auto pb-4">
              {messages.map((m) => (
                <div key={m.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-800">
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <p className="mt-1 text-[10px] text-slate-400">{m.createdAt || ""}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2 border-t border-slate-100 pt-3">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={2}
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/20 focus:ring"
              />
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={sending}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white disabled:opacity-50"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                رد
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
