import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import ContactMessage from "@/models/ContactMessage";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^(\+966|0)?5\d{8}$/;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const fullName = String(body.fullName || "").trim();
    const phone = String(body.phone || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const subject = String(body.subject || "").trim();
    const message = String(body.message || "").trim();
    const inquiryType = String(body.inquiryType || "general").trim();

    if (!fullName || !phone || !email || !subject || !message) {
      return NextResponse.json({ error: "يرجى تعبئة الحقول المطلوبة." }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "صيغة البريد الإلكتروني غير صحيحة." }, { status: 400 });
    }
    if (!PHONE_RE.test(phone.replace(/\s/g, ""))) {
      return NextResponse.json({ error: "رقم الجوال غير صحيح (مثال: 05xxxxxxxx)." }, { status: 400 });
    }

    await connectDB();
    await ContactMessage.create({
      fullName,
      phone,
      email,
      subject,
      message,
      inquiryType: ["general", "achievements", "activities", "judging", "technical"].includes(inquiryType)
        ? inquiryType
        : "general",
      status: "new",
      source: "public_contact",
    });

    return NextResponse.json({
      ok: true,
      message: "تم إرسال رسالتك بنجاح. سنعاود التواصل معك قريبًا.",
    });
  } catch (error) {
    console.error("[POST /api/public/contact]", error);
    return NextResponse.json({ error: "حدث خطأ أثناء الإرسال. حاول مرة أخرى." }, { status: 500 });
  }
}
