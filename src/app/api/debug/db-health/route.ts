import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB, { getMongoHostForLogs, pingMongo } from "@/lib/mongodb";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = process.env.AUTH_HEALTH_TOKEN?.trim();
  const auth = request.headers.get("authorization")?.trim();
  const expected = token ? `Bearer ${token}` : null;

  const isDev = process.env.NODE_ENV !== "production";
  if (!isDev && token && auth !== expected) {
    return NextResponse.json({ ok: false, code: "FORBIDDEN" }, { status: 403 });
  }

  let ping = false;
  try {
    await connectDB();
    ping = await pingMongo();
  } catch {
    ping = false;
  }

  const uri = process.env.MONGODB_URI?.trim() ?? "";
  const host = uri ? getMongoHostForLogs(uri) : "(unset)";

  return NextResponse.json({
    ok: ping,
    readyState: mongoose.connection.readyState,
    dbName: mongoose.connection.name ?? null,
    host,
    nodeEnv: process.env.NODE_ENV ?? null,
    ping,
  });
}
