"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import { getLocale } from "@/lib/i18n";
import { Loader2, Send } from "lucide-react";

type ThreadRow = {
  id: string;
  applicationId: string;
  opportunityTitle: string;
  studentName: string;
  subject: string;
  lastMessagePreview: string;
  unreadCount: number;
};

type MessageRow = {
  id: string;
  senderRole: string;
  body: string;
  createdAt: string | null;
  isMine: boolean;
};

const InstitutionMessagesPage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const searchParams = useSearchParams();
  const preselectedAppId = searchParams.get("applicationId");

  const [loading, setLoading] = useState(true);
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [activeApplicationId, setActiveApplicationId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadThreads = useCallback(async () => {
    const res = await fetch("/api/institution/training/messages", { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (res.ok && Array.isArray(json.items)) {
      setThreads(json.items);
      if (preselectedAppId) {
        const match = json.items.find((row: ThreadRow) => row.applicationId === preselectedAppId);
        if (match) setActiveId(match.id);
      }
    } else {
      setThreads([]);
    }
  }, [preselectedAppId]);

  const loadMessages = useCallback(async (threadId: string) => {
    const res = await fetch(`/api/institution/training/messages?threadId=${encodeURIComponent(threadId)}`, {
      cache: "no-store",
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && Array.isArray(json.items)) {
      setMessages(json.items);
      setActiveApplicationId(typeof json.applicationId === "string" ? json.applicationId : null);
    } else {
      setMessages([]);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadThreads();
      setLoading(false);
    })();
  }, [loadThreads]);

  useEffect(() => {
    if (activeId) void loadMessages(activeId);
  }, [activeId, loadMessages]);

  const handleSend = async () => {
    if (!activeApplicationId || !reply.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/institution/training/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: activeApplicationId, body: reply.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setReply("");
      if (activeId) await loadMessages(activeId);
      await loadThreads();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSending(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title={isAr ? "مركز رسائل المؤسسة" : "Institution messaging center"}
        subtitle={isAr ? "التواصل مع الطلاب والمشرفين" : "Communicate with students and supervisors"}
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-text-light">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <SectionCard>
            <ul className="max-h-[70vh] space-y-2 overflow-y-auto">
              {threads.length === 0 ? (
                <li className="py-8 text-center text-sm text-text-light">
                  {isAr ? "لا توجد محادثات." : "No conversations yet."}
                </li>
              ) : (
                threads.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => setActiveId(row.id)}
                      className={`w-full rounded-xl border px-3 py-3 text-start text-sm transition ${
                        activeId === row.id
                          ? "border-primary bg-primary/10"
                          : "border-border bg-white hover:bg-gray-50"
                      }`}
                    >
                      <p className="font-bold text-foreground">{row.studentName}</p>
                      <p className="text-xs text-text-light">{row.opportunityTitle}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-text">{row.lastMessagePreview}</p>
                      {row.unreadCount > 0 ? (
                        <span className="mt-1 inline-flex rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white">
                          {row.unreadCount}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </SectionCard>

          <SectionCard>
            {!activeId ? (
              <p className="py-16 text-center text-sm text-text-light">
                {isAr ? "اختر محادثة." : "Select a conversation."}
              </p>
            ) : (
              <>
                {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
                <div className="mb-4 max-h-[55vh] space-y-3 overflow-y-auto">
                  {messages.map((row) => (
                    <div
                      key={row.id}
                      className={`rounded-xl px-3 py-2 text-sm ${
                        row.isMine ? "ms-8 bg-primary/10 text-foreground" : "me-8 bg-gray-100 text-text"
                      }`}
                    >
                      <p className="mb-1 text-[10px] font-bold uppercase text-text-light">{row.senderRole}</p>
                      <p>{row.body}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder={isAr ? "اكتب رسالتك…" : "Write your message…"}
                    className="min-h-16 flex-1 rounded-xl border border-border px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    disabled={sending || !reply.trim()}
                    onClick={() => void handleSend()}
                    className="inline-flex h-fit items-center gap-2 rounded-xl border border-primary bg-primary px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                  >
                    <Send className="h-4 w-4" aria-hidden />
                    {isAr ? "إرسال" : "Send"}
                  </button>
                </div>
                {activeApplicationId ? (
                  <Link
                    href={`/institution/training/${encodeURIComponent(activeApplicationId)}`}
                    className="mt-3 inline-block text-sm font-semibold text-primary hover:underline"
                  >
                    {isAr ? "عرض ملف الطلب" : "View application profile"}
                  </Link>
                ) : null}
              </>
            )}
          </SectionCard>
        </div>
      )}
    </PageContainer>
  );
};

export default InstitutionMessagesPage;
