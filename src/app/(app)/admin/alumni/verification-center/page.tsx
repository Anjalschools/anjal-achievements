"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import { getLocale } from "@/lib/i18n";
import { getAlumniVerificationChannel } from "@/lib/alumni/alumni-verification-ui";
import { getVerificationTicketStatusLabel, normalizeVerificationStatus } from "@/lib/alumni/normalizeVerificationStatus";
import { getVerificationSourceLabel } from "@/lib/alumni/verification-source-label";

type VerificationStatus = "pending" | "approved" | "rejected";

type ListItem = {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  requestedLevel: string;
  status: VerificationStatus;
  attachments: Array<{ type: string; url: string; label?: string }>;
  aiValidationScore?: number;
  aiNotes?: string;
  reviewerNotes?: string;
  createdAt?: string | Date;
  currentTier: string | null;
  isVerifiedAlumni: boolean;
  /** Row synthesized from verified User profile with no AlumniVerificationRequest document */
  isProfileOnly?: boolean;
  /** Stored on User.alumniProfile when available */
  verificationSource?: string | null;
};

const verificationChannelBadge = (
  row: ListItem,
  isAr: boolean
): { key: string; className: string; label: string } => {
  const ch = getAlumniVerificationChannel(row);
  if (ch === "request") {
    return {
      key: "req",
      className: "bg-sky-100 text-sky-900 ring-sky-200",
      label: isAr ? "موثّق عبر طلب" : "Verified via request",
    };
  }
  if (ch === "manual") {
    return {
      key: "man",
      className: "bg-violet-100 text-violet-900 ring-violet-200",
      label: isAr ? "موثّق يدويًا من الإدارة" : "Manual admin verification",
    };
  }
  return {
    key: "auto",
    className: "bg-emerald-100 text-emerald-900 ring-emerald-200",
    label: isAr ? "موثّق تلقائيًا" : "Auto / non-ticket verification",
  };
};

const tierLabel = (code: string, isAr: boolean): string => {
  const map: Record<string, { ar: string; en: string }> = {
    basic: { ar: "موثّق أساسي", en: "Basic verified" },
    academic: { ar: "أكاديمي", en: "Academic verified" },
    career: { ar: "مهني", en: "Career verified" },
    institution: { ar: "مؤسسي", en: "Institution verified" },
    global: { ar: "عالمي", en: "Global verified" },
  };
  const row = map[code];
  if (!row) return code;
  return isAr ? row.ar : row.en;
};

