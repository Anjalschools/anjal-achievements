"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import { getLocale } from "@/lib/i18n";
import { Loader2, Mail, MessageSquare, Archive, Clock3, Copy, Send } from "lucide-react";

type MessageStatus = "new" | "in_progress" | "replied" | "archived";
type InquiryType = "general" | "achievements" | "activities" | "judging" | "technical";

type ContactRow = {
  _id: string;
  fullName: string;
  phone: string;
  email: string;
  subject: string;
  inquiryType: InquiryType;
  message: string;
  status: MessageStatus;
  assignedRole?: string;
  createdAt: string;
};

const statusTabs: Array<{ id: "all" | MessageStatus; ar: string; en: string }> = [
  { id: "all", ar: "الكل", en: "All" },
  { id: "new", ar: "جديدة", en: "New" },
  { id: "in_progress", ar: "قيد المعالجة", en: "In progress" },
  { id: "replied", ar: "تم الرد", en: "Replied" },
  { id: "archived", ar: "مؤرشفة", en: "Archived" },
];

const inquiryLabel = (type: InquiryType, isAr: boolean): string => {
  const map: Record<InquiryType, { ar: string; en: string }> = {
    general: { ar: "عام", en: "General" },
    achievements: { ar: "الإنجازات", en: "Achievements" },
    activities: { ar: "الأنشطة", en: "Activities" },
    judging: { ar: "التحكيم", en: "Judging" },
    technical: { ar: "تقني", en: "Technical" },
  };
  return map[type][isAr ? "ar" : "en"];
};

