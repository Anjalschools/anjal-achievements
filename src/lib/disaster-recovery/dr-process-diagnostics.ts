import "server-only";

import { truncateDrErrorStack } from "@/lib/disaster-recovery/dr-diag-policy";

let registered = false;

export const registerDrProcessDiagnostics = (): void => {
  if (registered) return;
  registered = true;

  process.on("uncaughtException", (error) => {
    console.error("[DR] uncaughtException", {
      message: error.message,
      stack: truncateDrErrorStack(error),
      name: error.name,
    });
  });

  process.on("unhandledRejection", (reason) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    console.error("[DR] unhandledRejection", {
      message,
      stack: truncateDrErrorStack(reason),
    });
  });

  process.on("SIGTERM", () => {
    console.warn("[DR] SIGTERM received — process may shut down during backup");
  });

  process.on("SIGINT", () => {
    console.warn("[DR] SIGINT received — process may shut down during backup");
  });

  console.log("[DR] process diagnostics registered");
};
