import connectDB from "@/lib/mongodb";
import mongoose from "mongoose";

export type DbHealth = { ok: boolean; latencyMs: number; error?: string };

export const checkMongoHealth = async (): Promise<DbHealth> => {
  const started = Date.now();
  try {
    await connectDB();
    await mongoose.connection.db?.admin().ping();
    return { ok: true, latencyMs: Date.now() - started };
  } catch (e) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: e instanceof Error ? e.message : "ping_failed",
    };
  }
};
