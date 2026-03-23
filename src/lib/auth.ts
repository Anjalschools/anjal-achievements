import { cookies } from "next/headers";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import mongoose from "mongoose";
import { perfElapsed, perfLog, perfNow } from "@/lib/perf-debug";

export interface SessionUser {
  id: string;
  email: string;
  fullName?: string;
  role?: string;
}

/**
 * Get current user from session/cookies
 * Returns a lean user record (no Mongoose document overhead) or null
 */
export async function getCurrentDbUser() {
  try {
    await connectDB();

    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;
    const userEmail = cookieStore.get("userEmail")?.value;

    perfLog("auth:session:start", { hasUserId: Boolean(userId), hasEmail: Boolean(userEmail) });

    // Try to find by ID first (lean + field trim — read-only session identity)
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      const t1 = perfNow();
      const user = await User.findById(userId).select("-passwordHash").lean();
      perfElapsed("auth:session:userLookupById", t1);
      if (user) {
        return user as unknown as InstanceType<typeof User>;
      }
    }

    if (userEmail) {
      const t2 = perfNow();
      const user = await User.findOne({ email: userEmail.toLowerCase() }).select("-passwordHash").lean();
      perfElapsed("auth:session:userLookupByEmail", t2);
      if (user) {
        return user as unknown as InstanceType<typeof User>;
      }
    }

    perfLog("auth:session:noUser");
    return null;
  } catch (error) {
    console.error("[getCurrentDbUser] Error:", error);
    return null;
  }
}

/**
 * Set user session in cookies
 */
export async function setUserSession(userId: string, email: string, fullName?: string) {
  const cookieStore = await cookies();
  cookieStore.set("userId", userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  cookieStore.set("userEmail", email, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  if (fullName) {
    cookieStore.set("userFullName", fullName, {
      httpOnly: false, // Allow client-side access
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
  }
}

/**
 * Clear user session
 */
export async function clearUserSession() {
  const cookieStore = await cookies();
  cookieStore.delete("userId");
  cookieStore.delete("userEmail");
  cookieStore.delete("userFullName");
}
