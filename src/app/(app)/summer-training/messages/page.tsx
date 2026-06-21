"use client";

import { useCallback, useEffect, useState } from "react";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import { getLocale } from "@/lib/i18n";
import Link from "next/link";
import TrainingApplicationStatusBadge from "@/components/partnerships/TrainingApplicationStatusBadge";
import type { StudentTrainingDashboardContext } from "@/lib/partnerships/partnerships-student-dashboard-context";
import { Briefcase, HelpCircle, Loader2, Mail, Plus, Send, X } from "lucide-react";
import PartnershipMessageBubble, {
  type PartnershipMessageBubbleRow,
} from "@/components/partnerships/PartnershipMessageBubble";
import PartnershipMessageCenterEmptyState from "@/components/partnerships/PartnershipMessageCenterEmptyState";

type ThreadRow = {
  id: string;
  applicationId: string;
  opportunityTitle: string;
  subject: string;
  lastMessagePreview: string;
  lastMessageAt: string | null;
  unreadCount: number;
  threadKind?: string;
  inquiryType?: string | null;
};

type MessageRow = PartnershipMessageBubbleRow;

type InquiryContext = {
  allowedInquiryTypes: string[];
  applications: Array<{ id: string; status: string; opportunityId: string; opportunityTitle: string }>;
  opportunities: Array<{ id: string; title: string }>;
};

const INQUIRY_LABELS: Record<string, { ar: string; en: string }> = {
  general_inquiry: { ar: "استفسار عام", en: "General inquiry" },
  opportunity_inquiry: { ar: "استفسار عن فرصة", en: "Opportunity inquiry" },
  application_inquiry: { ar: "استفسار عن طلب", en: "Application inquiry" },
  interview_inquiry: { ar: "استفسار عن مقابلة", en: "Interview inquiry" },
  acceptance_inquiry: { ar: "استفسار عن قبول", en: "Acceptance inquiry" },
};

