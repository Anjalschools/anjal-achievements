import "server-only";
import { sendSmtpMail } from "@/lib/mailer";
import { getBaseUrl } from "@/lib/get-base-url";
import type { AlumniOnboardingServices } from "@/models/AlumniOnboardingRequest";

export const ALUMNI_APPROVAL_DEFAULT_PASSWORD = "Anjal585000@";

export type SendAlumniApprovalEmailInput = {
  to: string;
  recipientName: string;
  /** When true, user upgrades from an existing student portal account — do not imply a new password was set. */
  useExistingPortalPassword: boolean;
  services?: AlumniOnboardingServices | null;
};

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
    return `<p style="margin:0;color:#475569;font-size:15px;line-height:1.7;">لم يتم تحديد مساهمات محددة في الطلب؛ يمكنك تحديث تفضيلاتك لاحقًا من ملف الخريج.</p>`;
  }
  return `<ul style="margin:0;padding-right:20px;color:#0f172a;font-size:15px;line-height:1.9;">${chosen.map((l) => `<li>${l}</li>`).join("")}</ul>`;
};

/**
 * Professional RTL onboarding email after admin approval. SMTP failures are surfaced to caller as boolean.
 */
export const sendAlumniApprovalEmail = async (input: SendAlumniApprovalEmailInput): Promise<boolean> => {
  const to = String(input.to || "").trim().toLowerCase();
  if (!to.includes("@")) return false;

  const base = getBaseUrl();
  const loginUrl = `${base}/login`;
  const logoUrl = `${base}/logow.png`;
  const name = input.recipientName.trim() || "خريجنا الكريم";

  const passwordSection = input.useExistingPortalPassword
    ? `<p style="margin:12px 0 0;color:#0f172a;font-size:15px;line-height:1.8;"><strong>كلمة المرور:</strong> يمكنك استخدام <strong>كلمة المرور الحالية</strong> الخاصة بحسابك في منصة الأنجال (نفس بيانات الدخول كطالب)، ولم يتم تغييرها تلقائيًا.</p>`
    : `<p style="margin:12px 0 0;color:#0f172a;font-size:15px;line-height:1.8;"><strong>كلمة المرور:</strong> <span dir="ltr" style="font-family:ui-monospace,monospace;background:#f1f5f9;padding:2px 8px;border-radius:6px;">${ALUMNI_APPROVAL_DEFAULT_PASSWORD}</span></p>
       <p style="margin:8px 0 0;color:#64748b;font-size:13px;line-height:1.6;">يُنصح بشدة بتغيير كلمة المرور بعد أول تسجيل دخول. إن كنت تمتلك بالفعل حسابًا في المنصة، استخدم كلمة مرورك المعتادة وتجاهل القيمة أعلاه.</p>`;

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;background:#f8fafc;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);">
        <tr><td style="background:linear-gradient(135deg,#1e3a8a 0%,#0f172a 100%);padding:24px;text-align:center;">
          <img src="${logoUrl}" alt="مدارس الأنجال" width="120" height="auto" style="display:inline-block;max-width:120px;height:auto;"/>
          <p style="margin:16px 0 0;color:#e0f2fe;font-size:18px;font-weight:800;">مرحبًا بك في مجتمع خريجي الأنجال</p>
        </td></tr>
        <tr><td style="padding:28px 24px;">
          <p style="margin:0;color:#0f172a;font-size:16px;line-height:1.8;">عزيزي/عزيزتي <strong>${name}</strong>،</p>
          <p style="margin:16px 0 0;color:#334155;font-size:15px;line-height:1.85;">يسرّنا تهنئتك باعتماد انضمامك إلى <strong>مجتمع خريجي مدارس الأنجال الأهلية</strong>، وهو فضاء يهدف إلى بناء شبكة علاقات مهنية وداعمة، ونقل الخبرات، ودعم الطلاب، والإرشاد المهني، وإبراز قصص النجاح، وتعزيز الانتماء لمدارس الأنجال.</p>
          <p style="margin:16px 0 0;color:#334155;font-size:15px;line-height:1.85;">من خلال المنصة يمكنك الاطلاع على الفعاليات، والفرص، والإرشاد، والتواصل مع الزملاء الخريجين بما يخدم رسالة المدرسة.</p>

          <h2 style="margin:28px 0 12px;color:#1e3a8a;font-size:17px;">مساهماتك المختارة</h2>
          ${buildContributionsHtml(input.services)}

          <div style="margin-top:28px;padding:20px;background:#f1f5f9;border-radius:12px;border:1px solid #e2e8f0;">
            <h2 style="margin:0 0 12px;color:#1e3a8a;font-size:17px;">بيانات الدخول</h2>
            <p style="margin:0;color:#0f172a;font-size:15px;"><strong>البريد الإلكتروني:</strong> <span dir="ltr">${to}</span></p>
            ${passwordSection}
          </div>

          <div style="margin-top:28px;text-align:center;">
            <a href="${loginUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:800;font-size:15px;padding:14px 28px;border-radius:12px;">تسجيل الدخول إلى مجتمع الخريجين</a>
          </div>
        </td></tr>
        <tr><td style="padding:16px 24px 24px;text-align:center;color:#94a3b8;font-size:12px;line-height:1.6;">
          إدارة مدارس الأنجال الأهلية<br/>
          <span dir="ltr" style="color:#cbd5e1;">${base}</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    `مرحبًا بك في مجتمع خريجي الأنجال — ${name}`,
    ``,
    `تم اعتماد طلبك. سجّل الدخول: ${loginUrl}`,
    `البريد: ${to}`,
    input.useExistingPortalPassword
      ? `كلمة المرور: استخدم كلمة المرور الحالية لحسابك في المنصة.`
      : `كلمة المرور الافتراضية المعتمدة للحسابات الجديدة: ${ALUMNI_APPROVAL_DEFAULT_PASSWORD} (إن كان لديك حسابًا سابقًا فاستخدم كلمة مرورك المعتادة).`,
    ``,
    `إدارة مدارس الأنجال الأهلية`,
  ].join("\n");

  const result = await sendSmtpMail({
    to,
    subject: "مرحبًا بك في مجتمع خريجي الأنجال",
    text,
    html,
  });
  return result.ok;
};
