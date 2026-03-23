import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const response = NextResponse.json(
    { message: "Logout successful" },
    { status: 200 }
  );

  // Clear session cookies
  response.cookies.delete("userId");
  response.cookies.delete("userEmail");
  response.cookies.delete("userFullName");

  return response;
}
