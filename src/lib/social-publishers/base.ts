import type { PublishContext, PublishAttemptResult, SocialPublisher } from "@/lib/social-publishers/types";
import type { PublishTarget } from "@/models/NewsPost";

export const notConnectedResult = (target: PublishTarget, ar: boolean): PublishAttemptResult => ({
  target,
  success: false,
  errorMessage: ar
    ? "التكامل غير مكتمل أو غير مُعدّ بعد."
    : "Integration not configured or not connected.",
});

export abstract class PlaceholderPublisher implements SocialPublisher {
  abstract readonly target: PublishTarget;
  abstract readonly displayNameAr: string;
  abstract readonly displayNameEn: string;

  async isReady(): Promise<boolean> {
    return false;
  }

  validate(ctx: PublishContext): { ok: boolean; warnings: string[]; blocking: string[] } {
    const blocking: string[] = [];
    const warnings: string[] = [];
    if (!ctx.caption?.trim() && !ctx.body?.trim()) {
      blocking.push("missing_text");
    }
    return { ok: blocking.length === 0, warnings, blocking };
  }

  async publish(ctx: PublishContext): Promise<PublishAttemptResult> {
    return notConnectedResult(this.target, true);
  }
}
