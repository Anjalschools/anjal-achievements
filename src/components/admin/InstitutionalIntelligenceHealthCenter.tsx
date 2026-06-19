"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import SectionCard from "@/components/layout/SectionCard";
import type { IntelligenceHealthMonitoringPayload } from "@/lib/school-improvement/intelligence-diagnostics-types";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Download,
  HeartPulse,
  Loader2,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

const scoreTone = (score: number) => {
  if (score >= 95) return "text-emerald-700 bg-emerald-50 ring-emerald-200";
  if (score >= 85) return "text-blue-700 bg-blue-50 ring-blue-200";
  if (score >= 70) return "text-amber-700 bg-amber-50 ring-amber-200";
  return "text-red-700 bg-red-50 ring-red-200";
};

const alertTone = (level: string) => {
  if (level === "critical") return "border-red-200 bg-red-50 text-red-950";
  if (level === "warning") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-slate-200 bg-slate-50 text-slate-900";
};

type InstitutionalIntelligenceHealthCenterProps = {
  monitoring: IntelligenceHealthMonitoringPayload;
  isAr: boolean;
  showExportActions?: boolean;
  showAdminActions?: boolean;
  onRefresh?: () => Promise<void> | void;
};

const TrendMini = ({
  title,
  points,
  isAr,
}: {
  title: string;
  points: Array<{ timestamp: string; value: number }>;
  isAr: boolean;
}) => (
  <div className="rounded-xl border border-border/70 p-3">
    <p className="mb-2 text-xs font-bold text-text-light">{title}</p>
    {points.length === 0 ? (
      <p className="text-xs text-text-light">{isAr ? "لا بيانات بعد" : "No data yet"}</p>
    ) : (
      <div className="flex flex-wrap gap-1">
        {points.slice(-12).map((point) => (
          <span
            key={point.timestamp}
            className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold tabular-nums"
            title={new Date(point.timestamp).toLocaleString(isAr ? "ar-SA" : "en-US")}
          >
            {point.value}
          </span>
        ))}
      </div>
    )}
  </div>
);

