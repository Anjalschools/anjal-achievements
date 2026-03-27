/**
 * Must stay lightweight: no MongoDB / mongoose / Node native modules pulled into the instrumentation bundle.
 * System stats document bootstrap runs from GET /api/public/home-stats when the row is missing.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
}
