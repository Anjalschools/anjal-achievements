import { NextResponse } from "next/server";

const isDev = () => process.env.NODE_ENV === "development";

export type JsonInternalServerErrorOptions = {
  status?: number;
  /** Public `error` string when not in dev (default: "Internal server error") */
  fallbackMessage?: string;
  /** Merged into the JSON body before `error` (unless skipErrorKey) */
  merge?: Record<string, unknown>;
  /** Omit automatic `error` field (use merge-only body + optional detail in dev) */
  skipErrorKey?: boolean;
};

/**
 * 500-style response: generic in production; message + optional stack detail in development.
 * Preserves existing `{ error: string }` and common merge shapes (`ok`, `success`, etc.).
 */
export const jsonInternalServerError = (
  err: unknown,
  options?: number | JsonInternalServerErrorOptions
): NextResponse => {
  const opt: JsonInternalServerErrorOptions =
    typeof options === "number" ? { status: options } : options ?? {};
  const status = opt.status ?? 500;
  const fallback = opt.fallbackMessage ?? "Internal server error";
  const dev = isDev();
  const message = dev && err instanceof Error ? err.message : fallback;
  const body: Record<string, unknown> = { ...(opt.merge ?? {}) };
  if (!opt.skipErrorKey) {
    body.error = message;
  }
  if (dev && err instanceof Error && err.stack) {
    body.detail = err.stack;
  }
  return NextResponse.json(body, { status });
};
