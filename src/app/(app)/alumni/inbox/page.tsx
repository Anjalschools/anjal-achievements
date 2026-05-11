"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Mail, MessageCirclePlus, Search, Send } from "lucide-react";
import { useAppSession } from "@/contexts/AppSessionContext";
import { getLocale } from "@/lib/i18n";
import AlumniPageHeader from "@/components/alumni/AlumniPageHeader";
import AlumniEmptyState from "@/components/alumni/AlumniEmptyState";
import MessagesEmptyIllustration from "@/components/alumni/MessagesEmptyIllustration";

type Thread = {
  id: string;
  subject: string;
  lastMessagePreview: string;
  unread: number;
  updatedAt: string | null;
};

type Msg = { id: string; senderId: string; body: string; createdAt: string | null };

export default function AlumniInboxPage() {
  const locale = getLocale();
  const isAr = locale === "ar";
  const dir = isAr ? "rtl" : "ltr";

  const { profile, loading: sessionLoading } = useAppSession();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newBody, setNewBody] = useState("");
  const [showNewThread, setShowNewThread] = useState(false);
  const [threadQuery, setThreadQuery] = useState("");

  const formatThreadTime = useCallback(
    (raw: string | null) => {
      if (!raw) return "";
      const d = new Date(raw);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleString(isAr ? "ar-SA" : "en-GB", { dateStyle: "short", timeStyle: "short" });
      }
      return raw;
    },
    [isAr]
  );

  const filteredThreads = useMemo(() => {
    const q = threadQuery.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter(
      (row) =>
        row.subject.toLowerCase().includes(q) || (row.lastMessagePreview || "").toLowerCase().includes(q)
    );
  }, [threads, threadQuery]);

  const loadThreads = useCallback(async () => {
    const res = await fetch("/api/alumni/inbox", { credentials: "include" });
    const json = (await res.json()) as { ok?: boolean; items?: Thread[] };
    if (json.ok && Array.isArray(json.items)) setThreads(json.items);
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

  const loadMessages = async (id: string) => {
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

  const handleNewThread = async () => {
    if (!newBody.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/alumni/inbox", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: newSubject.trim() || (isAr ? "محادثة مع الإدارة" : "Message to administration"),
          body: newBody.trim(),
        }),
      });
      const json = (await res.json()) as { ok?: boolean; threadId?: string };
      if (json.ok && json.threadId) {
        setNewSubject("");
        setNewBody("");
        setShowNewThread(false);
        await loadThreads();
        await loadMessages(json.threadId);
      }
    } finally {
      setSending(false);
    }
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
      await loadMessages(activeId);
      await loadThreads();
    } finally {
      setSending(false);
    }
  };

  if (sessionLoading || loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center" dir={dir}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      </div>
    );
  }

  if (profile?.accountType !== "alumni") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center" dir={dir}>
        <p className="text-slate-700">
          {isAr ? "صندوق الرسائل متاح لحسابات الخريجين." : "The inbox is available for alumni accounts."}
        </p>
        <Link href="/dashboard" className="mt-4 inline-block text-primary underline">
          {isAr ? "العودة" : "Back"}
        </Link>
      </div>
    );
  }

  return (
    <div dir={dir} className="alumni-mobile-shell mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <AlumniPageHeader
        title={isAr ? "صندوق الرسائل" : "Messages"}
        description={
          isAr
            ? "تواصل آمن مع الإدارة — محادثاتك محفوظة ومرتبة."
            : "Secure messaging with administration — organized threads."
        }
        backHref="/alumni/dashboard"
        backLabel={isAr ? "رجوع" : "Back"}
        icon={<Mail className="h-6 w-6 text-white" aria-hidden />}
        breadcrumb={[
          { label: isAr ? "الخريجون" : "Alumni", href: "/alumni" },
          { label: isAr ? "الرسائل" : "Messages" },
        ]}
        dir={dir}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="relative min-w-0 flex-1">
          <Search
            className={`pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 ${isAr ? "right-3" : "left-3"}`}
            aria-hidden
          />
          <input
            type="search"
            value={threadQuery}
            onChange={(e) => setThreadQuery(e.target.value)}
            placeholder={isAr ? "ابحث في المحادثات…" : "Search conversations…"}
            className={`h-11 w-full rounded-2xl border border-slate-200 bg-white py-2 text-sm text-slate-900 shadow-sm outline-none ring-primary/20 focus:ring-2 ${
              isAr ? "pr-10 pl-4" : "pl-10 pr-4"
            }`}
            aria-label={isAr ? "بحث المحادثات" : "Search threads"}
          />
        </div>
        <button
          type="button"
          onClick={() => setShowNewThread((v) => !v)}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-black text-white shadow-md shadow-primary/25 transition hover:opacity-95"
          tabIndex={0}
          aria-expanded={showNewThread}
        >
          <MessageCirclePlus className="h-4 w-4 shrink-0" aria-hidden />
          {isAr ? "محادثة جديدة" : "New conversation"}
        </button>
      </div>

      {showNewThread ? (
        <div className="mb-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-md sm:p-5">
          <p className="text-sm font-black text-slate-900">
            {isAr ? "بدء محادثة جديدة" : "Start a new conversation"}
          </p>
          <input
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            placeholder={isAr ? "الموضوع (اختياري)" : "Subject (optional)"}
            className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-2"
            aria-label={isAr ? "موضوع المحادثة" : "Conversation subject"}
          />
          <textarea
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            rows={3}
            placeholder={isAr ? "نص الرسالة…" : "Your message…"}
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-2"
            aria-label={isAr ? "نص الرسالة" : "Message body"}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleNewThread()}
              disabled={sending || !newBody.trim()}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {isAr ? "إرسال" : "Send"}
            </button>
            <button
              type="button"
              onClick={() => setShowNewThread(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700"
            >
              {isAr ? "إلغاء" : "Cancel"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex min-h-[min(70vh,640px)] flex-col gap-4 lg:flex-row-reverse lg:items-stretch">
        <aside className="w-full shrink-0 lg:w-80">
          <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-md lg:max-h-[70vh] lg:overflow-hidden lg:flex lg:flex-col">
            <h2 className="px-2 py-2 text-lg font-black text-slate-900">
              {isAr ? "المحادثات" : "Threads"}
            </h2>
            {threads.length === 0 ? (
              <div className="px-1 py-4">
                <AlumniEmptyState
                  className="!py-10"
                  illustration={<MessagesEmptyIllustration />}
                  icon={<Mail className="h-8 w-8" aria-hidden />}
                  title={isAr ? "لا توجد محادثات بعد" : "No conversations yet"}
                  description={
                    isAr
                      ? "ابدأ محادثة جديدة مع فريق مجتمع الخريجين عند الحاجة."
                      : "Start a new thread with the alumni community team when you need support."
                  }
                  ctaLabel={isAr ? "محادثة جديدة" : "New conversation"}
                  onCtaClick={() => setShowNewThread(true)}
                  dir={dir}
                />
              </div>
            ) : filteredThreads.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-slate-500">
                {isAr ? "لا نتائج مطابقة للبحث." : "No threads match your search."}
              </p>
            ) : (
              <ul className="mt-1 max-h-[45vh] space-y-1 overflow-y-auto lg:max-h-none lg:flex-1" role="list">
                {filteredThreads.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => void loadMessages(t.id)}
                      className={`flex w-full flex-col gap-1 rounded-2xl px-3 py-3 text-start text-sm transition ${
                        activeId === t.id
                          ? "bg-primary/10 font-bold text-primary ring-1 ring-primary/20"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="line-clamp-2 min-w-0 flex-1">{t.subject}</span>
                        {t.unread > 0 ? (
                          <span className="inline-flex min-w-[1.35rem] shrink-0 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-black text-white">
                            {t.unread}
                          </span>
                        ) : null}
                      </div>
                      {t.lastMessagePreview ? (
                        <span className="line-clamp-2 text-xs font-normal leading-relaxed text-slate-500">
                          {t.lastMessagePreview}
                        </span>
                      ) : (
                        <span className="text-xs italic text-slate-400">
                          {isAr ? "لا معاينة بعد — اكتب أول رسالة" : "No preview yet"}
                        </span>
                      )}
                      {t.updatedAt ? (
                        <span className="text-[10px] font-medium text-slate-400">
                          {formatThreadTime(t.updatedAt)}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section className="flex min-h-[320px] flex-1 flex-col rounded-3xl border border-slate-200 bg-white shadow-md">
          {!activeId ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <AlumniEmptyState
                className="w-full max-w-md border-0 bg-transparent shadow-none"
                illustration={<MessagesEmptyIllustration className="mx-auto h-28 w-full max-w-[200px]" />}
                icon={<MessageCirclePlus className="h-8 w-8 text-primary" aria-hidden />}
                title={isAr ? "اختر محادثة" : "Select a conversation"}
                description={
                  isAr
                    ? "اختر من القائمة أو أنشئ محادثة جديدة مع فريق المجتمع المهني."
                    : "Pick a thread from the list or start one with the alumni team."
                }
                ctaLabel={threads.length === 0 ? undefined : isAr ? "محادثة جديدة" : "New conversation"}
                onCtaClick={threads.length === 0 ? undefined : () => setShowNewThread(true)}
                dir={dir}
              />
            </div>
          ) : (
            <div className="flex h-full min-h-[320px] flex-col">
              <div className="flex-1 space-y-3 overflow-y-auto p-4 pb-2">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-2xl border border-slate-100 bg-slate-50/90 px-4 py-3 text-sm text-slate-800 shadow-sm"
                  >
                    <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
                    <p className="mt-2 text-[10px] text-slate-400">{formatThreadTime(m.createdAt)}</p>
                  </div>
                ))}
              </div>
              <div className="relative border-t border-slate-100 p-3">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={2}
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2 pb-8 text-sm outline-none ring-primary/20 focus:ring-2"
                  placeholder={isAr ? "اكتب رسالتك…" : "Type your message…"}
                  aria-label={isAr ? "ردك" : "Your reply"}
                />
                <span
                  className={`pointer-events-none absolute bottom-5 flex items-center gap-0.5 text-[10px] font-medium text-slate-400 ${
                    isAr ? "right-5" : "left-5"
                  }`}
                  aria-hidden
                >
                  <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-slate-400" />
                  <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-slate-400 [animation-delay:180ms]" />
                  <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-slate-400 [animation-delay:360ms]" />
                </span>
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={sending || !reply.trim()}
                    className="inline-flex h-11 shrink-0 items-center gap-2 rounded-2xl bg-primary px-4 text-sm font-bold text-white disabled:opacity-50"
                    aria-label={isAr ? "إرسال" : "Send"}
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
