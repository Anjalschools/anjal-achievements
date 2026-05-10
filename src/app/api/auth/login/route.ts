import { NextRequest, NextResponse } from "next/server";
import connectDB, { logDbReadyState, pingMongo } from "@/lib/mongodb";
import User from "@/models/User";
import bcrypt from "bcryptjs";
import { perfElapsed, perfLog, perfNow } from "@/lib/perf-debug";
// Rate limit: must import from this module only (contains diagnostic logs inside checkRateLimit).
import { checkRateLimit } from "@/lib/rate-limit";
import { warnSecurityEvent } from "@/lib/security-log";
import { getAccountType } from "@/lib/account-type";
import { escapeRegExp } from "@/lib/search/query-normalizer";

const loginSafeDiag = () => ({
  hasNextAuthSecret: Boolean(process.env.NEXTAUTH_SECRET?.trim()),
  hasMongoUri: Boolean(process.env.MONGODB_URI?.trim()),
  nodeEnv: process.env.NODE_ENV ?? "(unset)",
  nextAuthUrl: process.env.NEXTAUTH_URL?.trim()
    ? process.env.NEXTAUTH_URL!.trim().replace(/\/$/, "")
    : "(unset)",
});

export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = await checkRateLimit(request, "/api/auth/login");
    console.log("[login:rate-limit-result]", {
      blocked: !!rateLimitResult,
      status: rateLimitResult?.status ?? null,
    });
    if (rateLimitResult) {
      return rateLimitResult;
    }

    perfLog("login:start");
    const tDb = perfNow();
    await connectDB();
    perfElapsed("login:dbConnect", tDb);
    logDbReadyState("login");

    const pingOk = await pingMongo();
    if (!pingOk) {
      return NextResponse.json(
        { ok: false, code: "DB_UNAVAILABLE", message: "Database unavailable" },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { identifier, password } = body;

    if (!identifier || !password) {
      return NextResponse.json(
        { error: "Identifier and password are required" },
        { status: 400 }
      );
    }

    // Determine search criteria based on identifier
    let searchCriteria: {
      email?: string;
      $or?: Array<{ username: string | RegExp } | { studentId: string }>;
    };

    const trimmedId = identifier.trim();
    if (trimmedId.includes("@")) {
      searchCriteria = { email: trimmedId.toLowerCase() };
    } else {
      const usernamePattern = new RegExp(`^${escapeRegExp(trimmedId)}$`, "i");
      searchCriteria = {
        $or: [{ username: usernamePattern }, { studentId: trimmedId }],
      };
    }

    const tFind = perfNow();
    const user = await User.findOne(searchCriteria).select("+passwordHash").lean();
    perfElapsed("login:userLookup", tFind);

    if (!user) {
      warnSecurityEvent("login_failure", { reason: "unknown_user" });
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    if (user.status !== "active") {
      return NextResponse.json({ error: "Account is not active" }, { status: 403 });
    }

    const tPw = perfNow();
    const hash = String((user as { passwordHash?: string }).passwordHash || "");
    const isPasswordValid = await bcrypt.compare(password, hash);
    perfElapsed("login:passwordCheck", tPw);

    if (!isPasswordValid) {
      warnSecurityEvent("login_failure", { reason: "bad_password" });
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const userResponse = {
      id: String(user._id),
      fullName: user.fullName,
      email: user.email,
      username: user.username,
      studentId: user.studentId,
      role: user.role,
      accountType: getAccountType(user as { accountType?: "student" | "alumni" | null }),
      status: user.status,
      preferredLanguage: user.preferredLanguage,
      profilePhoto: user.profilePhoto,
      createdAt: user.createdAt,
      mustChangePassword: (user as { mustChangePassword?: boolean }).mustChangePassword === true,
    };

    const response = NextResponse.json(
      {
        message: "Login successful",
        user: userResponse,
      },
      { status: 200 }
    );

    const sessionCookieOpts = {
      path: "/",
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: 60 * 60 * 24 * 7,
    };

    const tCookie = perfNow();
    try {
      response.cookies.set("userId", String(user._id), {
        ...sessionCookieOpts,
        httpOnly: true,
      });

      response.cookies.set("userEmail", user.email, {
        ...sessionCookieOpts,
        httpOnly: true,
      });

      if (user.fullName) {
        response.cookies.set("userFullName", user.fullName, {
          ...sessionCookieOpts,
          httpOnly: false,
        });
      }

      console.log("[jwt:create]", { success: true, userId: String(user._id) });
    } catch (cookieErr) {
      const e = cookieErr instanceof Error ? cookieErr : new Error(String(cookieErr));
      console.error("[jwt:create:failed]", {
        message: e.message,
        userId: String(user._id),
      });
      throw cookieErr;
    }

    perfElapsed("login:sessionCookies", tCookie);
    perfLog("login:done");

    void User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } }).catch(() => {
      /* non-blocking */
    });

    return response;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[login:error]", {
      message: err.message,
      stack: err.stack,
      ...loginSafeDiag(),
    });
    return NextResponse.json(
      { ok: false, code: "LOGIN_INTERNAL_ERROR", message: "Login failed" },
      { status: 500 }
    );
  }
}
