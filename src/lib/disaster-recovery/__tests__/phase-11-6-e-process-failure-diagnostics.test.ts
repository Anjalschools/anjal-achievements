import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/mongodb", () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

import {
  logDrApiHandlerFailed,
  logDrApiRequestEnd,
  logDrApiRequestStart,
} from "@/lib/disaster-recovery/dr-api-route-diagnostics";
import { logDrJobHeartbeat } from "@/lib/disaster-recovery/dr-job-heartbeat-diagnostics";
import {
  logDrJobNotFound,
} from "@/lib/disaster-recovery/dr-known-jobs";
import {
  resetBackupJobQueue,
  setBackupJobQueue,
} from "@/lib/disaster-recovery/worker/dr-job-queue";
import { createInMemoryBackupJobQueue } from "@/lib/disaster-recovery/worker/dr-memory-job-queue";
import {
  emitDrMemorySnapshot,
  startDrMemorySnapshotTimer,
  stopDrMemorySnapshotTimer,
} from "@/lib/disaster-recovery/dr-memory-snapshot-timer";
import {
  buildDrProcessEventPayload,
  logDrProcessEvent,
  resetDrProcessDiagnosticsRegistration,
} from "@/lib/disaster-recovery/dr-process-diagnostics";
import {
  logDrPollingHtmlResponse,
  logDrPollingResponse,
  readDrPollingResponseBody,
} from "@/lib/disaster-recovery/dr-polling-diagnostics";
import { resetDrJobContext } from "@/lib/disaster-recovery/dr-job-context";
import { enqueueBackupJob } from "@/lib/disaster-recovery/worker/dr-job-queue";

