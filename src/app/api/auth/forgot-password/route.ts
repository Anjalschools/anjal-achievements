import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import PasswordResetToken from "@/models/PasswordResetToken";
import { getBaseUrlForRequest } from "@/lib/get-base-url";
import { checkRouteRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";
import { sendPasswordResetEmail } from "@/lib/password-reset-mail";
import { isSmtpFullyConfigured } from "@/lib/mailer";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { isDevNodeEnv, maskEmailForLogs } from "@/lib/email-log";
import { hashResetToken } from "@/lib/password-reset-token";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const UNIFORM_SUCCESS_MESSAGE =
  "إذا كان البريد مسجلًا لدينا، فسيتم إرسال رابط إعادة تعيين كلمة المرور.";

const TOKEN_TTL_MS = 30 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    if (!(await checkRouteRateLimit(request, "/api/auth/forgot-password"))) {
      return rateLimitExceededResponse();
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const emailRaw =
      typeof body === "object" && body !== null && "email" in body
        ? String((body as { email: unknown }).email ?? "").trim()
        : "";

    const email = emailRaw.toLowerCase();

    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json(
        { error: "صيغة البريد الإلكتروني غير صحيحة." },
        { status: 400 }
      );
    }

    const masked = maskEmailForLogs(email);

    await connectDB();

    const user = await User.findOne({ email }).select("_id").lean();

    if (!user?._id) {
      return NextResponse.json({
        ok: true,
        message: UNIFORM_SUCCESS_MESSAGE,
      });
    }

    if (!isSmtpFullyConfigured()) {
      if (isDevNodeEnv()) {
        console.warn(
          "[forgot-password] email_config_missing — set SMTP_HOST/EMAIL_HOST, SMTP_PORT/EMAIL_PORT, SMTP_USER/EMAIL_USER, SMTP_PASS/EMAIL_PASS, EMAIL_FROM (or MAIL_FROM)"
        );
      } else {
        console.warn("[forgot-password] email_config_missing", { email: masked });
      }
      return NextResponse.json({
        ok: true,
        message: UNIFORM_SUCCESS_MESSAGE,
      });
    }

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = hashResetToken(rawToken);

    await PasswordResetToken.deleteMany({ userId: user._id });

    await PasswordResetToken.create({
      userId: user._id,
      tokenHash,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    });

    const baseUrl = getBaseUrlForRequest(request);
    const resetUrl = `${baseUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(rawToken)}`;

    if (isDevNodeEnv()) {
      console.log("[forgot-password] reset_url_dev", resetUrl);
    }

    const sendResult = await sendPasswordResetEmail({ to: email, resetUrl });
    if (sendResult.ok) {
      console.log("[forgot-password] email_sent", { email: masked });
    } else {
      console.error("[forgot-password] email_send_failed", { email: masked });
    }

    return NextResponse.json({
      ok: true,
      message: UNIFORM_SUCCESS_MESSAGE,
    });
  } catch (error) {
    console.error("[POST /api/auth/forgot-password]", error);
    return jsonInternalServerError(error, { fallbackMessage: "حدث خطأ. حاول لاحقًا." });
  }
}
