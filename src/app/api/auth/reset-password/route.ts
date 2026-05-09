import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import PasswordResetToken from "@/models/PasswordResetToken";
import { checkRouteRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import {
  hashResetToken,
  normalizeRawResetToken,
  RAW_RESET_TOKEN_HEX_LEN,
  resetPasswordDebugEnabled,
} from "@/lib/password-reset-token";

export const runtime = "nodejs";

const MIN_PASSWORD_LEN = 8;

const MSG_TOKEN_MISSING = "لم يُرسل رمز إعادة التعيين. افتح الرابط من البريد كاملًا.";
const MSG_PASSWORD_SHORT = "كلمة المرور يجب أن تكون 8 أحرف على الأقل.";
const MSG_TOKEN_INVALID_OR_EXPIRED =
  "رابط إعادة التعيين غير صالح أو منتهي الصلاحية. اطلب رابطًا جديدًا من صفحة نسيت كلمة المرور.";
const MSG_TOKEN_EXPIRED = "انتهت صلاحية رابط إعادة التعيين. اطلب رابطًا جديدًا.";

const logResetDebug = (payload: Record<string, unknown>) => {
  if (!resetPasswordDebugEnabled()) return;
  console.log("[reset-password:debug]", payload);
};

export async function POST(request: NextRequest) {
  try {
    if (!(await checkRouteRateLimit(request, "/api/auth/reset-password"))) {
      return rateLimitExceededResponse();
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body", code: "BAD_JSON" }, { status: 400 });
    }

    const tokenRaw =
      typeof body === "object" && body !== null && "token" in body
        ? String((body as { token: unknown }).token ?? "")
        : "";
    const password =
      typeof body === "object" && body !== null && "password" in body
        ? String((body as { password: unknown }).password ?? "")
        : "";

    if (!tokenRaw.trim()) {
      logResetDebug({
        token_received_length: 0,
        token_encoding_type: "empty",
        has_record_match: false,
        token_expired: false,
        token_hash_prefix: "(none)",
      });
      return NextResponse.json({ error: MSG_TOKEN_MISSING, code: "TOKEN_MISSING" }, { status: 400 });
    }

    if (password.length < MIN_PASSWORD_LEN) {
      return NextResponse.json({ error: MSG_PASSWORD_SHORT, code: "PASSWORD_TOO_SHORT" }, { status: 400 });
    }

    const normalized = normalizeRawResetToken(tokenRaw);
    if (!normalized.ok) {
      const len = tokenRaw.trim().length;
      logResetDebug({
        token_received_length: len,
        token_encoding_type: len === RAW_RESET_TOKEN_HEX_LEN ? "non_hex_or_bad_decode" : "wrong_length",
        has_record_match: false,
        token_expired: false,
        token_hash_prefix: "(invalid_raw)",
      });
      return NextResponse.json(
        { error: MSG_TOKEN_INVALID_OR_EXPIRED, code: "TOKEN_INVALID_OR_EXPIRED" },
        { status: 400 }
      );
    }

    const token = normalized.token;

    await connectDB();

    const tokenHash = hashResetToken(token);
    const hashPrefix = `${tokenHash.slice(0, 8)}…`;

    const record = await PasswordResetToken.findOne({ tokenHash }).lean();

    const exp = record?.expiresAt;
    const expired = Boolean(exp) && new Date(exp as Date).getTime() <= Date.now();

    logResetDebug({
      token_received_length: token.length,
      token_hash_prefix: hashPrefix,
      has_record_match: Boolean(record?._id),
      token_expired: expired,
      token_encoding_type: "hex64",
    });

    if (!record?.userId || !record.expiresAt) {
      return NextResponse.json(
        { error: MSG_TOKEN_INVALID_OR_EXPIRED, code: "TOKEN_INVALID_OR_EXPIRED" },
        { status: 400 }
      );
    }

    if (expired) {
      await PasswordResetToken.deleteOne({ _id: record._id });
      return NextResponse.json({ error: MSG_TOKEN_EXPIRED, code: "TOKEN_EXPIRED" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await User.updateOne({ _id: record.userId }, { $set: { passwordHash, mustChangePassword: false } });
    await PasswordResetToken.deleteMany({ userId: record.userId });

    return NextResponse.json({ ok: true, message: "تم تحديث كلمة المرور. يمكنك تسجيل الدخول الآن." });
  } catch (error) {
    console.error("[POST /api/auth/reset-password]", error);
    return jsonInternalServerError(error, { fallbackMessage: "حدث خطأ. حاول لاحقًا." });
  }
}
