import { NextRequest, NextResponse } from "next/server";
import { sendSmtpMail } from "@/lib/mailer";
import { isSmtpFullyConfigured } from "@/lib/mailer";
import { maskEmailForLogs } from "@/lib/email-log";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const to = new URL(request.url).searchParams.get("to")?.trim().toLowerCase() ?? "";
  if (!to || !EMAIL_RE.test(to)) {
    return NextResponse.json(
      { error: "Provide ?to=valid@email.com (GET) or POST JSON { \"to\": \"...\" }" },
      { status: 400 }
    );
  }

  if (!isSmtpFullyConfigured()) {
    console.warn("[debug/email] email_config_missing");
    return NextResponse.json(
      { ok: false, error: "SMTP not fully configured (host, from, user, pass)" },
      { status: 503 }
    );
  }

  const result = await sendSmtpMail({
    to,
    subject: "[Anjal dev] Test email",
    text: "If you received this, SMTP from the Anjal platform is working.",
    html: "<p>If you received this, SMTP from the Anjal platform is working.</p>",
  });

  if (!result.ok) {
    console.error("[debug/email] send_failed", { to: maskEmailForLogs(to) });
    return NextResponse.json({ ok: false, error: "send_failed" }, { status: 500 });
  }

  console.log("[debug/email] sent", { to: maskEmailForLogs(to) });
  return NextResponse.json({ ok: true, message: "sent", to: maskEmailForLogs(to) });
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const toRaw =
    typeof body === "object" && body !== null && "to" in body
      ? String((body as { to: unknown }).to ?? "").trim().toLowerCase()
      : "";
  if (!toRaw || !EMAIL_RE.test(toRaw)) {
    return NextResponse.json({ error: "Body must include { \"to\": \"valid@email.com\" }" }, { status: 400 });
  }

  if (!isSmtpFullyConfigured()) {
    console.warn("[debug/email] email_config_missing");
    return NextResponse.json(
      { ok: false, error: "SMTP not fully configured (host, from, user, pass)" },
      { status: 503 }
    );
  }

  const result = await sendSmtpMail({
    to: toRaw,
    subject: "[Anjal dev] Test email",
    text: "If you received this, SMTP from the Anjal platform is working.",
    html: "<p>If you received this, SMTP from the Anjal platform is working.</p>",
  });

  if (!result.ok) {
    console.error("[debug/email] send_failed", { to: maskEmailForLogs(toRaw) });
    return NextResponse.json({ ok: false, error: "send_failed" }, { status: 500 });
  }

  console.log("[debug/email] sent", { to: maskEmailForLogs(toRaw) });
  return NextResponse.json({ ok: true, message: "sent", to: maskEmailForLogs(toRaw) });
}