describe("phase 11.6.E — process failure diagnostics", () => {
  beforeEach(() => {
    resetDrJobContext();
    setBackupJobQueue(createInMemoryBackupJobQueue());
  });

  afterEach(() => {
    stopDrMemorySnapshotTimer();
    resetDrProcessDiagnosticsRegistration();
    resetBackupJobQueue();
    vi.restoreAllMocks();
  });

  it("logs PROCESS_EVENT payload with memory fields", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logDrProcessEvent("SIGTERM", { signal: "SIGTERM" });

    expect(errorSpy).toHaveBeenCalledWith(
      "[DR] PROCESS_EVENT",
      expect.objectContaining({
        event: "SIGTERM",
        pid: process.pid,
        signal: "SIGTERM",
        rss: expect.any(Number),
        heapUsed: expect.any(Number),
        heapTotal: expect.any(Number),
        external: expect.any(Number),
        arrayBuffers: expect.any(Number),
      })
    );
  });

  it("buildDrProcessEventPayload includes uptime", () => {
    const payload = buildDrProcessEventPayload("warning", { reason: "test" });
    expect(payload.event).toBe("warning");
    expect(payload.uptime).toBeGreaterThanOrEqual(0);
    expect(payload.reason).toBe("test");
  });

  it("logs MEMORY_SNAPSHOT with job context", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    resetDrJobContext({ recordId: "job-1", phase: "object-export", startedAtMs: Date.now() });

    emitDrMemorySnapshot("job-1");

    expect(infoSpy).toHaveBeenCalledWith(
      "[DR] MEMORY_SNAPSHOT",
      expect.objectContaining({
        jobId: "job-1",
        stage: "object-export",
        rss: expect.any(Number),
        heapUsed: expect.any(Number),
      })
    );
  });

  it("starts and stops memory snapshot timer without throwing", () => {
    vi.useFakeTimers();
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    startDrMemorySnapshotTimer("job-timer");
    vi.advanceTimersByTime(10_000);
    stopDrMemorySnapshotTimer();

    const snapshotCalls = infoSpy.mock.calls.filter(
      (call) => call[0] === "[DR] MEMORY_SNAPSHOT"
    );
    expect(snapshotCalls.length).toBeGreaterThanOrEqual(2);
    vi.useRealTimers();
  });

  it("logs API_HANDLER_FAILED and preserves error", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const rootError = new Error("ROUTE_CRASH");

    expect(() => {
      logDrApiHandlerFailed(
        { route: "/api/admin/backup/[id]", method: "GET", jobId: "abc" },
        rootError
      );
      throw rootError;
    }).toThrow(rootError);

    expect(errorSpy).toHaveBeenCalledWith(
      "[DR] API_HANDLER_FAILED",
      expect.objectContaining({
        route: "/api/admin/backup/[id]",
        jobId: "abc",
        message: "ROUTE_CRASH",
      })
    );
  });

  it("logs API request start and end", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logDrApiRequestStart({
      route: "/api/admin/backup/disaster-recovery",
      method: "POST",
      jobId: "job-99",
    });
    logDrApiRequestEnd(
      { route: "/api/admin/backup/disaster-recovery", method: "POST", jobId: "job-99" },
      { duration: 42, statusCode: 202 }
    );

    expect(infoSpy).toHaveBeenCalledWith(
      "[DR] API_REQUEST_START",
      expect.objectContaining({
        route: "/api/admin/backup/disaster-recovery",
        jobId: "job-99",
        pid: process.pid,
      })
    );
    expect(infoSpy).toHaveBeenCalledWith(
      "[DR] API_REQUEST_END",
      expect.objectContaining({ duration: 42, statusCode: 202 })
    );
  });

  it("logs JOB_NOT_FOUND with queue jobs", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await enqueueBackupJob({
      recordId: "active-job",
      input: {
        moduleId: "full",
        storageProvider: "r2",
        createdByUserId: "user-1",
      },
    });

    await logDrJobNotFound("missing-job", { reason: "not_in_database" });

    expect(warnSpy).toHaveBeenCalledWith(
      "[DR] JOB_NOT_FOUND",
      expect.objectContaining({
        jobId: "missing-job",
        queueJobs: ["active-job"],
        reason: "not_in_database",
      })
    );
  });

  it("logs JOB_HEARTBEAT with process memory", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    resetDrJobContext({ recordId: "hb-1", startedAtMs: Date.now() - 1000 });

    logDrJobHeartbeat({
      processedObjects: 100,
      remainingObjects: 400,
      elapsed: 1000,
    });

    expect(infoSpy).toHaveBeenCalledWith(
      "[DR] JOB_HEARTBEAT",
      expect.objectContaining({
        jobId: "hb-1",
        processedObjects: 100,
        remainingObjects: 400,
        elapsed: 1000,
        pid: process.pid,
        rss: expect.any(Number),
      })
    );
  });

  it("logs POLLING_HTML_RESPONSE before JSON parse", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const html = "<!DOCTYPE html><html><body>Bad Gateway</body></html>";
    const response = new Response(html, {
      status: 502,
      headers: {
        "content-type": "text/html",
        server: "cloudflare",
        "cf-ray": "abc123",
        "x-render-routing": "instance-dead",
        date: "Thu, 01 Jan 2026 00:00:00 GMT",
      },
    });

    const body = await readDrPollingResponseBody(response, "/api/admin/backup/job-1");

    expect(body).toBe(html);
    expect(infoSpy).toHaveBeenCalledWith(
      "[DR] POLLING_RESPONSE",
      expect.objectContaining({
        status: 502,
        contentType: "text/html",
        url: "/api/admin/backup/job-1",
      })
    );
    expect(warnSpy).toHaveBeenCalledWith(
      "[DR] POLLING_502_HEADERS",
      expect.objectContaining({
        status: 502,
        server: "cloudflare",
        cfRay: "abc123",
        xRenderRouting: "instance-dead",
      })
    );
    expect(infoSpy).toHaveBeenCalledWith(
      "[DR] POLLING_HTML_RESPONSE",
      expect.objectContaining({
        status: 502,
        preview: html.slice(0, 300),
      })
    );
  });

  it("logs POLLING_HTML_RESPONSE via helper", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logDrPollingResponse({
      status: 200,
      contentType: "application/json",
      contentLength: "12",
      url: "/api/admin/backup/x",
    });
    logDrPollingHtmlResponse({ status: 502, preview: "<!DOCTYPE html>" });

    expect(infoSpy).toHaveBeenCalledWith("[DR] POLLING_HTML_RESPONSE", {
      status: 502,
      preview: "<!DOCTYPE html>",
    });
  });
});
