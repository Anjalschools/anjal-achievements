import { competitionIntelDebug, competitionIntelWarn } from "@/lib/competition-intelligence-diagnostics";
import {
  exportTimeoutMs,
  resolveExportSafety,
  type ExportSafetyContext,
} from "@/lib/competition/governance/export-safety-policy";
import { logPdfMemoryPressureIntel } from "@/lib/competition-intelligence-debug";

export type CompetitionExportPhase =
  | "idle"
  | "preparing"
  | "fetching"
  | "building_pdf"
  | "waiting_assets"
  | "printing"
  | "success"
  | "error";

export type CompetitionExportState = {
  phase: CompetitionExportPhase;
  messageAr: string;
  messageEn: string;
  errorDetail?: string;
  attempt: number;
  correlationId?: string;
};

export const exportPhaseMessages = (
  phase: CompetitionExportPhase,
  isAr: boolean
): { ar: string; en: string } => {
  const map: Record<CompetitionExportPhase, { ar: string; en: string }> = {
    idle: { ar: "", en: "" },
    preparing: { ar: "جاري تجهيز التقرير التنفيذي…", en: "Preparing executive export…" },
    fetching: { ar: "جاري جلب بيانات المشاركين…", en: "Fetching participant data…" },
    building_pdf: { ar: "جاري بناء ملف PDF…", en: "Building PDF document…" },
    waiting_assets: { ar: "جاري تجهيز الرسوم البيانية…", en: "Preparing charts…" },
    printing: { ar: "جاري فتح نافذة الطباعة…", en: "Opening print dialog…" },
    success: { ar: "اكتمل التصدير بنجاح", en: "Export completed successfully" },
    error: { ar: "فشل التصدير — حاول مجددًا", en: "Export failed — try again" },
  };
  const m = map[phase];
  return isAr ? { ar: m.ar, en: m.en } : { ar: m.en, en: m.en };
};

export type RunExecutiveExportParams = {
  isAr: boolean;
  onUpdate: (s: CompetitionExportState) => void;
  /** Main async work (fetch + build); should call PDF builder inside */
  run: () => Promise<void>;
  /** Overall guard */
  totalTimeoutMs?: number;
  /** Increment on user retry so UI shows attempt number */
  initialAttempt?: number;
  /** Stable id for export diagnostics / audit (client-generated). */
  correlationId?: string;
  /** Optional export safety context for caps / degraded mode */
  safetyContext?: Partial<ExportSafetyContext>;
};

/**
 * Wraps an export pipeline with phased UI updates and timeouts.
 * The `run` callback must invoke the actual PDF print routine (which returns a Promise when print is scheduled).
 */
export const runCompetitionExecutiveExport = async (
  params: RunExecutiveExportParams & { run: () => Promise<void> }
): Promise<
  | { ok: true; degraded?: boolean }
  | { ok: false; error: string; degraded?: boolean }
> => {
  const {
    isAr,
    onUpdate,
    run,
    totalTimeoutMs,
    initialAttempt = 1,
    correlationId,
    safetyContext,
  } = params;
  let attempt = initialAttempt;

  const safety = resolveExportSafety({
    requestedRows: safetyContext?.requestedRows ?? 800,
    requestedCharts: safetyContext?.requestedCharts ?? 8,
    pdfSections: safetyContext?.pdfSections ?? ["executive", "charts", "participants"],
    attempt,
  });

  if (safety.shouldAbort) {
    const msg = isAr ? "تجاوزت الحد الأقصى لمحاولات التصدير" : "Export retry cap exceeded";
    competitionIntelWarn("export aborted", safety.abortReason ?? "retry_cap");
    onUpdate({
      phase: "error",
      messageAr: msg,
      messageEn: msg,
      errorDetail: safety.abortReason,
      attempt,
      correlationId,
    });
    return { ok: false, error: msg, degraded: true };
  }

  logPdfMemoryPressureIntel({
    estimatedRows: safety.safeRowCap,
    chartCount: safety.safeChartCap,
    degraded: safety.degraded,
  });

  const timeoutMs = totalTimeoutMs ?? exportTimeoutMs(safety.policy);
  const setPhase = (phase: CompetitionExportPhase, errorDetail?: string) => {
    const { ar, en } = exportPhaseMessages(phase, isAr);
    onUpdate({ phase, messageAr: ar, messageEn: en, errorDetail, attempt, correlationId });
  };

  const exec = async (): Promise<void> => {
    setPhase("preparing");
    await new Promise((r) => setTimeout(r, 80));
    setPhase("fetching");
    await new Promise((r) => setTimeout(r, 60));
    setPhase("building_pdf");
    competitionIntelDebug("export pipeline: building");
    await run();
    setPhase("printing");
    await new Promise((r) => setTimeout(r, 200));
    setPhase("success");
    competitionIntelDebug("export pipeline: success");
  };

  try {
    await Promise.race([
      exec(),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error(isAr ? "انتهت مهلة التصدير" : "Export timed out")), timeoutMs)
      ),
    ]);
    return { ok: true, degraded: safety.degraded };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    competitionIntelWarn("export failed", msg);
    setPhase("error", msg);
    return { ok: false, error: msg, degraded: safety.degraded };
  }
};
