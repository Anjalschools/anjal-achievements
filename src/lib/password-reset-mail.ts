import "server-only";
import { sendSmtpMail } from "@/lib/mailer";

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const SUBJECT = "إعادة تعيين كلمة المرور - منصة تميز الأنجال";

/**
 * Sends password reset message via SMTP (`EMAIL_*` / `SMTP_*` — see {@link sendSmtpMail}).
 */
export const sendPasswordResetEmail = async (params: {
  to: string;
  resetUrl: string;
}): Promise<{ ok: boolean }> => {
  const text = `لإعادة تعيين كلمة المرور، افتح الرابط التالي (صالح لمدة 30 دقيقة):\n\n${params.resetUrl}\n\nإذا لم تطلب ذلك، يمكنك تجاهل هذه الرسالة.`;
  const html = `<p>لإعادة تعيين كلمة المرور، اضغط على الرابط أدناه (صالح لمدة 30 دقيقة):</p><p><a href="${escapeHtml(
    params.resetUrl
  )}">إعادة تعيين كلمة المرور</a></p><p>إذا لم تطلب ذلك، يمكنك تجاهل هذه الرسالة.</p>`;

  const result = await sendSmtpMail({
    to: params.to,
    subject: SUBJECT,
    text,
    html,
  });
  return { ok: result.ok };
};
