"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import InstitutionConversationQuickActions from "@/components/institution/InstitutionConversationQuickActions";
import { getLocale } from "@/lib/i18n";
import {
  trainingApplicationStatusBadgeClass,
  trainingApplicationStatusLabel,
} from "@/lib/partnerships/partnerships-application-status-ui";
import { Headphones, Loader2, Send, Users } from "lucide-react";
import PartnershipMessageBubble, {
  type PartnershipMessageBubbleRow,
} from "@/components/partnerships/PartnershipMessageBubble";
import PartnershipMessageCenterEmptyState from "@/components/partnerships/PartnershipMessageCenterEmptyState";

type ThreadRow = {
  id: string;
  kind: "student" | "supervisor";
  applicationId: string;
  opportunityTitle: string;
  studentName: string;
  subject: string;
  lastMessagePreview: string;
  unreadCount: number;
  status: string;
};

type MessageRow = PartnershipMessageBubbleRow;

const InstitutionMessagesPage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const searchParams = useSearchParams();
  const preselectedAppId = searchParams.get("applicationId");

  const [loading, setLoading] = useState(true);
  const [studentThreads, setStudentThreads] = useState<ThreadRow[]>([]);
  const [supervisorThread, setSupervisorThread] = useState<ThreadRow | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeKind, setActiveKind] = useState<"student" | "supervisor">("student");
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [activeApplicationId, setActiveApplicationId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadThreads = useCallback(async () => {
    const res = await fetch("/api/institution/training/messages", { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      const students = Array.isArray(json.studentThreads) ? json.studentThreads : json.items || [];
      setStudentThreads(students);
      setSupervisorThread(json.supervisorThread || null);

      if (preselectedAppId) {
        const match = students.find((row: ThreadRow) => row.applicationId === preselectedAppId);
        if (match) {
          setActiveId(match.id);
          setActiveKind("student");
        }
      }
    } else {
      setStudentThreads([]);
      setSupervisorThread(null);
    }
  }, [preselectedAppId]);

  const loadMessages = useCallback(async (threadId: string) => {
    const res = await fetch(`/api/institution/training/messages?threadId=${encodeURIComponent(threadId)}`, {
      cache: "no-store",
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && Array.isArray(json.items)) {
      setMessages(json.items);
      setActiveKind(json.threadKind === "supervisor" ? "supervisor" : "student");
      setActiveApplicationId(typeof json.applicationId === "string" && json.applicationId ? json.applicationId : null);
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
    if (!activeId && supervisorThread) {
      setActiveId(supervisorThread.id);
      setActiveKind("supervisor");
    }
  }, [supervisorThread, activeId]);

  useEffect(() => {
    if (activeId) void loadMessages(activeId);
  }, [activeId, loadMessages]);

  const handleSelect = (row: ThreadRow) => {
    setActiveId(row.id);
    setActiveKind(row.kind);
  };

  const handleSend = async () => {
    if (!reply.trim()) return;
    if (activeKind === "student" && !activeApplicationId) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/institution/training/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: activeApplicationId || undefined,
          threadKind: activeKind,
          body: reply.trim(),
        }),
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

  const renderThreadButton = (row: ThreadRow) => (
    <li key={row.id}>
      <button
        type="button"
        onClick={() => handleSelect(row)}
        className={`w-full rounded-xl border px-3 py-2.5 text-start text-sm transition ${
          activeId === row.id ? "border-primary bg-primary/10" : "border-border bg-white hover:bg-gray-50"
        }`}
      >
        <p className="font-bold text-foreground">
          {row.kind === "supervisor"
            ? isAr
              ? "مشرف الشراكات"
              : "Partnerships supervisor"
            : row.studentName}
        </p>
        {row.opportunityTitle ? (
          <p className="text-xs text-text-light">{row.opportunityTitle}</p>
        ) : null}
        {row.status && row.kind === "student" ? (
          <span
            className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${trainingApplicationStatusBadgeClass(row.status)}`}
          >
            {trainingApplicationStatusLabel(row.status, isAr)}
          </span>
        ) : null}
        <p className="mt-1 line-clamp-1 text-xs text-text">{row.lastMessagePreview || "—"}</p>
        {row.unreadCount > 0 ? (
          <span className="mt-1 inline-flex rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white">
            {row.unreadCount}
          </span>
        ) : null}
      </button>
    </li>
  );

  return (
    <PageContainer>
      <PageHeader
        title={isAr ? "مركز رسائل المؤسسة" : "Institution messaging center"}
        subtitle={isAr ? "محادثات الطلاب ومشرف الشراكات" : "Student conversations and partnerships supervisor"}
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-text-light">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[300px_1fr]">
          <div className="space-y-3">
            <SectionCard padding="sm">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-text-light">
                <Headphones className="h-3.5 w-3.5" aria-hidden />
                {isAr ? "مشرف الشراكات" : "Partnerships supervisor"}
              </p>
              <ul>{supervisorThread ? renderThreadButton(supervisorThread) : null}</ul>
            </SectionCard>

            <SectionCard padding="sm">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-text-light">
                <Users className="h-3.5 w-3.5" aria-hidden />
                {isAr ? "محادثات الطلاب" : "Student conversations"} ({studentThreads.length})
              </p>
              <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
                {studentThreads.length === 0 ? (
                  <li className="py-4 text-center text-xs text-text-light">
                    {isAr ? "لا توجد محادثات طلاب بعد." : "No student conversations yet."}
                  </li>
                ) : (
                  studentThreads.map((row) => renderThreadButton(row))
                )}
              </ul>
            </SectionCard>
          </div>

          <SectionCard padding="sm">
            {!activeId ? (
              <PartnershipMessageCenterEmptyState isAr={isAr} />
            ) : (
              <>
                {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}
                <div className="mb-3 max-h-[45vh] min-h-[200px] space-y-2 overflow-y-auto">
                  {messages.length === 0 ? (
                    <p className="py-6 text-center text-xs text-text-light">
                      {isAr ? "لا توجد رسائل بعد. ابدأ المحادثة." : "No messages yet. Start the conversation."}
                    </p>
                  ) : (
                    messages.map((row) => (
                      <PartnershipMessageBubble
                        key={row.id}
                        message={row}
                        isAr={isAr}
                        apiBase="/api/institution/training/messages"
                        align={row.isMine ? "end" : "start"}
                        bubbleClassName={
                          row.isMine ? "bg-primary/10 text-foreground" : "bg-gray-100 text-text"
                        }
                        onUpdated={(updated) =>
                          setMessages((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
                        }
                      />
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder={isAr ? "اكتب رسالتك…" : "Write your message…"}
                    className="min-h-14 flex-1 rounded-xl border border-border px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    disabled={sending || !reply.trim()}
                    onClick={() => void handleSend()}
                    className="inline-flex h-fit items-center gap-2 rounded-xl border border-primary bg-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                  >
                    <Send className="h-4 w-4" aria-hidden />
                    {isAr ? "إرسال" : "Send"}
                  </button>
                </div>

                <InstitutionConversationQuickActions
                  applicationId={activeApplicationId}
                  threadKind={activeKind}
                  onActionComplete={async () => {
                    if (activeId) await loadMessages(activeId);
                    await loadThreads();
                  }}
                />

                {activeApplicationId ? (
                  <Link
                    href={`/institution/training/${encodeURIComponent(activeApplicationId)}`}
                    className="mt-2 inline-block text-xs font-semibold text-primary hover:underline"
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
