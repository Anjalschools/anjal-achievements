import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const response = NextResponse.json(
    { message: "Logout successful" },
    { status: 200 }
  );

  const path = { path: "/" };
  response.cookies.set("userId", "", { ...path, maxAge: 0 });
  response.cookies.set("userEmail", "", { ...path, maxAge: 0 });
  response.cookies.set("userFullName", "", { ...path, maxAge: 0 });

  return response;
}
