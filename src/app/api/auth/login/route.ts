import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import bcrypt from "bcryptjs";
import { perfElapsed, perfLog, perfNow } from "@/lib/perf-debug";

export async function POST(request: NextRequest) {
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
    const user = await User.findOne(searchCriteria).lean();
    perfElapsed("login:userLookup", tFind);

    if (!user) {
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

    response.cookies.set("userId", String(user._id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    response.cookies.set("userEmail", user.email, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    if (user.fullName) {
      response.cookies.set("userFullName", user.fullName, {
        httpOnly: false, // Allow client-side access
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 days
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
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
