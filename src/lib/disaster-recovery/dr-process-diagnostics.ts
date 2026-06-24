import "server-only";

let registered = false;

export const registerDrProcessDiagnostics = (): void => {
  if (registered) return;
  registered = true;

  process.on("uncaughtException", (error) => {
    console.error("[DR] uncaughtException", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
  });

  process.on("unhandledRejection", (reason) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : undefined;
    console.error("[DR] unhandledRejection", { message, stack, reason });
  });

  process.on("SIGTERM", () => {
    console.warn("[DR] SIGTERM received — process may shut down during backup");
  });

  process.on("SIGINT", () => {
    console.warn("[DR] SIGINT received — process may shut down during backup");
  });

  console.log("[DR] process diagnostics registered");
};