const SummerTrainingMessagesPage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [loading, setLoading] = useState(true);
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [activeApplicationId, setActiveApplicationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inquiryContext, setInquiryContext] = useState<InquiryContext | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeType, setComposeType] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeOpportunityId, setComposeOpportunityId] = useState("");
  const [composeApplicationId, setComposeApplicationId] = useState("");
  const [composing, setComposing] = useState(false);
  const [trainingContext, setTrainingContext] = useState<StudentTrainingDashboardContext | null>(null);

  const loadThreads = useCallback(async () => {
    const [threadsRes, contextRes, trainingRes] = await Promise.all([
      fetch("/api/partnerships/messages", { cache: "no-store" }),
      fetch("/api/partnerships/messages?includeContext=1", { cache: "no-store" }),
      fetch("/api/partnerships/student-training-context", { cache: "no-store" }),
    ]);
    const json = await threadsRes.json().catch(() => ({}));
    const contextJson = await contextRes.json().catch(() => ({}));
    if (threadsRes.ok && Array.isArray(json.items)) {
      setThreads(json.items);
    } else {
      setThreads([]);
      if (!threadsRes.ok) setError(typeof json.error === "string" ? json.error : "Error");
    }
    if (contextRes.ok && contextJson.context) {
      setInquiryContext(contextJson.context as InquiryContext);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await loadThreads();
      } finally {
        setLoading(false);
      }
    })();
  }, [loadThreads]);

  const openThread = async (thread: ThreadRow) => {
    setActiveId(thread.id);
    setActiveApplicationId(thread.applicationId || null);
    setError(null);
    const res = await fetch(`/api/partnerships/messages?threadId=${encodeURIComponent(thread.id)}`, {
      cache: "no-store",
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && Array.isArray(json.items)) {
      setMessages(json.items);
    } else {
      setMessages([]);
      setError(typeof json.error === "string" ? json.error : "Error");
    }
    void loadThreads();
  };

  const handleSend = async () => {
    if (!reply.trim()) return;
    setSending(true);
    setError(null);
    try {
      const payload: Record<string, string> = { body: reply.trim(), locale };
      if (activeId) payload.threadId = activeId;
      else if (activeApplicationId) payload.applicationId = activeApplicationId;
      else throw new Error(isAr ? "اختر محادثة أولاً." : "Select a thread first.");

      const res = await fetch("/api/partnerships/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setReply("");
      if (activeId) {
        const thread = threads.find((row) => row.id === activeId);
        if (thread) await openThread(thread);
      }
      await loadThreads();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSending(false);
    }
  };

  const handleCompose = async () => {
    if (!composeType || !composeBody.trim()) return;
    setComposing(true);
    setError(null);
    try {
      const res = await fetch("/api/partnerships/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inquiryType: composeType,
          body: composeBody.trim(),
          locale,
          opportunityId: composeOpportunityId || undefined,
          applicationId: composeApplicationId || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setComposeOpen(false);
      setComposeBody("");
      setComposeType("");
      setComposeOpportunityId("");
      setComposeApplicationId("");
      await loadThreads();
      if (json.threadId) {
        const thread = { id: json.threadId, applicationId: composeApplicationId, subject: "", opportunityTitle: "", lastMessagePreview: "", lastMessageAt: null, unreadCount: 0 };
        await openThread(thread);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setComposing(false);
    }
  };

  const inquiryLabel = (type: string) => INQUIRY_LABELS[type]?.[isAr ? "ar" : "en"] || type;

  const needsOpportunity = composeType === "opportunity_inquiry";
  const needsApplication = ["application_inquiry", "interview_inquiry", "acceptance_inquiry"].includes(composeType);

  if (loading) {
    return (
      <PageContainer>
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title={isAr ? "رسائل التدريب الصيفي" : "Summer training messages"}
          subtitle={
            isAr
              ? "تواصل مع مشرف الشراكات بخصوص طلباتك."
              : "Communicate with the partnerships supervisor about your applications."
          }
        />
        <button
          type="button"
          onClick={() => setComposeOpen(true)}
          disabled={!inquiryContext?.allowedInquiryTypes.length}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          aria-label={isAr ? "رسالة جديدة" : "New message"}
        >
          <Plus className="h-4 w-4" aria-hidden />
          {isAr ? "رسالة جديدة" : "New message"}
        </button>
      </div>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      {trainingContext?.widget.applicationStatus ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-white px-4 py-3">
          <span className="text-sm font-semibold text-slate-700">
            {isAr ? "حالة طلب التدريب:" : "Training application status:"}
          </span>
          <TrainingApplicationStatusBadge
            status={trainingContext.widget.applicationStatus}
            isAr={isAr}
          />
          {trainingContext.widget.opportunityTitle ? (
            <span className="text-sm text-slate-600">{trainingContext.widget.opportunityTitle}</span>
          ) : null}
        </div>
      ) : null}

      <div className="flex min-h-[min(70vh,640px)] flex-col gap-4 lg:flex-row" role="main">
        <SectionCard className="w-full shrink-0 lg:w-80">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-black text-slate-900">
            <Mail className="h-5 w-5" aria-hidden />
            {isAr ? "المحادثات" : "Threads"}
          </h2>
          {threads.length === 0 ? (
            <div className="space-y-3 py-6 text-center">
              <p className="text-sm text-slate-500">
                {isAr ? "لا توجد محادثات بعد." : "No conversations yet."}
              </p>
              <button
                type="button"
                onClick={() => setComposeOpen(true)}
                disabled={!inquiryContext?.allowedInquiryTypes.length}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                aria-label={isAr ? "إرسال استفسار جديد" : "Send a new inquiry"}
              >
                <Plus className="h-4 w-4" aria-hidden />
                {isAr ? "إرسال استفسار جديد" : "Send a new inquiry"}
              </button>
              <Link
                href="/summer-training"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <Briefcase className="h-4 w-4" aria-hidden />
                {isAr ? "استعراض الفرص" : "Browse opportunities"}
              </Link>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-start text-xs text-slate-600">
                <p className="mb-1 flex items-center gap-1 font-bold text-slate-800">
                  <HelpCircle className="h-3.5 w-3.5" aria-hidden />
                  {isAr ? "مساعدة الاستخدام" : "How to use"}
                </p>
                <p>
                  {isAr
                    ? "يمكنك إرسال استفسار عام قبل التقديم، أو متابعة طلبك بعد التقديم عبر نفس المركز."
                    : "Send a general inquiry before applying, or follow up on your application after submission."}
                </p>
              </div>
            </div>
          ) : (
            <ul className="max-h-[60vh] space-y-1 overflow-y-auto">
              {threads.map((thread) => (
                <li key={thread.id}>
                  <button
                    type="button"
                    onClick={() => void openThread(thread)}
                    className={`w-full rounded-xl px-3 py-2 text-start text-sm transition ${
                      activeId === thread.id ? "bg-primary/10 font-bold text-primary" : "hover:bg-slate-50"
                    }`}
                    aria-label={thread.subject}
                  >
                    <span className="line-clamp-1 font-bold">{thread.subject}</span>
                    <span className="block text-xs text-slate-500">{thread.opportunityTitle}</span>
                    <span className="line-clamp-1 text-xs text-slate-400">{thread.lastMessagePreview}</span>
                    {thread.unreadCount > 0 ? (
                      <span className="mt-1 inline-block rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white">
                        {thread.unreadCount}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard className="min-h-[420px] flex-1">
          {!activeId ? (
            <div className="flex flex-col items-center gap-4">
              <PartnershipMessageCenterEmptyState isAr={isAr} />
              {threads.length === 0 ? (
                <button
                  type="button"
                  onClick={() => setComposeOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  {isAr ? "إرسال استفسار جديد" : "Send a new inquiry"}
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <div className="mb-4 max-h-[50vh] space-y-3 overflow-y-auto">
                {messages.map((msg) => (
                  <PartnershipMessageBubble
                    key={msg.id}
                    message={msg}
                    isAr={isAr}
                    align={msg.isMine ? "end" : "start"}
                    bubbleClassName={
                      msg.isMine ? "bg-primary/10 text-slate-900" : "bg-slate-100 text-slate-800"
                    }
                    onUpdated={(updated) =>
                      setMessages((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
                    }
                  />
                ))}
              </div>
              <div className="flex gap-2 border-t border-slate-100 pt-4">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={2}
                  className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder={isAr ? "اكتب ردك..." : "Write your reply..."}
                  aria-label={isAr ? "نص الرد" : "Reply text"}
                />
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={sending || !reply.trim()}
                  className="inline-flex items-center gap-1 self-end rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                  aria-label={isAr ? "إرسال" : "Send"}
                >
                  <Send className="h-4 w-4" aria-hidden />
                  {isAr ? "إرسال" : "Send"}
                </button>
              </div>
            </>
          )}
        </SectionCard>
      </div>

      {composeOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={isAr ? "رسالة جديدة" : "New message"}
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground">{isAr ? "رسالة جديدة" : "New message"}</h3>
              <button
                type="button"
                onClick={() => setComposeOpen(false)}
                className="rounded-lg p-1 hover:bg-slate-100"
                aria-label={isAr ? "إغلاق" : "Close"}
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <label className="mb-3 block text-sm">
              <span className="mb-1 block font-semibold">{isAr ? "نوع الرسالة" : "Message type"}</span>
              <select
                value={composeType}
                onChange={(e) => setComposeType(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              >
                <option value="">{isAr ? "اختر النوع" : "Select type"}</option>
                {(inquiryContext?.allowedInquiryTypes || []).map((type) => (
                  <option key={type} value={type}>
                    {inquiryLabel(type)}
                  </option>
                ))}
              </select>
            </label>
            {needsOpportunity ? (
              <label className="mb-3 block text-sm">
                <span className="mb-1 block font-semibold">{isAr ? "الفرصة" : "Opportunity"}</span>
                <select
                  value={composeOpportunityId}
                  onChange={(e) => setComposeOpportunityId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                >
                  <option value="">{isAr ? "اختر الفرصة" : "Select opportunity"}</option>
                  {(inquiryContext?.opportunities || []).map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.title}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {needsApplication ? (
              <label className="mb-3 block text-sm">
                <span className="mb-1 block font-semibold">{isAr ? "الطلب" : "Application"}</span>
                <select
                  value={composeApplicationId}
                  onChange={(e) => setComposeApplicationId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                >
                  <option value="">{isAr ? "اختر الطلب" : "Select application"}</option>
                  {(inquiryContext?.applications || []).map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.opportunityTitle}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="mb-4 block text-sm">
              <span className="mb-1 block font-semibold">{isAr ? "نص الرسالة" : "Message"}</span>
              <textarea
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                rows={5}
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
            <button
              type="button"
              onClick={() => void handleCompose()}
              disabled={composing || !composeType || !composeBody.trim()}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {composing ? (isAr ? "جاري الإرسال…" : "Sending…") : isAr ? "إرسال" : "Send"}
            </button>
          </div>
        </div>
      ) : null}
    </PageContainer>
  );
};

export default SummerTrainingMessagesPage;
