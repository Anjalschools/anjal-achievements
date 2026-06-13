"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import { getLocale } from "@/lib/i18n";
import { statusBadgeTheme, statusLabelUi } from "@/lib/audit-log-display";
import type { AuditDisplayStatus } from "@/lib/audit-log-display";
import { ArrowLeft, Loader2, Search } from "lucide-react";

type AuditRow = {
  _id?: string;
  actionType?: string;
  entityType?: string;
  entityTitle?: string;
  actorName?: string;
  actorEmail?: string;
  createdAt?: string;
  _ui?: {
    label?: string;
    description?: string;
    status?: AuditDisplayStatus;
  };
};

const GROUPS = [
  { id: "all", ar: "الكل", en: "All" },
  { id: "approvals", ar: "الاعتمادات", en: "Approvals" },
  { id: "rejections", ar: "الرفض", en: "Rejections" },
  { id: "messages", ar: "الرسائل", en: "Messages" },
  { id: "certificates", ar: "الشهادات", en: "Certificates" },
  { id: "achievements", ar: "الإنجازات", en: "Achievements" },
];

const PartnershipsAuditPage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AuditRow[]>([]);
  const [group, setGroup] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "30", group });
      if (search.trim()) params.set("search", search.trim());
      params.set("lang", isAr ? "ar" : "en");
      const res = await fetch(`/api/admin/partnerships/audit?${params.toString()}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setItems(Array.isArray(json.items) ? json.items : []);
      setTotalPages(Number(json.totalPages) || 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [group, page, search, isAr]);

  useEffect(() => {
    load();
  }, [load]);

  const formatDate = (value?: string) => {
    if (!value) return "—";
    try {
      return new Date(value).toLocaleString(isAr ? "ar-SA" : "en-US");
    } catch {
      return value;
    }
  };

  return (
    <PageContainer>
      <div className="mb-4">
        <Link href="/admin/partnerships/settings" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {isAr ? "العودة للإعدادات" : "Back to settings"}
        </Link>
      </div>

      <PageHeader
        title={isAr ? "مستكشف التدقيق" : "Audit explorer"}
        subtitle={isAr ? "سجل عمليات برنامج التدريب والشراكات" : "Partnership program audit trail"}
      />

      <SectionCard className="mb-4">
        <div className="flex flex-wrap gap-2">
          {GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => {
                setGroup(g.id);
                setPage(1);
              }}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold ${
                group === g.id ? "bg-primary text-white" : "bg-muted text-foreground"
              }`}
            >
              {isAr ? g.ar : g.en}
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isAr ? "بحث…" : "Search…"}
            className="flex-1 rounded-xl border border-border px-3 py-2 text-sm"
            aria-label={isAr ? "بحث" : "Search"}
          />
          <button
            type="button"
            onClick={() => {
              setPage(1);
              load();
            }}
            className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-sm font-semibold"
          >
            <Search className="h-4 w-4" aria-hidden />
            {isAr ? "بحث" : "Search"}
          </button>
        </div>
      </SectionCard>

      <SectionCard>
        {loading ? (
          <div className="flex items-center gap-2 py-10 text-text-light">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            <span>{isAr ? "جاري التحميل…" : "Loading…"}</span>
          </div>
        ) : error ? (
          <p className="py-8 text-center text-red-600">{error}</p>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-text-light">{isAr ? "لا توجد سجلات." : "No records."}</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {items.map((row) => {
              const status = row._ui?.status || "unknown";
              const theme = statusBadgeTheme(status);
              return (
                <li key={String(row._id)} className="py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-foreground">{row._ui?.label || row.actionType}</p>
                      <p className="text-sm text-text-light">{row._ui?.description || row.entityTitle || "—"}</p>
                      <p className="mt-1 text-xs text-text-light">
                        {row.actorName || row.actorEmail || "—"} · {row.entityType} · {formatDate(row.createdAt)}
                      </p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${theme.className}`}>
                      {statusLabelUi(status, isAr)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-4 flex items-center justify-between text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-border px-3 py-1 disabled:opacity-50"
          >
            {isAr ? "السابق" : "Previous"}
          </button>
          <span>
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-border px-3 py-1 disabled:opacity-50"
          >
            {isAr ? "التالي" : "Next"}
          </button>
        </div>
      </SectionCard>
    </PageContainer>
  );
};

export default PartnershipsAuditPage;
