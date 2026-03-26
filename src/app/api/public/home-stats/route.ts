import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import Achievement from "@/models/Achievement";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await connectDB();

    const [studentsCount, achievementsCount, fieldsDistinct] = await Promise.all([
      User.countDocuments({ role: { $in: ["student", "Student"] } }),
      Achievement.countDocuments({}),
      Achievement.distinct("inferredField", { inferredField: { $nin: [null, ""] } }),
    ]);

    const fieldsCount = Array.isArray(fieldsDistinct) ? fieldsDistinct.length : 0;

    return NextResponse.json(
      {
        ok: true,
        data: {
          studentsCount,
          achievementsCount,
          fieldsCount,
          awardsCount: 50,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("[GET /api/public/home-stats]", error);
    return NextResponse.json(
      {
        ok: true,
        data: {
          studentsCount: 0,
          achievementsCount: 0,
          fieldsCount: 0,
          awardsCount: 50,
        },
      },
      { status: 200 }
    );
  }
}

