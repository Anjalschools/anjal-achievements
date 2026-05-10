import "server-only";
import { sendSmtpMail } from "@/lib/mailer";
import { getBaseUrl } from "@/lib/get-base-url";
import type { AlumniOnboardingServices } from "@/models/AlumniOnboardingRequest";

const serviceLabels: { key: keyof NonNullable<AlumniOnboardingServices>; label: string }[] = [
  { key: "mentoring", label: "الإرشاد" },
  { key: "internships", label: "فرص التدريب" },
  { key: "jobs", label: "الفرص الوظيفية" },
  { key: "workshops", label: "الورش والفعاليات المهنية" },
  { key: "judging", label: "التحكيم" },
  { key: "sponsorship", label: "الرعاية والشراكة" },
];

const buildContributionsHtml = (services?: AlumniOnboardingServices | null): string => {
  const chosen = serviceLabels.filter((s) => services?.[s.key] === true).map((s) => s.label);
  if (!chosen.length) {
    return `<p style="margin:0;color:#475569;font-size:15px;line-height:1.85;">لم يتم تحديد مساهمات محددة في الطلب؛ يمكنك تحديث تفضيلاتك لاحقًا من ملف الخريج.</p>`;
  }
  return `<ul style="margin:12px 0 0;padding:0 24px 0 0;color:#0f172a;font-size:15px;line-height:2;">${chosen.map((l) => `<li style="margin:0 0 6px;">${l}</li>`).join("")}</ul>`;
};

