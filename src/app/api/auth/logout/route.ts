import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const response = NextResponse.json(
    { message: "Logout successful" },
    { status: 200 }
  );

  const cookieBase = {
    path: "/" as const,
    maxAge: 0,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
  };
  response.cookies.set("userId", "", { ...cookieBase, httpOnly: true });
  response.cookies.set("userEmail", "", { ...cookieBase, httpOnly: true });
  response.cookies.set("userFullName", "", { ...cookieBase, httpOnly: false });

  return response;
}
