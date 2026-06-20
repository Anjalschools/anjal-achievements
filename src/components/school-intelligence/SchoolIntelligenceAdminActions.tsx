"use client";

import type { AdminActionFeedback } from "@/lib/school-intelligence/school-intelligence-page-types";
import { CheckCircle2, Loader2, RefreshCw, Stethoscope, XCircle } from "lucide-react";
import { useState } from "react";

type SchoolIntelligenceAdminActionsProps = {
  isAr: boolean;
  onRetry: () => Promise<void>;
  onRefresh: () => Promise<void>;
};

const ACTION_LABELS = {
  retry: { ar: "إعادة المحاولة", en: "Retry" },
  refresh: { ar: "تحديث البيانات", en: "Refresh data" },
  diagnostics: { ar: "تشغيل التشخيص", en: "Run diagnostics" },
} as const;

const STATE_LABELS = {
  loading: { ar: "جاري التنفيذ…", en: "Running…" },
  success: { ar: "نجاح", en: "Success" },
  failure: { ar: "فشل", en: "Failure" },
} as const;

const SchoolIntelligenceAdminActions = ({
  isAr,
  onRetry,
  onRefresh,
}: SchoolIntelligenceAdminActionsProps) => {
  const [feedbacks, setFeedbacks] = useState<Record<string, AdminActionFeedback>>({});

  const setFeedback = (key: string, patch: Partial<AdminActionFeedback>) => {
    setFeedbacks((prev) => ({
      ...prev,
      [key]: { key, state: "idle", ...prev[key], ...patch },
    }));
  };

  const runAction = async (key: keyof typeof ACTION_LABELS, fn: () => Promise<void>) => {
    const started = Date.now();
    setFeedback(key, { state: "loading" });
    try {
      await fn();
      setFeedback(key, {
        state: "success",
        durationMs: Date.now() - started,
        messageAr: `${ACTION_LABELS[key].ar}: ${STATE_LABELS.success.ar}`,
        messageEn: `${ACTION_LABELS[key].en}: ${STATE_LABELS.success.en}`,
      });
    } catch {
      setFeedback(key, {
        state: "failure",
        durationMs: Date.now() - started,
        messageAr: `${ACTION_LABELS[key].ar}: ${STATE_LABELS.failure.ar}`,
        messageEn: `${ACTION_LABELS[key].en}: ${STATE_LABELS.failure.en}`,
      });
    }
  };

  const handleRunDiagnostics = async () => {
    const res = await fetch("/api/admin/intelligence-health/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "rerun_diagnostics" }),
    });
    if (!res.ok) throw new Error("diagnostics_failed");
  };

  const buttons = [
    { key: "retry" as const, onClick: onRetry, icon: RefreshCw },
    { key: "refresh" as const, onClick: onRefresh, icon: RefreshCw },
    { key: "diagnostics" as const, onClick: handleRunDiagnostics, icon: Stethoscope },
  ];

  return (
    <div className="mb-4 rounded-xl border border-border/70 p-3">
      <p className="mb-2 text-sm font-bold">{isAr ? "إجراءات المسؤول" : "Admin actions"}</p>
      <div className="flex flex-wrap gap-2">
        {buttons.map((btn) => {
          const feedback = feedbacks[btn.key];
          const loading = feedback?.state === "loading";
          return (
            <button
              key={btn.key}
              type="button"
              disabled={Object.values(feedbacks).some((f) => f.state === "loading")}
              onClick={() => void runAction(btn.key, btn.onClick)}
              className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              ) : (
                <btn.icon className="h-3 w-3" aria-hidden />
              )}
              {isAr ? ACTION_LABELS[btn.key].ar : ACTION_LABELS[btn.key].en}
            </button>
          );
        })}
      </div>
      <div className="mt-2 space-y-1">
        {buttons.map((btn) => {
          const feedback = feedbacks[btn.key];
          if (!feedback || feedback.state === "idle") return null;
          return (
            <p key={btn.key} className="flex items-center gap-1.5 text-xs text-text-light">
              {feedback.state === "loading" ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              ) : feedback.state === "success" ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-600" aria-hidden />
              ) : (
                <XCircle className="h-3 w-3 text-red-600" aria-hidden />
              )}
              <span>
                {isAr ? feedback.messageAr : feedback.messageEn}
                {feedback.durationMs != null
                  ? ` (${isAr ? "المدة" : "Duration"}: ${Math.round(feedback.durationMs / 1000)}s)`
                  : ""}
              </span>
            </p>
          );
        })}
      </div>
    </div>
  );
};

export default SchoolIntelligenceAdminActions;
