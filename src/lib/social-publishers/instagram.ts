import { PlaceholderPublisher } from "@/lib/social-publishers/base";
import type { PublishContext, PublishAttemptResult } from "@/lib/social-publishers/types";
import connectDB from "@/lib/mongodb";
import SocialIntegration from "@/models/SocialIntegration";

export class InstagramPublisher extends PlaceholderPublisher {
  readonly target = "instagram" as const;
  readonly displayNameAr = "إنستغرام";
  readonly displayNameEn = "Instagram";

  override async isReady(): Promise<boolean> {
    await connectDB();
    const row = await SocialIntegration.findOne({ provider: "instagram" }).lean();
    return row?.status === "connected";
  }

  override validate(ctx: PublishContext) {
    const base = super.validate(ctx);
    const blocking = [...base.blocking];
    if (!ctx.coverImageUrl?.trim()) {
      blocking.push("instagram_needs_media");
    }
    if ((ctx.caption || "").length > 2200) {
      blocking.push("instagram_caption_too_long");
    }
    return { ok: blocking.length === 0, warnings: base.warnings, blocking };
  }

  override async publish(ctx: PublishContext): Promise<PublishAttemptResult> {
    const ready = await this.isReady();
    if (!ready) {
      return {
        target: "instagram",
        success: false,
        errorMessage: "Instagram غير متصل — أكمل OAuth في إعدادات التكامل الاجتماعي.",
      };
    }
    return {
      target: "instagram",
      success: false,
      errorMessage: "Instagram Graph API: أضف استدعاء النشر الرسمي (صورة/ريل) في social-publishers/instagram.ts.",
    };
  }
}
