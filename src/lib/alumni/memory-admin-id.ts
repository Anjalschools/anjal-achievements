import mongoose from "mongoose";

/** Stable admin API id: `<userId>__<memoryPostId>` */
export const encodeAlumniMemoryAdminId = (userId: string, memoryPostId: string): string =>
  `${String(userId).trim()}__${String(memoryPostId).trim()}`;

export const decodeAlumniMemoryAdminId = (
  raw: string
): { userId: string; memoryPostId: string } | null => {
  const s = String(raw || "").trim();
  const parts = s.split("__");
  if (parts.length === 2) {
    const [userId, memoryPostId] = parts;
    if (mongoose.isValidObjectId(userId) && mongoose.isValidObjectId(memoryPostId)) {
      return { userId, memoryPostId };
    }
  }
  return null;
};