const ContactMessagesAdminPage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ContactRow[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | MessageStatus>("all");
  const [searchQ, setSearchQ] = useState("");
  const [selected, setSelected] = useState<ContactRow | null>(null);
  const [replyText, setReplyText] = useState("");
  const [kpis, setKpis] = useState({
    total: 0,
    newCount: 0,
    inProgressCount: 0,
    repliedCount: 0,
    archivedCount: 0,
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        status: activeTab,
        q: searchQ.trim(),
        limit: "40",
      });
      const res = await fetch(`/api/admin/contact-messages?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setError(isAr ? "لا يمكن تحميل الرسائل حاليًا." : "Failed to load messages.");
        setRows([]);
        return;
      }
      const json = (await res.json()) as {
        items: ContactRow[];
        kpis: typeof kpis;
      };
      setRows(json.items || []);
      setKpis(
        json.kpis || {
          total: 0,
          newCount: 0,
          inProgressCount: 0,
          repliedCount: 0,
          archivedCount: 0,
        }
      );
      if (selected) {
        const fresh = (json.items || []).find((x) => x._id === selected._id) || null;
        setSelected(fresh);
      }
    } catch {
      setError(isAr ? "حدث خطأ أثناء تحميل الرسائل." : "Error loading messages.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, isAr, searchQ, selected]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const showToast = (kind: "ok" | "err", text: string) => setToast({ kind, text });

  const handlePatchMessage = async (payload: Record<string, string>) => {
    if (!selected?._id) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/contact-messages/${selected._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || j.ok === false) {
        showToast("err", (j.error || "").trim() || (isAr ? "فشل تحديث الرسالة." : "Failed to update message."));
        return;
      }
      await fetchRows();
      if (payload.reply) setReplyText("");
      showToast("ok", isAr ? "تم التحديث بنجاح" : "Updated successfully");
    } finally {
      setSaving(false);
    }
  };

  const stats = useMemo(
    () => [
      { id: "total", val: kpis.total, label: isAr ? "إجمالي الرسائل" : "Total", icon: Mail },
      { id: "new", val: kpis.newCount, label: isAr ? "جديدة" : "New", icon: MessageSquare },
      { id: "progress", val: kpis.inProgressCount, label: isAr ? "قيد المعالجة" : "In progress", icon: Clock3 },
      { id: "archived", val: kpis.archivedCount, label: isAr ? "مؤرشفة" : "Archived", icon: Archive },
    ],
    [isAr, kpis]
  );

  return (
    <PageContainer>
      <PageHeader
        title={isAr ? "مركز الرسائل والتواصل" : "Contact messages center"}
        subtitle={isAr ? "إدارة رسائل اتصل بنا حسب الدور والنطاق." : "Manage contact messages by role and scope."}
      />
      {toast ? (
        <div
          className={`mb-4 rounded-xl border px-4 py-3 text-sm font-semibold ${
            toast.kind === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
          role="status"
          aria-live="polite"
        >
          {toast.text}
        </div>
      ) : null}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-text-light">{s.label}</p>
                <Icon className="h-4 w-4 text-primary" aria-hidden />
              </div>
              <p className="text-3xl font-black text-text">{s.val}</p>
            </div>
          );
        })}
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {statusTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                activeTab === tab.id ? "bg-primary text-white" : "bg-gray-100 text-text"
              }`}
            >
              {isAr ? tab.ar : tab.en}
            </button>
          ))}
        </div>
        <input
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder={isAr ? "بحث بالاسم/البريد/العنوان..." : "Search by name/email/subject..."}
          className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-primary sm:max-w-xs"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          {loading ? (
            <div className="flex min-h-56 items-center justify-center text-text-light">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : error ? (
            <p className="p-5 text-sm text-rose-600">{error}</p>
          ) : rows.length === 0 ? (
            <p className="p-5 text-sm text-text-light">
              {isAr ? "لا توجد رسائل ضمن هذا الفلتر." : "No messages for current filter."}
            </p>
          ) : (
            <div className="max-h-[70vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50">
                  <tr className="text-right">
                    <th className="px-3 py-2 font-semibold">{isAr ? "الاسم" : "Name"}</th>
                    <th className="px-3 py-2 font-semibold">{isAr ? "النوع" : "Type"}</th>
                    <th className="px-3 py-2 font-semibold">{isAr ? "العنوان" : "Subject"}</th>
                    <th className="px-3 py-2 font-semibold">{isAr ? "الحالة" : "Status"}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row._id}
                      className={`cursor-pointer border-t border-gray-100 transition hover:bg-gray-50 ${
                        selected?._id === row._id ? "bg-primary/5" : ""
                      }`}
                      onClick={() => setSelected(row)}
                    >
                      <td className="px-3 py-2">{row.fullName}</td>
                      <td className="px-3 py-2">{inquiryLabel(row.inquiryType, isAr)}</td>
                      <td className="px-3 py-2">{row.subject}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            row.status === "replied"
                              ? "bg-emerald-100 text-emerald-900"
                              : row.status === "in_progress"
                                ? "bg-amber-100 text-amber-900"
                                : row.status === "archived"
                                  ? "bg-gray-200 text-gray-700"
                                  : "bg-sky-100 text-sky-900"
                          }`}
                        >
                          {row.status === "in_progress"
                            ? isAr
                              ? "قيد المعالجة"
                              : "Processing"
                            : row.status === "replied"
                              ? isAr
                                ? "تم الرد"
                                : "Replied"
                              : row.status === "archived"
                                ? isAr
                                  ? "مؤرشفة"
                                  : "Archived"
                                : isAr
                                  ? "جديدة"
                                  : "New"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          {!selected ? (
            <p className="text-sm text-text-light">
              {isAr ? "اختر رسالة من القائمة لعرض التفاصيل." : "Select a message to see details."}
            </p>
          ) : (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-text">{selected.subject}</h3>
              <div className="space-y-1 text-sm">
                <p><strong>{isAr ? "الاسم:" : "Name:"}</strong> {selected.fullName}</p>
                <p className="flex items-center gap-2">
                  <strong>{isAr ? "البريد:" : "Email:"}</strong> {selected.email}
                  <button
                    type="button"
                    className="text-primary"
                    onClick={() => navigator.clipboard.writeText(selected.email)}
                    aria-label={isAr ? "نسخ البريد" : "Copy email"}
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </p>
                <p className="flex items-center gap-2">
                  <strong>{isAr ? "الجوال:" : "Phone:"}</strong> {selected.phone}
                  <button
                    type="button"
                    className="text-primary"
                    onClick={() => navigator.clipboard.writeText(selected.phone)}
                    aria-label={isAr ? "نسخ الجوال" : "Copy phone"}
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </p>
                <p><strong>{isAr ? "النوع:" : "Type:"}</strong> {inquiryLabel(selected.inquiryType, isAr)}</p>
              </div>

              <div className="rounded-lg bg-gray-50 p-3 text-sm leading-relaxed text-text">{selected.message}</div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handlePatchMessage({ status: "processing" })}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  {isAr ? "قيد المعالجة" : "Set in progress"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handlePatchMessage({ status: "archived" })}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  {isAr ? "أرشفة" : "Archive"}
                </button>
              </div>

              <input
                value={selected.assignedRole || ""}
                onChange={(e) => setSelected({ ...selected, assignedRole: e.target.value })}
                placeholder={isAr ? "الجهة المسندة (مثال: فريق الدعم)" : "Assigned to (e.g. support team)"}
                className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-primary"
              />
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  void handlePatchMessage({
                    assignedTo: selected.assignedRole || "",
                  })
                }
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                {isAr ? "حفظ الإسناد" : "Save assignment"}
              </button>

              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={4}
                placeholder={isAr ? "اكتب ردًا احترافيًا..." : "Write a professional reply..."}
                className="w-full rounded-lg border border-gray-300 p-3 text-sm outline-none focus:border-primary"
              />
              <button
                type="button"
                disabled={saving || !replyText.trim()}
                onClick={() => {
                  const reply = replyText.trim();
                  if (!reply) {
                    showToast("err", isAr ? "اكتب الرد قبل الإرسال." : "Enter a reply before sending.");
                    return;
                  }
                  void handlePatchMessage({ reply, status: "replied", assignedTo: selected.assignedRole || "" });
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {isAr ? "إرسال الرد وتحديث الحالة" : "Send reply and update status"}
              </button>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
};

export default ContactMessagesAdminPage;
