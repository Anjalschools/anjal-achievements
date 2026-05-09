import type { IUser } from "@/models/User";

/** Platform admin — may manage alumni inbox & CMS (matches existing alumni admin routes). */
export const isPlatformAdmin = (user: Pick<IUser, "role"> | null | undefined): boolean =>
  String(user?.role || "").toLowerCase() === "admin";
