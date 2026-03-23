import type { Types } from "mongoose";

/**
 * Official ownership field on Achievement: `userId` → ref User.
 * Student-facing list APIs must always constrain queries with this filter.
 * Never apply a user id from client query params (IDOR risk).
 */
export const achievementOwnerUserIdFilter = (
  userId: Types.ObjectId
): { userId: Types.ObjectId } => ({ userId });
