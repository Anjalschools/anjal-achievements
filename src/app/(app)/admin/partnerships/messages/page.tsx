"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import { getLocale } from "@/lib/i18n";
import {
  PARTNERSHIP_BULK_TARGETS,
  PARTNERSHIP_MESSAGE_TEMPLATE_LABELS,
  PARTNERSHIP_MESSAGE_TEMPLATES,
} from "@/lib/partnerships/partnerships-messaging-constants";
import { Loader2, Mail, Send, Users } from "lucide-react";
import PartnershipMessageBubble, {
  type PartnershipMessageBubbleRow,
} from "@/components/partnerships/PartnershipMessageBubble";
import PartnershipMessageCenterEmptyState from "@/components/partnerships/PartnershipMessageCenterEmptyState";

type ThreadRow = {
  id: string;
  applicationId: string;
  opportunityTitle: string;
  studentName: string;
  subject: string;
  lastMessagePreview: string;
  lastMessageAt: string | null;
  unreadCount: number;
};

type MessageRow = PartnershipMessageBubbleRow;

type OpportunityOption = { id: string; title: string };

const PartnershipsMessagesAdminPage = () => {
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
  const [templateKey, setTemplateKey] = useState<string>("");
  const [opportunities, setOpportunities] = useState<OpportunityOption[]>([]);
  const [bulkOpportunityId, setBulkOpportunityId] = useState("");
  const [bulkTarget, setBulkTarget] = useState<string>("accepted");
  const [bulkTemplate, setBulkTemplate] = useState<string>("interview_invite");
  const [bulkSending, setBulkSending] = useState(false);

  const templateOptions = useMemo(
    () =>
      PARTNERSHIP_MESSAGE_TEMPLATES.map((key) => ({
        value: key,
        label: PARTNERSHIP_MESSAGE_TEMPLATE_LABELS[key][isAr ? "ar" : "en"],
      })),
    [isAr]
  );

  const loadThreads = useCallback(async () => {
    const res = await fetch("/api/partnerships/messages", { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (res.ok && Array.isArray(json.items)) setThreads(json.items);
    else setThreads([]);
  }, []);

  const loadOpportunities = useCallback(async () => {
    const res = await fetch("/api/partnerships/opportunities", { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (res.ok && Array.isArray(json.items)) {
      const rows = json.items.map((row: { id: string; title: string }) => ({
        id: row.id,
        title: row.title,
      }));
      setOpportunities(rows);
      if (rows[0]?.id) setBulkOpportunityId(rows[0].id);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await Promise.all([loadThreads(), loadOpportunities()]);
      } finally {
        setLoading(false);
      }
    })();
  }, [loadThreads, loadOpportunities]);

  const openThread = async (thread: ThreadRow) => {
    setActiveId(thread.id);
    setActiveApplicationId(thread.applicationId);
    setError(null);
    const res = await fetch(`/api/partnerships/messages?threadId=${encodeURIComponent(thread.id)}`, {
      cache: "no-store",
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && Array.isArray(json.items)) setMessages(json.items);
    else setMessages([]);
    void loadThreads();
  };

  const handleSend = async () => {
    if (!activeApplicationId) return;
    const body = reply.trim();
    if (!body && !templateKey) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/partnerships/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: activeApplicationId,
          body: body || undefined,
          templateKey: templateKey || undefined,
          locale,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setReply("");
      setTemplateKey("");
      const thread = threads.find((row) => row.id === activeId);
      if (thread) await openThread(thread);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSending(false);
    }
  };

  const handleBulkSend = async () => {
    if (!bulkOpportunityId || !bulkTemplate) return;
    if (!window.confirm(isAr ? "إرسال رسالة جماعية؟" : "Send bulk message?")) return;
    setBulkSending(true);
    setError(null);
    try {
      const res = await fetch("/api/partnerships/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opportunityId: bulkOpportunityId,
          bulkTarget,
          templateKey: bulkTemplate,
          locale,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      alert(isAr ? `تم الإرسال إلى ${json.count} طالب` : `Sent to ${json.count} students`);
      await loadThreads();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBulkSending(false);
    }
  };

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
      <PageHeader
        title={isAr ? "مركز رسائل الشراكات" : "Partnerships message center"}
        subtitle={
          isAr
            ? "مراسلة الطلاب وإرسال قوالب جاهزة ورسائل جماعية."
            : "Message students with templates and bulk sends."
        }
      />

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      <SectionCard className="mb-6">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-black text-slate-900">
          <Users className="h-5 w-5" aria-hidden />
          {isAr ? "رسائل جماعية" : "Bulk messages"}
        </h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="font-bold">{isAr ? "الفرصة" : "Opportunity"}</span>
            <select
              value={bulkOpportunityId}
              onChange={(e) => setBulkOpportunityId(e.target.value)}
              className="mt-1 block rounded-xl border border-slate-200 px-3 py-2"
            >
              {opportunities.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.title}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="font-bold">{isAr ? "المجموعة" : "Target"}</span>
            <select
              value={bulkTarget}
              onChange={(e) => setBulkTarget(e.target.value)}
              className="mt-1 block rounded-xl border border-slate-200 px-3 py-2"
            >
              {PARTNERSHIP_BULK_TARGETS.map((value) => (
                <option key={value} value={value}>
                  {value === "accepted"
                    ? isAr
                      ? "المقبولين"
                      : "Accepted"
                    : value === "rejected"
                      ? isAr
                        ? "المرفوضين"
                        : "Rejected"
                      : isAr
                        ? "بانتظار المقابلة"
                        : "Awaiting interview"}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="font-bold">{isAr ? "القالب" : "Template"}</span>
            <select
              value={bulkTemplate}
              onChange={(e) => setBulkTemplate(e.target.value)}
              className="mt-1 block rounded-xl border border-slate-200 px-3 py-2"
            >
              {templateOptions.map((row) => (
                <option key={row.value} value={row.value}>
                  {row.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void handleBulkSend()}
            disabled={bulkSending}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {bulkSending ? (isAr ? "جاري الإرسال..." : "Sending...") : isAr ? "إرسال جماعي" : "Send bulk"}
          </button>
        </div>
      </SectionCard>

      <div className="flex min-h-[min(70vh,640px)] flex-col gap-4 lg:flex-row">
        <SectionCard className="w-full shrink-0 lg:w-80">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-black text-slate-900">
            <Mail className="h-5 w-5" aria-hidden />
            {isAr ? "المحادثات" : "Threads"}
          </h2>
          {threads.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              {isAr ? "لا توجد محادثات." : "No threads yet."}
            </p>
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
                  >
                    <span className="line-clamp-1 font-bold">{thread.studentName || thread.subject}</span>
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
            <PartnershipMessageCenterEmptyState isAr={isAr} />
          ) : (
            <>
              <div className="mb-3">
                <label className="text-sm font-bold text-slate-700">
                  {isAr ? "قالب رسالة" : "Message template"}
                </label>
                <select
                  value={templateKey}
                  onChange={(e) => setTemplateKey(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">{isAr ? "بدون قالب" : "No template"}</option>
                  {templateOptions.map((row) => (
                    <option key={row.value} value={row.value}>
                      {row.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4 max-h-[45vh] space-y-3 overflow-y-auto">
                {messages.map((msg) => (
                  <PartnershipMessageBubble
                    key={msg.id}
                    message={msg}
                    isAr={isAr}
                    align={msg.senderRole === "supervisor" ? "end" : "start"}
                    bubbleClassName={
                      msg.senderRole === "supervisor" ? "bg-primary/10" : "bg-slate-100"
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
                  placeholder={isAr ? "نص الرسالة (اختياري مع القالب)" : "Message text (optional with template)"}
                />
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={sending || (!reply.trim() && !templateKey)}
                  className="inline-flex items-center gap-1 self-end rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                >
                  <Send className="h-4 w-4" aria-hidden />
                  {isAr ? "إرسال" : "Send"}
                </button>
              </div>
            </>
          )}
        </SectionCard>
      </div>
    </PageContainer>
  );
};

export default PartnershipsMessagesAdminPage;
