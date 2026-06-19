"use client";

import { Loader2, RefreshCw, Stethoscope } from "lucide-react";
import { useState } from "react";

type SchoolIntelligenceAdminActionsProps = {
  isAr: boolean;
  onRetry: () => Promise<void>;
  onRefresh: () => Promise<void>;
};

const SchoolIntelligenceAdminActions = ({
  isAr,
  onRetry,
  onRefresh,
}: SchoolIntelligenceAdminActionsProps) => {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const runAction = async (key: string, fn: () => Promise<void>) => {
    setLoadingAction(key);
    setMessage(null);
    try {
      await fn();
      setMessage(isAr ? "تم تنفيذ الإجراء" : "Action completed");
    } catch {
      setMessage(isAr ? "فشل الإجراء" : "Action failed");
    } finally {
      setLoadingAction(null);
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
    {
      key: "retry",
      label: isAr ? "إعادة المحاولة" : "Retry",
      onClick: onRetry,
      icon: RefreshCw,
    },
    {
      key: "refresh",
      label: isAr ? "تحديث البيانات" : "Refresh data",
      onClick: onRefresh,
      icon: RefreshCw,
    },
    {
      key: "diagnostics",
      label: isAr ? "تشغيل التشخيص" : "Run diagnostics",
      onClick: handleRunDiagnostics,
      icon: Stethoscope,
    },
  ];

  return (
    <div className="mb-4 rounded-xl border border-border/70 p-3">
      <p className="mb-2 text-sm font-bold">{isAr ? "إجراءات المسؤول" : "Admin actions"}</p>
      <div className="flex flex-wrap gap-2">
        {buttons.map((btn) => (
          <button
            key={btn.key}
            type="button"
            disabled={loadingAction != null}
            onClick={() => void runAction(btn.key, btn.onClick)}
            className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          >
            {loadingAction === btn.key ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            ) : (
              <btn.icon className="h-3 w-3" aria-hidden />
            )}
            {btn.label}
          </button>
        ))}
      </div>
      {message ? <p className="mt-2 text-xs text-text-light">{message}</p> : null}
    </div>
  );
};

export default SchoolIntelligenceAdminActions;