const VerificationCenterPage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | VerificationStatus>("pending");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<ListItem[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [selected, setSelected] = useState<ListItem | null>(null);
  const [reviewerNotes, setReviewerNotes] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/user/profile", { cache: "no-store" });
        if (!res.ok) return setAllowed(false);
        const json = (await res.json()) as { role?: string };
        setAllowed(String(json.role || "") === "admin");
      } catch {
        setAllowed(false);
      }
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams();
      if (statusFilter !== "all") sp.set("status", statusFilter);
      if (q.trim()) sp.set("q", q.trim());
      sp.set("page", "1");
      sp.set("limit", "30");
      const response = await fetch(`/api/admin/alumni/verification-requests?${sp.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });
      const json = (await response.json()) as {
        ok?: boolean;
        success?: boolean;
        items?: ListItem[];
        pendingCount?: number;
        count?: number;
        error?: string;
      };
      if (!response.ok) throw new Error(json.error || "Failed");
      setItems(Array.isArray(json.items) ? json.items : []);
      setPendingCount(Number(json.pendingCount ?? 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [q, statusFilter]);

  useEffect(() => {
    if (allowed !== true) return;
    void load();
  }, [allowed, load]);

  const title = isAr ? "مركز توثيق الخريجين" : "Alumni verification center";
  const subtitle = isAr
    ? "مراجعة المستندات وترقية مستويات التوثيق بأمان."
    : "Review evidence and upgrade verification tiers safely.";

  const stats = useMemo(
    () => ({
      shown: items.length,
      pendingQueue: pendingCount,
    }),
    [items.length, pendingCount]
  );

  const detailChannel = selected ? verificationChannelBadge(selected, isAr) : null;

  const handleDecision = async (status: "approved" | "rejected") => {
    if (!selected || selected.isProfileOnly) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/alumni/verification-requests/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reviewerNotes }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed");
      setSelected(null);
      setReviewerNotes("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  if (allowed === null) {
    return (
      <PageContainer>
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
        </div>
      </PageContainer>
    );
  }

  if (!allowed) {
    return (
      <PageContainer>
        <p className="text-sm text-red-600">{isAr ? "غير مصرّح" : "Unauthorized"}</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title={title} subtitle={subtitle} />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {(["pending", "all", "approved", "rejected"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key === "all" ? "all" : key)}
              className={`rounded-full px-3 py-1 text-sm ring-1 transition ${
                (key === "all" && statusFilter === "all") || statusFilter === key
                  ? "bg-primary text-primary-foreground ring-primary"
                  : "bg-white text-text ring-gray-200 hover:bg-gray-50"
              }`}
            >
              {key === "pending"
                ? isAr
                  ? `قيد المراجعة (${stats.pendingQueue})`
                  : `Pending (${stats.pendingQueue})`
                : key === "all"
                  ? isAr
                    ? "الكل"
                    : "All"
                  : key === "approved"
                    ? isAr
                      ? "معتمد"
                      : "Approved"
                    : isAr
                      ? "مرفوض"
                      : "Rejected"}
            </button>
          ))}
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={
            isAr
              ? "بحث: الاسم (عربي/إنجليزي)، البريد، اسم المستخدم، الجامعة، سنة التخرج…"
              : "Search: name (AR/EN), email, username, university, graduation year…"
          }
          className="w-full max-w-md rounded-lg border border-gray-200 px-3 py-2 text-sm sm:w-72"
        />
      </div>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm ring-1 ring-gray-100">
          <h2 className="mb-3 text-sm font-semibold text-text">
            {isAr ? "الطلبات" : "Requests"} ({stats.shown})
          </h2>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{isAr ? "لا توجد نتائج." : "No rows."}</p>
          ) : (
            <ul className="max-h-[480px] space-y-2 overflow-y-auto pe-1">
              {items.map((row) => {
                const vch = verificationChannelBadge(row, isAr);
                return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(row);
                      setReviewerNotes(row.reviewerNotes || "");
                    }}
                    className={`w-full rounded-lg border px-3 py-2 text-start text-sm transition ${
                      selected?.id === row.id
                        ? "border-primary bg-primary/5"
                        : "border-gray-100 bg-gray-50/80 hover:bg-gray-50"
                    }`}
                  >
                    <div className="font-medium text-text">{row.fullName || row.email}</div>
                    <div className="text-xs text-muted-foreground">
                      <span className={`me-1 inline-block rounded px-1.5 py-0.5 font-semibold ring-1 ${vch.className}`}>
                        {vch.label}
                      </span>
                      {row.isProfileOnly ? (
                        <span className="me-1 rounded bg-slate-200 px-1.5 py-0.5 font-semibold text-slate-800 ring-1 ring-slate-300">
                          {isAr ? "بدون تذكرة" : "No ticket"}
                        </span>
                      ) : null}
                      {tierLabel(row.requestedLevel, isAr)} ·{" "}
                      {getVerificationTicketStatusLabel(row.status, isAr ? "ar" : "en")}
                      {typeof row.aiValidationScore === "number" ? ` · AI ${Math.round(row.aiValidationScore * 100)}%` : ""}
                    </div>
                  </button>
                </li>
              );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm ring-1 ring-gray-100">
          {!selected ? (
            <p className="text-sm text-muted-foreground">{isAr ? "اختر طلبًا للعرض." : "Select a request."}</p>
          ) : (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-text">{selected.fullName}</h2>
                <p className="text-sm text-muted-foreground">{selected.email}</p>
                <p className="mt-2 text-sm">
                  {isAr ? "المستوى المطلوب:" : "Requested level:"}{" "}
                  <span className="font-medium">{tierLabel(selected.requestedLevel, isAr)}</span>
                </p>
                {detailChannel ? (
                  <p className="mt-1 flex flex-wrap gap-1.5 text-xs">
                    <span className={`rounded px-2 py-0.5 font-semibold ring-1 ${detailChannel.className}`}>
                      {detailChannel.label}
                    </span>
                    {selected.verificationSource ? (
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 ring-1 ring-slate-200">
                        {getVerificationSourceLabel(selected.verificationSource, isAr ? "ar" : "en")}
                      </span>
                    ) : null}
                  </p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  {isAr ? "الحالة الحالية:" : "Current profile:"}{" "}
                  {selected.isVerifiedAlumni ? (isAr ? "موثّق" : "Verified") : isAr ? "غير موثّق" : "Not verified"}
                  {selected.currentTier ? ` · ${tierLabel(selected.currentTier, isAr)}` : ""}
                </p>
              </div>

              {typeof selected.aiValidationScore === "number" ? (
                <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-100">
                  <strong>{isAr ? "مساعد التحقق (قواعد):" : "AI assist (rules):"}</strong>{" "}
                  {Math.round(selected.aiValidationScore * 100)}%
                  {selected.aiNotes ? ` — ${selected.aiNotes}` : ""}
                </div>
              ) : null}

              <div>
                <h3 className="mb-2 text-sm font-semibold">{isAr ? "المستندات" : "Attachments"}</h3>
                {selected.attachments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{isAr ? "لا مرفقات في هذا السجل." : "No attachments."}</p>
                ) : (
                  <ul className="space-y-2">
                    {selected.attachments.map((a, i) => (
                      <li key={`${a.url}-${i}`}>
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
                        >
                          {a.type}
                          {a.label ? ` — ${a.label}` : ""}
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <label className="block text-sm">
                <span className="font-medium text-text">{isAr ? "ملاحظات المراجع" : "Reviewer notes"}</span>
                <textarea
                  value={reviewerNotes}
                  onChange={(e) => setReviewerNotes(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </label>

              {selected.isProfileOnly ? (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-100">
                  {isAr
                    ? "هذا السجل موثّق إداريًا دون طلب رسمي في النظام — لا يتطلب اعتمادًا من هذه القائمة."
                    : "This record is verified administratively without a formal ticket — no action needed here."}
                </p>
              ) : null}

              {!selected.isProfileOnly && normalizeVerificationStatus(selected.status) === "pending" ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleDecision("approved")}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {saving ? <Loader2 className="inline h-4 w-4 animate-spin" /> : isAr ? "اعتماد" : "Approve"}
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleDecision("rejected")}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {isAr ? "رفض" : "Reject"}
                  </button>
                </div>
              ) : !selected.isProfileOnly ? (
                <p className="text-sm text-muted-foreground">
                  {isAr ? "تمت معالجة هذا الطلب." : "This request was already processed."}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
};

export default VerificationCenterPage;
