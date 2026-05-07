import { cookies } from "next/headers";
import connectDB, { logDbReadyState } from "@/lib/mongodb";
import User from "@/models/User";
import mongoose from "mongoose";
import { perfElapsed, perfLog, perfNow } from "@/lib/perf-debug";
import { getCachedDbUser, setCachedDbUser } from "@/lib/auth-session-cache";

export interface SessionUser {
  id: string;
  email: string;
  fullName?: string;
  role?: string;
}

const dbFailLog = (phase: string, error: unknown) => {
  const err = error instanceof Error ? error : new Error(String(error));
  const code = (error as NodeJS.ErrnoException)?.code;
  console.error("[auth:session:db_failed]", {
    phase,
    message: err.message,
    errorName: err.name,
    errorCode: code ?? undefined,
    stack: err.stack,
    readyState: mongoose.connection.readyState,
  });
};

/**
 * Get current user from session/cookies
 * Returns a lean user record (no Mongoose document overhead) or null
 */
export async function getCurrentDbUser() {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;
    const userEmail = cookieStore.get("userEmail")?.value;

    perfLog("auth:session:start", { hasUserId: Boolean(userId), hasEmail: Boolean(userEmail) });

    try {
      await connectDB();
      logDbReadyState("auth_session");
    } catch (error) {
      dbFailLog("connect", error);
      return null;
    }

    // Try to find by ID first (lean + field trim — read-only session identity)
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      const ck = `id:${userId}`;
      const hit = getCachedDbUser(ck);
      if (hit !== undefined) {
        perfLog("auth:session:cacheHit", { key: "id" });
        return hit as unknown as InstanceType<typeof User>;
      }
      try {
        const t1 = perfNow();
        const user = await User.findById(userId).select("-passwordHash -__v").lean();
        perfElapsed("auth:session:userLookupById", t1);
        if (user) {
          const u = user as unknown as Record<string, unknown>;
          setCachedDbUser(ck, u);
          return user as unknown as InstanceType<typeof User>;
        }
      } catch (error) {
        dbFailLog("findById", error);
        return null;
      }
    }

    if (userEmail) {
      const ek = `email:${userEmail.toLowerCase()}`;
      const hit = getCachedDbUser(ek);
      if (hit !== undefined) {
        perfLog("auth:session:cacheHit", { key: "email" });
        return hit as unknown as InstanceType<typeof User>;
      }
      try {
        const t2 = perfNow();
        const user = await User.findOne({ email: userEmail.toLowerCase() })
          .select("-passwordHash -__v")
          .lean();
        perfElapsed("auth:session:userLookupByEmail", t2);
        if (user) {
          const u = user as unknown as Record<string, unknown>;
          setCachedDbUser(ek, u);
          const id = user._id?.toString?.();
          if (id) setCachedDbUser(`id:${id}`, u);
          return user as unknown as InstanceType<typeof User>;
        }
      } catch (error) {
        dbFailLog("findOneEmail", error);
        return null;
      }
    }

    perfLog("auth:session:noUser");
    return null;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[auth:session:decode_failed]", {
      message: err.message,
      stack: err.stack,
      nodeEnv: process.env.NODE_ENV ?? "(unset)",
    });
    return null;
  }
}

/**
 * Set user session in cookies
 */
export async function setUserSession(userId: string, email: string, fullName?: string) {
  const cookieStore = await cookies();
  const cookieBase = {
    path: "/" as const,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 7,
  };
  cookieStore.set("userId", userId, { ...cookieBase, httpOnly: true });
  cookieStore.set("userEmail", email, { ...cookieBase, httpOnly: true });
  if (fullName) {
    cookieStore.set("userFullName", fullName, {
      ...cookieBase,
      httpOnly: false,
    });
  }
}

/**
 * Clear user session
 */
export async function clearUserSession() {
  const cookieStore = await cookies();
  const names = ["userId", "userEmail", "userFullName"] as const;
  for (const name of names) {
    cookieStore.delete({ name, path: "/" });
  }
}
