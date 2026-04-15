import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import UserConsent from "@/models/UserConsent";
import bcrypt from "bcryptjs";
import { normalizeGrade } from "@/constants/grades";
import { ensureStudentPublicPortfolioReady } from "@/lib/public-portfolio-bootstrap";
import { queueHomeStatsRefresh } from "@/lib/home-stats-service";
import { checkRouteRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    if (!(await checkRouteRateLimit(request, "/api/auth/register"))) {
      return rateLimitExceededResponse();
    }
    await connectDB();

    const formData = await request.formData();

    const fullName = formData.get("fullName") as string;
    const fullNameAr = formData.get("fullNameAr") as string | null;
    const fullNameEn = formData.get("fullNameEn") as string | null;
    const email = formData.get("email") as string;
    const username = formData.get("username") as string;
    const studentId = formData.get("studentId") as string;
    const nationalId = formData.get("nationalId") as string | null;
    const phone = formData.get("phone") as string | null;
    const password = formData.get("password") as string;
    const gender = formData.get("gender") as "male" | "female";
    const section = formData.get("section") as "arabic" | "international";
    const grade = formData.get("grade") as string;
    const guardianName = formData.get("guardianName") as string | null;
    const guardianId = formData.get("guardianId") as string | null;
    const guardianPhone = formData.get("guardianPhone") as string | null;
    const preferredLanguage = (formData.get("preferredLanguage") as string) || "ar";
    const termsAgreed = formData.get("termsAgreed") === "true";
    const notificationsAgreed = formData.get("notificationsAgreed") === "true";
    const profilePhoto = formData.get("profilePhoto") as File | null;
    const isMawhibaStudentRaw = formData.get("isMawhibaStudent");
    /** Explicit `true` only when sent as "true"; missing/legacy payloads default to false. */
    const isMawhibaStudent = isMawhibaStudentRaw === "true";

    // Validation - Required fields
    if (!fullName || !email || !username || !studentId || !password) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!gender || !section || !grade) {
      return NextResponse.json(
        { error: "Gender, section, and grade are required" },
        { status: 400 }
      );
    }

    if (!termsAgreed) {
      return NextResponse.json(
        { error: "Terms and conditions must be accepted" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Validate student ID (10 digits)
    if (!/^\d{10}$/.test(studentId)) {
      return NextResponse.json(
        { error: "Student ID must be 10 digits" },
        { status: 400 }
      );
    }

    // Validate national ID if provided (10 digits)
    if (nationalId && !/^\d{10}$/.test(nationalId)) {
      return NextResponse.json(
        { error: "National ID must be 10 digits" },
        { status: 400 }
      );
    }

    // Validate phone if provided (starts with 05, 10 digits)
    if (phone && !/^05\d{8}$/.test(phone)) {
      return NextResponse.json(
        { error: "Invalid phone number format (must start with 05 and be 10 digits)" },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Normalize email to lowercase and trim all string fields
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedUsername = username.trim();
    const normalizedStudentId = studentId.trim();
    const normalizedNationalId = nationalId ? nationalId.trim() : undefined;
    const normalizedPhone = phone ? phone.trim() : undefined;
    const normalizedFullName = fullName.trim();
    const normalizedFullNameAr = fullNameAr ? fullNameAr.trim() : normalizedFullName;
    const normalizedFullNameEn = fullNameEn ? fullNameEn.trim() : undefined;
    const normalizedGrade = normalizeGrade(grade) || grade;

    // Check for existing user
    const existingUser = await User.findOne({
      $or: [
        { email: normalizedEmail },
        { username: normalizedUsername },
        { studentId: normalizedStudentId },
        ...(normalizedNationalId ? [{ nationalId: normalizedNationalId }] : []),
      ],
    });

    if (existingUser) {
      let conflictField = "email, username, or student ID";
      if (existingUser.email === normalizedEmail) {
        conflictField = "email";
      } else if (existingUser.username === normalizedUsername) {
        conflictField = "username";
      } else if (existingUser.studentId === normalizedStudentId) {
        conflictField = "student ID";
      } else if (normalizedNationalId && existingUser.nationalId === normalizedNationalId) {
        conflictField = "national ID";
      }

      return NextResponse.json(
        { error: `User already exists with this ${conflictField}` },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // TODO: Handle profile photo upload (save to cloud storage or public folder)
    // For now, we'll store a placeholder or handle it later
    let profilePhotoUrl: string | undefined = undefined;
    // if (profilePhoto) {
    //   profilePhotoUrl = await uploadImage(profilePhoto);
    // }

    // Create user
    const user = await User.create({
      fullName: normalizedFullName,
      fullNameAr: normalizedFullNameAr,
      fullNameEn: normalizedFullNameEn,
      email: normalizedEmail,
      username: normalizedUsername,
      studentId: normalizedStudentId,
      nationalId: normalizedNationalId,
      phone: normalizedPhone,
      passwordHash,
      gender,
      section,
      grade: normalizedGrade,
      isMawhibaStudent,
      guardianName: guardianName ? guardianName.trim() : undefined,
      guardianPhone: guardianPhone ? guardianPhone.trim() : undefined,
      guardianNationalId: guardianId ? guardianId.trim() : undefined,
      profilePhoto: profilePhotoUrl,
      role: "student",
      status: "active",
      preferredLanguage: preferredLanguage === "en" ? "en" : "ar",
    });

    await ensureStudentPublicPortfolioReady(user._id.toString());

    // Create consent record
    await UserConsent.create({
      userId: user._id,
      acceptedTerms: termsAgreed,
      acceptedNotifications: notificationsAgreed,
      acceptedAt: new Date(),
    });

    // Return user data without passwordHash
    const userResponse = {
      id: user._id.toString(),
      fullName: user.fullName,
      email: user.email,
      username: user.username,
      studentId: user.studentId,
      role: user.role,
      status: user.status,
      preferredLanguage: user.preferredLanguage,
      createdAt: user.createdAt,
    };

    queueHomeStatsRefresh();

    return NextResponse.json(
      {
        message: "Registration successful",
        user: userResponse,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Registration error:", error);

    // Handle MongoDB duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return NextResponse.json(
        { error: `User already exists with this ${field}` },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
