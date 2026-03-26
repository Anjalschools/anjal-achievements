import type { PublishTarget } from "@/models/NewsPost";

export type PublishContext = {
  newsId: string;
  title: string;
  coverImageUrl?: string;
  caption?: string;
  body?: string;
};

export type PublishAttemptResult = {
  target: PublishTarget;
  success: boolean;
  externalId?: string;
  errorMessage?: string;
};

export type SocialPublisher = {
  readonly target: PublishTarget;
  readonly displayNameAr: string;
  readonly displayNameEn: string;
  isReady(): Promise<boolean>;
  validate(ctx: PublishContext): { ok: boolean; warnings: string[]; blocking: string[] };
  publish(ctx: PublishContext): Promise<PublishAttemptResult>;
};
