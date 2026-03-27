import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import bcrypt from "bcryptjs";
import { perfElapsed, perfLog, perfNow } from "@/lib/perf-debug";
// Rate limit: must import from this module only (contains diagnostic logs inside checkRateLimit).
import { checkRateLimit } from "@/lib/rate-limit";
import { warnSecurityEvent } from "@/lib/security-log";
import { jsonInternalServerError } from "@/lib/api-safe-response";

export async function POST(request: NextRequest) {
  const rateLimitResult = await checkRateLimit(request, "/api/auth/login");
  console.log("[login:rate-limit-result]", {
    blocked: !!rateLimitResult,
    status: rateLimitResult?.status ?? null,
  });
  if (rateLimitResult) {
    return rateLimitResult;
  }

  try {
    perfLog("login:start");
    const tDb = perfNow();
    await connectDB();
    perfElapsed("login:dbConnect", tDb);

    const body = await request.json();
    const { identifier, password } = body;

    if (!identifier || !password) {
      return NextResponse.json(
        { error: "Identifier and password are required" },
        { status: 400 }
      );
    }

    // Determine search criteria based on identifier
    let searchCriteria: any;

    if (identifier.includes("@")) {
      // If identifier contains @, search by email (lowercase)
      searchCriteria = { email: identifier.toLowerCase().trim() };
    } else {
      // Otherwise, search by username or studentId
      const trimmedIdentifier = identifier.trim();
      searchCriteria = {
        $or: [
          { username: trimmedIdentifier },
          { studentId: trimmedIdentifier },
        ],
      };
    }

    const tFind = perfNow();
    const user = await User.findOne(searchCriteria).select("+passwordHash").lean();
    perfElapsed("login:userLookup", tFind);

    if (!user) {
      warnSecurityEvent("login_failure", { reason: "unknown_user" });
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    if (user.status !== "active") {
      return NextResponse.json(
        { error: "Account is not active" },
        { status: 403 }
      );
    }

    const tPw = perfNow();
    const hash = String((user as { passwordHash?: string }).passwordHash || "");
    const isPasswordValid = await bcrypt.compare(password, hash);
    perfElapsed("login:passwordCheck", tPw);

    if (!isPasswordValid) {
      warnSecurityEvent("login_failure", { reason: "bad_password" });
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const tCookie = perfNow();
    const userResponse = {
      id: String(user._id),
      fullName: user.fullName,
      email: user.email,
      username: user.username,
      studentId: user.studentId,
      role: user.role,
      status: user.status,
      preferredLanguage: user.preferredLanguage,
      profilePhoto: user.profilePhoto,
      createdAt: user.createdAt,
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

    perfElapsed("login:sessionCookies", tCookie);
    perfLog("login:done");

    void User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } }).catch(() => {
      /* non-blocking */
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return jsonInternalServerError(error, { fallbackMessage: "Something went wrong" });
  }
}
