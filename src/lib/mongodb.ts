import mongoose from "mongoose";
import { perfElapsed, perfLog, perfNow } from "@/lib/perf-debug";

const MONGODB_URI = process.env.MONGODB_URI as string;

if (!MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI environment variable");
}

declare global {
  var mongooseCache:
    | {
        conn: typeof mongoose | null;
        promise: Promise<typeof mongoose> | null;
      }
    | undefined;
}

const cached = global.mongooseCache ?? { conn: null, promise: null };
global.mongooseCache = cached;

export default async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    const t0 = perfNow();
    perfLog("db:connect:start");
    cached.promise = mongoose
      .connect(MONGODB_URI, {
        dbName: "anjal_achievements",
      })
      .then((m) => {
        perfElapsed("db:firstConnect", t0);
        return m;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}