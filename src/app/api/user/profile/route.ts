import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getCurrentDbUser } from "@/lib/auth";
import User from "@/models/User";
import { normalizeGrade, getGradeLabel } from "@/constants/grades";
import { perfElapsed, perfLog, perfNow } from "@/lib/perf-debug";

export const dynamic = "force-dynamic";

// GET user profile
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    console.log("[GET /api/user/profile] Fetching current user from session");

    const user = await getCurrentDbUser();

    if (!user) {
      console.log("[GET /api/user/profile] No user found in session");
      return NextResponse.json(
        { error: "Unauthorized - Please login" },
        { status: 401 }
      );
    }

    console.log("[GET /api/user/profile] Found user:", user._id.toString());

    const u = user as unknown as {
      createdAt?: Date;
      lastLoginAt?: Date;
      status?: string;
    };

    return NextResponse.json({
      id: user._id.toString(),
      fullName: user.fullName,
      fullNameAr: user.fullNameAr || user.fullName,
      fullNameEn: user.fullNameEn || "",
      email: user.email,
      username: user.username,
      studentId: user.studentId,
      nationalId: user.nationalId || "",
      gender: user.gender,
      grade: user.grade,
      gradeLabel: getGradeLabel(user.grade, user.preferredLanguage || "ar"),
      section: user.section === "arabic" ? "عربي" : "دولي",
      sectionRaw: user.section,
      phone: user.phone || "",
      guardianName: user.guardianName || "",
      guardianPhone: user.guardianPhone || "",
      guardianNationalId: user.guardianNationalId || "",
      profilePhoto: user.profilePhoto,
      role: user.role,
      preferredLanguage: user.preferredLanguage,
      accountStatus: u.status || "active",
      createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : undefined,
      lastLoginAt: u.lastLoginAt instanceof Date ? u.lastLoginAt.toISOString() : null,
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// UPDATE user profile
export async function PUT(request: NextRequest) {
  try {
    await connectDB();

    const currentUser = await getCurrentDbUser();

    if (!currentUser) {
      return NextResponse.json(
        { error: "Unauthorized - Please login" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { 
      fullName,
      fullNameAr,
      fullNameEn,
      phone, 
      gender, 
      section, 
      grade, 
      guardianName, 
      guardianPhone,
      guardianNationalId,
      preferredLanguage,
      currentPassword,
      newPassword,
      profilePhoto, // Base64 or URL string
    } = body;

    // Ignore immutable fields: email, username, studentId, nationalId
    // These should not be updated through this endpoint

    const updateData: any = {};
    if (fullName) updateData.fullName = fullName.trim();
    if (fullNameAr !== undefined) updateData.fullNameAr = fullNameAr ? fullNameAr.trim() : undefined;
    if (fullNameEn !== undefined) updateData.fullNameEn = fullNameEn ? fullNameEn.trim() : undefined;
    if (phone) updateData.phone = phone.trim();
    if (gender) updateData.gender = gender;
    if (section) updateData.section = section;
    if (grade) {
      const normalized = normalizeGrade(grade);
      updateData.grade = normalized || grade.trim();
    }
    if (guardianName !== undefined) updateData.guardianName = guardianName ? guardianName.trim() : undefined;
    if (guardianPhone !== undefined) updateData.guardianPhone = guardianPhone ? guardianPhone.trim() : undefined;
    if (guardianNationalId !== undefined) updateData.guardianNationalId = guardianNationalId ? guardianNationalId.trim() : undefined;
    if (preferredLanguage) updateData.preferredLanguage = preferredLanguage;
    if (profilePhoto) {
      // If profilePhoto is a base64 string or URL, save it
      updateData.profilePhoto = profilePhoto;
    }

    // Handle password change if provided
    if (newPassword && currentPassword) {
      const bcrypt = await import("bcryptjs");
      const secretRow = await User.findById(currentUser._id).select("passwordHash").lean();
      const currentHash =
        secretRow && typeof (secretRow as { passwordHash?: string }).passwordHash === "string"
          ? (secretRow as { passwordHash: string }).passwordHash
          : "";
      const isPasswordValid = await bcrypt.compare(currentPassword, currentHash);
      if (!isPasswordValid) {
        return NextResponse.json(
          { error: "Current password is incorrect" },
          { status: 400 }
        );
      }
      // Hash new password
      updateData.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    const user = await User.findByIdAndUpdate(
      currentUser._id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select("-passwordHash");

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const uu = user as unknown as {
      createdAt?: Date;
      lastLoginAt?: Date;
      status?: string;
    };

    return NextResponse.json({
      id: user._id.toString(),
      fullName: user.fullName,
      fullNameAr: user.fullNameAr || user.fullName,
      fullNameEn: user.fullNameEn || "",
      email: user.email,
      username: user.username,
      studentId: user.studentId,
      nationalId: user.nationalId || "",
      gender: user.gender,
      grade: user.grade,
      gradeLabel: getGradeLabel(user.grade, user.preferredLanguage || "ar"),
      section: user.section === "arabic" ? "عربي" : "دولي",
      sectionRaw: user.section,
      phone: user.phone || "",
      guardianName: user.guardianName || "",
      guardianPhone: user.guardianPhone || "",
      guardianNationalId: user.guardianNationalId || "",
      profilePhoto: user.profilePhoto,
      role: user.role,
      preferredLanguage: user.preferredLanguage,
      accountStatus: uu.status || "active",
      createdAt: uu.createdAt instanceof Date ? uu.createdAt.toISOString() : undefined,
      lastLoginAt: uu.lastLoginAt instanceof Date ? uu.lastLoginAt.toISOString() : null,
    });
  } catch (error: any) {
    console.error("Error updating user profile:", error);

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
