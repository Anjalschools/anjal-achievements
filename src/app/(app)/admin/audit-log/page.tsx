"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PageContainer from "@/components/layout/PageContainer";
import { getLocale } from "@/lib/i18n";
import {
  Loader2,
  X,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  Globe,
} from "lucide-react";
import type { AuditOperationFilter, AuditUiAugment } from "@/lib/audit-log-display";
import { platformLabel, statusBadgeTheme } from "@/lib/audit-log-display";

type UiRow = Record<string, unknown> & { _ui: AuditUiAugment };

const OPERATION_TYPES: { id: AuditOperationFilter; ar: string; en: string }[] = [
  { id: "all", ar: "الكل", en: "All" },
  { id: "news", ar: "الأخبار", en: "News" },
  { id: "ai", ar: "الذكاء الاصطناعي", en: "AI" },
  { id: "publishing", ar: "النشر", en: "Publishing" },
  { id: "settings", ar: "الإعدادات", en: "Settings" },
  { id: "users", ar: "المستخدمون", en: "Users" },
];

const STATUS_FILTERS: { id: ""; v: string; ar: string; en: string }[] = [
  { id: "", v: "", ar: "الكل", en: "All" },
  { id: "", v: "success", ar: "نجاح", en: "Success" },
  { id: "", v: "failure", ar: "فشل", en: "Failed" },
  { id: "", v: "blocked", ar: "تم المنع", en: "Blocked" },
];

const PLATFORM_FILTERS: { id: string; ar: string; en: string }[] = [
  { id: "", ar: "كل المنصات", en: "All platforms" },
  { id: "website", ar: "الموقع", en: "Website" },
  { id: "instagram", ar: "Instagram", en: "Instagram" },
  { id: "x", ar: "X", en: "X" },
  { id: "tiktok", ar: "TikTok", en: "TikTok" },
];

const LIMIT = 30;

const FormattedValue = ({ v, depth = 0 }: { v: unknown; depth?: number }) => {
  if (depth > 8) return <span className="text-text-light">…</span>;
  if (v === null || v === undefined)
    return <span className="text-text-light">—</span>;
  if (typeof v === "boolean")
    return <span className="font-mono text-xs">{v ? "true" : "false"}</span>;
  if (typeof v === "number") return <span className="font-mono text-xs">{v}</span>;
  if (typeof v === "string")
    return (
      <span className="whitespace-pre-wrap break-words text-sm leading-relaxed">
        {v.length > 4000 ? `${v.slice(0, 4000)}…` : v}
      </span>
    );
  if (Array.isArray(v)) {
    if (v.length === 0) return <span className="text-text-light">[]</span>;
    return (
      <ul className="list-disc space-y-2 ps-4">
        {v.slice(0, 80).map((item, i) => (
          <li key={i}>
            <FormattedValue v={item} depth={depth + 1} />
          </li>
        ))}
        {v.length > 80 ? (
          <li className="list-none text-text-light">+{v.length - 80} …</li>
        ) : null}
      </ul>
    );
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    const keys = Object.keys(o);
    if (keys.length === 0) return <span className="text-text-light">{"{}"}</span>;
    return (
      <div className="space-y-2 border-s-2 border-gray-200 ps-3">
        {keys.map((k) => (
          <div key={k}>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">{k}</p>
            <div className="mt-1">
              <FormattedValue v={o[k]} depth={depth + 1} />
            </div>
          </div>
        ))}
      </div>
    );
  }
  return <span className="text-sm">{String(v)}</span>;
};

const PlatformBadges = ({ keys, isAr }: { keys: string[]; isAr: boolean }) => {
  if (!keys.length) return <span className="text-text-light">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {keys.map((k) => (
        <span
          key={k}
          className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-text ring-1 ring-gray-200"
        >
          <Globe className="h-3 w-3 opacity-70" aria-hidden />
          {platformLabel(k, isAr)}
        </span>
      ))}
    </div>
  );
};

const pickAiKeys = (meta: Record<string, unknown> | undefined): string[] => {
  if (!meta) return [];
  return Object.keys(meta).filter((k) =>
    /^(ai|prompt|completion|model|tokens|input|output)/i.test(k)
  );
};