export const InstitutionalIntelligenceHealthCenter = ({
  monitoring,
  isAr,
  showExportActions = true,
  showAdminActions = false,
  onRefresh,
}: InstitutionalIntelligenceHealthCenterProps) => {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const handleExport = (format: string) => {
    const params = new URLSearchParams({ format, lang: isAr ? "ar" : "en" });
    window.open(`/api/admin/school-improvement-intelligence/diagnostics/export?${params.toString()}`, "_blank");
  };

  const handleAdminAction = useCallback(
    async (action: string, section?: string) => {
      setActionLoading(action);
      setActionMessage(null);
      try {
        const res = await fetch("/api/admin/intelligence-health/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, section }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Action failed");
        setActionMessage(isAr ? "تم تنفيذ الإجراء بنجاح" : "Action completed successfully");
        await onRefresh?.();
      } catch (error) {
        setActionMessage(error instanceof Error ? error.message : isAr ? "فشل الإجراء" : "Action failed");
      } finally {
        setActionLoading(null);
      }
    },
    [isAr, onRefresh]
  );

  const resilienceScore = monitoring.resilienceScore?.score ?? 0;

  return (
    <SectionCard>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold">
            <Activity className="h-4 w-4" aria-hidden />
            {isAr ? "مركز صحة الذكاء المؤسسي" : "Institutional intelligence health center"}
          </h2>
          <p className="mt-1 text-xs text-text-light">
            {isAr
              ? "مراقبة نشطة — الاستعادة التلقائية، اللقطات الاحتياطية، والمرونة"
              : "Active monitoring — auto recovery, snapshot fallback, and resilience"}
          </p>
        </div>
        {showExportActions ? (
          <div className="flex flex-wrap gap-2">
            {(["json", "xlsx", "html"] as const).map((format) => (
              <button
                key={format}
                type="button"
                onClick={() => handleExport(format)}
                className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold"
              >
                <Download className="h-3 w-3" aria-hidden />
                {format.toUpperCase()}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <div className={`rounded-xl px-4 py-3 ring-1 ${scoreTone(monitoring.healthScore.score)}`}>
          <p className="text-xs opacity-80">{isAr ? "مؤشر الصحة" : "Health score"}</p>
          <p className="text-3xl font-black tabular-nums">{monitoring.healthScore.score}</p>
          <p className="text-xs font-semibold">
            {isAr ? monitoring.healthScore.labelAr : monitoring.healthScore.labelEn}
          </p>
        </div>
        <div className={`rounded-xl px-4 py-3 ring-1 ${scoreTone(resilienceScore)}`}>
          <p className="flex items-center gap-1 text-xs opacity-80">
            <HeartPulse className="h-3 w-3" aria-hidden />
            {isAr ? "مؤشر المرونة" : "Resilience score"}
          </p>
          <p className="text-3xl font-black tabular-nums">{resilienceScore}</p>
          <p className="text-xs font-semibold">
            {isAr
              ? monitoring.resilienceScore?.labelAr || "—"
              : monitoring.resilienceScore?.labelEn || "—"}
          </p>
        </div>
        {[
          {
            label: isAr ? "نسبة الاستعادة" : "Recovery rate",
            value: `${monitoring.summary.recoveryRatePct ?? 100}%`,
            icon: ShieldCheck,
          },
          {
            label: isAr ? "استشفاء تلقائي" : "Auto-healed",
            value: monitoring.summary.autoHealedIncidents ?? 0,
            icon: CheckCircle2,
          },
          {
            label: isAr ? "تنبيهات حرجة" : "Critical alerts",
            value: monitoring.summary.criticalCount,
            icon: AlertTriangle,
          },
          {
            label: isAr ? "خدمات مستعادة" : "Recovered services",
            value: monitoring.summary.recoveredServices ?? monitoring.summary.recoveryCount,
            icon: RefreshCw,
          },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-border/70 px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-text-light">
              <card.icon className="h-3.5 w-3.5" aria-hidden />
              {card.label}
            </div>
            <p className="mt-1 text-xl font-black">{card.value}</p>
          </div>
        ))}
      </div>

      {showAdminActions ? (
        <div className="mb-4 rounded-xl border border-border/70 p-3">
          <h3 className="mb-2 text-sm font-bold">{isAr ? "إجراءات المسؤول" : "Admin actions"}</h3>
          <div className="flex flex-wrap gap-2">
            {[
              { action: "rerun_diagnostics", label: isAr ? "إعادة التشخيص" : "Re-run diagnostics" },
              { action: "clear_stale_snapshots", label: isAr ? "مسح اللقطات القديمة" : "Clear stale snapshots" },
              {
                action: "retry_section",
                section: "action_engine",
                label: isAr ? "إعادة محاولة action_engine" : "Retry action_engine",
              },
              {
                action: "clear_snapshot",
                section: "action_engine",
                label: isAr ? "مسح لقطة action_engine" : "Clear action_engine snapshot",
              },
            ].map((item) => (
              <button
                key={`${item.action}-${item.section || "all"}`}
                type="button"
                disabled={actionLoading != null}
                onClick={() => void handleAdminAction(item.action, item.section)}
                className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
              >
                {actionLoading === item.action ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                ) : (
                  <RefreshCw className="h-3 w-3" aria-hidden />
                )}
                {item.label}
              </button>
            ))}
          </div>
          {actionMessage ? <p className="mt-2 text-xs text-text-light">{actionMessage}</p> : null}
        </div>
      ) : null}

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <TrendMini
          title={isAr ? "اتجاه مؤشر الصحة — 24 ساعة" : "Health score trend — 24h"}
          points={monitoring.trends.last24Hours.healthScore}
          isAr={isAr}
        />
        <TrendMini
          title={isAr ? "اتجاه الاستعلامات البطيئة — 7 أيام" : "Slow query trend — 7d"}
          points={monitoring.trends.last7Days.slowQueries}
          isAr={isAr}
        />
        <TrendMini
          title={isAr ? "اتجاه الأقسام غير المتاحة — 30 يوماً" : "Unavailable sections trend — 30d"}
          points={monitoring.trends.last30Days.unavailableSections}
          isAr={isAr}
        />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-bold">{isAr ? "أكثر الخدمات استقراراً" : "Most stable services"}</h3>
          {(monitoring.mostStableServices || []).length === 0 ? (
            <p className="text-sm text-text-light">{isAr ? "لا بيانات بعد." : "No data yet."}</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {(monitoring.mostStableServices || []).map((row) => (
                <li key={row.service} className="flex justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <span className="font-semibold">{row.service}</span>
                  <span>{row.stability}%</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="mb-2 text-sm font-bold">{isAr ? "أكثر الخدمات عدم استقرار" : "Most unstable services"}</h3>
          {(monitoring.mostUnstableServices || []).length === 0 ? (
            <p className="text-sm text-text-light">{isAr ? "لا بيانات بعد." : "No data yet."}</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {(monitoring.mostUnstableServices || []).map((row) => (
                <li key={row.service} className="flex justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <span className="font-semibold">{row.service}</span>
                  <span>
                    {row.failure} {isAr ? "فشل" : "failures"} · {row.stability}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {(monitoring.recommendations || []).length > 0 ? (
        <div className="mb-4">
          <h3 className="mb-2 text-sm font-bold">{isAr ? "توصيات تلقائية" : "Automatic recommendations"}</h3>
          <ul className="space-y-2 text-xs">
            {(monitoring.recommendations || []).slice(0, 6).map((item) => (
              <li key={item.id} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-blue-950">
                <p className="font-semibold">{isAr ? item.titleAr : item.titleEn}</p>
                <p className="opacity-80">{isAr ? item.messageAr : item.messageEn}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-bold">{isAr ? "التنبيهات النشطة" : "Active alerts"}</h3>
          {monitoring.alerts.length === 0 ? (
            <p className="text-sm text-text-light">{isAr ? "لا توجد تنبيهات نشطة." : "No active alerts."}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {monitoring.alerts.slice(0, 8).map((alert) => (
                <li key={alert.id} className={`rounded-xl border px-3 py-2 ${alertTone(alert.level)}`}>
                  <p className="font-bold">{isAr ? alert.titleAr : alert.titleEn}</p>
                  <p className="text-xs">{isAr ? alert.messageAr : alert.messageEn}</p>
                  <p className="mt-1 text-[11px] opacity-70">
                    {alert.service || alert.section} · {alert.occurrenceCount}x ·{" "}
                    {new Date(alert.lastSeenAt).toLocaleString(isAr ? "ar-SA" : "en-US")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-sm font-bold">{isAr ? "أكثر الخدمات فشلاً" : "Top failing services"}</h3>
          {monitoring.failureLeaderboard.length === 0 ? (
            <p className="text-sm text-text-light">{isAr ? "لا سجل فشل بعد." : "No failure history yet."}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-border/70">
                    <th className="px-2 py-2 text-start">{isAr ? "الخدمة" : "Service"}</th>
                    <th className="px-2 py-2">{isAr ? "التكرار" : "Occurrences"}</th>
                    <th className="px-2 py-2">{isAr ? "آخر ظهور" : "Last seen"}</th>
                    <th className="px-2 py-2">{isAr ? "الأثر" : "Impact"}</th>
                  </tr>
                </thead>
                <tbody>
                  {monitoring.failureLeaderboard.map((row) => (
                    <tr key={row.service} className="border-b border-border/40">
                      <td className="px-2 py-2 font-semibold">{row.service}</td>
                      <td className="px-2 py-2 text-center">{row.occurrences}</td>
                      <td className="px-2 py-2 text-center">
                        {new Date(row.lastSeenAt).toLocaleDateString(isAr ? "ar-SA" : "en-US")}
                      </td>
                      <td className="px-2 py-2 text-center">{row.averageImpact}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {monitoring.recoveries.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-bold">{isAr ? "استعادات حديثة" : "Recent recoveries"}</h3>
          <ul className="space-y-2 text-xs">
            {monitoring.recoveries.slice(0, 6).map((recovery) => (
              <li key={recovery.id} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-950">
                <p className="font-semibold">{isAr ? recovery.messageAr : recovery.messageEn}</p>
                <p className="opacity-80">
                  {Math.round(recovery.downtimeMs / 1000)}s ·{" "}
                  {new Date(recovery.resolvedAt).toLocaleString(isAr ? "ar-SA" : "en-US")}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-4 text-xs text-text-light">
        <Link href="/admin/school-improvement-intelligence" className="font-semibold text-primary underline">
          {isAr ? "العودة إلى لوحة ذكاء التحسين" : "Back to school improvement intelligence"}
        </Link>
      </p>
    </SectionCard>
  );
};
