import { PlaceholderPublisher } from "@/lib/social-publishers/base";
import type { PublishContext, PublishAttemptResult } from "@/lib/social-publishers/types";
import connectDB from "@/lib/mongodb";
import SocialIntegration from "@/models/SocialIntegration";

export class XPublisher extends PlaceholderPublisher {
  readonly target = "x" as const;
  readonly displayNameAr = "إكس (X)";
  readonly displayNameEn = "X";

  override async isReady(): Promise<boolean> {
    await connectDB();
    const row = await SocialIntegration.findOne({ provider: "x" }).lean();
    return row?.status === "connected";
  }

  override validate(ctx: PublishContext) {
    const base = super.validate(ctx);
    const text = (ctx.body || ctx.caption || "").trim();
    const blocking = [...base.blocking];
    if (text.length > 280) blocking.push("x_text_too_long");
    return { ok: blocking.length === 0, warnings: base.warnings, blocking };
  }

  override async publish(ctx: PublishContext): Promise<PublishAttemptResult> {
    const ready = await this.isReady();
    if (!ready) {
      return { target: "x", success: false, errorMessage: "X غير متصل — أكمل الربط الرسمي في الإعدادات." };
    }
    return {
      target: "x",
      success: false,
      errorMessage: "نشر X جاهز للتوسعة عبر Twitter API v2 الرسمي.",
    };
  }
}
