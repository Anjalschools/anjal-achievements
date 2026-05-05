import "server-only";
import nodemailer from "nodemailer";

/**
 * SMTP (primary for this project). Env aliases:
 * - Host: `SMTP_HOST` or `EMAIL_HOST`
 * - Port: `SMTP_PORT` or `EMAIL_PORT` (default 587)
 * - User: `SMTP_USER` or `EMAIL_USER`
 * - Pass: `SMTP_PASS` or `EMAIL_PASS`
 * - From: `EMAIL_FROM` or `MAIL_FROM`
 * - From display name: `EMAIL_FROM_NAME` (optional → "Name <email>")
 */
export type SmtpReady =
  | {
      ok: true;
      transporter: nodemailer.Transporter;
      fromAddress: string;
    }
  | { ok: false };

const trim = (v: string | undefined): string => (v ?? "").trim();

export const getSmtpMailer = (): SmtpReady => {
  const host = trim(process.env.SMTP_HOST) || trim(process.env.EMAIL_HOST);
  const portRaw = trim(process.env.SMTP_PORT) || trim(process.env.EMAIL_PORT) || "587";
  const port = Number.parseInt(portRaw, 10);
  const safePort = Number.isFinite(port) && port > 0 ? port : 587;
  const user = trim(process.env.SMTP_USER) || trim(process.env.EMAIL_USER);
  const pass = trim(process.env.SMTP_PASS) || trim(process.env.EMAIL_PASS);
  const fromEmail = trim(process.env.EMAIL_FROM) || trim(process.env.MAIL_FROM);
  const fromName = trim(process.env.EMAIL_FROM_NAME);

  if (!host || !fromEmail) {
    return { ok: false };
  }

  const fromAddress = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

  const transporter = nodemailer.createTransport({
    host,
    port: safePort,
    secure: safePort === 465,
    auth: user && pass ? { user, pass } : undefined,
  });

  return { ok: true, transporter, fromAddress };
};

/** True when host, from, and credentials are set (typical relay requirement). */
export const isSmtpFullyConfigured = (): boolean => {
  const host = trim(process.env.SMTP_HOST) || trim(process.env.EMAIL_HOST);
  const fromEmail = trim(process.env.EMAIL_FROM) || trim(process.env.MAIL_FROM);
  const user = trim(process.env.SMTP_USER) || trim(process.env.EMAIL_USER);
  const pass = trim(process.env.SMTP_PASS) || trim(process.env.EMAIL_PASS);
  return Boolean(host && fromEmail && user && pass);
};

export type SendMailPayload = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export const sendSmtpMail = async (payload: SendMailPayload): Promise<{ ok: true } | { ok: false }> => {
  const mailer = getSmtpMailer();
  if (!mailer.ok) {
    return { ok: false };
  }
  if (!isSmtpFullyConfigured()) {
    return { ok: false };
  }

  try {
    await mailer.transporter.sendMail({
      from: mailer.fromAddress,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
};