const AdminAuditLogPage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const L = useCallback((ar: string, en: string) => (isAr ? ar : en), [isAr]);

  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [items, setItems] = useState<UiRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<UiRow | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const [opType, setOpType] = useState<AuditOperationFilter>("all");
  const [status, setStatus] = useState("");
  const [platform, setPlatform] = useState("");
  const [actorEmail, setActorEmail] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchApplied, setSearchApplied] = useState("");

  const [stats, setStats] = useState({
    total: 0,
    todayCount: 0,
    newsCount: 0,
    publishingCount: 0,
    failedCount: 0,
    aiCount: 0,
  });

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const p = new URLSearchParams();
      if (from) p.set("from", from);
      if (to) p.set("to", to);
      const res = await fetch(`/api/admin/audit-logs/stats?${p}`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.stats) setStats(data.stats);
    } finally {
      setStatsLoading(false);
    }
  }, [from, to]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      p.set("page", String(page));
      p.set("limit", String(LIMIT));
      p.set("lang", isAr ? "ar" : "en");
      if (opType !== "all") p.set("type", opType);
      if (status) p.set("status", status);
      if (platform) p.set("platform", platform);
      if (actorEmail.trim()) p.set("actorEmail", actorEmail.trim());
      if (from) p.set("from", from);
      if (to) p.set("to", to);
      if (searchApplied.trim()) p.set("search", searchApplied.trim());

      const res = await fetch(`/api/admin/audit-logs?${p}`, { cache: "no-store" });
      const data = await res.json();
      const rows = (data.data || data.items || []) as UiRow[];
      setItems(rows);
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  }, [page, opType, status, platform, actorEmail, from, to, searchApplied, isAr]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const kpi = (label: string, value: number) => (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-text-light">{label}</p>
      <p className="mt-2 text-2xl font-black text-primary">{statsLoading ? "—" : value}</p>
    </div>
  );

  const rowHighlight = (row: UiRow): string => {
    const s = row._ui?.displayStatus;
    if (s === "failure") return "bg-red-50/90";
    if (s === "blocked") return "bg-amber-50/80";
    return "";
  };

  const detailMeta = useMemo(() => {
    if (!detail?.metadata || typeof detail.metadata !== "object") return undefined;
    return detail.metadata as Record<string, unknown>;
  }, [detail]);

  const aiDetailKeys = useMemo(() => pickAiKeys(detailMeta), [detailMeta]);

  const publishResults = useMemo(() => {
    const m = detailMeta;
    if (!m) return undefined;
    const pr = m.publishResults ?? m.results;
    if (Array.isArray(pr)) return pr as Record<string, unknown>[];
    return undefined;
  }, [detailMeta]);

  const handleApplySearch = () => {
    setPage(1);
    setSearchApplied(searchInput.trim());
  };

  const handleRefresh = () => {
    void loadStats();
    void load();
  };

  const TableSkeleton = () => (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="min-w-[900px] space-y-0 p-3">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div
            key={i}
            className="mb-2 h-12 animate-pulse rounded-lg bg-gray-100"
            aria-hidden
          />
        ))}
      </div>
    </div>
  );

  return (
    <PageContainer>
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-text">
            {L("مركز تدقيق العمليات", "Audit center")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-text-light">
            {L(
              "سجل موحّد لعمليات الأخبار والذكاء الاصطناعي والنشر والإعدادات مع تتبع الأخطاء والمنصات.",
              "Unified log for news, AI, publishing, and settings — with errors and platforms visible."
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2" dir="ltr">
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-text shadow-sm transition hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            {L("تحديث", "Refresh")}
          </button>
        </div>
      </header>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpi(L("إجمالي العمليات", "Total operations"), stats.total)}
        {kpi(L("عمليات اليوم", "Today"), stats.todayCount)}
        {kpi(L("عمليات الأخبار", "News"), stats.newsCount)}
        {kpi(L("عمليات الذكاء الاصطناعي", "AI"), stats.aiCount)}
        {kpi(L("عمليات النشر", "Publishing"), stats.publishingCount)}
        {kpi(L("العمليات الفاشلة", "Failed"), stats.failedCount)}
      </div>

      <div
        className="mb-6 space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
        dir={isAr ? "rtl" : "ltr"}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <label className="min-w-[140px] flex-1 text-xs font-bold text-text-light">
            {L("نوع العملية", "Operation type")}
            <select
              className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-2 text-sm"
              value={opType}
              onChange={(e) => {
                setPage(1);
                setOpType(e.target.value as AuditOperationFilter);
              }}
            >
              {OPERATION_TYPES.map((c) => (
                <option key={c.id} value={c.id}>
                  {L(c.ar, c.en)}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[120px] flex-1 text-xs font-bold text-text-light">
            {L("الحالة", "Status")}
            <select
              className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-2 text-sm"
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value);
              }}
            >
              {STATUS_FILTERS.map((c) => (
                <option key={c.v || "all"} value={c.v}>
                  {L(c.ar, c.en)}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[120px] flex-1 text-xs font-bold text-text-light">
            {L("المنصة", "Platform")}
            <select
              className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-2 text-sm"
              value={platform}
              onChange={(e) => {
                setPage(1);
                setPlatform(e.target.value);
              }}
            >
              {PLATFORM_FILTERS.map((c) => (
                <option key={c.id || "all"} value={c.id}>
                  {L(c.ar, c.en)}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[120px] flex-1 text-xs font-bold text-text-light">
            {L("من تاريخ", "From")}
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-2 text-sm"
              value={from}
              onChange={(e) => {
                setPage(1);
                setFrom(e.target.value);
              }}
            />
          </label>
          <label className="min-w-[120px] flex-1 text-xs font-bold text-text-light">
            {L("إلى تاريخ", "To")}
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-2 text-sm"
              value={to}
              onChange={(e) => {
                setPage(1);
                setTo(e.target.value);
              }}
            />
          </label>
          <label className="min-w-[160px] flex-[2] text-xs font-bold text-text-light">
            {L("البريد (منفذ)", "Actor email")}
            <input
              className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-2 text-sm"
              value={actorEmail}
              onChange={(e) => {
                setPage(1);
                setActorEmail(e.target.value);
              }}
              placeholder="user@school.edu"
              dir="ltr"
            />
          </label>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1 text-xs font-bold text-text-light">
            {L("بحث", "Search")}
            <div className="relative mt-1" dir="ltr">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full rounded-lg border border-gray-200 py-2 ps-9 pe-3 text-sm"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleApplySearch();
                }}
                placeholder={L("وصف، عنوان، بريد، نوع…", "Description, title, email, action…")}
              />
            </div>
          </label>
          <button
            type="button"
            onClick={handleApplySearch}
            className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-bold text-white"
          >
            {L("بحث", "Search")}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="mt-2">
          <div className="mb-3 flex justify-center sm:hidden">
            <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
          </div>
          <TableSkeleton />
        </div>
      ) : items.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-gray-300 bg-gray-50/80 py-16 text-center">
          <p className="text-lg font-bold text-text-light">
            {L("لا توجد عمليات مسجلة", "No operations recorded")}
          </p>
          <p className="mt-2 text-sm text-text-light">
            {L("جرّب توسيع نطاق التاريخ أو إزالة المرشحات.", "Try widening the date range or clearing filters.")}
          </p>
        </div>
      ) : (
        <div
          className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm"
          dir={isAr ? "rtl" : "ltr"}
        >
          <table className="min-w-[1000px] text-sm">
            <thead className="sticky top-0 z-[1] bg-gray-50 text-start text-xs font-black uppercase tracking-wide text-text-light">
              <tr>
                <th className="p-3">{L("التاريخ", "Date")}</th>
                <th className="p-3">{L("العملية", "Operation")}</th>
                <th className="min-w-[180px] p-3">{L("الوصف", "Description")}</th>
                <th className="p-3">{L("الكيان", "Entity")}</th>
                <th className="p-3">{L("المنفذ", "Actor")}</th>
                <th className="p-3">{L("الحالة", "Status")}</th>
                <th className="p-3">{L("المنصة", "Platform")}</th>
                <th className="p-3">{L("التفاصيل", "Details")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const badge = statusBadgeTheme(row._ui.displayStatus);
                return (
                  <tr
                    key={String(row._id)}
                    className={`border-t border-gray-100 transition-colors ${rowHighlight(row)}`}
                  >
                    <td className="whitespace-nowrap p-3 text-xs text-text-light">
                      {row.createdAt
                        ? new Date(String(row.createdAt)).toLocaleString(
                            isAr ? "ar-SA" : "en-GB"
                          )
                        : "—"}
                    </td>
                    <td className="p-3">
                      <span className="font-bold text-text">{row._ui.label}</span>
                      <span className="mt-0.5 block text-[10px] font-medium text-text-light">
                        {row._ui.category}
                      </span>
                    </td>
                    <td className="max-w-[240px] p-3">
                      <p className="line-clamp-2 text-text" title={row._ui.description}>
                        {row._ui.description}
                      </p>
                      {row._ui.errorHint ? (
                        <p className="mt-1 line-clamp-2 text-xs font-semibold text-red-700" title={row._ui.errorHint}>
                          {row._ui.errorHint}
                        </p>
                      ) : null}
                    </td>
                    <td className="p-3 text-xs">
                      <span className="font-semibold">{String(row.entityType || "—")}</span>
                      {row.entityTitle ? (
                        <span className="mt-0.5 block line-clamp-2 text-text-light" title={String(row.entityTitle)}>
                          {String(row.entityTitle)}
                        </span>
                      ) : null}
                      {row.entityId ? (
                        <span className="mt-0.5 block font-mono text-[10px] text-text-light">
                          #{String(row.entityId).slice(-8)}
                        </span>
                      ) : null}
                    </td>
                    <td className="max-w-[140px] p-3 text-xs break-all">
                      {String(row.actorEmail || row.actorName || "—")}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ${badge.className}`}
                      >
                        {row._ui.statusLabel}
                      </span>
                    </td>
                    <td className="p-3">
                      <PlatformBadges keys={row._ui.platformKeys} isAr={isAr} />
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        className="font-bold text-primary underline underline-offset-2"
                        onClick={() => {
                          setDetail(row);
                          setAdvancedOpen(false);
                          setAiOpen(false);
                        }}
                      >
                        {L("تفاصيل", "Details")}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm" dir={isAr ? "rtl" : "ltr"}>
        <span className="text-text-light">
          {L("الصفحة", "Page")} {page} / {totalPages} · {total} {L("إجمالي", "total")}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-gray-300 px-3 py-1.5 font-bold disabled:opacity-40"
          >
            {L("السابق", "Prev")}
          </button>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 font-bold disabled:opacity-40"
          >
            {L("التالي", "Next")}
          </button>
        </div>
      </div>

      {/* Side panel */}
      {detail ? (
        <>
          <button
            type="button"
            aria-label={L("إغلاق اللوحة", "Close panel")}
            className="fixed inset-0 z-40 bg-black/40 transition-opacity"
            onClick={() => setDetail(null)}
          />
          <aside
            className={`fixed inset-y-0 z-50 flex w-full max-w-lg flex-col bg-white shadow-2xl ${
              isAr ? "start-0 border-e border-gray-200" : "end-0 border-s border-gray-200"
            }`}
            role="dialog"
            aria-modal="true"
            dir={isAr ? "rtl" : "ltr"}
          >
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 p-4">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-black leading-snug text-text">{detail._ui.label}</h2>
                <p className="mt-1 text-xs font-bold uppercase tracking-wide text-text-light">
                  {detail._ui.category}
                </p>
              </div>
              <button
                type="button"
                aria-label={L("إغلاق", "Close")}
                onClick={() => setDetail(null)}
                className="shrink-0 rounded-lg p-2 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <dl className="space-y-4 text-sm">
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wide text-text-light">
                    {L("الوصف", "Description")}
                  </dt>
                  <dd className="mt-1 text-text">{detail._ui.description}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wide text-text-light">
                    {L("الكيان", "Entity")}
                  </dt>
                  <dd className="mt-1">
                    <span className="font-semibold">{String(detail.entityType || "—")}</span>
                    {detail.entityTitle ? (
                      <p className="mt-1 text-text">{String(detail.entityTitle)}</p>
                    ) : null}
                    <p className="mt-1 font-mono text-xs text-text-light break-all">
                      {String(detail.entityId || "—")}
                    </p>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wide text-text-light">
                    {L("المنفذ", "Actor")}
                  </dt>
                  <dd className="mt-1 break-all">
                    {String(detail.actorName || "")}{" "}
                    <span className="text-text-light">{String(detail.actorEmail || "")}</span>
                    <span className="mt-1 block text-xs text-text-light">
                      {String(detail.actorRole || "")}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wide text-text-light">
                    {L("التوقيت", "Timestamp")}
                  </dt>
                  <dd className="mt-1 text-text">
                    {detail.createdAt
                      ? new Date(String(detail.createdAt)).toLocaleString(
                          isAr ? "ar-SA" : "en-GB"
                        )
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wide text-text-light">
                    {L("الحالة", "Status")}
                  </dt>
                  <dd className="mt-1">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${statusBadgeTheme(detail._ui.displayStatus).className}`}
                    >
                      {detail._ui.statusLabel}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wide text-text-light">
                    {L("المنصة / الأهداف", "Platform / targets")}
                  </dt>
                  <dd className="mt-1">
                    <PlatformBadges keys={detail._ui.platformKeys} isAr={isAr} />
                  </dd>
                </div>
                {detail._ui.errorHint ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                    <dt className="text-xs font-bold uppercase text-red-900">
                      {L("رسالة الخطأ", "Error")}
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-red-950 whitespace-pre-wrap">
                      {detail._ui.errorHint}
                    </dd>
                  </div>
                ) : null}
              </dl>

              {publishResults && publishResults.length > 0 ? (
                <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs font-black uppercase tracking-wide text-text">
                    {L("نتائج النشر حسب المنصة", "Publish results by platform")}
                  </p>
                  <ul className="mt-3 space-y-2">
                    {publishResults.map((r, idx) => {
                      const target = String(r.target ?? r.platform ?? idx);
                      const ok = r.success === true;
                      return (
                        <li
                          key={idx}
                          className="rounded-lg border border-white bg-white p-2 text-xs shadow-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-bold">{platformLabel(target, isAr)}</span>
                            <span
                              className={
                                ok
                                  ? "font-bold text-emerald-700"
                                  : "font-bold text-red-700"
                              }
                            >
                              {ok ? L("نجاح", "OK") : L("فشل", "Fail")}
                            </span>
                          </div>
                          {r.errorMessage ? (
                            <p className="mt-1 text-red-800">{String(r.errorMessage)}</p>
                          ) : null}
                          {r.message ? (
                            <p className="mt-1 text-text-light">{String(r.message)}</p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              {aiDetailKeys.length > 0 ? (
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => setAiOpen((v) => !v)}
                    className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-bold text-text"
                  >
                    {L("ملخص الذكاء الاصطناعي", "AI input / output summary")}
                    {aiOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  {aiOpen ? (
                    <div className="mt-2 space-y-3 rounded-xl border border-gray-100 bg-white p-3">
                      {aiDetailKeys.map((k) => (
                        <div key={k}>
                          <p className="text-xs font-bold text-primary">{k}</p>
                          <div className="mt-1">
                            <FormattedValue v={detailMeta?.[k]} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => setAdvancedOpen((v) => !v)}
                  className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-bold text-text"
                >
                  {L("البيانات التقنية", "Technical details")}
                  {advancedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {advancedOpen ? (
                  <div className="mt-2 space-y-4 rounded-xl border border-gray-100 bg-gray-50/80 p-3">
                    {(["metadata", "before", "after"] as const).map((key) => {
                      const block = detail[key];
                      if (block === undefined || block === null)
                        return (
                          <div key={key}>
                            <p className="text-xs font-black uppercase text-text-light">{key}</p>
                            <p className="text-xs text-text-light">—</p>
                          </div>
                        );
                      return (
                        <div key={key}>
                          <p className="text-xs font-black uppercase text-text">{key}</p>
                          <div className="mt-2 max-h-[320px] overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
                            <FormattedValue v={block} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          </aside>
        </>
      ) : null}
    </PageContainer>
  );
};

export default AdminAuditLogPage;