const wrapAlumniEmail = (params: {
  base: string;
  logoUrl: string;
  innerHtml: string;
}): string => `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;background:#f1f5f9;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:600px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(15,23,42,0.08);">
        <tr><td style="background:linear-gradient(145deg,#0f172a 0%,#1e3a8a 55%,#1d4ed8 100%);padding:32px 28px;text-align:center;">
          <img src="${params.logoUrl}" alt="مدارس الأنجال" width="112" style="display:inline-block;max-width:112px;height:auto;"/>
          <h1 style="margin:20px 0 0;color:#f8fafc;font-size:22px;font-weight:800;line-height:1.45;letter-spacing:-0.02em;">تم تفعيل حسابك في موقع مجتمع خريجي الأنجال</h1>
        </td></tr>
        <tr><td style="padding:32px 28px 28px;">
          ${params.innerHtml}
        </td></tr>
        <tr><td style="padding:0 28px 28px;text-align:center;color:#94a3b8;font-size:12px;line-height:1.65;">
          إدارة مدارس الأنجال الأهلية<br/>
          <span dir="ltr" style="color:#cbd5e1;">${params.base}</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const buttonPrimary = (href: string, label: string) =>
  `<div style="margin:28px 0 8px;text-align:center;">
    <a href="${href}" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;font-weight:800;font-size:16px;padding:16px 36px;border-radius:14px;letter-spacing:-0.01em;">${label}</a>
  </div>`;

const subtleLink = (href: string, label: string) =>
  `<p style="margin:12px 0 0;text-align:center;font-size:14px;color:#64748b;line-height:1.6;">${label}<br/><a href="${href}" style="color:#2563eb;font-weight:600;word-break:break-all;">${href}</a></p>`;

export type NewAlumniAccountEmailInput = {
  to: string;
  recipientName: string;
  username: string;
  tempPassword: string;
  services?: AlumniOnboardingServices | null;
};

export type LinkedAlumniAccountEmailInput = {
  to: string;
  recipientName: string;
  services?: AlumniOnboardingServices | null;
};

/**
 * CASE A — حساب جديد: يتضمن اسم المستخدم وكلمة المرور المؤقتة (في جسم البريد فقط — لا تُسجَّل).
 */
export const sendNewAlumniAccountActivationEmail = async (
  input: NewAlumniAccountEmailInput
): Promise<boolean> => {
  const to = String(input.to || "").trim().toLowerCase();
  if (!to.includes("@")) return false;

  const base = getBaseUrl();
  const loginUrl = `${base}/login/alumni`;
  const resetUrl = `${base}/forgot-password`;
  const logoUrl = `${base}/logow.png`;
  const name = input.recipientName.trim() || "خريجنا الكريم";

  const inner = `
          <p style="margin:0;color:#0f172a;font-size:17px;line-height:1.8;font-weight:600;">عزيزي/عزيزتي ${name}،</p>
          <p style="margin:16px 0 0;color:#334155;font-size:16px;line-height:1.9;">تم <strong>إنشاء حساب جديد</strong> لك في <strong>مجتمع خريجي مدارس الأنجال الأهلية</strong> بعد اعتماد طلبك. هذا الحساب مخصص لخدمات الخريجين المهنية والأكاديمية.</p>
          <p style="margin:12px 0 0;color:#475569;font-size:15px;line-height:1.85;">يمكنك تسجيل الدخول باستخدام <strong>البريد الإلكتروني</strong> أو <strong>اسم المستخدم</strong> الظاهر أدناه.</p>
          <p style="margin:14px 0 0;color:#b45309;font-size:14px;line-height:1.7;background:#fffbeb;padding:12px 14px;border-radius:12px;border:1px solid #fde68a;">لأسباب أمنية: لا تشارك هذه الرسالة أو كلمة المرور. يُرجى <strong>تغيير كلمة المرور</strong> فور أول تسجيل دخول من صفحة الإعدادات.</p>

          <h2 style="margin:28px 0 10px;color:#1e3a8a;font-size:17px;font-weight:800;">مساهماتك المختارة</h2>
          ${buildContributionsHtml(input.services)}

          <div style="margin-top:28px;padding:22px;background:#f8fafc;border-radius:16px;border:1px solid #e2e8f0;">
            <h2 style="margin:0 0 14px;color:#1e3a8a;font-size:17px;font-weight:800;">بيانات الدخول — حساب جديد</h2>
            <p style="margin:0;color:#0f172a;font-size:15px;line-height:1.9;"><strong>البريد الإلكتروني:</strong><br/><span dir="ltr" style="display:inline-block;margin-top:6px;font-family:ui-monospace,monospace;">${to}</span></p>
            <p style="margin:14px 0 0;color:#0f172a;font-size:15px;line-height:1.9;"><strong>اسم المستخدم:</strong><br/><span dir="ltr" style="display:inline-block;margin-top:6px;font-family:ui-monospace,monospace;background:#e2e8f0;padding:6px 12px;border-radius:10px;">${input.username}</span></p>
            <p style="margin:14px 0 0;color:#0f172a;font-size:15px;line-height:1.9;"><strong>كلمة المرور المؤقتة:</strong><br/><span dir="ltr" style="display:inline-block;margin-top:6px;font-family:ui-monospace,monospace;background:#fef3c7;padding:8px 14px;border-radius:10px;font-weight:700;">${input.tempPassword}</span></p>
          </div>

          ${buttonPrimary(loginUrl, "تسجيل الدخول — بوابة الخريجين")}
          ${subtleLink(resetUrl, "نسيت كلمة المرور؟ رابط إعادة التعيين:")}
  `;

  const html = wrapAlumniEmail({ base, logoUrl, innerHtml: inner });

  const text = [
    `تم تفعيل حسابك في موقع مجتمع خريجي الأنجال — بيانات الدخول (حساب جديد) — ${name}`,
    ``,
    `تم إنشاء حساب جديد في مجتمع الخريجين.`,
    `رابط الدخول (خريجين): ${loginUrl}`,
    `البريد: ${to}`,
    `اسم المستخدم: ${input.username}`,
    `كلمة مرور مؤقتة: (موجودة في نسخة HTML فقط — غيّرها بعد أول دخول)`,
    `إعادة تعيين كلمة المرور: ${resetUrl}`,
    ``,
    `إدارة مدارس الأنجال الأهلية`,
  ].join("\n");

  const result = await sendSmtpMail({
    to,
    subject: "تم تفعيل حسابك في موقع مجتمع خريجي الأنجال - بيانات الدخول (حساب جديد)",
    text,
    html,
  });
  return result.ok;
};

/**
 * CASE B — ربط حساب موجود: لا تُرسل كلمة مرور؛ نفس بيانات الدخول الحالية.
 */
export const sendLinkedAlumniActivationEmail = async (
  input: LinkedAlumniAccountEmailInput
): Promise<boolean> => {
  const to = String(input.to || "").trim().toLowerCase();
  if (!to.includes("@")) return false;

  const base = getBaseUrl();
  const loginUrl = `${base}/login/alumni`;
  const resetUrl = `${base}/forgot-password`;
  const logoUrl = `${base}/logow.png`;
  const name = input.recipientName.trim() || "خريجنا الكريم";

  const inner = `
          <p style="margin:0;color:#0f172a;font-size:17px;line-height:1.8;font-weight:600;">عزيزي/عزيزتي ${name}،</p>
          <p style="margin:16px 0 0;color:#334155;font-size:16px;line-height:1.9;">تم اعتماد طلبك و<strong>ربط حسابك الحالي في المنصة</strong> بخدمات <strong>مجتمع خريجي مدارس الأنجال الأهلية</strong>. يمكنك تسجيل الدخول باستخدام <strong>نفس البريد وكلمة المرور التي تستخدمها اليوم</strong> — لم يتم إنشاء كلمة مرور جديدة ولن تُرسل عبر البريد.</p>
          <p style="margin:14px 0 0;color:#475569;font-size:15px;line-height:1.85;">استخدم دائماً <strong>بوابة دخول الخريجين</strong> أدناه للوصول السريع إلى لوحة الخريج والشبكة المهنية.</p>

          <h2 style="margin:28px 0 10px;color:#1e3a8a;font-size:17px;font-weight:800;">مساهماتك المختارة</h2>
          ${buildContributionsHtml(input.services)}

          ${buttonPrimary(loginUrl, "تسجيل الدخول — بوابة الخريجين")}
          ${subtleLink(resetUrl, "إذا احتجت لإعادة تعيين كلمة المرور لاحقاً:")}
  `;

  const html = wrapAlumniEmail({ base, logoUrl, innerHtml: inner });

  const text = [
    `تم تفعيل حساب الخريجين الخاص بك — ${name}`,
    ``,
    `تم ربط حسابك الحالي بخدمات الخريجين.`,
    `سجّل الدخول بنفس بياناتك المعتادة عبر بوابة الخريجين: ${loginUrl}`,
    `البريد المرتبط: ${to}`,
    `لم يتم إرسال كلمة مرور جديدة في هذه الرسالة.`,
    `إعادة تعيين كلمة المرور عند الحاجة: ${resetUrl}`,
    ``,
    `إدارة مدارس الأنجال الأهلية`,
  ].join("\n");

  const result = await sendSmtpMail({
    to,
    subject: "تم تفعيل حساب الخريجين الخاص بك — الأنجال",
    text,
    html,
  });
  return result.ok;
};
