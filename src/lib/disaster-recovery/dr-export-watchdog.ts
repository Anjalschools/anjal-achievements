import { DR_EXPORT_WATCHDOG_STALL_MS } from "@/lib/disaster-recovery/dr-async-timeout";
import { logDrObjectDiag } from "@/lib/disaster-recovery/dr-stream-lifecycle";

export type DrExportWatchdogSnapshot = {
  lastEntryId?: string;
  lastArchivePath?: string;
  lastPhase?: string;
  lastProgressAt: number;
  processedObjects: number;
};

export type DrExportWatchdogOptions = {
  stallMs?: number;
  onStall: (snapshot: DrExportWatchdogSnapshot) => void;
};

export class DrExportWatchdog {
  private readonly stallMs: number;
  private readonly onStall: (snapshot: DrExportWatchdogSnapshot) => void;
  private timer: ReturnType<typeof setInterval> | null = null;
  private snapshot: DrExportWatchdogSnapshot = {
    lastProgressAt: Date.now(),
    processedObjects: 0,
  };

  constructor(options: DrExportWatchdogOptions) {
    this.stallMs = options.stallMs ?? DR_EXPORT_WATCHDOG_STALL_MS;
    this.onStall = options.onStall;
  }

  start(): void {
    this.stop();
    this.snapshot.lastProgressAt = Date.now();
    this.timer = setInterval(() => {
      const idleMs = Date.now() - this.snapshot.lastProgressAt;
      if (idleMs < this.stallMs) return;
      logDrObjectDiag("Watchdog timeout", {
        idleMs,
        stallMs: this.stallMs,
        ...this.snapshot,
      });
      this.onStall({ ...this.snapshot });
    }, Math.min(10_000, Math.max(1_000, Math.floor(this.stallMs / 6))));
  }

  touch(partial: Partial<DrExportWatchdogSnapshot>): void {
    this.snapshot = {
      ...this.snapshot,
      ...partial,
      lastProgressAt: Date.now(),
    };
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }
}
