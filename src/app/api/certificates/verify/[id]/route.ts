import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import {
  buildCertificateVerifyPublicPayload,
  lookupAchievementForCertificateVerification,
} from "@/lib/certificate-verify-lookup";

export const dynamic = "force-dynamic";

type RouteParams = { params: { id: string } };

const failureMessage = (reason: string | undefined, locale: "ar" | "en") => {
  const ar: Record<string, string> = {
    not_found: "الشهادة غير موجودة أو الرمز غير صالح",
    superseded: "هذا الرابط لم يعد فعّالاً — صدرت نسخة أحدث",
    revoked: "تم إلغاء هذه الشهادة",
    invalid_chain: "لا يمكن التحقق من هذه الشهادة بالحالة الحالية",
  };
  const en: Record<string, string> = {
    not_found: "This certificate does not exist or the code is not valid",
    superseded: "This verification link is no longer active",
    revoked: "This certificate has been revoked",
    invalid_chain: "This certificate cannot be verified in its current state",
  };
  const key = reason || "not_found";
  return locale === "ar" ? ar[key] || ar.not_found : en[key] || en.not_found;
};

/**
 * GET /api/certificates/verify/:id
 * id = verification token (QR), CERT-2026-XXXXXX display id, or certificate UUID.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const raw = params.id?.trim();
  if (!raw) {
    return NextResponse.json({ valid: false, code: "missing", message: "Missing id" }, { status: 400 });
  }

  if (raw.length > 200) {
    return NextResponse.json({ valid: false, code: "invalid", message: "Invalid id" }, { status: 400 });
  }

  const locParam = request.nextUrl.searchParams.get("locale");
  const locale = locParam === "en" ? "en" : "ar";

  try {
    await connectDB();
    const result = await lookupAchievementForCertificateVerification(raw);

    if (!result.ok) {
      return NextResponse.json({
        valid: false,
        code: result.reason,
        message: failureMessage(result.reason, locale),
      });
    }

    const payload = await buildCertificateVerifyPublicPayload(result.doc);
    return NextResponse.json(payload);
  } catch (e) {
    console.error("[GET /api/certificates/verify/[id]]", e);
    return NextResponse.json(
      {
        valid: false,
        code: "server_error",
        message: locale === "ar" ? "خطأ في الخادم" : "Server error",
      },
      { status: 500 }
    );
  }
}
